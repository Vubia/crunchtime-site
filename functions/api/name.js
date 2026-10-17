// POST /api/name  { id, name }
// Çizim bitince oyuncu karakterine bir ad (takma ad) verir.
// Yönetici o ada dokunduysa (name_locked) oyuncu artık değiştiremez; turnuva ağacı kurulduysa da kapı kapanır.
// Sayfayı yanlışlıkla kapatan oyuncunun adını yönetici panelden girer.
import { json, fail, clean, sameOrigin, limited, NO_NAME } from '../_lib/util.js';
import { readBracket } from '../_lib/bracket.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'Yasak.');
  if (limited('name:' + (request.headers.get('cf-connecting-ip') || 'x'), 300)) return fail(429, 'Çok hızlısın.');

  let b;
  try { b = await request.json(); } catch { return fail(400, 'Bozuk istek.'); }
  const id = String(b.id || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(id)) return fail(400, 'Kimlik geçersiz.');
  if (limited('name:' + id, 12)) return fail(429, 'Çok hızlısın.');
  const name = clean(b.name, 24);
  if (name.length < 2) return fail(400, 'Karakterin adı en az 2 harf olmalı.');

  const row = await env.DB.prepare('SELECT id, char_name, name_locked FROM players WHERE id = ?').bind(id).first();
  if (!row) return fail(404, 'Kayıt bulunamadı.');
  if (row.name_locked) return json({ ok: false, error: 'Karakterinin adını yönetici belirledi.', charName: row.char_name || NO_NAME, locked: true }, 403);

  const br = await readBracket(env);
  if (br && br.fighters && br.fighters[id]) return fail(409, 'Turnuva başladı, ad artık değişmez.');

  await env.DB.prepare('UPDATE players SET char_name = ? WHERE id = ?').bind(name, id).run();
  return json({ ok: true, charName: name });
}
