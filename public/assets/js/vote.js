// Seyirci oylaması: soru açıksa iki çizim ve soru çıkar, dokunan oy verir. Kapalıysa maçın durumunu gösterir.
// Her sorunun gizli bir kuralı var (ÇOK oy alanın mı AZ oy alanın mı canı gider); oy veren bilemez, tahmin eder.
// Cihaz kimliği sunucunun verdiği HttpOnly çerezde durur; aynı cihazdan gelen ikinci oy ilkini ezer.
(() => {
  'use strict';
  const { $, api, esc } = CT;
  const body = $('#v-body'), svBox = $('#v-survey');

  localStorage.removeItem('ct_voter');   // eski sürümün kendi ürettiği kimlik; artık kullanılmıyor
  const voterReady = api('/api/voter').catch(() => { /* oy verirken yeniden denenir */ });

  let key = '';       // aynı görünümü boşuna yeniden çizmemek için
  let off = 0;        // sunucu saati - bu cihazın saati
  let latest = null, timer = null, inflight = false, qEnds = null, qSecs = 0, tick = null;

  const find = (br, id) => {
    for (let r = 0; r < br.rounds.length; r++) for (const m of br.rounds[r]) if (m.id === id) return { r, m };
    return null;
  };
  const photo = (br, id) => `/api/photo?id=${id}&v=${br.fighters[id].v}`;
  const roundName = (r, total) => {
    const left = total - r;
    return left === 1 ? 'FİNAL' : left === 2 ? 'YARI FİNAL' : left === 3 ? 'ÇEYREK FİNAL' : 'SON ' + 2 ** left;
  };

  function card(br, id, side, pick, hp, interactive) {
    const f = br.fighters[id], t = f.task || ['', '', ''];
    const t2 = [t[1], t[2]].filter(Boolean).join(' · ');
    return `<${interactive ? 'button type="button"' : 'div'} class="vcard${pick === side ? ' pick' : ''}${interactive ? '' : ' static'}" data-side="${side}">
      <img src="${photo(br, id)}" alt="${esc(id)}"><div class="vl">${esc(id)}</div><div class="vn">${esc(f.name)}</div>
      <div class="vt">${esc(t[0])}</div>${t2 ? `<div class="vw">${esc(t2)}</div>` : ''}
      <div class="vh"><i style="width:${hp}%"></i></div></${interactive ? 'button' : 'div'}>`;
  }

  /* ---------------- etkinlik anketi ---------------- */
  function drawSurvey(sv) {
    const k = sv && sv.on && sv.url ? sv.url : '';
    if (svBox._k === k) return;
    svBox._k = k;
    svBox.innerHTML = k ? `<div class="sv"><h2>ANKETİ DOLDUR!</h2><p>Etkinlik hakkında düşüncelerini anonim olarak paylaş. Bir dakika sürer.</p>
      <a class="btn" href="${esc(k)}" target="_blank" rel="noopener noreferrer">ANKETE GİT<span class="arr"></span></a>
      <div class="sq">${CT.qr(k)}</div></div>` : '';
  }

  /* ---------------- ekran ---------------- */
  function draw(s) {
    drawSurvey(s.survey);
    const br = s.bracket;
    if (!br) {
      if (key !== 'none') { key = 'none'; qEnds = null; body.innerHTML = '<div class="wait">Turnuva henüz başlamadı.<br>Ekrana bak, birazdan başlıyor!</div>'; }
      return;
    }

    // açık soru
    if (br.voting && br.q) {
      const q = br.q, f = find(br, q.matchId);
      const pick = localStorage.getItem('ct_pick_' + br.voting) || '';
      const k = 'q:' + br.voting + ':' + pick;
      qEnds = q.endsAt ? q.endsAt : null; qSecs = q.secs || 0;
      if (key === k) return;
      key = k;
      const label = q.tb ? `TIE-BREAK ${q.tbNo}/${q.tbOf}` : `SORU ${q.n}/${q.of}`;
      body.innerHTML = `<div class="vq"><div class="vq-n${q.tb ? ' tb' : ''}">${label}</div><div class="vq-t">${esc(q.text)}</div>
          <div class="vq-h">Birine dokun. Gizli kural var: bazı sorularda ÇOK oy alanın, bazılarında AZ oy alanın canı gider. Tahmin et!</div></div>
        ${q.endsAt ? '<div class="vtimer" id="vtimer"><i></i></div>' : ''}
        <div class="vs-wrap">${card(br, f.m.a, 'a', pick, f.m.hpA, true)}<div class="vs-mid">VS</div>${card(br, f.m.b, 'b', pick, f.m.hpB, true)}</div>`;
      return;
    }
    qEnds = null;

    // turnuva bitti
    if (br.champion) {
      const k = 'w:' + br.champion;
      if (key === k) return;
      key = k;
      body.innerHTML = `<div class="wait"><b style="font:14px/1.6 PS2P;color:var(--yellow)">ŞAMPİYON</b><br>${esc(br.champion)} - ${esc(br.fighters[br.champion].name)}<br>Hepinize teşekkürler!</div>`;
      return;
    }

    // maç sürüyor ama soru kapalı: durum kartı
    const f = br.current ? find(br, br.current) : null;
    if (f && f.m.a && f.m.b) {
      const m = f.m, k = 's:' + br.version;
      if (key === k) return;
      key = k;
      const l = m.log[m.log.length - 1];
      const nmA = br.fighters[m.a].name, nmB = br.fighters[m.b].name;
      let res = '';
      if (l) {
        const who = l.hit === 'a' ? nmA : nmB;
        res = `<div class="vres"><span class="rl">SON TUR</span>"${esc(l.text)}"<br>Oylar: ${l.a} - ${l.b}. ${l.hit
          ? `Kural: <b>${l.mode === 'most' ? 'ÇOK oy alan' : 'AZ oy alan'}</b> can kaybeder. ${esc(who)} <b>-${l.dmg}</b> can.`
          : 'Berabere, kimse can kaybetmedi.'}</div>`;
      }
      const end = m.winner ? `<div class="vres"><span class="rl">MAÇ BİTTİ</span>Kazanan: <b>${esc(br.fighters[m.winner === 'a' ? m.a : m.b].name)}</b></div>` : '';
      body.innerHTML = `<div class="vq"><div class="vq-n">${roundName(f.r, br.rounds.length)}</div>
          <div class="vq-t">${esc(nmA)} <span style="color:var(--red)">VS</span> ${esc(nmB)}</div></div>
        <div class="vs-wrap">${card(br, m.a, 'a', '', m.hpA, false)}<div class="vs-mid">VS</div>${card(br, m.b, 'b', '', m.hpB, false)}</div>
        ${res}${end}<div class="wait">${m.winner ? 'Sıradaki maçı bekle...' : 'Sıradaki soruyu bekle...'}</div>`;
      return;
    }

    if (key !== 'idle') { key = 'idle'; body.innerHTML = '<div class="wait">Oylama kapalı.<br>Sıradaki dövüşü bekle...</div>'; }
  }

  // Soru süresi çubuğu: yalnızca kendi küçük döngüsü, ağ çağrısı yok.
  clearInterval(tick);
  tick = setInterval(() => {
    const bar = $('#vtimer'); if (!bar || !qEnds || !qSecs) return;
    const rem = qEnds - (Date.now() + off);
    bar.firstChild.style.width = Math.max(0, Math.min(100, rem / (qSecs * 1000) * 100)) + '%';
    bar.classList.toggle('low', rem <= 5000);
  }, 200);

  body.addEventListener('click', async e => {
    const c = e.target.closest('.vcard[data-side]'); if (!c || c.classList.contains('static')) return;
    const mid = latest && latest.bracket && latest.bracket.voting; if (!mid) return;
    const side = c.dataset.side;
    const send = () => api('/api/vote', { method: 'POST', body: { matchId: mid, side } });
    try {
      await voterReady;
      // Çerez yoksa ya da süresi dolduysa bir kez yenisini alıp tekrar dene.
      await send().catch(async ex => { if (ex.status !== 401) throw ex; await api('/api/voter'); return send(); });
      localStorage.setItem('ct_pick_' + mid, side);
      if (navigator.vibrate) navigator.vibrate(60);
      draw(latest);
    } catch (ex) { alert(ex.message); poll(); }
  });

  // Sorgu aralığı duruma göre: oylama açıkken sık, maç sürerken orta, beklerken seyrek.
  // Yüzlerce telefon aynı anda vurmasın diye aralığa biraz rastgelelik katılır.
  const gap = () => {
    const br = latest && latest.bracket;
    const base = br && br.voting ? 4000 : br && br.champion ? 20000 : br && br.view === 'stage' && br.current ? 6000 : 10000;
    return base * (0.85 + Math.random() * 0.3);
  };
  async function poll() {
    clearTimeout(timer);
    if (document.hidden || inflight) return;   // görünür olunca visibilitychange yeniden başlatır
    inflight = true;
    try {
      latest = await api('/api/state');
      off = latest.serverNow - Date.now();
      draw(latest);
    } catch { /* ağ kesilirse bir sonraki turda tekrar */ }
    inflight = false;
    timer = setTimeout(poll, gap());
  }
  poll();
  document.addEventListener('visibilitychange', poll);
})();
