// POST /api/vote  { matchId, side: 'a'|'b', voter }
// Seyirci oyu: yalnızca oylama o maç için açıkken kabul edilir. Cihaz başına tek oy, kapanana kadar değiştirilebilir.
import { json, fail, sameOrigin, limited } from '../_lib/util.js';
import { readBracket } from '../_lib/bracket.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'Yasak.');
  if (limited('vote:' + (request.headers.get('cf-connecting-ip') || 'x'), 240)) return fail(429, 'Çok hızlısın.');

  let b;
  try { b = await request.json(); } catch { return fail(400, 'Bozuk istek.'); }
  const side = b.side === 'a' || b.side === 'b' ? b.side : null;
  const voter = typeof b.voter === 'string' && /^[a-z0-9]{8,32}$/.test(b.voter) ? b.voter : null;
  if (!side || !voter || typeof b.matchId !== 'string') return fail(400, 'Eksik bilgi.');

  const br = await readBracket(env);
  if (!br || br.voting !== b.matchId) return fail(409, 'Oylama kapalı.');

  await env.DB.prepare(
    'INSERT INTO votes (match_id, voter, side, created_at) VALUES (?,?,?,?) ON CONFLICT(match_id, voter) DO UPDATE SET side = excluded.side, created_at = excluded.created_at'
  ).bind(b.matchId, voter, side, Date.now()).run();
  return json({ ok: true, side });
}
