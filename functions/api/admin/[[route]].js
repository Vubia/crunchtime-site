// /api/admin/*  Kaptan köşkü. Her istek x-admin-token başlığıyla gelmek zorunda.
//   GET  ping | players | settings | export | bracket
//   POST photo | settings | bracket | reset
//   DELETE players?id= | photo?id=
import { json, fail, clean, sameOrigin, adminGate, getSetting, setSetting, DEFAULT_MIN } from '../../_lib/util.js';
import {
  readBracket, saveBracket, writeNewBracket, buildBracket, findMatch, setWinner, clearWinner, nextPlayable, rnd,
} from '../../_lib/bracket.js';

const MAX_PHOTO_B64 = 900000;   // ~650 KB ikili; istemci zaten ~120 KB'a küçültüyor

export async function onRequest({ request, env, params }) {
  const gate = await adminGate(request, env);
  if (gate !== true) return gate;
  if (request.method !== 'GET' && !sameOrigin(request)) return fail(403, 'Yasak.');

  const route = (Array.isArray(params.route) ? params.route : [params.route]).join('/');
  const url = new URL(request.url);
  const method = request.method;

  try {
    if (route === 'ping') return json({ ok: true });

    // ---- oyuncu listesi (telefon dahil: yalnızca burada görünür)
    if (route === 'players' && method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT p.id, p.first_name, p.last_name, p.phone, p.prompt, p.twist, p.created_at, ph.updated_at AS photo_v
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
      return json({ ok: true, durationMin: parseInt(await getSetting(env, 'duration_min', String(DEFAULT_MIN)), 10), ...c });
    }
    if (route === 'settings' && method === 'POST') {
      const b = await request.json();
      const mins = parseInt(b.durationMin, 10);
      if (!(mins >= 1 && mins <= 180)) return fail(400, 'Süre 1 ile 180 dakika arasında olmalı.');
      await setSetting(env, 'duration_min', mins);
      return json({ ok: true, durationMin: mins });
    }

    // ---- CSV (Google Forms anketi için ad, soyad, telefon + görev)
    if (route === 'export' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM players ORDER BY created_at').all();
      // Hücre "=" "+" "-" "@" ile başlarsa Excel formül sanar; başına kesme koyup etkisizleştiriyoruz.
      const cell = (v, raw) => {
        let s = String(v ?? '');
        if (!raw && /^[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      const rows = [['ID', 'Ad', 'Soyad', 'Telefon', 'Görev', 'Ek şart', 'Kayıt zamanı']];
      for (const p of results) {
        rows.push([p.id, p.first_name, p.last_name, p.phone, p.prompt, p.twist,
          new Date(p.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })]);
      }
      const csv = '\ufeff' + rows.map(r => r.map((v, i) => cell(v, i === 3)).join(',')).join('\r\n');
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
    'SELECT (SELECT COUNT(*) FROM players) AS players, (SELECT COUNT(*) FROM photos) AS photos'
  ).first();
  let live = null;
  if (br && br.voting) {
    const { results } = await env.DB.prepare('SELECT side, COUNT(*) AS n FROM votes WHERE match_id = ? GROUP BY side').bind(br.voting).all();
    live = { a: 0, b: 0 };
    for (const r of results) live[r.side] = r.n;
  }
  return { ok: true, serverNow: Date.now(), bracket: br, live, players: c.players, photos: c.photos };
}

function resultEvent(matchId, side, how) {
  return { type: 'result', matchId, side, how, at: Date.now() };
}

async function bracketAction(env, body) {
  const action = body.action;
  let br = await readBracket(env);

  if (action === 'build') {
    const { results } = await env.DB.prepare(
      'SELECT p.id, p.first_name, p.last_name, ph.updated_at AS v FROM players p JOIN photos ph ON ph.player_id = p.id ORDER BY p.id'
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
    const fighters = list.map(x => ({ id: x.id, name: `${x.first_name} ${x.last_name.charAt(0)}.`, v: x.v }));
    br = buildBracket(fighters, gen);
    await writeNewBracket(env, br);
    return json(await adminBracketState(env));
  }

  if (action === 'reset') {
    await env.DB.batch([env.DB.prepare('DELETE FROM votes'), env.DB.prepare("DELETE FROM kv WHERE k = 'bracket'")]);
    return json(await adminBracketState(env));
  }

  if (!br) return fail(400, 'Önce turnuva ağacını oluştur.');
  // Açık oylama sessizce kaybolmasın: kapanana kadar yalnızca ekran değiştirilebilir.
  if (br.voting && action !== 'view' && action !== 'vote_close') return fail(409, 'Oylama açık. Önce OYLAMAYI KAPAT ile bitir.');

  if (action === 'view') {
    if (!['bracket', 'stage', 'champion'].includes(body.view)) return fail(400, 'Görünüm geçersiz.');
    br.view = body.view;
  } else if (action === 'next') {
    const m = nextPlayable(br);
    if (!m) return fail(400, br.champion ? 'Turnuva bitti, şampiyon belli.' : 'Oynanacak maç kalmadı.');
    br.current = m.id; br.voting = null; br.view = 'stage';
  } else if (action === 'current') {
    const f = findMatch(br, body.matchId);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Bu maç şu an oynanamaz.');
    br.current = f.m.id; br.voting = null; br.view = 'stage';
  } else if (action === 'rng' || action === 'vote_open') {
    const f = findMatch(br, body.matchId || br.current);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Önce oynanabilir bir maç seç (Sıradaki Maç).');
    if (action === 'rng') {
      const side = rnd(2) === 0 ? 'a' : 'b';
      setWinner(br, f.r, f.i, side, 'rng');
      br.current = f.m.id; br.voting = null; br.view = 'stage';
      br.last = resultEvent(f.m.id, side, 'rng');
    } else {
      await env.DB.prepare('DELETE FROM votes WHERE match_id = ?').bind(f.m.id).run();
      br.current = f.m.id; br.voting = f.m.id; br.view = 'stage';
    }
  } else if (action === 'vote_close') {
    const f = br.voting ? findMatch(br, br.voting) : null;
    if (!f) return fail(400, 'Açık oylama yok.');
    const { results } = await env.DB.prepare('SELECT side, COUNT(*) AS n FROM votes WHERE match_id = ? GROUP BY side').bind(f.m.id).all();
    const tally = { a: 0, b: 0 };
    for (const r of results) tally[r.side] = r.n;
    let side = tally.a > tally.b ? 'a' : tally.b > tally.a ? 'b' : null;
    let how = 'vote';
    if (!side) { side = rnd(2) === 0 ? 'a' : 'b'; how = 'vote-tie'; }   // beraberlikte zar karar verir
    f.m.votesA = tally.a; f.m.votesB = tally.b;
    setWinner(br, f.r, f.i, side, how);
    br.voting = null; br.view = 'stage';
    br.last = resultEvent(f.m.id, side, how);
  } else if (action === 'set_winner') {
    const f = findMatch(br, body.matchId || br.current);
    if (!f || !f.m.a || !f.m.b || f.m.winner) return fail(400, 'Bu maç için kazanan seçilemez.');
    if (body.side !== 'a' && body.side !== 'b') return fail(400, 'Taraf geçersiz.');
    setWinner(br, f.r, f.i, body.side, 'manual');
    br.current = f.m.id; br.voting = null; br.view = 'stage';
    br.last = resultEvent(f.m.id, body.side, 'manual');
  } else if (action === 'undo') {
    const id = body.matchId || (br.last && br.last.matchId);
    const f = id ? findMatch(br, id) : null;
    if (!f || !clearWinner(br, f.r, f.i)) return fail(400, 'Geri alınamadı (üst turdaki maç oynanmış olabilir).');
    br.current = f.m.id; br.voting = null; br.view = 'stage';
    br.last = { type: 'undo', matchId: f.m.id, at: Date.now() };
  } else {
    return fail(400, 'Bilinmeyen eylem.');
  }

  if (!(await saveBracket(env, br))) return fail(409, 'Başka bir cihaz aynı anda değiştirdi. Ekran yenilendi, tekrar dene.');
  return json(await adminBracketState(env));
}
