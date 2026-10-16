// POST /api/register  { first, last, phone }
// Gişe burası: isim + telefon gelir, 4 haneli kimlik ve görev çıkar, hepsi D1'e yazılır.
// Aynı telefon ikinci kez gelirse yeni görev VERİLMEZ, eski kayıt aynen döner (zar yeniden atılamaz).
import { json, fail, clean, sameOrigin, limited, getSetting, playerView, DEFAULT_MIN } from '../_lib/util.js';
import { makeMission } from '../_lib/prompts.js';

// 0/O ve 1/I karışmasın diye çıkarılmış 32 harflik alfabe (32 olunca modulo sapması da olmaz).
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newId() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return Array.from(b, x => ALPHA[x & 31]).join('');
}

function normPhone(raw) {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  const tr = digits.match(/^(?:0090|90|0)?(5\d{9})$/);
  const phone = tr ? '+90' + tr[1] : (s.startsWith('+') ? '+' : '') + digits;
  return { phone, key: digits.slice(-10) };
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'Yasak.');
  // Etkinlikte herkes aynı wifi'den girer; sınır bol tutuldu, yalnızca bot yağmurunu keser.
  if (limited('reg:' + (request.headers.get('cf-connecting-ip') || 'x'), 120)) return fail(429, 'Yavaş ol şampiyon, biraz sonra tekrar dene.');

  let body;
  try { body = await request.json(); } catch { return fail(400, 'Bozuk istek.'); }

  const first = clean(body.first, 40);
  const last = clean(body.last, 40);
  const ph = normPhone(body.phone);
  if (first.length < 2) return fail(400, 'Adını yaz (en az 2 harf).');
  if (last.length < 2) return fail(400, 'Soyadını yaz (en az 2 harf).');
  if (!ph) return fail(400, 'Telefon numarası geçersiz. Örnek: 05xx xxx xx xx');

  const existing = await env.DB.prepare('SELECT * FROM players WHERE phone_key = ?').bind(ph.key).first();
  if (existing) return json({ ok: true, returning: true, player: playerView(existing) });

  const duration = parseInt(await getSetting(env, 'duration_min', String(DEFAULT_MIN)), 10) || DEFAULT_MIN;
  const { prompt, twist } = makeMission();
  const now = Date.now();

  for (let tries = 0; tries < 12; tries++) {
    const id = newId();
    try {
      await env.DB.prepare(
        'INSERT INTO players (id, first_name, last_name, phone, phone_key, prompt, twist, duration_min, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(id, first, last, ph.phone, ph.key, prompt, twist, duration, now).run();
      const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
      return json({ ok: true, returning: false, player: playerView(row) });
    } catch (e) {
      // Aynı kimlik ya da aynı anda gelen aynı telefon: yeniden dene / var olanı ver.
      const again = await env.DB.prepare('SELECT * FROM players WHERE phone_key = ?').bind(ph.key).first();
      if (again) return json({ ok: true, returning: true, player: playerView(again) });
    }
  }
  return fail(500, 'Kimlik üretilemedi, bir daha dene.');
}
