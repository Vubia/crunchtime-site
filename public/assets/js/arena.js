// Arena: iki çizim karşı karşıya, üstte iki can çubuğu. Yönetici soruyu açar, seyirci telefondan oy verir, bu ekran gösterir.
// Her turun gizli kuralı vardır (ÇOK oy alanın mı AZ oy alanın mı canı gider); oylar kapanınca önce sayım,
// sonra kural ilan edilir, sonra can çubuğu yavaş yavaş erir. Veri her 2 sn'de /api/state'ten çekilir.
// Yeni bir "round" ya da "result" olayı görürse önce animasyonu oynatır, sonuç ekrana ondan sonra çıkar
// (yoksa sürpriz sürpriz olmaz). Hinche kaptan köşkünden bağırıyor: "Ateş serbest!"
(() => {
  'use strict';
  const { $, api, esc, audio, sleep } = CT;
  const main = $('#ar-main');

  let shown = null;        // ekranda çizilmiş durum
  let latest = null;       // en son çekilen durum
  let busy = false;        // animasyon sürerken yeni durum kuyrukta bekler
  let seenAt = null;       // en son oynatılmış olayın zamanı
  let confettiOn = false;
  let off = 0;             // sunucu saati - bu cihazın saati
  let tmr = null;          // soru süre çubuğunun zamanlayıcısı
  let svKey = '';          // anket QR'ı hangi adres için çizildi

  const roundName = (r, total) => {
    const left = total - r;
    return left === 1 ? 'FİNAL' : left === 2 ? 'YARI FİNAL' : left === 3 ? 'ÇEYREK FİNAL' : 'SON ' + 2 ** left;
  };
  const find = (br, id) => {
    for (let r = 0; r < br.rounds.length; r++) for (let i = 0; i < br.rounds[r].length; i++) if (br.rounds[r][i].id === id) return { r, i, m: br.rounds[r][i] };
    return null;
  };
  const photo = (br, id) => `/api/photo?id=${id}&v=${br.fighters[id].v}`;
  const base = () => location.origin;

  /* ---------------- sahne: iki dövüşçü, can çubukları, soru bandı ---------------- */
  function hpSide(side, hp) {
    return `<div class="hpside ${side}"><div class="hpwrap"><div class="hpbar${hp > 0 && hp <= 25 ? ' low' : ''}" data-hp="${side}"><i class="lag" style="width:${hp}%"></i><i class="fill" style="width:${hp}%"></i></div></div><div class="hpnum" data-hpn="${side}">${hp}</div></div>`;
  }
  function fighterHTML(br, id, side, m) {
    const f = br.fighters[id];
    const t = f.task || ['', '', ''];
    const t2 = [t[1], t[2]].filter(Boolean).join(' · ');
    const res = m.winner ? (m.winner === side ? ' win' : ' lose') : '';
    return `<div class="fighter ${side}${res}">
      <div class="ribbon">WINNER</div>
      <div class="frame"><img src="${photo(br, id)}" alt="${esc(id)}"><div class="redflash"></div><div class="dmg"></div></div>
      <div class="finfo">
        <div class="frow"><span class="fid">${esc(id)}</span><span class="fname">${esc(f.name)}</span></div>
        <div class="ftask"><span class="t1">${esc(t[0])}</span>${t2 ? `<span class="t2">${esc(t2)}</span>` : ''}</div>
      </div></div>`;
  }
  function pipsHTML(m, br, asking) {
    const of = br.of || 3;
    const slots = Math.max(of, m.log.length + (asking ? 1 : 0));
    let h = '';
    for (let i = 0; i < slots; i++) {
      h += `<b class="${i < m.log.length ? 'done' : (asking && i === m.log.length ? 'cur' : '')}${i >= of ? ' tbp' : ''}"></b>`;
    }
    return h;
  }
  const lastLine = (m, br) => {
    const l = m.log[m.log.length - 1];
    const nm = s => esc(br.fighters[s === 'a' ? m.a : m.b].name);
    return l.hit
      ? `Son tur: ${nm(l.hit)} -${l.dmg} can (${l.mode === 'most' ? 'ÇOK oy alan' : 'AZ oy alan'} can kaybetti)`
      : 'Son tur: berabere, kimse can kaybetmedi';
  };
  const HOW = { ko: 'K.O.', points: 'PUANLA', tiebreak: 'TIE-BREAK İLE', coin: 'YAZI-TURA İLE', rng: 'ZARLA', manual: 'JÜRİ KARARIYLA' };

  function renderStage(br, voteTotal = 0) {
    const f = find(br, br.current);
    if (!f || !f.m.a || !f.m.b) return renderBracket(br);
    const m = f.m;
    const q = br.q && br.q.matchId === m.id ? br.q : null;
    $('#ar-round').textContent = roundName(f.r, br.rounds.length) + ' - MAÇ ' + (f.i + 1) + '/' + br.rounds[f.r].length;

    const tag = q ? (q.tb ? `TIE-BREAK ${q.tbNo}` : `SORU ${q.n}/${q.of}`) : m.winner ? 'MAÇ BİTTİ' : m.log.length ? 'SIRADAKİ SORU' : 'HAZIR OLUN';
    let qbar;
    if (q) {
      const label = q.tb ? `TIE-BREAK ${q.tbNo}/${q.tbOf} - EŞİTLİK BOZMA TURU` : `SORU ${q.n}/${q.of}`;
      qbar = `<div class="qbar${q.tb ? ' tbq' : ''}">
        <div class="qtext"><small class="${q.tb ? 'tb' : ''}">${label}</small>${esc(q.text)}
          <div class="qhint">Gizli kural var: bazı sorularda ÇOK oy alanın, bazılarında AZ oy alanın canı gider. Tahmin et!</div></div>
        <div class="qside"><div class="qrbox">${CT.qr(base() + '/vote')}</div>
          <div class="qinfo"><div class="host">${esc(location.host)}/vote</div><div class="cnt"><span id="vcnt">${voteTotal}</span> OY</div></div></div>
        ${q.endsAt ? '<div class="timer" id="qtimer"><i></i></div>' : ''}
      </div>`;
    } else {
      const w = m.winner ? br.fighters[m.winner === 'a' ? m.a : m.b] : null;
      const body = w ? `KAZANAN: ${esc(w.name)}<div class="qhint">${HOW[m.how] || ''} galip geldi</div>`
        : m.log.length ? `Sıradaki soru geliyor...<div class="qhint">${lastLine(m, br)}</div>`
          : `Maç başlıyor...<div class="qhint">Her turda bir soru sorulur; oylar canı eritir. Canı çok olan kazanır.</div>`;
      qbar = `<div class="qbar idle"><div class="qtext"><small>${tag}</small>${body}</div></div>`;
    }

    main.innerHTML = `<div class="st">
      <div class="hpline">${hpSide('a', m.hpA)}<div class="rmid"><div class="rtag${q && q.tb ? ' tb' : ''}">${tag}</div><div class="pips">${pipsHTML(m, br, !!q)}</div></div>${hpSide('b', m.hpB)}</div>
      <div class="arow">${fighterHTML(br, m.a, 'a', m)}<div class="vsmark">VS</div>${fighterHTML(br, m.b, 'b', m)}</div>
      ${qbar}</div>`;
    startTimer(q);
  }

  // Soru süresi: ince çubuk boşalır, son 5 saniyede bip bip.
  function startTimer(q) {
    clearInterval(tmr);
    const bar = $('#qtimer');
    if (!q || !q.endsAt || !bar) return;
    let lastSec = null;
    const tick = () => {
      const rem = q.endsAt - (Date.now() + off);
      bar.firstChild.style.width = Math.max(0, Math.min(100, rem / (q.secs * 1000) * 100)) + '%';
      bar.classList.toggle('low', rem <= 5000);
      const sec = Math.ceil(rem / 1000);
      if (sec !== lastSec) { lastSec = sec; if (sec > 0 && sec <= 5) audio.beep(sec <= 2 ? 1318 : 880); }
      if (rem <= -2000) clearInterval(tmr);
    };
    tmr = setInterval(tick, 100); tick();
  }

  function setHp(side, hp) {
    const bar = main.querySelector(`[data-hp="${side}"]`);
    if (!bar) return;
    bar.querySelector('.fill').style.width = hp + '%';
    bar.querySelector('.lag').style.width = hp + '%';        // kırmızı iz gecikmeli erir (CSS'te gecikme var)
    bar.classList.toggle('low', hp > 0 && hp <= 25);
    const num = main.querySelector(`[data-hpn="${side}"]`);
    if (!num) return;
    let cur = parseInt(num.textContent, 10) || 0;
    const step = cur > hp ? -1 : 1;
    const iv = setInterval(() => {
      if (cur === hp) return clearInterval(iv);
      cur += step * Math.max(1, Math.ceil(Math.abs(cur - hp) / 14));
      if ((step < 0 && cur < hp) || (step > 0 && cur > hp)) cur = hp;
      num.textContent = cur;
    }, 45);
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
    clearInterval(tmr);
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

  /* ---------------- animasyonlar ---------------- */
  function flash(html, cls = '', ms = 900) {
    const d = document.createElement('div');
    d.className = 'flash ' + cls;
    d.innerHTML = `<b>${html}</b>`;
    main.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  // Maç bitişinin ortak kısmı: ilan + kazanan/kaybeden sınıfları.
  async function settleMatch(result, finalRound) {
    const A = main.querySelector('.fighter.a'), B = main.querySelector('.fighter.b');
    if (result.how === 'ko') { flash('K.O.', 'ko', 1500); audio.ko(); await sleep(1700); }
    else if (result.how === 'points') { flash('PUANLA<br>GALİP!', 'rule', 2200); audio.win(); await sleep(2400); }
    else if (result.how === 'tiebreak') { flash('TIE-BREAK<br>GALİBİ!', 'rule', 2200); audio.win(); await sleep(2400); }
    else if (result.how === 'coin') { flash('YAZI-TURA!<br>ŞANS KAZANDIRDI', 'rule', 2400); audio.win(); await sleep(2600); }
    (result.side === 'a' ? A : B).classList.add('win');
    (result.side === 'a' ? B : A).classList.add('lose');
    audio.win();
  }

  // Bir soru turu bitti: sayım -> kural ilanı -> hasar -> (maç bittiyse) sonuç.
  async function playRound(next) {
    busy = true;
    try {
      const nb = next.bracket, ev = nb.last, f = find(nb, ev.matchId);
      // Oylama kapanmadan önceki sahneyi kur: canlar eski, maç sürüyor.
      const pre = JSON.parse(JSON.stringify(nb));
      const pf = find(pre, ev.matchId);
      pf.m.winner = null; pf.m.how = null; pf.m.hpA = ev.hpA0; pf.m.hpB = ev.hpB0;
      pf.m.log = pf.m.log.filter(x => x.n !== ev.n);
      pre.current = ev.matchId; pre.voting = null; pre.q = null; pre.view = 'stage';
      hideChamp();
      renderStage(pre, 0);
      // Sayım sürerken orta etiket kapanan sorunun numarasını göstersin ("SIRADAKİ SORU" demesin).
      const rt = main.querySelector('.rtag');
      if (rt) { rt.textContent = ev.tb ? 'TIE-BREAK' : `SORU ${ev.n}/${ev.of}`; rt.classList.toggle('tb', !!ev.tb); }

      const qb = main.querySelector('.qbar');
      qb.className = 'qbar';
      qb.innerHTML = `<div class="reveal"><div class="rv-q">"${esc(ev.text)}"</div>
        <div class="rv-row"><span class="rv-n a" id="rva">0</span><div class="rvbar"><i class="a" id="rbA"></i><i class="b" id="rbB"></i></div><span class="rv-n b" id="rvb">0</span></div></div>`;
      await sleep(600);

      const tot = ev.votesA + ev.votesB;
      $('#rbA').style.width = tot ? (ev.votesA / tot * 100) + '%' : '0%';
      $('#rbB').style.width = tot ? (ev.votesB / tot * 100) + '%' : '0%';
      const steps = 16;
      for (let i = 1; i <= steps; i++) {
        $('#rva').textContent = Math.round(ev.votesA * i / steps);
        $('#rvb').textContent = Math.round(ev.votesB * i / steps);
        if (i % 3 === 0) audio.beep(500 + i * 25);
        await sleep(75);
      }
      await sleep(1100);

      // gizli kural ilanı
      audio.count(0);
      if (!tot) flash('OY YOK!<br>HASAR YOK', 'rule', 2300);
      else if (!ev.hit) flash('BERABERE!<br>HASAR YOK', 'rule', 2300);
      else flash(ev.mode === 'most' ? 'ÇOK OY ALANIN<br>CANI GİDER!' : 'AZ OY ALANIN<br>CANI GİDER!', 'rule', 2300);
      await sleep(2500);

      // hasar
      if (ev.hit) {
        const fe = main.querySelector(`.fighter.${ev.hit}`);
        fe.classList.add('hurt');
        const d = fe.querySelector('.dmg'); d.textContent = '-' + ev.dmg; d.classList.add('go');
        audio.hit();
        setHp(ev.hit, ev.hit === 'a' ? ev.hpA : ev.hpB);
        await sleep(2400);
      } else await sleep(600);

      let crown = false;
      if (ev.result) {
        await settleMatch(ev.result);
        await sleep(1800);
        crown = !!nb.champion && f.r === nb.rounds.length - 1;
      } else {
        const qb2 = main.querySelector('.qbar');
        if (qb2) { qb2.className = 'qbar idle'; qb2.innerHTML = `<div class="qtext"><small>SIRADAKİ SORU</small>Sıradaki soru geliyor...<div class="qhint">${lastLine(find(nb, ev.matchId).m, nb)}</div></div>`; }
        await sleep(1200);
      }
      shown = latest; render();
      // Final bittiyse sahne bir süre görünür, sonra şampiyon katmanı biner (render onu gizlemesin diye sonradan).
      if (crown) { await sleep(2500); showChamp(nb); }
    } finally { busy = false; handle(); }
  }

  // Zarla / elle bitirilen maç: eski usul tokuşma + K.O.
  async function playQuick(next) {
    busy = true;
    try {
      const nb = next.bracket, ev = nb.last, f = find(nb, ev.matchId);
      const pre = JSON.parse(JSON.stringify(nb));
      const pf = find(pre, ev.matchId);
      const ll = pf.m.log[pf.m.log.length - 1];
      pf.m.winner = null; pf.m.how = null; pf.m.hpA = ll ? ll.hpA : 100; pf.m.hpB = ll ? ll.hpB : 100;
      pre.current = ev.matchId; pre.voting = null; pre.q = null; pre.view = 'stage';
      hideChamp();
      renderStage(pre, 0);
      const A = main.querySelector('.fighter.a'), B = main.querySelector('.fighter.b');
      await sleep(700);
      flash('FIGHT!'); audio.count(0);
      A.classList.add('clash'); B.classList.add('clash');
      for (let i = 0; i < 5; i++) { audio.hit(); await sleep(380); }
      A.classList.remove('clash'); B.classList.remove('clash');
      setHp(ev.side === 'a' ? 'b' : 'a', 0);
      await settleMatch({ side: ev.side, how: 'ko' });
      await sleep(1500);
      shown = latest; render();
      if (nb.champion && f.r === nb.rounds.length - 1) { await sleep(2500); showChamp(nb); }
    } finally { busy = false; handle(); }
  }

  /* ---------------- anket QR'ı ---------------- */
  function applySurvey(sv) {
    const el = $('#survey');
    if (!sv || !sv.on || !sv.url) { el.hidden = true; svKey = ''; return; }
    if (svKey !== sv.url) {
      svKey = sv.url;
      $('#survey-qr').innerHTML = CT.qr(sv.url);
      $('#survey-url').textContent = sv.url.replace(/^https?:\/\//, '');
    }
    if (el.hidden) { el.hidden = false; audio.win(); }
  }

  /* ---------------- veri çekme ---------------- */
  function handle() {
    if (!latest) return;
    applySurvey(latest.survey);
    if (busy) return;
    const lb = latest.bracket, sb = shown && shown.bracket;
    const verChanged = !shown || (lb ? lb.version : -1) !== (sb ? sb.version : -1);
    if (verChanged) {
      const ev = lb && lb.last;
      if (ev && ev.at > seenAt && sb && find(lb, ev.matchId)) {
        if (ev.type === 'round') { seenAt = ev.at; playRound(latest); return; }
        if (ev.type === 'result') { seenAt = ev.at; playQuick(latest); return; }
      }
      if (ev && ev.at > (seenAt || 0)) seenAt = ev.at;
      shown = latest; render();
    } else if (lb && lb.voting) {
      const el = $('#vcnt'); if (el) el.textContent = latest.voteTotal;
    }
  }
  async function poll() {
    try {
      const t0 = Date.now();
      latest = await api('/api/state');
      off = latest.serverNow - (t0 + Date.now()) / 2;     // gidiş-dönüş yarısı kadar düzeltilmiş saat farkı
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
