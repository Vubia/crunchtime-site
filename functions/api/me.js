// GET /api/me?id=R7X2  -> oyuncunun kendi görev + sayaç bilgisi (sayfa yenilenince kaldığı yerden devam eder).
import { json, fail, playerView } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const id = (new URL(request.url).searchParams.get('id') || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(id)) return fail(400, 'Kimlik geçersiz.');
  const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (!row) return fail(404, 'Kayıt bulunamadı.');
  return json({ ok: true, player: playerView(row) });
}
