// POST /api/register  { name }
// Gişe burası: tek kutudan ad gelir, 4 haneli kimlik ve görev çıkar, hepsi D1'e yazılır.
// Telefon, soyad ya da başka kişisel bilgi sorulmaz ve saklanmaz.
import { json, fail, clean, sameOrigin, limited, getSetting, playerView, DEFAULT_MIN } from '../_lib/util.js';
import { makeMission } from '../_lib/prompts.js';

// 0/O ve 1/I karışmasın diye çıkarılmış 32 harflik alfabe (32 olunca modulo sapması da olmaz).
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newId() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return Array.from(b, x => ALPHA[x & 31]).join('');
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'Yasak.');
  // Etkinlikte herkes aynı wifi'den girer; sınır bol tutuldu, yalnızca bot yağmurunu keser.
  if (limited('reg:' + (request.headers.get('cf-connecting-ip') || 'x'), 120)) return fail(429, 'Yavaş ol şampiyon, biraz sonra tekrar dene.');

  let body;
  try { body = await request.json(); } catch { return fail(400, 'Bozuk istek.'); }

  const name = clean(body.name, 40);
  if (name.length < 2) return fail(400, 'Adını yaz (en az 2 harf).');

  const duration = parseInt(await getSetting(env, 'duration_min', String(DEFAULT_MIN)), 10) || DEFAULT_MIN;
  const m = makeMission();
  const now = Date.now();

  for (let tries = 0; tries < 12; tries++) {
    const id = newId();
    try {
      await env.DB.prepare(
        'INSERT INTO players (id, name, prompt, twist, task_short, twist_short, duration_min, created_at) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(id, name, m.prompt, m.twist, m.taskShort, m.twistShort, duration, now).run();
      const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
      return json({ ok: true, player: playerView(row) });
    } catch (e) {
      // Aynı kimlik denk geldiyse yeni zar at; başka türlü bir hata varsa döngüye sokmadan bildir.
      if (!/UNIQUE|constraint/i.test(String(e && e.message))) return fail(500, 'Kayıt yazılamadı.');
    }
  }
  return fail(500, 'Kimlik üretilemedi, bir daha dene.');
}
