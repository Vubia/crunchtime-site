// GET /api/state -> arena ve oylama ekranlarının okuduğu herkese açık turnuva durumu.
// Telefon, soyad, görev yok; sadece kimlik + ad + soyadın baş harfi çıkar.
// Salondaki yüzlerce telefon aynı cevabı ister: cevap edge önbelleğinde 1 sn tutulur, D1'e saniyede ~1 sorgu gider.
import { json } from '../_lib/util.js';
import { readBracket, publicBracket } from '../_lib/bracket.js';

const CACHE_SEC = 1;

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL('/api/state', request.url));
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return json(await hit.json());
  }

  const br = await readBracket(env);
  let voteTotal = 0;
  if (br && br.voting) {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE match_id = ?').bind(br.voting).first();
    voteTotal = r ? r.n : 0;
  }
  const body = { ok: true, serverNow: Date.now(), voteTotal, bracket: publicBracket(br) };
  // Tarayıcıya no-store gider; önbelleğe konan kopya yalnızca 1 sn yaşar.
  if (cache) waitUntil(cache.put(key, json(body, 200, { 'cache-control': `public, max-age=${CACHE_SEC}` })));
  return json(body);
}
