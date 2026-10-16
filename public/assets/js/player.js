// Oyuncu akışı: açılış -> sözleşme -> kayıt -> kimlik çarkı + görev -> 3-2-1 -> sayaç -> süre doldu.
// Saat bilgisi sunucudan gelir (startsAt / endsAt); telefonun saati şaşsa da sayaç şaşmaz.
// Sayfa yenilenirse localStorage'daki kimlikle aynı noktadan devam edilir. Kaptan sert, ama adil.
(() => {
  'use strict';
  const { $, api, audio, sprite, mmss } = CT;

  const SCREENS = ['title', 'waiver', 'form', 'intro', 'fight'];
  const show = id => { SCREENS.forEach(s => { $('#s-' + s).hidden = s !== id; }); window.scrollTo(0, 0); };

  let P = null;          // oyuncu paketi
  let offset = 0;        // sunucu saati - telefon saati
  const now = () => Date.now() + offset;

  // Art Director'ün sahne arkası bağırışları: kalan saniyeye göre en son geçilen satır görünür.
  const SHOUTS = [
    { at: Infinity, t: 'Saat işliyor! Gözünü kağıttan ayırma.' },
    { at: 600, t: 'Bu karakterin motivasyonu ne? Vergilerini mi ödeyememiş? Biraz duygu kat şuna!' },
    { at: 420, t: 'Bu çizime bakıyorum ve hiçbir şey hissetmiyorum. Hissettir bana.' },
    { at: 300, t: '5 dakika! Karakter değil, yürüyen bir buzdolabı çizmişsin. Hitbox nerede?' },
    { at: 180, t: 'Son 3 dakika! Oyunu ertelersek yatırımcılar beni oyar, ben de sizi oyarım!' },
    { at: 60, t: 'SON 60 SANİYE! Ağlamak yok, çizmek var!' },
    { at: 10, t: 'KALEMLERİ KALDIRMAYA HAZIRLAN...' },
  ];

  /* ---------------- 1) açılış, sözleşme, form ---------------- */
  function drawHud() {
    $('#hud').innerHTML = '<span>1P</span><span>' + sprite('heart', 3) + sprite('heart', 3) + sprite('heart', 3) + '</span><span class="blink">CREDIT 01</span>';
  }

  $('#btn-start').addEventListener('click', () => { audio.unlock(); audio.coin(); show('waiver'); });

  $('#chk-agree').addEventListener('change', e => { $('#btn-agree').disabled = !e.target.checked; });
  $('#btn-agree').addEventListener('click', () => { audio.coin(); show('form'); });

  $('#form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#f-err'), btn = $('#btn-go');
    err.textContent = '';
    const body = { first: $('#f-first').value.trim(), last: $('#f-last').value.trim(), phone: $('#f-phone').value.trim() };
    if (body.first.length < 2) { err.textContent = 'Adını yaz (en az 2 harf).'; return; }
    if (body.last.length < 2) { err.textContent = 'Soyadını yaz (en az 2 harf).'; return; }
    if (body.phone.replace(/\D/g, '').length < 10) { err.textContent = 'Telefon numarası eksik görünüyor.'; return; }
    btn.disabled = true; btn.firstChild.textContent = 'KAYDEDİLİYOR...';
    try {
      const d = await api('/api/register', { method: 'POST', body });
      enter(d.player);
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.firstChild.textContent = 'KAYDET VE BAŞLA';
    }
  });

  /* ---------------- 2) giriş: kimlik çarkı, görev, 3-2-1 ---------------- */
  function enter(p) {
    P = p;
    offset = p.serverNow - Date.now();
    localStorage.setItem('ct_id', p.id);
    if (now() < p.startsAt) runIntro(); else runFight(false);
  }

  function runIntro() {
    show('intro');
    const slots = [...document.querySelectorAll('#idrow b')];
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const t0 = P.startsAt - P.introMs;
    const lockAt = [900, 1250, 1600, 1950];
    const typeFrom = 2400, typeTo = 4600, countFrom = P.introMs - 3000;
    const locked = [false, false, false, false];
    let lastN = null;
    const mainEl = $('#m-main'), twistBox = $('#m-twist'), countEl = $('#count');
    mainEl.textContent = ''; twistBox.hidden = true; countEl.hidden = true;
    $('#m-twist-t').textContent = P.twist;

    const iv = setInterval(() => {
      const el = now() - t0;
      slots.forEach((s, i) => {
        if (el >= lockAt[i]) {
          if (!locked[i]) { locked[i] = true; s.textContent = P.id[i]; s.classList.remove('spin'); s.classList.add('lock'); audio.coin(); }
        } else {
          s.textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      });
      if (el >= typeFrom) {
        const f = Math.min(1, (el - typeFrom) / (typeTo - typeFrom));
        const n = Math.floor(P.prompt.length * f);
        if (mainEl.textContent.length !== n) mainEl.textContent = P.prompt.slice(0, n);
        if (f >= 1) twistBox.hidden = false;
      }
      if (el >= countFrom) {
        const left = P.startsAt - now();
        const n = Math.max(1, Math.ceil(left / 1000));
        countEl.hidden = false;
        if (n !== lastN && left > 0) {
          lastN = n; countEl.textContent = n;
          countEl.style.animation = 'none'; void countEl.offsetWidth; countEl.style.animation = '';
          audio.count(n);
        }
      }
      if (now() >= P.startsAt) { clearInterval(iv); runFight(true); }
    }, 60);
  }

  /* ---------------- 3) sayaç ---------------- */
  let wake = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch { /* ekran uyursa uyusun */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && P) keepAwake(); });

  function runFight(fresh) {
    show('fight');
    $('#k-id').textContent = P.id; $('#k-id2').textContent = P.id; $('#k-name').textContent = P.first;
    $('#k-main').textContent = P.prompt; $('#k-twist').textContent = P.twist;
    keepAwake();
    CT.muteButton();
    if (fresh) {
      const f = $('#fflash'); f.hidden = false; audio.count(0);
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(() => { f.hidden = true; }, 900);
    }

    const clock = $('#clock'), fill = $('#hp-fill'), hp = $('#hp'), quote = $('#quote');
    let lastSec = null, lastShout = -1, over = false;

    const tick = () => {
      if (over) return;
      const rem = P.endsAt - now();
      if (rem <= 0) { over = true; clearInterval(iv); finish(rem); return; }

      // 60 sn'ye kadar yukarı yuvarla (15:00 görünsün), son dakikada yüzde saniyeleri göster.
      let txt;
      if (rem > 60000) txt = mmss(Math.ceil(rem / 1000));
      else txt = mmss(Math.floor(rem / 1000)) + '<span class="cs">.' + String(Math.floor((rem % 1000) / 10)).padStart(2, '0') + '</span>';
      clock.innerHTML = txt;
      clock.classList.toggle('hot', rem <= 60000);
      clock.classList.toggle('final', rem <= 10000);

      const pct = Math.max(0, rem / P.durationMs);
      fill.style.width = (pct * 100).toFixed(2) + '%';
      hp.classList.toggle('low', pct <= 0.2);
      hp.classList.toggle('mid', pct > 0.2 && pct <= 0.5);

      const sec = Math.ceil(rem / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        if (sec <= 10) audio.beep(sec <= 3 ? 1318 : 880);
        const remSec = rem / 1000;
        let idx = 0;
        SHOUTS.forEach((s, i) => { if (remSec <= s.at && s.at < P.durationMs / 1000) idx = i; });
        if (idx !== lastShout) { lastShout = idx; quote.textContent = '"' + SHOUTS[idx].t + '"'; }
      }
    };
    const iv = setInterval(tick, 50);
    tick();
  }

  function finish(rem) {
    $('#hp-fill').style.width = '0%';
    $('#clock').innerHTML = '00:00<span class="cs">.00</span>';
    $('#tu-skull').innerHTML = sprite('skull', 10);
    $('#tu-id').textContent = P.id;
    $('#timesup').hidden = false;
    if (rem > -4000) {                 // sayfa yeni açılmadıysa korna çalsın
      audio.horn();
      if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800]);
    }
  }

  $('#tu-new').addEventListener('click', e => {
    e.preventDefault();
    if (confirm('Bu telefondaki kayıt silinsin ve yeni oyuncu kaydedilsin mi?')) { localStorage.removeItem('ct_id'); location.reload(); }
  });

  /* ---------------- önyükleme ---------------- */
  (async function boot() {
    drawHud();
    const saved = localStorage.getItem('ct_id');
    if (saved) {
      try { const d = await api('/api/me?id=' + encodeURIComponent(saved)); enter(d.player); return; }
      catch (ex) { if (ex.status === 404 || ex.status === 400) localStorage.removeItem('ct_id'); }
    }
    show('title');
  })();
})();
