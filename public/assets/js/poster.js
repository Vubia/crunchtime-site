// Afiş: QR ve adres satırı, sayfanın açıldığı alan adından üretilir (statik görsel yok).
// Alan adı değişse ya da test adresinden basılsa bile QR doğru yere götürür.
document.getElementById('qr').innerHTML = CT.qr(location.origin + '/');
document.getElementById('url').textContent = location.host;
