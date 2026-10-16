// Yönetim paneli: oyuncu listesi, hızlı fotoğraf, turnuva düğmeleri, ayarlar.
// Kaptan köşkündeki her düğme tek bir kapıdan (CT.api, admin:true) geçer; anahtar tarayıcıda saklı kalır.
(() => {
  'use strict';
  const { $, $$, api, esc } = CT;
  const A = (path, opt = {}) => api(path, { ...opt, admin: true });

  let players = [];
  let serverSkew = 0;
  let bk = null;            // son turnuva durumu
  let tab = 'players';
  let pollTimer = null;

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
    tab = t;
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
      players = d.players; serverSkew = d.serverNow - Date.now();
      renderPlayers();
    } catch (e) { fail(e); if (e.status === 401) { localStorage.removeItem('ct_admin'); location.reload(); } }
  }
  function renderPlayers() {
    const q = $('#q').value.trim();
    const qu = q.toUpperCase(), ql = q.toLocaleLowerCase('tr'), qd = q.replace(/\D/g, '');
    const list = !q ? players : players.filter(p =>
      p.id.includes(qu) || (p.first_name + ' ' + p.last_name).toLocaleLowerCase('tr').includes(ql) ||
      (qd.length >= 3 && p.phone.replace(/\D/g, '').includes(qd)));
    const withPhoto = players.filter(p => p.photo_v).length;
    $('#stats').innerHTML = `<span class="chip">KAYITLI <b>${players.length}</b></span><span class="chip">FOTOĞRAFLI <b>${withPhoto}</b></span><span class="chip">GÖSTERİLEN <b>${list.length}</b></span>`;
    $('#plist').innerHTML = list.length ? list.map(card).join('') :
      `<div class="empty">${players.length ? 'Eşleşen kayıt yok.' : 'Henüz kimse kayıt olmadı.'}</div>`;
  }
  function card(p) {
    const img = p.photo_v ? `<img src="/api/photo?id=${p.id}&v=${p.photo_v}" alt="${p.id}">` : 'FOTO<br>YOK';
    const hit = $('#q').value.trim().toUpperCase() === p.id ? ' hit' : '';
    return `<div class="pcard${hit}" data-id="${p.id}">
      <div class="ph" data-act="photo">${img}</div>
      <div>
        <div class="pid">${p.id}</div>
        <div class="who">${esc(p.first_name)} ${esc(p.last_name)} &middot; <a class="tel" href="tel:${esc(p.phone)}">${esc(p.phone)}</a></div>
        <div class="tm">kayıt ${hhmm(p.created_at)}</div>
        <div class="pr">${esc(p.prompt)}</div>
        <div class="tw">+ ${esc(p.twist || '')}</div>
        <div class="act"><button class="btn small" data-act="photo">FOTO</button><button class="btn small ghost" data-act="del">SİL</button></div>
      </div></div>`;
  }
  $('#q').addEventListener('input', renderPlayers);
  $('#btn-refresh').addEventListener('click', loadPlayers);

  // Kartlardaki tüm düğmeler tek kulaktan dinlenir.
  const pfile = document.createElement('input');
  pfile.type = 'file'; pfile.accept = 'image/*'; pfile.hidden = true; document.body.appendChild(pfile);
  let pfileTarget = null;
  $('#plist').addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const id = el.closest('.pcard').dataset.id;
    if (el.dataset.act === 'photo') { pfileTarget = id; pfile.value = ''; pfile.click(); }
    if (el.dataset.act === 'del') {
      if (!confirm(id + ' kaydı silinsin mi? (fotoğrafı da gider)')) return;
      try { await A('/api/admin/players?id=' + id, { method: 'DELETE' }); toast(id + ' silindi'); loadPlayers(); } catch (ex) { fail(ex); }
    }
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
  let qpData = null;
  const qpId = $('#qp-id');
  function qpUpdate() {
    qpId.value = qpId.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const p = qpId.value.length === 4 ? players.find(x => x.id === qpId.value) : null;
    $('#qp-pick').disabled = !p;
    $('#qp-who').innerHTML = p ? `<b style="color:var(--yellow);font-weight:400">${p.id}</b> &middot; ${esc(p.first_name)} ${esc(p.last_name)}<br><span style="color:#ffe9b0">${esc(p.prompt)}</span>${p.photo_v ? '<br><span style="color:var(--green)">Zaten fotoğrafı var, yenisi üstüne yazar.</span>' : ''}`
      : (qpId.value.length === 4 ? `<span style="color:#ff6b81">${qpId.value} diye biri yok.</span>` : 'ID\'yi yaz, kimin olduğu burada çıkar.');
    if (!p) { $('#qp-prev').hidden = true; $('#qp-up').hidden = true; qpData = null; }
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
      $('#qp-msg').innerHTML = `<span class="ok-flash">${id} yüklendi. Sıradaki!</span>`;
      qpId.value = ''; qpData = null; qpUpdate(); await loadPlayers(); qpId.focus();
    } catch (ex) { fail(ex); }
    $('#qp-up').disabled = false;
  });

  /* ---------- TURNUVA ---------- */
  async function loadBracket() {
    try { bk = await A('/api/admin/bracket'); renderBracket(); } catch (e) { fail(e); }
  }
  // Çift dokunuş ikinci isteği göndermesin; sunucu reddederse (ör. başka cihaz değiştirdi) güncel hali çek.
  let acting = false;
  async function act(action, extra = {}) {
    if (acting) return;
    acting = true;
    try { bk = await A('/api/admin/bracket', { method: 'POST', body: { action, ...extra } }); renderBracket(); }
    catch (e) { fail(e); loadBracket(); }
    finally { acting = false; }
  }
  const nm = (br, id) => id && br.fighters[id] ? `${id} (${esc(br.fighters[id].name)})` : '<span style="color:#777">belli değil</span>';

  function renderBracket() {
    const br = bk.bracket;
    $('#b-stats').innerHTML = `<span class="chip">KAYITLI <b>${bk.players}</b></span><span class="chip">FOTOĞRAFLI <b>${bk.photos}</b></span>` +
      (br ? `<span class="chip">DÖVÜŞÇÜ <b>${Object.keys(br.fighters).length}</b></span><span class="chip">EKRAN <b>${br.view.toUpperCase()}</b></span>` : '');
    $('#b-build').textContent = br ? 'AĞACI YENİDEN KUR (SIFIRLAR)' : 'AĞACI KUR (RASTGELE EŞLEŞTİR)';
    $('#b-reset').hidden = !br;

    const ctl = $('#b-ctl'), list = $('#b-list');
    if (!br) {
      ctl.innerHTML = `<p class="hint">Ağaç yok. Fotoğrafı yüklenmiş <b>${bk.photos}</b> dövüşçü ile kurulur (en az 2).</p>`;
      list.innerHTML = ''; return;
    }
    const cur = br.current ? findM(br, br.current) : null;
    let head = '';
    if (br.champion) head = `<div class="who-line">ŞAMPİYON: <b style="color:var(--yellow);font-weight:400">${nm(br, br.champion)}</b></div>`;
    else if (cur) head = `<div class="who-line">Şu an: <span style="color:var(--cyan)">${roundName(cur.r, br.rounds.length)}</span><br>A: ${nm(br, cur.m.a)}<br>B: ${nm(br, cur.m.b)}</div>`;
    else head = '<div class="who-line">Sırada maç seçilmedi. "SIRADAKİ MAÇ" ile başla.</div>';

    let live = '';
    if (br.voting && bk.live) {
      const t = bk.live.a + bk.live.b || 1;
      live = `<div class="who-line" style="color:var(--green)">OYLAMA AÇIK: A ${bk.live.a} - B ${bk.live.b}</div>
              <div class="livebar"><i class="a" style="width:${bk.live.a / t * 100}%"></i><i class="b" style="width:${bk.live.b / t * 100}%"></i></div>`;
    }
    const playable = cur && cur.m.a && cur.m.b && !cur.m.winner;
    // Oylama açıkken yalnızca KAPAT ve ekran düğmeleri çalışır (sunucu da aynısını uygular).
    const lock = br.voting ? 'disabled' : '';
    ctl.innerHTML = head + live + `<div class="row">
      <button class="btn small" data-b="next" ${lock}>SIRADAKİ MAÇ</button>
      <button class="btn small red" data-b="rng" ${playable && !br.voting ? '' : 'disabled'}>RNG İLE DÖVÜŞTÜR</button>
      ${br.voting ? '<button class="btn small cyan" data-b="vote_close">OYLAMAYI KAPAT VE BİTİR</button>'
        : `<button class="btn small cyan" data-b="vote_open" ${playable ? '' : 'disabled'}>OYLAMAYI AÇ</button>`}
    </div><div class="row">
      <button class="btn small ghost" data-b="set_winner" data-side="a" ${playable && !br.voting ? '' : 'disabled'}>A KAZANDI (ELLE)</button>
      <button class="btn small ghost" data-b="set_winner" data-side="b" ${playable && !br.voting ? '' : 'disabled'}>B KAZANDI (ELLE)</button>
      <button class="btn small ghost" data-b="undo" ${lock}>SON SONUCU GERİ AL</button>
    </div><div class="row">
      <button class="btn small ghost" data-b="view" data-view="bracket">EKRAN: AĞAÇ</button>
      <button class="btn small ghost" data-b="view" data-view="stage">EKRAN: SAHNE</button>
      ${br.champion ? '<button class="btn small" data-b="view" data-view="champion">EKRAN: ŞAMPİYON</button>' : ''}
    </div>`;

    list.innerHTML = br.rounds.map((round, r) => round.map((m, i) => {
      const done = !!m.winner, isCur = br.current === m.id;
      const res = done ? `<span class="w">${m.winner === 'a' ? m.a : m.b} kazandı (${m.how})${m.votesA != null ? ` ${m.votesA}-${m.votesB}` : ''}</span>` : (m.a && m.b ? 'bekliyor' : '...');
      return `<div class="mrow${isCur ? ' cur' : ''}${done ? ' done' : ''}">
        <span class="rn">${roundName(r, br.rounds.length)} ${i + 1}</span>
        <span>${m.a || '?'} vs ${m.b || '?'}</span>
        <span>${(m.a && m.b && !done) ? `<button class="btn small ghost" data-b="current" data-m="${m.id}" style="margin:0" ${lock}>SEÇ</button>` : res}</span></div>`;
    }).join('')).join('');
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
    act(a);
  });
  $('#b-list').addEventListener('click', e => {
    const b = e.target.closest('[data-b="current"]'); if (b) act('current', { matchId: b.dataset.m });
  });
  $('#b-build').addEventListener('click', () => {
    if (bk && bk.bracket && !confirm('Mevcut ağaç silinip yeniden kurulacak. Emin misin?')) return;
    act('build');
  });
  $('#b-reset').addEventListener('click', () => { if (confirm('Turnuva ağacı silinsin mi?')) act('reset'); });

  /* ---------- AYARLAR ---------- */
  async function loadSettings() {
    try { const d = await A('/api/admin/settings'); $('#s-min').value = d.durationMin; } catch (e) { fail(e); }
  }
  $('#s-save').addEventListener('click', async () => {
    try { const d = await A('/api/admin/settings', { method: 'POST', body: { durationMin: $('#s-min').value } }); toast('Süre ' + d.durationMin + ' dakika'); } catch (e) { fail(e); }
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
  $('#s-wipe-p').addEventListener('click', () => wipe('players', 'TÜM oyuncular, telefonlar, görevler ve fotoğraflar silinecek!'));

  /* ---------- önyükleme ---------- */
  (async () => {
    const saved = localStorage.getItem('ct_admin');
    if (saved) { try { await tryLogin(saved); openApp(); return; } catch { /* anahtar eskimiş */ } }
    $('#login').hidden = false;
  })();
})();
