// GET /api/state -> arena ve oylama ekranlarının okuduğu herkese açık turnuva durumu.
// Telefon, soyad, görev yok; sadece kimlik + ad + soyadın baş harfi çıkar.
import { json } from '../_lib/util.js';
import { readBracket, publicBracket } from '../_lib/bracket.js';

export async function onRequestGet({ env }) {
  const br = await readBracket(env);
  let voteTotal = 0;
  if (br && br.voting) {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE match_id = ?').bind(br.voting).first();
    voteTotal = r ? r.n : 0;
  }
  return json({ ok: true, serverNow: Date.now(), voteTotal, bracket: publicBracket(br) });
}
