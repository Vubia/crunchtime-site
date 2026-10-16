// Turnuva ağacı: dövüşçüler karıştırılır, bay geçenler yan kapıdan ilerler, kazananlar bir üst tura yazılır.
// Ağaç tek bir JSON olarak kv tablosunda durur (anahtar: "bracket").

export function rnd(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function readBracket(env) {
  const row = await env.DB.prepare("SELECT v FROM kv WHERE k = 'bracket'").first();
  return row ? JSON.parse(row.v) : null;
}

// Yeni ağacı koşulsuz yazar (kurulum: eskisinin üstüne bilerek yazılır).
export async function writeNewBracket(env, br) {
  br.version = (br.version || 0) + 1;
  await env.DB.prepare("INSERT INTO kv (k, v) VALUES ('bracket', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
    .bind(JSON.stringify(br)).run();
  return br;
}

// Var olan ağacı yalnızca okunduğundan beri kimse değiştirmediyse yazar.
// İki cihaz (ya da çift dokunuş) aynı anda düğmeye basarsa ikincisi false alır, birbirini ezmez.
export async function saveBracket(env, br) {
  const prev = br.version || 0;
  br.version = prev + 1;
  const r = await env.DB.prepare("UPDATE kv SET v = ? WHERE k = 'bracket' AND json_extract(v, '$.version') = ?")
    .bind(JSON.stringify(br), prev).run();
  return r.meta.changes === 1;
}

// fighters: [{ id, name, v }]
export function buildBracket(fighters, gen) {
  const n = fighters.length;
  let size = 2;
  while (size < n) size *= 2;
  const m0 = size / 2;

  const rounds = [];
  for (let r = 0, cnt = m0; cnt >= 1; r++, cnt /= 2) {
    rounds.push(Array.from({ length: cnt }, (_, i) => ({
      id: `g${gen}r${r}m${i}`, a: null, b: null, winner: null, how: null, votesA: null, votesB: null,
    })));
  }

  // Önce her maçın A koltuğu dolar, artanlar B'ye oturur: iki bay yan yana düşmez.
  const order = shuffle([...Array(m0).keys()]);
  const pool = shuffle(fighters.map(f => f.id));
  for (let i = 0; i < m0; i++) rounds[0][order[i]].a = pool[i];
  for (let j = m0; j < n; j++) rounds[0][order[j - m0]].b = pool[j];

  const br = {
    gen, version: 0, view: 'bracket',
    fighters: Object.fromEntries(fighters.map(f => [f.id, f])),
    rounds, current: null, voting: null, champion: null, last: null,
  };
  rounds[0].forEach((m, i) => { if (m.a && !m.b) setWinner(br, 0, i, 'a', 'bye'); });
  return br;
}

export function findMatch(br, matchId) {
  for (let r = 0; r < br.rounds.length; r++) {
    for (let i = 0; i < br.rounds[r].length; i++) {
      if (br.rounds[r][i].id === matchId) return { r, i, m: br.rounds[r][i] };
    }
  }
  return null;
}

export function setWinner(br, r, i, side, how) {
  const m = br.rounds[r][i];
  m.winner = side;
  m.how = how;
  const wid = side === 'a' ? m.a : m.b;
  if (r + 1 < br.rounds.length) {
    br.rounds[r + 1][i >> 1][i % 2 === 0 ? 'a' : 'b'] = wid;
  } else {
    br.champion = wid;
  }
}

// Kazananı geri alır; üst turdaki maç oynanmışsa izin vermez (ağaç çorbaya döner).
export function clearWinner(br, r, i) {
  const m = br.rounds[r][i];
  if (!m.winner || m.how === 'bye') return false;
  if (r + 1 < br.rounds.length) {
    const nx = br.rounds[r + 1][i >> 1];
    if (nx.winner) return false;
    nx[i % 2 === 0 ? 'a' : 'b'] = null;
  } else {
    br.champion = null;
  }
  m.winner = null; m.how = null; m.votesA = null; m.votesB = null;
  return true;
}

export function nextPlayable(br) {
  for (const round of br.rounds) {
    for (const m of round) if (m.a && m.b && !m.winner) return m;
  }
  return null;
}

// Seyirciye giden görünüm: açık oylamada sayılar gizli kalır (gerilim şart).
export function publicBracket(br) {
  if (!br) return null;
  const copy = JSON.parse(JSON.stringify(br));
  if (copy.voting) {
    const f = findMatch(copy, copy.voting);
    if (f) { f.m.votesA = null; f.m.votesB = null; }
  }
  return copy;
}
