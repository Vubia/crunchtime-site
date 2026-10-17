// /api/admin/*  Kaptan köşkü. Her istek x-admin-token başlığıyla gelmek zorunda.
//   GET  ping | players | settings | export | bracket
//   POST name | photo | settings | survey | bracket | reset
//   DELETE players?id= | photo?id=
import {
  json, fail, clean, sameOrigin, adminGate, getSetting, setSetting, cleanUrl, taskParts,
  DEFAULT_MIN, DEFAULT_ROUNDS, DEFAULT_VOTE_SECS, NO_NAME,
} from '../../_lib/util.js';
import {
  readBracket, saveBracket, writeNewBracket, buildBracket, findMatch, setWinner, clearWinner, nextPlayable,
  resolveRound, rnd, MAX_TIEBREAK,
} from '../../_lib/bracket.js';
import { pickQuestion } from '../../_lib/questions.js';

const MAX_PHOTO_B64 = 900000;   // ~650 KB ikili; istemci zaten ~120 KB'a küçültüyor

const intSetting = async (env, k, d) => {
  const n = parseInt(await getSetting(env, k, String(d)), 10);
  return Number.isFinite(n) ? n : d;
};

export async function onRequest({ request, env, params }) {
  const gate = await adminGate(request, env);
  if (gate !== true) return gate;
  if (request.method !== 'GET' && !sameOrigin(request)) return fail(403, 'Yasak.');

  const route = (Array.isArray(params.route) ? params.route : [params.route]).join('/');
  const url = new URL(request.url);
  const method = request.method;

  try {
    if (route === 'ping') return json({ ok: true });

    // ---- oyuncu listesi (oyuncunun yazdığı ad ve karakter adı dahil; telefon zaten hiç saklanmaz)
    if (route === 'players' && method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT p.id, p.name, p.char_name, p.name_locked, p.prompt, p.twist, p.created_at, ph.updated_at AS photo_v
         FROM players p LEFT JOIN photos ph ON ph.player_id = p.id ORDER BY p.created_at DESC`
      ).all();
      return json({ ok: true, serverNow: Date.now(), players: results });
    }
    if (route === 'players' && method === 'DELETE') {
      const id = (url.searchParams.get('id') || '').toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(id)) return fail(400, 'Kimlik geçersiz.');
      await env.DB.batch([
        env.DB.prepare('DELETE FROM photos WHERE player_id = ?').bind(id),
        env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }

    // ---- karakter adına müdahale: küfür, yanlış yazım ya da sayfayı kapatıp adını veremeyen oyuncu için.
    // Yönetici dokununca ad kilitlenir (oyuncu telefondan geri değiştiremez). Boş ad = adı sil.
    if (route === 'name' && method === 'POST') {
      const b = await request.json();
      const id = String(b.id || '').toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(id)) return fail(400, 'Kimlik geçersiz.');
      const nm = clean(b.name, 24);
      if (nm && nm.length < 2) return fail(400, 'Ad en az 2 harf olmalı.');
      const r = await env.DB.prepare('UPDATE players SET char_name = ?, name_locked = 1 WHERE id = ?').bind(nm || null, id).run();
      if (!r.meta.changes) return fail(404, `${id} kimlikli oyuncu yok.`);
      // Ağaç kurulmuşsa ekrandaki ad da hemen güncellensin.
      const br = await readBracket(env);
      if (br && br.fighters && br.fighters[id]) {
        br.fighters[id].name = nm || NO_NAME;
        if (!(await saveBracket(env, br))) return fail(409, 'Ağaç aynı anda değişti, adı bir daha kaydet.');
      }
      return json({ ok: true, id, charName: nm });
    }

    // ---- fotoğraf yükle / sil
    if (route === 'photo' && method === 'POST') {
      const b = await request.json();
      const id = String(b.id || '').toUpperCase();
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
      if (!/^[A-Z0-9]{4}$/.test(id) || !m) return fail(400, 'Fotoğraf ya da kimlik geçersiz.');
      if (m[2].length > MAX_PHOTO_B64) return fail(413, 'Fotoğraf çok büyük.');
      const exists = await env.DB.prepare('SELECT 1 AS x FROM players WHERE id = ?').bind(id).first();
      if (!exists) return fail(404, `${id} kimlikli oyuncu yok.`);
      const v = Date.now();
      await env.DB.prepare(
        'INSERT INTO photos (player_id, mime, data, updated_at) VALUES (?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at'
      ).bind(id, m[1], m[2], v).run();
      return json({ ok: true, id, v });
    }
    if (route === 'photo' && method === 'DELETE') {
      const id = (url.searchParams.get('id') || '').toUpperCase();
      await env.DB.prepare('DELETE FROM photos WHERE player_id = ?').bind(id).run();
      return json({ ok: true });
    }

    // ---- ayarlar
    if (route === 'settings' && method === 'GET') {
      const c = await env.DB.prepare(
        'SELECT (SELECT COUNT(*) FROM players) AS players, (SELECT COUNT(*) FROM photos) AS photos'
      ).first();
      return json({
        ok: true,
        durationMin: await intSetting(env, 'duration_min', DEFAULT_MIN),
        roundsPerMatch: await intSetting(env, 'rounds_per_match', DEFAULT_ROUNDS),
        voteSecs: await intSetting(env, 'vote_secs', DEFAULT_VOTE_SECS),
        surveyUrl: await getSetting(env, 'survey_url', ''),
        surveyOn: (await getSetting(env, 'survey_on', '0')) === '1',
        ...c,
      });
    }
    if (route === 'settings' && method === 'POST') {
      const b = await request.json();
      const todo = [];
      if (b.durationMin !== undefined) {
        const n = parseInt(b.durationMin, 10);
        if (!(n >= 1 && n <= 180)) return fail(400, 'Çizim süresi 1 ile 180 dakika arasında olmalı.');
        todo.push(['duration_min', n]);
      }
      if (b.roundsPerMatch !== undefined) {
        const n = parseInt(b.roundsPerMatch, 10);
        if (!(n >= 1 && n <= 9)) return fail(400, 'Maç başına soru sayısı 1 ile 9 arasında olmalı.');
        todo.push(['rounds_per_match', n]);
      }
      if (b.voteSecs !== undefined) {
        const n = parseInt(b.voteSecs, 10);
        if (!(n === 0 || (n >= 5 && n <= 300))) return fail(400, 'Oy süresi 5 ile 300 saniye arasında olmalı (0 = elle kapat).');
        todo.push(['vote_secs', n]);
      }
      if (b.surveyUrl !== undefined) {
        const u = cleanUrl(b.surveyUrl);
        if (u === null) return fail(400, 'Anket bağlantısı https:// ile başlayan geçerli bir adres olmalı.');
        todo.push(['survey_url', u]);
        if (!u) todo.push(['survey_on', '0']);   // adres silindiyse anket QR'ı da kapanır
      }
      for (const [k, v] of todo) await setSetting(env, k, v);
      return json({ ok: true });
    }

    // ---- anket QR'ını arenada ve oylama ekranlarında göster / gizle
    if (route === 'survey' && method === 'POST') {
      const b = await request.json();
      const on = !!b.on;
      if (on && !(await getSetting(env, 'survey_url', ''))) return fail(400, 'Önce Ayarlar bölümüne anket bağlantısını yaz.');
      await setSetting(env, 'survey_on', on ? '1' : '0');
      return json({ ok: true, on });
    }

    // ---- CSV (ad, karakter adı, görev; telefon yok)
    if (route === 'export' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM players ORDER BY created_at').all();
      // Hücre "=" "+" "-" "@" ile başlarsa Excel formül sanar; başına kesme koyup etkisizleştiriyoruz.
      const cell = v => {
        let s = String(v ?? '');
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      const rows = [['ID', 'Ad', 'Karakter adı', 'Görev', 'Ek şart', 'Kayıt zamanı']];
      for (const p of results) {
        rows.push([p.id, p.name, p.char_name, p.prompt, p.twist,
          new Date(p.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })]);
      }
      const csv = '\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n');
      return new Response(csv, {
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="crunchtime-kayitlar.csv"', 'cache-control': 'no-store' },
      });
    }

    // ---- turnuva
    if (route === 'bracket' && method === 'GET') return json(await adminBracketState(env));
    if (route === 'bracket' && method === 'POST') return await bracketAction(env, await request.json());

    // ---- tehlikeli bölge
    if (route === 'reset' && method === 'POST') {
      const b = await request.json();
      if (b.confirm !== 'SIL') return fail(400, 'Onay kelimesi eksik.');
      if (b.what === 'players') {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM photos'), env.DB.prepare('DELETE FROM players'),
          env.DB.prepare('DELETE FROM votes'), env.DB.prepare("DELETE FROM kv WHERE k = 'bracket'"),
        ]);
      } else if (b.what === 'bracket') {
        await env.DB.batch([env.DB.prepare('DELETE FROM votes'), env.DB.prepare("DELETE FROM kv WHERE k = 'bracket'")]);
      } else return fail(400, 'Ne silinecek?');
      return json({ ok: true });
    }

    return fail(404, 'Böyle bir kapı yok.');
  } catch (e) {
    return fail(500, 'Sunucu tökezledi: ' + (e && e.message ? e.message : e));
  }
}

async function adminBracketState(env) {
  const br = await readBracket(env);
  const c = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM players) AS players, (SELECT COUNT(*) FROM photos) AS photos,
            (SELECT COUNT(*) FROM players p JOIN photos ph ON ph.player_id = p.id WHERE p.char_name IS NULL OR p.char_name = '') AS unnamed`
  ).first();
  let live = null;
  if (br && br.voting) {
    const { results } = await env.DB.prepare('SELECT side, COUNT(*) AS n FROM votes WHERE match_id = ? GROUP BY side').bind(br.voting).all();
    live = { a: 0, b: 0 };
    for (const r of results) live[r.side] = r.n;
  }
  const surveyUrl = await getSetting(env, 'survey_url', '');
  const surveyOn = (await getSetting(env, 'survey_on', '0')) === '1';
  return {
    ok: true, serverNow: Date.now(), bracket: br, live,
    players: c.players, photos: c.photos, unnamed: c.unnamed,
    of: await intSetting(env, 'rounds_per_match', DEFAULT_ROUNDS),
    survey: { on: surveyOn && !!surveyUrl, hasUrl: !!surveyUrl },
  };
}

async function bracketAction(env, body) {
  const action = body.action;
  let br = await readBracket(env);

  if (action === 'build') {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.char_name, p.prompt, p.task_short, p.twist_short, ph.updated_at AS v
       FROM players p JOIN photos ph ON ph.player_id = p.id ORDER BY p.id`
    ).all();
    let list = results;
    if (Array.isArray(body.ids) && body.ids.length) {
      const want = new Set(body.ids.map(x => String(x).toUpperCase()));
      list = list.filter(x => want.has(x.id));
    }
    if (list.length < 2) return fail(400, 'Turnuva için en az 2 fotoğraflı dövüşçü lazım.');
    if (list.length > 64) return fail(400, 'En fazla 64 dövüşçü.');
    const gen = parseInt(await getSetting(env, 'bracket_gen', '0'), 10) + 1;
    await setSetting(env, 'bracket_gen', gen);
    const fighters = list.map(x => ({ id: x.id, name: x.char_name || NO_NAME, v: x.v, task: taskParts(x) }));
    br = buildBracket(fighters, gen, await intSetting(env, 'rounds_per_match', DEFAULT_ROUNDS));
    await env.DB.prepare('DELETE FROM votes').run();   // eski ağaçtan kalan oylar kalmasın
    await writeNewBracket(env, br);
    return json(await adminBracketState(env));
  }

  if (action === 'reset') {
    await env.DB.batch([env.DB.prepare('DELETE FROM votes'), env.DB.prepare("DELETE FROM kv WHERE k = 'bracket'")]);
    return json(await adminBracketState(env));
  }

  if (!br) return fail(400, 'Önce turnuva ağacını oluştur.');
  // Açık soru sessizce kaybolmasın: kapanana kadar yalnızca ekran değiştirilebilir.
  if (br.voting && action !== 'view' && action !== 'close') return fail(409, 'Soru açık. Önce SORUYU KAPAT ile bitir.');

  if (action === 'view') {
    if (!['bracket', 'stage', 'champion'].includes(body.view)) return fail(400, 'Görünüm geçersiz.');
    br.view = body.view;
  } else if (action === 'next') {
    const m = nextPlayable(br);
    if (!m) return fail(400, br.champion ? 'Turnuva bitti, şampiyon belli.' : 'Oynanacak maç kalmadı.');
    br.current = m.id; br.view = 'stage';
  } else if (action === 'current') {
    const f = findMatch(br, body.matchId);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Bu maç şu an oynanamaz.');
    br.current = f.m.id; br.view = 'stage';
  } else if (action === 'ask') {
    // Yeni soru: seyirci iki çizimden birini seçer. Gizli kural (çok oy mu az oy mu can kaybeder) zarla belirlenir.
    const f = findMatch(br, br.current);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Önce SIRADAKİ MAÇ ile oynanabilir bir maç seç.');
    const m = f.m;
    const of = await intSetting(env, 'rounds_per_match', DEFAULT_ROUNDS);
    const secs = await intSetting(env, 'vote_secs', DEFAULT_VOTE_SECS);
    const tbDone = m.log.filter(x => x.tb).length;
    const tb = (m.log.length - tbDone) >= of;
    const n = m.log.length + 1;
    let text = clean(body.text, 90);
    if (text && text.length < 5) return fail(400, 'Soru çok kısa.');
    if (!text) { const p = pickQuestion(br.used || []); text = p.text; br.used = p.used; }
    // Kural dışarıdan verilebilir (deneme için); panel göndermez, boşsa zar atılır.
    const mode = body.mode === 'most' || body.mode === 'least' ? body.mode : (rnd(2) === 0 ? 'most' : 'least');
    const key = `${m.id}#${n}`;
    await env.DB.prepare('DELETE FROM votes WHERE match_id = ?').bind(key).run();
    br.voting = key;
    br.of = of;
    br.q = {
      matchId: m.id, n, text, mode, tb, of,
      tbNo: tb ? tbDone + 1 : 0, tbOf: MAX_TIEBREAK,
      secs, endsAt: secs > 0 ? Date.now() + secs * 1000 : null,
    };
    br.view = 'stage';
  } else if (action === 'close') {
    if (!br.voting || !br.q) return fail(400, 'Açık soru yok.');
    const { results } = await env.DB.prepare('SELECT side, COUNT(*) AS n FROM votes WHERE match_id = ? GROUP BY side').bind(br.voting).all();
    const t = { a: 0, b: 0 };
    for (const r of results) if (r.side === 'a' || r.side === 'b') t[r.side] = r.n;
    resolveRound(br, t.a, t.b);
  } else if (action === 'rng') {
    // Hızlı yol: sorusuz, zarla bitir.
    const f = findMatch(br, body.matchId || br.current);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Önce oynanabilir bir maç seç (Sıradaki Maç).');
    const side = rnd(2) === 0 ? 'a' : 'b';
    setWinner(br, f.r, f.i, side, 'rng');
    br.current = f.m.id; br.view = 'stage';
    br.last = { type: 'result', matchId: f.m.id, side, how: 'rng', at: Date.now() };
  } else if (action === 'set_winner') {
    const f = findMatch(br, body.matchId || br.current);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Bu maç için kazanan seçilemez.');
    if (body.side !== 'a' && body.side !== 'b') return fail(400, 'Taraf geçersiz.');
    setWinner(br, f.r, f.i, body.side, 'manual');
    br.current = f.m.id; br.view = 'stage';
    br.last = { type: 'result', matchId: f.m.id, side: body.side, how: 'manual', at: Date.now() };
  } else if (action === 'undo') {
    // En son dokunulan maçı başa sarar: canlar 100'e döner, tur günlüğü silinir, kazanan geri alınır.
    const id = body.matchId || (br.last && br.last.matchId) || br.current;
    const f = id ? findMatch(br, id) : null;
    if (!f || !clearWinner(br, f.r, f.i)) return fail(400, 'Geri alınamadı (üst turdaki maç başlamış olabilir).');
    await env.DB.prepare('DELETE FROM votes WHERE match_id LIKE ?').bind(`${f.m.id}#%`).run();
    br.current = f.m.id; br.view = 'stage';
    br.last = { type: 'undo', matchId: f.m.id, at: Date.now() };
  } else {
    return fail(400, 'Bilinmeyen eylem.');
  }

  if (!(await saveBracket(env, br))) return fail(409, 'Başka bir cihaz aynı anda değiştirdi. Ekran yenilendi, tekrar dene.');
  return json(await adminBracketState(env));
}
