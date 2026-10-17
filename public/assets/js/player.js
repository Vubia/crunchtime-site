// Oyuncu akışı: açılış -> sözleşme -> kayıt (tek kutu) -> kimlik çarkı + görev -> 3-2-1 -> sayaç -> süre doldu -> karakter adı.
// Saat bilgisi sunucudan gelir (startsAt / endsAt); telefonun saati şaşsa da sayaç şaşmaz.
// Sayfa yenilenirse localStorage'daki kimlikle aynı noktadan devam edilir; süre dolmuşsa karakter adı ekranı yeniden açılır.
// Sayfayı hiç açmayan oyuncunun adını yönetici panelden yazar. Kaptan sert, ama adil.
(() => {
  'use strict';
  const { $, api, audio, sprite, mmss } = CT;

  const SCREENS = ['title', 'waiver', 'form', 'intro', 'fight'];
  const show = id => { SCREENS.forEach(s => { $('#s-' + s).hidden = s !== id; }); window.scrollTo(0, 0); };

  let P = null;          // oyuncu paketi
  let offset = 0;        // sunucu saati - telefon saati
  const now = () => Date.now() + offset;

  // Art Director'ün sahne arkası bağırışları. İki sandık var:
  //  SHOUTS      sabit satırlar: ilki açılış sözü, sonrakiler kalan saniyeye bağlı "son dakika" sözleri.
  //  SHOUT_POOL  havuz: aradaki boşluğu 30-45 sn'de bir rastgele (tekrarsız) doldurur.
  // Sabit satır (at <= 180) çıkınca bir sonrakine kadar ekranda kalır; daha öncekiler yalnızca 25 sn görünür.
  const SHOUTS = [
    { at: Infinity, t: 'Saat işliyor! Gözünü kağıttan ayırma.' },
    { at: 300, t: '5 dakika! Karakter değil, yürüyen bir buzdolabı çizmişsin. Hitbox nerede?' },
    { at: 180, t: 'Son 3 dakika! Oyunu ertelersek yatırımcılar beni oyar, ben de sizi oyarım!' },
    { at: 140, t: 'Son dakikalara yaklaşıyoruz! Ana hatları bitir, detaya sonra bakarız.' },
    { at: 100, t: 'Kimse ana hatları bitirmedi. İlk sen ol, efsane olursun.' },
    { at: 60, t: 'SON 60 SANİYE! Ağlamak yok, çizmek var!' },
    { at: 35, t: 'Kornaya basacağım... Hayır, henüz değil. Ama parmağım hazır.' },
    { at: 10, t: 'KALEMLERİ KALDIRMAYA HAZIRLAN...' },
  ];
  const SHOUT_POOL = [
    'Bu karakterin motivasyonu ne? Vergilerini mi ödeyememiş? Biraz duygu kat şuna!',
    'Bu çizime bakıyorum ve hiçbir şey hissetmiyorum. Hissettir bana.',
    'Not quite my tempo! Daha hızlı çiz, daha hızlı!',
    'Boş kağıt sanat değildir. Boş kağıt, grevdir. Greve izin yok.',
    'Bu çizgiyi beğendim. Tekrar baktım, beğenmedim. Üçüncü kez baktım: yine beğenmedim.',
    'Bu kol neden dizine kadar uzuyor? Neyse, bırak, hitbox\'a iyi gelir.',
    'FUS RO DAH! Çizgi böyle çekilir! Kağıt titresin!',
    'Bu pozda dövüşen kendi ayağına basar. Ama sevdim, bırak öyle kalsın.',
    'Bu yumruk Hadouken atmak istiyor. Engelleme, yazık.',
    'Bu çizimi görseler "FINISH HIM!" diye bağırırlar. Kimi bitireceklerini söylemiyorum.',
    'Bu ayak mı, ekmek mi? Karar ver, sonra çiz, sonra ben karar veririm.',
    'Yanlış çizgi yoktur, yalnızca bitmemiş çizgi vardır. Bu arada, bu yanlış.',
    'Bu çizim çiğ, pişir biraz! Gordon olsa bağırırdı, ben yalnızca iç çekiyorum.',
    'Bu karakter zindanda ilk tuzağa basar. Ayakkabılarına bak.',
    'YOU SHALL NOT PASS! Deadline\'ı kastettim. Çiz, çiz, çiz.',
    'It\'s dangerous to go alone! Al şu silgiyi.',
    'Bu çizim bir oyun olsaydı, yükleme ekranında takılı kalırdı.',
    'Hadouken değil, çizgi çek! Çizgi!',
    'Ben J.K. Simmons değilim. Ama şu an biraz oldum.',
    'Yüzük kimsede yoksa çizim de kimsede yok. Çiz şunu!',
    'It\'s a trap! Bu kadar detaya girme, süre bitiyor!',
    'Sen kimsin? Çizer misin, yoksa kağıdı süsleyen biri mi? Cevabı çizginle ver.',
    'Hey, listen! Süre bitiyor!',
    'Kaydetmeyi unuttun mu? Hayır, bu kağıt. Kaydetmek yok, kalem oynat.',
    'Pikachu bile bu kadar düşünmez. Çiz!',
    'Bu çizimde bir ruh var. Ruhu zayıf ama var.',
    'Konami kodunu denedin mi? Yukarı, yukarı, aşağı, aşağı... sen yine çiz.',
    'Kağıdın kenarında boşluk kalmış. Boşluk, kaybedilen puandır.',
    'Bu karakterin geçmişi var mı? Yok mu? Uydur, hızlıca.',
    'Harika. Şimdi bunu iki kat daha büyük çiz. Neden mi? Patron öyle istiyor.',
    'Şu an çizdiğin şey ya sanat ya da kaza. Sanat de, güven veriyor.',
    'Mario bile bu kadar zıplamadı. Sen de ilerle.',
    'Ben bu çizimi bir oyunun kapağında görürsem alırım. Almam. Ama düşünürüm.',
    'Yoda olsaydı derdi: çiz, çiz, çiz. Denemek yok.',
    'Pasta yalandır, deadline gerçektir.',
    'Bu çizime bakınca Darth Vader gibi derin bir nefes aldım. Sebebi çizim değil.',
  ];
  const SHOUT_MIN = 30, SHOUT_MAX = 45;

  // Söz seçici: totalSec çizim süresi. Dönen fonksiyon her saniye kalan süreyle çağrılır, o an görünecek sözü verir.
  function makeShouter(totalSec) {
    let bag = [], current = null, resumed = false, nextAt = totalSec - (SHOUT_MIN + Math.random() * (SHOUT_MAX - SHOUT_MIN));
    const draw = () => {
      if (!bag.length) bag = SHOUT_POOL.map((_, i) => i).sort(() => Math.random() - .5);
      let i = bag.pop();
      if (SHOUT_POOL[i] === current && bag.length) i = bag.pop();   // torba bitip baştan dolarsa üst üste aynısı gelmesin
      return SHOUT_POOL[i];
    };
    return remSec => {
      let m = null;
      for (const s of SHOUTS) if (s.at < totalSec && remSec <= s.at) m = s;
      if (m && (m.at <= 180 || m.at - remSec < 25)) { resumed = true; return m.t; }
      // Sabit söz bitince eski söz geri gelmesin, yenisi çekilsin.
      if (resumed || remSec <= nextAt) { resumed = false; current = draw(); nextAt = remSec - (SHOUT_MIN + Math.random() * (SHOUT_MAX - SHOUT_MIN)); }
      return current || SHOUTS[0].t;
    };
  }

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
    const name = $('#f-name').value.trim();
    if (name.length < 2) { err.textContent = 'Adını yaz (en az 2 harf).'; return; }
    btn.disabled = true; btn.firstChild.textContent = 'KAYDEDİLİYOR...';
    try {
      const d = await api('/api/register', { method: 'POST', body: { name } });
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
    $('#k-id').textContent = P.id; $('#k-id2').textContent = P.id; $('#k-name').textContent = P.name;
    $('#k-main').textContent = P.prompt; $('#k-twist').textContent = P.twist;
    keepAwake();
    CT.muteButton();
    if (fresh) {
      const f = $('#fflash'); f.hidden = false; audio.count(0);
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(() => { f.hidden = true; }, 900);
    }

    const clock = $('#clock'), fill = $('#hp-fill'), hp = $('#hp'), quote = $('#quote');
    let lastSec = null, lastShout = null, over = false;
    const shouter = makeShouter(P.durationMs / 1000);

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
        const line = shouter(remSec);
        if (line !== lastShout) { lastShout = line; quote.textContent = '"' + line + '"'; }
      }
    };
    const iv = setInterval(tick, 50);
    tick();
  }

  function finish(rem) {
    $('#hp-fill').style.width = '0%';
    $('#clock').innerHTML = '00:00<span class="cs">.00</span>';
    $('#tu-skull').innerHTML = sprite("skull", 7);
    $('#tu-id').textContent = P.id;
    $('#timesup').hidden = false;
    showNameState();
    if (rem > -4000) {                 // sayfa yeni açılmadıysa korna çalsın
      audio.horn();
      if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800]);
    }
  }

  /* ---------------- 4) karakter adı ---------------- */
  const nameForm = $('#nameform'), nameDone = $('#namedone');

  // Üç hâl: ad yok (form açık), ad var (özet + DEĞİŞTİR), yönetici adı sildi ve kilitledi (oyuncu bekler).
  function showNameState(editing = false) {
    const has = !!P.charName;
    if (P.locked && !has) {
      nameForm.hidden = true; nameDone.hidden = false;
      $('#nd-name').textContent = '...';
      $('#nd-sub').textContent = 'Karakterinin adını Art Director verecek.';
      $('#btn-rename').hidden = true;
      return;
    }
    nameForm.hidden = has && !editing;
    nameDone.hidden = !has || editing;
    if (has) {
      $('#nd-name').textContent = P.charName;
      $('#nd-sub').textContent = P.locked ? 'Ad Art Director tarafından belirlendi.' : 'Kaydedildi. Arenada bu adla dövüşecek!';
      $('#btn-rename').hidden = P.locked;
    }
    $('#f-char').value = P.charName || '';
    $('#n-err').textContent = '';
  }

  // Yönetici o arada adı değiştirdiyse sunucudaki hâli çek.
  async function refreshMe() {
    try {
      const d = await api('/api/me?id=' + encodeURIComponent(P.id));
      P.charName = d.player.charName; P.locked = d.player.locked;
    } catch { /* ağ yoksa eldeki hâl kalır */ }
    showNameState();
  }

  nameForm.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#n-err'), btn = $('#btn-name');
    err.textContent = '';
    const name = $('#f-char').value.trim();
    if (name.length < 2) { err.textContent = 'En az 2 harf yaz.'; return; }
    btn.disabled = true;
    try {
      const d = await api('/api/name', { method: 'POST', body: { id: P.id, name } });
      P.charName = d.charName; audio.coin(); showNameState();
    } catch (ex) {
      if (ex.status === 403 || ex.status === 409) { err.textContent = ex.message; await refreshMe(); err.textContent = ex.message; }
      else err.textContent = ex.message;
    }
    btn.disabled = false;
  });
  $('#btn-rename').addEventListener('click', () => showNameState(true));

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
