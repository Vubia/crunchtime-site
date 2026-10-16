// GET /api/photo?id=R7X2&v=<sürüm> -> çizim fotoğrafı (D1'de base64 tutulur, burada ikiliye çevrilir).
// "v" sürüm numarası verilirse tarayıcı sonsuza kadar önbelleğe alır; fotoğraf değişince v de değişir.
import { fail } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(id)) return fail(400, 'Kimlik geçersiz.');
  const row = await env.DB.prepare('SELECT mime, data, updated_at FROM photos WHERE player_id = ?').bind(id).first();
  if (!row) return new Response('yok', { status: 404 });

  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const versioned = url.searchParams.get('v') === String(row.updated_at);
  return new Response(bytes, {
    headers: {
      'content-type': row.mime,
      'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=30',
    },
  });
}
