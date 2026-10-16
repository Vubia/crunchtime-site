// GET /api/voter -> seyirci çerezini verir (zaten geçerli bir çerez varsa dokunmaz).
// Oylama sayfası açılırken bir kez çağrılır; oy ancak bu çerezle verilebilir.
import { json, fail, limited, readVoter, mintVoter } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  if (await readVoter(request, env)) return json({ ok: true });
  // Kimlik basmak ucuz olmasın; sınır yine de QR ekrana gelince aynı wifi'den gelen ~1000 kişiyi kesmeyecek kadar bol.
  if (limited('mint:' + (request.headers.get('cf-connecting-ip') || 'x'), 3000)) return fail(429, 'Çok hızlısın, biraz sonra tekrar dene.');
  const v = await mintVoter(env);
  if (!v) return fail(503, 'Oylama anahtarı kurulmamış.');
  return json({ ok: true }, 200, { 'set-cookie': v.cookie });
}
