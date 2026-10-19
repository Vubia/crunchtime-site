// Şema bekçisi: veritabanı eski (telefonlu) yapıdaysa ilk istekte kendini yeni yapıya çevirir.
// Böylece kodu yayınlayan kişi konsola girip SQL çalıştırmak zorunda kalmaz.
// Dönüşüm migrate-v2.sql ile aynıdır: ad+soyad birleşir, telefon ATILIR, fotoğraflar ve ayarlar kalır,
// turnuva ağacı ve oylar silinir. Hepsi tek işlemde (batch) döner: yarıda kalırsa hiçbir şey değişmez.
// Brund bu dosyayı görünce "yani define haritası kendini yeniden çiziyor" dedi, kimse itiraz etmedi.

import { fail } from '../_lib/util.js';

let ready = false;        // bu isolate için şema doğrulandı mı (yeniden sormayalım)

async function columns(env) {
  const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('players')").all();
  return results.map(r => r.name);
}

async function upgrade(env) {
  let cols = await columns(env);
  if (cols.includes('name')) return;                       // zaten yeni yapı
  if (!cols.includes('first_name')) return;                // tablo yok ya da tanımadığımız bir yapı: dokunma
  try {
    await env.DB.batch([
      env.DB.prepare('DROP TABLE IF EXISTS players_v2'),
      env.DB.prepare(`CREATE TABLE players_v2 (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL, twist TEXT,
        task_short TEXT, twist_short TEXT, char_name TEXT,
        name_locked INTEGER NOT NULL DEFAULT 0, duration_min INTEGER NOT NULL DEFAULT 15,
        created_at INTEGER NOT NULL)`),
      env.DB.prepare(`INSERT INTO players_v2 (id, name, prompt, twist, duration_min, created_at)
        SELECT id, trim(first_name || ' ' || last_name), prompt, twist, duration_min, created_at FROM players`),
      env.DB.prepare('DROP TABLE players'),
      env.DB.prepare('ALTER TABLE players_v2 RENAME TO players'),
      env.DB.prepare('DELETE FROM votes'),
      env.DB.prepare("DELETE FROM kv WHERE k IN ('bracket', 'q_used')"),
    ]);
  } catch (e) {
    // Başka bir istek aynı anda dönüştürmüş olabilir: durumu yeniden okuyup karar ver.
    cols = await columns(env);
    if (!cols.includes('name')) throw e;
  }
}

export async function onRequest({ env, next }) {
  if (!ready) {
    try { await upgrade(env); ready = true; }
    catch (e) { return fail(503, 'Veritabanı güncellenemedi: ' + (e && e.message ? e.message : e)); }
  }
  return next();
}
