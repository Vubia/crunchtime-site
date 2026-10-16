-- Crunch Time: ambar defteri. Her tablo bir sandık, her satır bir define.

-- Oyuncular: kayıt formundan gelen herkes buraya yazılır.
CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,            -- 4 haneli kimlik, örn. R7X2
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  phone        TEXT NOT NULL,               -- anket göndermek için (+90...)
  phone_key    TEXT NOT NULL UNIQUE,        -- son 10 hane: aynı numara iki kez kaydolamaz
  prompt       TEXT NOT NULL,               -- verilen çizim görevi
  twist        TEXT,                        -- zorunlu ek şart
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

-- Seyirci oyları: bir cihaz, bir maçta tek oy (değiştirebilir).
CREATE TABLE IF NOT EXISTS votes (
  match_id   TEXT NOT NULL,
  voter      TEXT NOT NULL,
  side       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, voter)
);
