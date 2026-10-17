// Ortak mutfak: istek atıcı, ses, piksel çizimler. Her sayfa bunu önce yükler.
// Korsan notu: bu dosyada gerçek define yok, ama kaptanın kornası burada çalıyor.
(() => {
  'use strict';
  const CT = (window.CT = {});

  CT.$ = (s, r = document) => r.querySelector(s);
  CT.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  CT.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  CT.sleep = ms => new Promise(r => setTimeout(r, ms));

  // Tek kapı: JSON konuşur, hata olursa mesajı olan bir Error fırlatır.
  CT.api = async (path, { method = 'GET', body, admin = false } = {}) => {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (admin) headers['x-admin-token'] = localStorage.getItem('ct_admin') || '';
    let res;
    try {
      res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch {
      const e = new Error('Bağlantı yok. Wifi var mı?'); e.status = 0; throw e;
    }
    let data = null;
    try { data = await res.json(); } catch { /* gövde JSON değil */ }
    if (!res.ok) { const e = new Error((data && data.error) || 'Hata ' + res.status); e.status = res.status; throw e; }
    return data;
  };

  // mm:ss
  CT.mmss = sec => String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');

  /* ------------------------------------------------------------------
     SES: dosya yok, her şey osilatörden çıkar (bant genişliği sıfır, kablo karışmaz).
     Tarayıcılar ilk dokunuşa kadar sesi kapalı tutar; "PRESS START" bunu açar.
     ------------------------------------------------------------------ */
  CT.audio = (() => {
    let ctx = null;
    let on = localStorage.getItem('ct_mute') !== '1';
    const ensure = () => {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const tone = (f, dur, type = 'square', vol = 0.1, delay = 0, to = null) => {
      if (!on || !ensure()) return;
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    };
    const noise = (dur, vol = 0.2, delay = 0) => {
      if (!on || !ensure()) return;
      const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; g.gain.value = vol; s.connect(g).connect(ctx.destination); s.start(ctx.currentTime + delay);
    };
    return {
      unlock: ensure,
      get on() { return on; },
      toggle() { on = !on; localStorage.setItem('ct_mute', on ? '0' : '1'); if (on) { ensure(); tone(660, .1); } return on; },
      beep(f = 880) { tone(f, .12, 'square', .09); },
      coin() { tone(988, .07, 'square', .08); tone(1319, .22, 'square', .08, .07); },
      count(n) { tone(n === 0 ? 1175 : 523, n === 0 ? .5 : .18, 'square', .1); },
      hit() { noise(.12, .25); tone(140, .12, 'sawtooth', .12, 0, 60); },
      ko() { noise(.5, .35); tone(110, .7, 'sawtooth', .16, 0, 38); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'square', .09, i * .13)); },
      // Hava kornası: üç testere dişi birden, bir akor halinde.
      horn() { [220, 277, 330].forEach(f => tone(f, 1.6, 'sawtooth', .12)); tone(110, 1.6, 'square', .1); },
    };
  })();

  /* ------------------------------------------------------------------
     PİKSEL ÇİZİMLER: harf = renk, nokta = boş. "mirror" ise satırın yarısı yazılır, ayna alınır.
     ------------------------------------------------------------------ */
  const PAL = { K: '#000', Y: '#ffd400', O: '#ff8a00', W: '#fff', R: '#e4002b', G: '#39ff14', C: '#00e5ff', D: '#777' };
  const SPR = {
    trophy: { mirror: true, rows: ['..KKKKK', 'KKKYYWY', 'KYKYWYY', 'KYKYWYY', 'KYKYYYY', '.KKYYYY', '..KKYYY', '...KKYY', '.....KY', '.....KY', '...KKKY', '..KOOOO', '..KKKKK'] },
    heart: { mirror: true, rows: ['..KKK.', '.KRRRK', 'KRWRRR', 'KRWRRR', 'KRRRRR', '.KRRRR', '..KRRR', '...KRR', '....KR', '.....K'] },
    star: { mirror: true, rows: ['.....K', '....KY', '....KY', 'KKKKKY', 'KYYYYY', '.KYYYY', '..KYYY', '..KYYK', '.KYYK.', '.KYK..', '.KK...'] },
    skull: { mirror: true, rows: ['..KKKK', '.KWWWW', 'KWWWWW', 'KWKKWW', 'KWKKWW', 'KWWWWK', '.KWWWW', '..KWKW', '..KKKK'] },
    speaker: { mirror: false, rows: ['....W.....', '...WW...W.', 'WWWWW.W..W', 'WWWWW..W.W', 'WWWWW..W.W', 'WWWWW.W..W', '...WW...W.', '....W.....'] },
  };
  CT.sprite = (name, px = 4, cls = '') => {
    const s = SPR[name];
    const rows = s.mirror ? s.rows.map(r => r + r.slice(0, -1).split('').reverse().join('')) : s.rows;
    const w = rows[0].length, h = rows.length;
    let rects = '';
    rows.forEach((row, y) => {
      for (let x = 0; x < w;) {
        const c = row[x];
        if (c === '.' || !PAL[c]) { x++; continue; }
        let e = x; while (e < w && row[e] === c) e++;
        rects += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${PAL[c]}"/>`;
        x = e;
      }
    });
    return `<svg class="sp ${cls}" width="${w * px}" height="${h * px}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${rects}</svg>`;
  };

  // Sağ alttaki ses düğmesi (isteyen sayfa çağırır).
  CT.muteButton = () => {
    const b = document.createElement('button');
    b.className = 'mute' + (CT.audio.on ? '' : ' off');
    b.setAttribute('aria-label', 'Sesi aç/kapat');
    b.innerHTML = CT.sprite('speaker', 3);
    b.addEventListener('click', () => { b.classList.toggle('off', !CT.audio.toggle()); });
    document.body.appendChild(b);
  };

  /* ------------------------------------------------------------------
     QR: adres neyse QR o. Statik görsel yok; sayfa hangi adreste açıldıysa kod ona göre çizilir
     (alan adı değişse de, test adresinde de doğru yere götürür). Sayfada qrcode.js yüklü olmalı.
     Dönen şey tek parça SVG yazısıdır; kenar boşluğu (sessiz bölge) dahildir.
     ------------------------------------------------------------------ */
  CT.qr = (text, margin = 2) => {
    const q = qrcode(0, 'M');
    q.addData(String(text));
    q.make();
    const n = q.getModuleCount(), size = n + margin * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        let e = c; while (e < n && q.isDark(r, e)) e++;
        d += `M${c + margin} ${r + margin}h${e - c}v1h-${e - c}z`;
        c = e - 1;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR kod"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  };
})();
