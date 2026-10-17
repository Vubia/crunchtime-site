// POST /api/vote  { matchId, side: 'a'|'b' }
// Seyirci oyu: yalnızca o soru için oylama açıkken kabul edilir. matchId burada açık sorunun anahtarıdır
// ("<maç>#<sıra>", durum cevabındaki "voting" alanı). Kimlik /api/voter'ın verdiği imzalı çerezden gelir;
// cihaz başına tek oy, kapanana kadar değiştirilebilir. Soruda süre varsa süre bitince oy kapanır.
import { json, fail, sameOrigin, limited, readVoter } from '../_lib/util.js';
import { readBracket } from '../_lib/bracket.js';

const GRACE_MS = 3000;   // ağ gecikmesi ve 1 sn'lik durum önbelleği için pay

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'Yasak.');
  // Herkes aynı wifi'den gelir: IP sınırı yalnızca sel baskınını keser, asıl sınır kimlik başına.
  if (limited('vote:' + (request.headers.get('cf-connecting-ip') || 'x'), 6000)) return fail(429, 'Çok hızlısın.');

  const voter = await readVoter(request, env);
  if (!voter) return fail(401, 'Oylama kimliği yok. Sayfayı yenile.');
  if (limited('voter:' + voter, 20)) return fail(429, 'Çok hızlısın.');

  let b;
  try { b = await request.json(); } catch { return fail(400, 'Bozuk istek.'); }
  const side = b.side === 'a' || b.side === 'b' ? b.side : null;
  if (!side || typeof b.matchId !== 'string') return fail(400, 'Eksik bilgi.');

  const br = await readBracket(env);
  if (!br || br.voting !== b.matchId) return fail(409, 'Oylama kapalı.');
  if (br.q && br.q.endsAt && Date.now() > br.q.endsAt + GRACE_MS) return fail(409, 'Süre doldu.');

  await env.DB.prepare(
    'INSERT INTO votes (match_id, voter, side, created_at) VALUES (?,?,?,?) ON CONFLICT(match_id, voter) DO UPDATE SET side = excluded.side, created_at = excluded.created_at'
  ).bind(b.matchId, voter, side, Date.now()).run();
  return json({ ok: true, side });
}
