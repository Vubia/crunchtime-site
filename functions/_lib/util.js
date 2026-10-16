// Ortak alet çantası. Güverte temiz, halat sağlam: her kapıdan giren iş önce buradan geçer.

export const INTRO_MS = 8000;   // "3-2-1 FIGHT" giriş sahnesi; istemci bu sayıyı sunucudan okur
export const DEFAULT_MIN = 15;  // sayaç süresi (dakika), panelden değişir

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

export const fail = (status, message) => json({ ok: false, error: message }, status);

// Kontrol karakterlerini, <> işaretlerini ve fazla boşluğu süpürür.
export const clean = (v, n) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n) : '';

// Yalnızca kendi geminden gelen istekler iskeleye yanaşır.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(request.url).host) return false; } catch { return false; }
  }
  return (request.headers.get('sec-fetch-site') || 'same-origin') !== 'cross-site';
}

// Kaba hız sınırı: yalnızca bu çalışma örneğinin belleğinde tutulur, diske yazılmaz.
const hits = new Map();
export function limited(key, max, ms = 60000) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const list = (hits.get(key) || []).filter(t => now - t < ms);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
function tooManyFails(key) {
  const now = Date.now();
  return (hits.get(key) || []).filter(t => now - t < 60000).length >= 10;
}

async function sha(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

// Yönetici kapısı: başlıkta gelen anahtar, Pages sırrı ADMIN_TOKEN ile karşılaştırılır.
// Başarılıysa true, değilse hazır bir Response döner.
export async function adminGate(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  if (!env.ADMIN_TOKEN) return fail(503, 'Yönetici anahtarı kurulmamış.');
  if (tooManyFails('fail:' + ip)) return fail(429, 'Çok fazla yanlış deneme. Bir dakika bekle.');
  const given = request.headers.get('x-admin-token') || '';
  const [a, b] = await Promise.all([sha(given), sha(env.ADMIN_TOKEN)]);
  let diff = given ? 0 : 1;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) { limited('fail:' + ip, 1000); return fail(401, 'Anahtar yanlış.'); }
  return true;
}

export async function getSetting(env, k, dflt) {
  const r = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first();
  return r ? r.v : dflt;
}
export async function setSetting(env, k, v) {
  await env.DB.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .bind(k, String(v)).run();
}

// Oyuncunun ekranına giden paket. Telefon numarası asla buradan çıkmaz.
export function playerView(row) {
  const startsAt = row.created_at + INTRO_MS;
  const durationMs = row.duration_min * 60000;
  return {
    id: row.id,
    first: row.first_name,
    prompt: row.prompt,
    twist: row.twist || '',
    introMs: INTRO_MS,
    startsAt,
    endsAt: startsAt + durationMs,
    durationMs,
    serverNow: Date.now(),
  };
}
