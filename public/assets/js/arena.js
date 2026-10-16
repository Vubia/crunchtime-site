// Arena: iki çizim karşı karşıya, gong çalar, biri yere serilir. Admin düğmeye basar, burası sadece gösterir.
// Veri her 2 sn'de /api/state'ten çekilir. Yeni bir "result" olayı görürse önce dövüş animasyonunu oynatır,
// sonuç ekrana ondan sonra çıkar (yoksa sürpriz sürpriz olmaz).
(() => {
  'use strict';
  const { $, api, esc, audio, sleep } = CT;
  const main = $('#ar-main');

  let shown = null;        // ekranda gösterilen durum
  let latest = null;
  let busy = false;        // animasyon sürerken yeni durum kuyrukta bekler
  let seenAt = null;       // en son oynatılmış sonucun zamanı
  let confettiOn = false;

  const roundName = (r, total) => {
    const left = total - r;
    return left === 1 ? 'FİNAL' : left === 2 ? 'YARI FİNAL' : left === 3 ? 'ÇEYREK FİNAL' : 'SON ' + 2 ** left;
  };
  const find = (br, id) => {
    for (let r = 0; r < br.rounds.length; r++) for (let i = 0; i < br.rounds[r].length; i++) if (br.rounds[r][i].id === id) return { r, i, m: br.rounds[r][i] };
    return null;
  };
  const photo = (br, id) => `/api/photo?id=${id}&v=${br.fighters[id].v}`;
  // Kazananın kalan canı maç kimliğinden türetilir: her yenilemede aynı çıkar.
  const winnerHp = id => 18 + ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 28);

  /* ---------------- sahne: iki dövüşçü ---------------- */
  function fighterHTML(br, id, side, m) {
    const f = br.fighters[id];
    const res = m.winner ? (m.winner === side ? ' win' : ' lose') : '';
    const hp = m.winner ? (m.winner === side ? winnerHp(m.id) : 0) : 100;
    return `<div class="fighter ${side}${res}">
      <div class="ribbon">WINNER</div>
      <div class="frame"><img src="${photo(br, id)}" alt="${esc(id)}"></div>
      <div class="fid">${esc(id)}</div>
      <div class="fname">${esc(f.name)}</div>
      <div class="hpbar"><i style="width:${hp}%"></i></div>
    </div>`;
  }
  function renderStage(br, voteTotal = 0) {
    const f = find(br, br.current);
    if (!f || !f.m.a || !f.m.b) return renderBracket(br);
    $('#ar-round').textContent = roundName(f.r, br.rounds.length) + ' - MAÇ ' + (f.i + 1) + '/' + br.rounds[f.r].length;
    let ban = '';
    if (br.voting === f.m.id) {
      ban = `<div class="voteban"><img src="/assets/img/qr-vote.svg" alt="QR"><div class="vt">OYLAMA AÇIK!<small>${esc(location.host)}/vote</small><div class="n"><span id="vtotal">${voteTotal}</span> OY</div></div></div>`;
    }
    main.innerHTML = `<div class="stage">${fighterHTML(br, f.m.a, 'a', f.m)}<div class="vsmark">VS<small>${esc(roundName(f.r, br.rounds.length))}</small></div>${fighterHTML(br, f.m.b, 'b', f.m)}</div>${ban}`;
  }

  /* ---------------- turnuva ağacı ---------------- */
  function renderBracket(br) {
    $('#ar-round').textContent = br.champion ? 'TURNUVA BİTTİ' : 'TURNUVA AĞACI';
    const n0 = br.rounds[0].length;
    const avail = window.innerHeight * 0.80;
    const rowh = Math.max(18, Math.min(72, Math.floor((avail / n0 - 10) / 2)));
    const row = (id, m, side) => {
      if (!id) return `<div class="bs tbd"><span class="nn">...</span></div>`;
      const f = br.fighters[id];
      const cls = m.winner ? (m.winner === side ? ' w' : ' l') : '';
      return `<div class="bs${cls}"><img src="${photo(br, id)}" alt=""><span class="ni">${esc(id)}</span><span class="nn">${esc(f.name)}</span></div>`;
    };
    main.innerHTML = `<div class="bk" style="--rowh:${rowh}px">` + br.rounds.map((round, r) =>
      `<div class="bk-col"><h4>${roundName(r, br.rounds.length)}</h4><div class="bk-list">` +
      round.map(m => `<div class="bm${br.current === m.id && !m.winner ? ' cur' : ''}">${row(m.a, m, 'a')}${row(m.b, m, 'b')}</div>`).join('') +
      `</div></div>`).join('') + `</div>`;
  }

  /* ---------------- şampiyon ---------------- */
  function showChamp(br) {
    const f = br.fighters[br.champion];
    $('#champ-img').src = photo(br, br.champion);
    $('#champ-id').textContent = br.champion;
    $('#champ-name').textContent = f.name;
    $('#champ').hidden = false;
    $('#ar-round').textContent = 'ŞAMPİYON';
    if (!confettiOn) startConfetti();
  }
  function hideChamp() { $('#champ').hidden = true; confettiOn = false; }

  // Piksel konfeti: kare parçalar yağar, canvas gizlenince döngü durur.
  function startConfetti() {
    const cv = $('#cf'), ctx = cv.getContext('2d');
    confettiOn = true;
    const resize = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
    resize();
    const colors = ['#ffd400', '#e4002b', '#00e5ff', '#39ff14', '#fff', '#ff8a00'];
    const bits = Array.from({ length: 140 }, () => ({
      x: Math.random() * cv.width, y: Math.random() * -cv.height, s: 6 + Math.floor(Math.random() * 3) * 6,
      v: 2 + Math.random() * 4, c: colors[Math.floor(Math.random() * colors.length)], w: Math.random() * 6,
    }));
    const loop = () => {
      if (!confettiOn) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const b of bits) {
        b.y += b.v; b.x += Math.sin((b.y + b.w * 50) / 40) * 1.5;
        if (b.y > cv.height) { b.y = -10; b.x = Math.random() * cv.width; }
        ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------------- ana çizim ---------------- */
  function render() {
    const br = shown && shown.bracket;
    if (!br) {
      hideChamp();
      $('#ar-round').textContent = '';
      main.innerHTML = `<div class="msg-center"><div><b>TURNUVA HAZIRLANIYOR</b>Dövüşçüler ısınıyor. Birazdan başlıyoruz...</div></div>`;
      return;
    }
    if (br.view === 'champion' && br.champion) { main.innerHTML = ''; showChamp(br); return; }
    hideChamp();
    if (br.view === 'stage' && br.current) renderStage(br, shown.voteTotal);
    else renderBracket(br);
  }

  /* ---------------- dövüş animasyonu ---------------- */
  function flash(text, ko = false) {
    const d = document.createElement('div');
    d.className = 'flash' + (ko ? ' ko' : '');
    d.innerHTML = `<b>${text}</b>`;
    main.appendChild(d);
    setTimeout(() => d.remove(), ko ? 1500 : 900);
  }
  async function playFight(next) {
    busy = true;
    try {
      const br = next.bracket, ev = br.last, f = find(br, ev.matchId);
      // Sonuç henüz yokmuş gibi bir kopya çiz: iki dövüşçü tam canla başlar.
      const pre = JSON.parse(JSON.stringify(br));
      find(pre, ev.matchId).m.winner = null;
      pre.current = ev.matchId; pre.voting = null; pre.view = 'stage';
      hideChamp();
      renderStage(pre);
      const A = main.querySelector('.fighter.a'), B = main.querySelector('.fighter.b');
      await sleep(700);
      flash('FIGHT!'); audio.count(0);
      A.classList.add('clash'); B.classList.add('clash');
      for (let i = 0; i < 5; i++) { audio.hit(); await sleep(380); }
      A.classList.remove('clash'); B.classList.remove('clash');
      flash('K.O.', true); audio.ko();
      const loser = ev.side === 'a' ? B : A, winner = ev.side === 'a' ? A : B;
      loser.querySelector('.hpbar i').style.width = '0%';
      winner.querySelector('.hpbar i').style.width = winnerHp(ev.matchId) + '%';
      await sleep(1700);
      shown = next; render(); audio.win();
      if (br.champion && f.r === br.rounds.length - 1) { await sleep(3000); showChamp(br); }
    } finally { busy = false; handle(); }
  }

  /* ---------------- veri çekme ---------------- */
  function handle() {
    if (busy || !latest) return;
    const lb = latest.bracket, sb = shown && shown.bracket;
    const verChanged = !shown || (lb ? lb.version : -1) !== (sb ? sb.version : -1);
    if (verChanged) {
      const ev = lb && lb.last;
      if (ev && ev.type === 'result' && ev.at > seenAt && sb && find(lb, ev.matchId)) { seenAt = ev.at; playFight(latest); return; }
      if (ev && ev.at > (seenAt || 0)) seenAt = ev.at;
      shown = latest; render();
    } else if (lb && lb.voting) {
      const el = $('#vtotal'); if (el) el.textContent = latest.voteTotal;
    }
  }
  async function poll() {
    try {
      latest = await api('/api/state');
      $('#net').hidden = true;
      if (seenAt === null) seenAt = latest.bracket && latest.bracket.last ? latest.bracket.last.at : 0;
      handle();
    } catch { $('#net').hidden = false; }
  }
  poll(); setInterval(poll, 2000);
  window.addEventListener('resize', () => { if (!busy && shown) render(); });

  // İlk dokunuş sesi açar, çift tık tam ekran yapar.
  document.addEventListener('click', () => { audio.unlock(); $('#snd').hidden = true; }, { once: true });
  document.addEventListener('dblclick', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
  });
})();
