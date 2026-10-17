// Turnuva ağacı: dövüşçüler karıştırılır, bay geçenler yan kapıdan ilerler, kazananlar bir üst tura yazılır.
// Ağaç tek bir JSON olarak kv tablosunda durur (anahtar: "bracket").
//
// Her maçta iki dövüşçünün 100'er canı vardır. Maç, seyirciye sorulan sorulardan (tur) oluşur:
// oylar kapanınca gizli kurala göre bir tarafın canı erir (bkz. questions.js). Tur günlüğü maçın "log" dizisindedir.
//   * Can sıfırlanırsa maç anında biter (K.O.).
//   * Normal turlar bitince canı çok olan kazanır.
//   * Canlar eşitse TIE-BREAK turları sorulur; MAX_TIEBREAK turda hâlâ eşitse yazı-tura atılır.

export const HP_MAX = 100;
export const DMG_MIN = 12;       // oylar kafa kafaya bile olsa gemi biraz sallanır
export const DMG_MAX = 50;       // ezici oylamada tek vuruşta yarım can gider
export const MAX_TIEBREAK = 3;

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

// fighters: [{ id, name, v, task }]   task: ["öfkeli İtalyan şef", "spatula", "3 renk"]
export function buildBracket(fighters, gen, of = 3) {
  const n = fighters.length;
  let size = 2;
  while (size < n) size *= 2;
  const m0 = size / 2;

  const rounds = [];
  for (let r = 0, cnt = m0; cnt >= 1; r++, cnt /= 2) {
    rounds.push(Array.from({ length: cnt }, (_, i) => ({
      id: `g${gen}r${r}m${i}`, a: null, b: null, winner: null, how: null,
      hpA: HP_MAX, hpB: HP_MAX, log: [],
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
    rounds, current: null,
    voting: null,      // açık sorunun anahtarı ("<maç>#<sıra>") ya da null
    q: null,           // açık sorunun ayrıntısı: { matchId, n, text, mode, tb, of, endsAt }
    used: [],          // sorulmuş soruların sıra numaraları
    of,                // maç başına normal soru sayısı (ayardan; her soruda tazelenir)
    champion: null, last: null,
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
  // Hızlı bitirmelerde (zar / elle) kaybedenin canı sıfırlanır; arena K.O. gösterebilsin.
  if (how === 'rng' || how === 'manual') m[side === 'a' ? 'hpB' : 'hpA'] = 0;
  const wid = side === 'a' ? m.a : m.b;
  if (r + 1 < br.rounds.length) {
    br.rounds[r + 1][i >> 1][i % 2 === 0 ? 'a' : 'b'] = wid;
  } else {
    br.champion = wid;
  }
}

// Maçı başa sarar (kazananı da geri alır). Üst turdaki maç başlamış ya da bitmişse izin vermez (ağaç çorbaya döner).
export function clearWinner(br, r, i) {
  const m = br.rounds[r][i];
  if (m.how === 'bye') return false;
  if (m.winner) {
    if (r + 1 < br.rounds.length) {
      const nx = br.rounds[r + 1][i >> 1];
      if (nx.winner || nx.log.length) return false;
      nx[i % 2 === 0 ? 'a' : 'b'] = null;
    } else {
      br.champion = null;
    }
  }
  m.winner = null; m.how = null; m.hpA = HP_MAX; m.hpB = HP_MAX; m.log = [];
  return true;
}

export function nextPlayable(br) {
  for (const round of br.rounds) {
    for (const m of round) if (m.a && m.b && !m.winner) return m;
  }
  return null;
}

// Oylar kapandı: hasarı hesapla, canı düş, maç bittiyse kazananı yaz. Arenanın oynatacağı olayı döner.
export function resolveRound(br, votesA, votesB) {
  const q = br.q;
  const f = findMatch(br, q.matchId);
  const m = f.m;
  const hpA0 = m.hpA, hpB0 = m.hpB;

  let hit = null, dmg = 0;
  if (votesA !== votesB) {
    const more = votesA > votesB ? 'a' : 'b';
    hit = q.mode === 'most' ? more : (more === 'a' ? 'b' : 'a');
    const margin = Math.abs(votesA - votesB) / (votesA + votesB);
    dmg = Math.round(DMG_MIN + (DMG_MAX - DMG_MIN) * margin);
    if (hit === 'a') m.hpA = Math.max(0, m.hpA - dmg); else m.hpB = Math.max(0, m.hpB - dmg);
  }
  m.log.push({ n: q.n, text: q.text, mode: q.mode, tb: q.tb, a: votesA, b: votesB, hit, dmg, hpA: m.hpA, hpB: m.hpB });

  let result = null;
  if (m.hpA <= 0 || m.hpB <= 0) {
    result = { side: m.hpA <= 0 ? 'b' : 'a', how: 'ko' };
  } else {
    const tbDone = m.log.filter(x => x.tb).length;
    const regularDone = m.log.length - tbDone;
    if (regularDone >= q.of) {
      if (m.hpA !== m.hpB) result = { side: m.hpA > m.hpB ? 'a' : 'b', how: tbDone ? 'tiebreak' : 'points' };
      else if (tbDone >= MAX_TIEBREAK) result = { side: rnd(2) === 0 ? 'a' : 'b', how: 'coin' };
    }
  }

  const ev = {
    type: 'round', matchId: m.id, n: q.n, text: q.text, mode: q.mode, tb: q.tb, of: q.of,
    votesA, votesB, hit, dmg, hpA0, hpB0, hpA: m.hpA, hpB: m.hpB, result, at: Date.now(),
  };
  br.voting = null; br.q = null; br.view = 'stage'; br.current = m.id;
  if (result) setWinner(br, f.r, f.i, result.side, result.how);
  br.last = ev;
  return ev;
}

// Seyirciye giden görünüm: açık sorunun gizli kuralı saklı kalır (tahmin eğlencesi), soru havuzu da gitmez.
export function publicBracket(br) {
  if (!br) return null;
  const copy = JSON.parse(JSON.stringify(br));
  delete copy.used;
  if (copy.q) delete copy.q.mode;
  return copy;
}
