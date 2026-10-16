// GET /api/photo?id=R7X2&v=<sürüm> -> çizim fotoğrafı (D1'de base64 tutulur, burada ikiliye çevrilir).
// "v" sürüm numarası verilirse tarayıcı sonsuza kadar önbelleğe alır; fotoğraf değişince v de değişir.
// Sürümlü fotoğraf edge önbelleğinde de 6 saat durur: yüzlerce telefon aynı iki çizimi isterken D1'e bir kez gidilir.
import { fail } from '../_lib/util.js';

const EDGE_SEC = 6 * 3600;

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(id)) return fail(400, 'Kimlik geçersiz.');
  const v = url.searchParams.get('v') || '';

  const cache = typeof caches !== 'undefined' && /^\d+$/.test(v) ? caches.default : null;
  const key = cache && new Request(new URL(`/api/photo?id=${id}&v=${v}`, request.url));
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: { 'content-type': hit.headers.get('content-type'), 'cache-control': 'public, max-age=31536000, immutable' } });
  }

  const row = await env.DB.prepare('SELECT mime, data, updated_at FROM photos WHERE player_id = ?').bind(id).first();
  if (!row) return new Response('yok', { status: 404 });

  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const versioned = v === String(row.updated_at);
  if (versioned && cache) {
    waitUntil(cache.put(key, new Response(bytes.slice(), { headers: { 'content-type': row.mime, 'cache-control': `public, max-age=${EDGE_SEC}` } })));
  }
  return new Response(bytes, {
    headers: {
      'content-type': row.mime,
      'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=30',
    },
  });
}
