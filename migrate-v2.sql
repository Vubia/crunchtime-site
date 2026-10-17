-- Crunch Time v2: eski (telefonlu) veritabanını telefonsuz yeni yapıya çevirir.
-- Çalıştır:  npx wrangler d1 execute <veritabanı-adı> --remote --file=migrate-v2.sql
-- Yalnızca v1 şemasıyla kurulmuş veritabanında bir kez çalıştırılır. Sıfırdan kurulumda schema.sql yeter.
--
-- Ne olur:
--  * players tablosu yeniden kurulur; telefon ve soyad sütunları ATILIR (telefonlar geri gelmez).
--    id, ad (ad + soyad birleşir), görev, ek şart, süre ve kayıt zamanı korunur.
--  * Fotoğraflar (photos) ve ayarlar (kv) yerinde kalır.
--  * Turnuva ağacı ve oylar SİLİNİR: can/soru düzeni eskisiyle uyumsuz. Ağacı panelden yeniden kur.

CREATE TABLE players_v2 (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  prompt       TEXT NOT NULL,
  twist        TEXT,
  task_short   TEXT,
  twist_short  TEXT,
  char_name    TEXT,
  name_locked  INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 15,
  created_at   INTEGER NOT NULL
);

INSERT INTO players_v2 (id, name, prompt, twist, duration_min, created_at)
  SELECT id, trim(first_name || ' ' || last_name), prompt, twist, duration_min, created_at FROM players;

DROP TABLE players;
ALTER TABLE players_v2 RENAME TO players;

DELETE FROM votes;
DELETE FROM kv WHERE k = 'bracket';
