// Seyirci oylaması: oylama açıksa iki çizim çıkar, dokunan oy verir. Kapalıysa "bekle" der.
// Cihaz kimliği localStorage'da durur; aynı cihazdan gelen ikinci oy ilkini ezer.
(() => {
  'use strict';
  const { $, api, esc } = CT;
  const body = $('#v-body');

  let voter = localStorage.getItem('ct_voter');
  if (!voter) {
    voter = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => (b % 36).toString(36)).join('');
    localStorage.setItem('ct_voter', voter);
  }

  let key = '';   // aynı görünümü boşuna yeniden çizmemek için
  const find = (br, id) => { for (const r of br.rounds) for (const m of r) if (m.id === id) return m; return null; };
  const photo = (br, id) => `/api/photo?id=${id}&v=${br.fighters[id].v}`;

  function card(br, id, side, pick) {
    const f = br.fighters[id];
    return `<button class="vcard${pick === side ? ' pick' : ''}" data-side="${side}" type="button">
      <img src="${photo(br, id)}" alt="${esc(id)}"><div class="vl">${esc(id)}</div><div class="vn">${esc(f.name)}</div></button>`;
  }
  function draw(s) {
    const br = s.bracket;
    if (!br) {
      if (key !== 'none') { key = 'none'; body.innerHTML = '<div class="wait">Turnuva henüz başlamadı.<br>Ekrana bak, birazdan başlıyor!</div>'; }
      return;
    }
    if (br.voting) {
      const m = find(br, br.voting);
      const pick = localStorage.getItem('ct_pick_' + br.voting) || '';
      const k = 'v:' + br.voting + ':' + pick;
      if (key === k) return;
      key = k;
      body.innerHTML = `<div class="panel" style="margin-top:12px"><h2>KİM KAZANSIN?</h2><p>Birine dokun. Kapanana kadar fikrini değiştirebilirsin.</p></div>
        <div class="vs-wrap">${card(br, m.a, 'a', pick)}<div class="vs-mid">VS</div>${card(br, m.b, 'b', pick)}</div>`;
      return;
    }
    const k = 'w:' + (br.champion || '') + ':' + (br.last ? br.last.at : 0);
    if (key === k) return;
    key = k;
    body.innerHTML = br.champion
      ? `<div class="wait"><b style="font:14px/1.6 PS2P;color:var(--yellow)">ŞAMPİYON</b><br>${esc(br.champion)} - ${esc(br.fighters[br.champion].name)}<br>Hepinize teşekkürler!</div>`
      : '<div class="wait">Oylama kapalı.<br>Sıradaki dövüşü bekle...</div>';
  }

  body.addEventListener('click', async e => {
    const c = e.target.closest('.vcard'); if (!c) return;
    const mid = latest && latest.bracket && latest.bracket.voting; if (!mid) return;
    const side = c.dataset.side;
    try {
      await api('/api/vote', { method: 'POST', body: { matchId: mid, side, voter } });
      localStorage.setItem('ct_pick_' + mid, side);
      if (navigator.vibrate) navigator.vibrate(60);
      draw(latest);
    } catch (ex) { alert(ex.message); poll(); }
  });

  let latest = null;
  async function poll() {
    if (document.hidden) return;
    try { latest = await api('/api/state'); draw(latest); } catch { /* ağ kesilirse bir sonraki turda tekrar */ }
  }
  poll(); setInterval(poll, 4000);
  document.addEventListener('visibilitychange', poll);
})();
