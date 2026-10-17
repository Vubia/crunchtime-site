-- Crunch Time: ambar defteri. Her tablo bir sandık, her satır bir define.

-- Oyuncular: kayıt formundan gelen herkes buraya yazılır.
-- Telefon, e-posta, soyad: hiçbiri tutulmaz. Geri bildirim anonim ankete bırakılır.
CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,            -- 4 haneli kimlik, örn. R7X2
  name         TEXT NOT NULL,               -- kayıtta tek kutuya yazılan ad
  prompt       TEXT NOT NULL,               -- verilen çizim görevi
  twist        TEXT,                        -- zorunlu ek şart
  task_short   TEXT,                        -- arenada görünen kısa görev: "öfkeli İtalyan şef|spatula"
  twist_short  TEXT,                        -- kısa ek şart: "3 renk"
  char_name    TEXT,                        -- çizim bitince karaktere verilen ad
  name_locked  INTEGER NOT NULL DEFAULT 0,  -- 1: yönetici dokundu, oyuncu artık değiştiremez
  duration_min INTEGER NOT NULL DEFAULT 15, -- kayıt anındaki süre
  created_at   INTEGER NOT NULL             -- ms (unix)
);

-- Çizim fotoğrafları (küçültülmüş JPEG, base64). Ayrı sandık: liste sorguları hafif kalsın.
CREATE TABLE IF NOT EXISTS photos (
  player_id  TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Küçük ayarlar + turnuva ağacı (JSON) burada durur.
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- Seyirci oyları: bir cihaz, bir soruda tek oy (kapanana kadar değiştirebilir).
-- match_id sütunu aslında soru anahtarıdır: "<maç kimliği>#<soru sırası>", örn. g1r0m0#2.
CREATE TABLE IF NOT EXISTS votes (
  match_id   TEXT NOT NULL,
  voter      TEXT NOT NULL,
  side       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, voter)
);
