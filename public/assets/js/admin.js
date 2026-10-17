// Yönetim paneli: oyuncu listesi (karakter adı müdahalesi), hızlı foto, turnuva düğmeleri, ayarlar.
// Kaptan köşkündeki her düğme tek bir kapıdan (CT.api, admin:true) geçer; anahtar tarayıcıda saklı kalır.
(() => {
  'use strict';
  const { $, $$, api, esc } = CT;
  const A = (path, opt = {}) => api(path, { ...opt, admin: true });

  let players = [];
  let bk = null;            // son turnuva durumu
  let pollTimer = null;
  let onlyNoName = false;

  /* ---------- küçük yardımcılar ---------- */
  let toastT;
  function toast(msg, bad = false) {
    const t = $('#toast');
    t.textContent = msg; t.className = bad ? 'err' : ''; t.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, bad ? 4500 : 2200);
  }
  const fail = e => toast(e.message || 'Hata', true);
  const hhmm = ms => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
  const roundName = (r, total) => {
    const left = total - r;
    return left === 1 ? 'FİNAL' : left === 2 ? 'YARI FİNAL' : left === 3 ? 'ÇEYREK FİNAL' : 'SON ' + 2 ** left;
  };
  const HOW = { ko: 'K.O.', points: 'puanla', tiebreak: 'tie-break', coin: 'yazı-tura', rng: 'zar', manual: 'elle', bye: 'bay' };
  // Değişmediyse DOM'a dokunma: yazılmakta olan kutular silinmesin.
  const setHtml = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };

  /* ---------- giriş ---------- */
  async function tryLogin(token) {
    localStorage.setItem('ct_admin', token);
    try { await A('/api/admin/ping'); return true; }
    catch (e) { localStorage.removeItem('ct_admin'); throw e; }
  }
  function openApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    loadPlayers(); setTab('players');
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#login-err'); err.textContent = '';
    try { await tryLogin($('#token').value.trim()); openApp(); }
    catch (ex) { err.textContent = ex.message; }
  });
  $('#logout').addEventListener('click', () => { localStorage.removeItem('ct_admin'); location.reload(); });

  /* ---------- sekmeler ---------- */
  function setTab(t) {
    $$('.tabbtn[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    ['players', 'photo', 'bracket', 'settings'].forEach(n => { $('#t-' + n).hidden = n !== t; });
    clearInterval(pollTimer);
    if (t === 'players') loadPlayers();
    if (t === 'bracket') { loadBracket(); pollTimer = setInterval(loadBracket, 3000); }
    if (t === 'settings') loadSettings();
    if (t === 'photo') { if (!players.length) loadPlayers(); $('#qp-id').focus(); }
  }
  $$('.tabbtn[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  /* ---------- OYUNCULAR ---------- */
  async function loadPlayers() {
    try {
      const d = await A('/api/admin/players');
      players = d.players;
      renderPlayers();
    } catch (e) { fail(e); if (e.status === 401) { localStorage.removeItem('ct_admin'); location.reload(); } }
  }
  function renderPlayers() {
    const q = $('#q').value.trim();
    const qu = q.toUpperCase(), ql = q.toLocaleLowerCase('tr');
    let list = !q ? players : players.filter(p =>
      p.id.includes(qu) || p.name.toLocaleLowerCase('tr').includes(ql) || (p.char_name || '').toLocaleLowerCase('tr').includes(ql));
    if (onlyNoName) list = list.filter(p => !p.char_name);
    const withPhoto = players.filter(p => p.photo_v).length;
    const named = players.filter(p => p.char_name).length;
    $('#stats').innerHTML = `<span class="chip">KAYITLI <b>${players.length}</b></span><span class="chip">FOTOĞRAFLI <b>${withPhoto}</b></span><span class="chip">KARAKTER ADI VAR <b>${named}</b></span><span class="chip">İSİMSİZ <b>${players.length - named}</b></span><span class="chip">GÖSTERİLEN <b>${list.length}</b></span>`;
    $('#btn-noname').classList.toggle('cyan', onlyNoName);
    $('#plist').innerHTML = list.length ? list.map(card).join('') :
      `<div class="empty">${players.length ? 'Eşleşen kayıt yok.' : 'Henüz kimse kayıt olmadı.'}</div>`;
  }
  function card(p) {
    const img = p.photo_v ? `<img src="/api/photo?id=${p.id}&v=${p.photo_v}" alt="${p.id}">` : 'FOTO<br>YOK';
    const hit = $('#q').value.trim().toUpperCase() === p.id ? ' hit' : '';
    return `<div class="pcard${hit}${p.char_name ? '' : ' noname'}" data-id="${p.id}">
      <div class="ph" data-act="photo">${img}</div>
      <div>
        <div class="pid">${p.id}${p.name_locked ? '<span class="lockb">KİLİTLİ</span>' : ''}</div>
        <div class="who">${esc(p.name)} <span class="tm">kayıt ${hhmm(p.created_at)}</span></div>
        <div class="nmrow">
          <input class="inp" data-f="cname" value="${esc(p.char_name || '')}" maxlength="24" placeholder="karakter adı yok" autocomplete="off">
          <button class="btn small" data-act="savename">KAYDET</button>
          <button class="btn small ghost" data-act="clearname">SİL</button>
        </div>
        <div class="pr">${esc(p.prompt)}</div>
        <div class="tw">+ ${esc(p.twist || '')}</div>
        <div class="act"><button class="btn small" data-act="photo">FOTO</button><button class="btn small ghost" data-act="del">OYUNCUYU SİL</button></div>
      </div></div>`;
  }
  $('#q').addEventListener('input', renderPlayers);
  $('#btn-refresh').addEventListener('click', loadPlayers);
  $('#btn-noname').addEventListener('click', () => { onlyNoName = !onlyNoName; renderPlayers(); });

  // Kartlardaki tüm düğmeler tek kulaktan dinlenir.
  const pfile = document.createElement('input');
  pfile.type = 'file'; pfile.accept = 'image/*'; pfile.hidden = true; document.body.appendChild(pfile);
  let pfileTarget = null;

  async function saveName(id, name) {
    try {
      await A('/api/admin/name', { method: 'POST', body: { id, name } });
      toast(name ? `${id} adı: ${name}` : `${id} adı silindi`);
      await loadPlayers();
    } catch (ex) { fail(ex); }
  }
  $('#plist').addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const cardEl = el.closest('.pcard'), id = cardEl.dataset.id;
    const act = el.dataset.act;
    if (act === 'photo') { pfileTarget = id; pfile.value = ''; pfile.click(); }
    if (act === 'savename') saveName(id, cardEl.querySelector('[data-f=cname]').value.trim());
    if (act === 'clearname') saveName(id, '');
    if (act === 'del') {
      if (!confirm(id + ' kaydı silinsin mi? (fotoğrafı da gider)')) return;
      try { await A('/api/admin/players?id=' + id, { method: 'DELETE' }); toast(id + ' silindi'); loadPlayers(); } catch (ex) { fail(ex); }
    }
  });
  $('#plist').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.matches('[data-f=cname]')) return;
    e.preventDefault();
    saveName(e.target.closest('.pcard').dataset.id, e.target.value.trim());
  });
  pfile.addEventListener('change', async () => {
    if (!pfile.files[0] || !pfileTarget) return;
    try { await upload(pfileTarget, pfile.files[0]); toast(pfileTarget + ' fotoğrafı yüklendi'); loadPlayers(); } catch (ex) { fail(ex); }
  });

  /* ---------- fotoğraf: küçült + yükle ---------- */
  async function shrink(file) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    }
    const w = src.width, h = src.height, k = Math.min(1, 1100 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.74);
  }
  async function upload(id, file) {
    const data = await shrink(file);
    return A('/api/admin/photo', { method: 'POST', body: { id, data } });
  }

  /* ---------- HIZLI FOTO ---------- */
  let qpData = null, qpFor = '';
  const qpId = $('#qp-id');
  function qpUpdate() {
    qpId.value = qpId.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const p = qpId.value.length === 4 ? players.find(x => x.id === qpId.value) : null;
    $('#qp-pick').disabled = !p;
    $('#qp-name-box').hidden = !p;
    $('#qp-who').innerHTML = p ? `<b style="color:var(--yellow);font-weight:400">${p.id}</b> &middot; ${esc(p.name)}<br><span style="color:#ffe9b0">${esc(p.prompt)}</span>${p.photo_v ? '<br><span style="color:var(--green)">Zaten fotoğrafı var, yenisi üstüne yazar.</span>' : ''}`
      : (qpId.value.length === 4 ? `<span style="color:#ff6b81">${qpId.value} diye biri yok.</span>` : 'ID\'yi yaz, kimin olduğu burada çıkar.');
    if (p && qpFor !== p.id) { qpFor = p.id; $('#qp-name').value = p.char_name || ''; }
    if (!p) { qpFor = ''; $('#qp-prev').hidden = true; $('#qp-up').hidden = true; qpData = null; }
  }
  qpId.addEventListener('input', qpUpdate);
  $('#qp-pick').addEventListener('click', () => { $('#qp-file').value = ''; $('#qp-file').click(); });
  $('#qp-file').addEventListener('change', async () => {
    const f = $('#qp-file').files[0]; if (!f) return;
    try {
      qpData = await shrink(f);
      $('#qp-prev').src = qpData; $('#qp-prev').hidden = false; $('#qp-up').hidden = false;
    } catch (ex) { fail(ex); }
  });
  $('#qp-up').addEventListener('click', async () => {
    const id = qpId.value; if (!qpData || id.length !== 4) return;
    $('#qp-up').disabled = true;
    try {
      await A('/api/admin/photo', { method: 'POST', body: { id, data: qpData } });
      // Karakter adı kutusu değiştiyse onu da kaydet (oyuncu adını vermediyse buradan girilir).
      const cur = players.find(x => x.id === id), nm = $('#qp-name').value.trim();
      if (cur && nm !== (cur.char_name || '')) await A('/api/admin/name', { method: 'POST', body: { id, name: nm } });
      $('#qp-msg').innerHTML = `<span class="ok-flash">${id} yüklendi. Sıradaki!</span>`;
      qpId.value = ''; qpData = null; qpFor = ''; qpUpdate(); await loadPlayers(); qpId.focus();
    } catch (ex) { fail(ex); }
    $('#qp-up').disabled = false;
  });

  /* ---------- TURNUVA ---------- */
  async function loadBracket() {
    try { bk = await A('/api/admin/bracket'); renderBracket(); } catch (e) { fail(e); }
  }
  // Çift dokunuş ikinci isteği göndermesin; sunucu reddederse (ör. başka cihaz değiştirdi) güncel hali çek.
  let acting = false;
  async function act(action, extra = {}, quiet = false) {
    if (acting) return false;
    acting = true;
    try { bk = await A('/api/admin/bracket', { method: 'POST', body: { action, ...extra } }); renderBracket(); return true; }
    catch (e) { if (!quiet) fail(e); loadBracket(); return false; }
    finally { acting = false; }
  }
  const nm = (br, id) => id && br.fighters[id] ? `${id} (${esc(br.fighters[id].name)})` : '<span style="color:#777">belli değil</span>';
  const hpmini = hp => `<span class="hpmini"><i style="width:${hp}%"></i></span>${hp}`;

  // Soru süresi dolunca paneli açık tutan yönetici soruyu kendiliğinden kapatır; elle kapatma her zaman çalışır.
  let autoKey = '', autoTimer = null, endsAtLocal = null;
  function scheduleAutoClose(br) {
    if (!br || !br.voting || !br.q || !br.q.endsAt) { endsAtLocal = null; if (!br || !br.voting) autoKey = ''; return; }
    endsAtLocal = br.q.endsAt - (bk.serverNow - Date.now());     // sunucu saatini bu cihazın saatine çevir
    if (autoKey === br.voting) return;
    autoKey = br.voting;
    clearTimeout(autoTimer);
    const key = br.voting;
    const fire = async () => {
      if (!bk || !bk.bracket || bk.bracket.voting !== key) return;
      if (!(await act('close', {}, true))) autoTimer = setTimeout(fire, 800);
    };
    autoTimer = setTimeout(fire, Math.max(0, endsAtLocal - Date.now()) + 600);
  }
  setInterval(() => {
    const el = $('#b-remain'); if (!el) return;
    el.textContent = endsAtLocal ? Math.max(0, Math.ceil((endsAtLocal - Date.now()) / 1000)) + ' sn' : 'süre yok (elle kapat)';
  }, 250);

  function renderBracket() {
    const br = bk.bracket;
    $('#b-stats').innerHTML = `<span class="chip">KAYITLI <b>${bk.players}</b></span><span class="chip">FOTOĞRAFLI <b>${bk.photos}</b></span><span class="chip">İSİMSİZ (FOTOLU) <b>${bk.unnamed}</b></span>` +
      (br ? `<span class="chip">DÖVÜŞÇÜ <b>${Object.keys(br.fighters).length}</b></span><span class="chip">EKRAN <b>${br.view.toUpperCase()}</b></span>` : '');
    $('#b-build').textContent = br ? 'AĞACI YENİDEN KUR (SIFIRLAR)' : 'AĞACI KUR (RASTGELE EŞLEŞTİR)';
    $('#b-reset').hidden = !br;

    // anket QR düğmesi
    const sv = bk.survey || { on: false, hasUrl: false };
    $('#b-survey').textContent = sv.on ? 'ANKET QR\'INI GİZLE' : 'ANKET QR\'INI GÖSTER';
    $('#b-survey').classList.toggle('red', sv.on);
    $('#b-survey').disabled = !sv.hasUrl && !sv.on;
    $('#b-survey-hint').textContent = !sv.hasUrl ? 'Önce Ayarlar sekmesine Google Forms bağlantısını yaz.'
      : sv.on ? 'Şu an arenada ve oylama sayfalarında gösteriliyor.' : 'Turnuva bitince bas: arenada büyük QR, oylama sayfalarında QR ve buton çıkar.';

    const ctl = $('#b-ctl'), list = $('#b-list');
    if (!br) {
      setHtml(ctl, `<p class="hint">Ağaç yok. Fotoğrafı yüklenmiş <b>${bk.photos}</b> dövüşçü ile kurulur (en az 2).${bk.unnamed ? ` <b style="color:var(--orange)">${bk.unnamed}</b> dövüşçünün karakter adı yok; "İsimsiz" görünür, kurmadan önce Oyuncular sekmesinden doldurabilirsin.` : ''}</p>`);
      setHtml(list, ''); scheduleAutoClose(null); return;
    }
    const cur = br.current ? findM(br, br.current) : null;
    const m = cur && cur.m;
    const playable = m && m.a && m.b && !m.winner;
    const lock = br.voting ? 'disabled' : '';

    let head = '';
    if (br.champion) head = `<div class="who-line">ŞAMPİYON: <b style="color:var(--yellow);font-weight:400">${nm(br, br.champion)}</b></div>`;
    else if (m) {
      const tbDone = m.log.filter(x => x.tb).length, regDone = m.log.length - tbDone, of = (br.q && br.q.of) || bk.of;
      head = `<div class="who-line">Şu an: <span style="color:var(--cyan)">${roundName(cur.r, br.rounds.length)}</span>`
        + ` &middot; tur ${regDone}/${of}${tbDone ? ` + ${tbDone} tie-break` : ''}`
        + (m.winner ? ` &middot; <span style="color:var(--green)">bitti (${HOW[m.how] || m.how})</span>` : '')
        + `<br>A: ${nm(br, m.a)} ${hpmini(m.hpA)}<br>B: ${nm(br, m.b)} ${hpmini(m.hpB)}</div>`;
    } else head = '<div class="who-line">Sırada maç seçilmedi. "SIRADAKİ MAÇ" ile başla.</div>';

    let live = '';
    if (br.voting && br.q) {
      const t = (bk.live ? bk.live.a + bk.live.b : 0) || 1, la = bk.live ? bk.live.a : 0, lb = bk.live ? bk.live.b : 0;
      const label = br.q.tb ? `TIE-BREAK ${br.q.tbNo}/${br.q.tbOf}` : `SORU ${br.q.n}/${br.q.of}`;
      live = `<div class="who-line" style="color:var(--green)">${label}: "${esc(br.q.text)}"</div>
              <div class="rule-on">GİZLİ KURAL: ${br.q.mode === 'most' ? 'ÇOK OY ALANIN canı gider' : 'AZ OY ALANIN canı gider'}</div>
              <div class="who-line">OYLAR: A ${la} - B ${lb} &middot; kalan <b id="b-remain" style="color:var(--yellow);font-weight:400"></b></div>
              <div class="livebar"><i class="a" style="width:${la / t * 100}%"></i><i class="b" style="width:${lb / t * 100}%"></i></div>`;
    }

    const ask = br.voting
      ? '<button class="btn small cyan" data-b="close">SORUYU KAPAT</button>'
      : `<button class="btn small cyan" data-b="ask" ${playable ? '' : 'disabled'}>SORU SOR</button>`;
    const custom = !br.voting && playable
      ? `<div class="cmp"><input class="inp" id="b-qtext" maxlength="90" placeholder="kendi sorun (boş bırak: rastgele soru gelir)" autocomplete="off"></div>` : '';
    const keepQ = $('#b-qtext') ? $('#b-qtext').value : '';

    setHtml(ctl, head + live + `<div class="row">
      <button class="btn small" data-b="next" ${lock}>SIRADAKİ MAÇ</button>
      ${ask}
    </div>${custom}<div class="row">
      <button class="btn small red" data-b="rng" ${playable && !br.voting ? '' : 'disabled'}>ZARLA BİTİR (SORUSUZ)</button>
      <button class="btn small ghost" data-b="set_winner" data-side="a" ${playable && !br.voting ? '' : 'disabled'}>A KAZANDI (ELLE)</button>
      <button class="btn small ghost" data-b="set_winner" data-side="b" ${playable && !br.voting ? '' : 'disabled'}>B KAZANDI (ELLE)</button>
      <button class="btn small ghost" data-b="undo" ${lock}>SON MAÇI BAŞA SAR</button>
    </div><div class="row">
      <button class="btn small ghost" data-b="view" data-view="bracket">EKRAN: AĞAÇ</button>
      <button class="btn small ghost" data-b="view" data-view="stage">EKRAN: SAHNE</button>
      ${br.champion ? '<button class="btn small" data-b="view" data-view="champion">EKRAN: ŞAMPİYON</button>' : ''}
    </div>`);
    if (keepQ && $('#b-qtext')) $('#b-qtext').value = keepQ;
    scheduleAutoClose(br);

    setHtml(list, br.rounds.map((round, r) => round.map((mm, i) => {
      const done = !!mm.winner, isCur = br.current === mm.id;
      const res = done ? `<span class="w">${mm.winner === 'a' ? mm.a : mm.b} kazandı (${HOW[mm.how] || mm.how}) ${mm.a && mm.b && mm.how !== 'bye' ? `${mm.hpA}-${mm.hpB}` : ''}</span>` : (mm.a && mm.b ? (mm.log.length ? `${mm.hpA}-${mm.hpB} sürüyor` : 'bekliyor') : '...');
      return `<div class="mrow${isCur ? ' cur' : ''}${done ? ' done' : ''}">
        <span class="rn">${roundName(r, br.rounds.length)} ${i + 1}</span>
        <span>${mm.a || '?'} vs ${mm.b || '?'}</span>
        <span>${(mm.a && mm.b && !done) ? `<button class="btn small ghost" data-b="current" data-m="${mm.id}" style="margin:0" ${lock}>SEÇ</button> ${mm.log.length ? res : ''}` : res}</span></div>`;
    }).join('')).join(''));
  }
  function findM(br, id) {
    for (let r = 0; r < br.rounds.length; r++) for (const m of br.rounds[r]) if (m.id === id) return { r, m };
    return null;
  }
  $('#b-ctl').addEventListener('click', e => {
    const b = e.target.closest('[data-b]'); if (!b || b.disabled) return;
    const a = b.dataset.b;
    if (a === 'view') return act('view', { view: b.dataset.view });
    if (a === 'set_winner') return act('set_winner', { side: b.dataset.side });
    if (a === 'ask') { const t = $('#b-qtext'); return act('ask', t && t.value.trim() ? { text: t.value.trim() } : {}); }
    if (a === 'undo' && !confirm('Son oynanan maç başa sarılsın mı? (canlar 100 olur, turlar silinir)')) return;
    act(a);
  });
  $('#b-list').addEventListener('click', e => {
    const b = e.target.closest('[data-b="current"]'); if (b && !b.disabled) act('current', { matchId: b.dataset.m });
  });
  $('#b-build').addEventListener('click', () => {
    const warn = bk && bk.unnamed ? `\n\n${bk.unnamed} dövüşçünün karakter adı yok ("İsimsiz" görünecek).` : '';
    if (bk && bk.bracket && !confirm('Mevcut ağaç silinip yeniden kurulacak. Emin misin?' + warn)) return;
    if ((!bk || !bk.bracket) && warn && !confirm('Ağaç kurulsun mu?' + warn)) return;
    act('build');
  });
  $('#b-reset').addEventListener('click', () => { if (confirm('Turnuva ağacı silinsin mi?')) act('reset'); });
  $('#b-survey').addEventListener('click', async () => {
    const on = !(bk && bk.survey && bk.survey.on);
    try { await A('/api/admin/survey', { method: 'POST', body: { on } }); toast(on ? 'Anket QR\'ı gösteriliyor' : 'Anket QR\'ı gizlendi'); loadBracket(); } catch (e) { fail(e); }
  });

  /* ---------- AYARLAR ---------- */
  async function loadSettings() {
    try {
      const d = await A('/api/admin/settings');
      $('#s-min').value = d.durationMin; $('#s-rounds').value = d.roundsPerMatch;
      $('#s-secs').value = d.voteSecs; $('#s-survey').value = d.surveyUrl || '';
    } catch (e) { fail(e); }
  }
  $('#s-save').addEventListener('click', async () => {
    try {
      await A('/api/admin/settings', { method: 'POST', body: {
        durationMin: $('#s-min').value, roundsPerMatch: $('#s-rounds').value,
        voteSecs: $('#s-secs').value, surveyUrl: $('#s-survey').value.trim(),
      } });
      toast('Ayarlar kaydedildi'); loadSettings();
    } catch (e) { fail(e); }
  });
  $('#s-csv').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/export', { headers: { 'x-admin-token': localStorage.getItem('ct_admin') || '' } });
      if (!res.ok) throw new Error('İndirilemedi');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = 'crunchtime-kayitlar.csv'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { fail(e); }
  });
  async function wipe(what, msg) {
    if (!confirm(msg)) return;
    if ((prompt('Onay için SIL yaz') || '').trim() !== 'SIL') return toast('İptal edildi');
    try { await A('/api/admin/reset', { method: 'POST', body: { what, confirm: 'SIL' } }); toast('Temizlendi'); players = []; } catch (e) { fail(e); }
  }
  $('#s-wipe-b').addEventListener('click', () => wipe('bracket', 'Turnuva ağacı ve oylar silinecek.'));
  $('#s-wipe-p').addEventListener('click', () => wipe('players', 'TÜM oyuncular, görevler ve fotoğraflar silinecek!'));

  /* ---------- önyükleme ---------- */
  (async () => {
    const saved = localStorage.getItem('ct_admin');
    if (saved) { try { await tryLogin(saved); openApp(); return; } catch { /* anahtar eskimiş */ } }
    $('#login').hidden = false;
  })();
})();
