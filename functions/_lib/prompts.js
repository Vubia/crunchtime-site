// Görev ambarı: üç sandıktan birer parça çekilir, dördüncüden zorunlu ek şart.
// Kalıp: "Silah olarak {silah} kullanan {ruh hali} {karakter}"
// Yeni malzeme eklemek için ilgili listeye bir satır eklemek yeter. Kural: silah "kullanan"dan önce,
// ruh hali de karakterden önce durabilmeli, yoksa cümle yalpalar.

const MOODS = [
  'öfkeli', 'sürekli ağlayan', 'aşırı kibirli', 'uykusuz', 'korkunç derecede neşeli',
  'vergi borcu olan', 'kendini fazla ciddiye alan', 'aşırı utangaç', 'intikam peşinde koşan',
  'pili bitmek üzere olan', 'üç gündür aç', 'diyetteki', 'her şeyden şüphelenen',
  'sadece bağırarak konuşan', 'sınav sabahı panik halindeki', 'ağır bir hayal kırıklığı yaşayan',
  'kıskançlıktan kuduran', 'tatile hasret', 'saati şaşmış', 'inanılmaz kendinden emin',
];

const CHARACTERS = [
  'İtalyan şef', 'emekli kovboy', 'ninja', 'uzaylı postacı', 'vampir diş hekimi',
  'hurdacı robot', 'yarı balık yarı muhasebeci', 'gece bekçisi', 'Viking balıkçı',
  'cadı berber', 'gezgin dondurmacı', 'çöl korsanı', 'kurt adam hemşire', 'emekli astronot',
  'sirk jonglörü', 'hayalet apartman yöneticisi', 'dev kaplumbağa sürücüsü', 'samuray garson',
  'mumya kuaför', 'bahçıvan goblin', 'zaman yolcusu kurye', 'yeraltı satranç ustası',
  'mafya babası kedi', 'yorgun süper kahraman',
];

const WEAPONS = [
  'devasa bir spatula', 'kaynar bir çaydanlık', 'tost makinesi', 'uzatma kablosu',
  'ucu kırık bir şemsiye', 'dev bir diş fırçası', 'pilli matkap', 'baget ekmek',
  'ıslak bir paspas', 'vuvuzela', 'kızgın bir ütü', 'bowling topu', 'akordeon',
  'katlanır kamp sandalyesi', 'balık ağı', 'yıpranmış bir cetvel', 'çalar saat',
  'tencere kapağı', 'dev bir çatal', 'lastik ördek ordusu', 'rulo duvar kâğıdı',
  'ağır bir daktilo', 'buz pateni', 'sürpriz kutusu',
];

const TWISTS = [
  'Karakterin üzerinde mutlaka bir kravat ya da papyon olsun.',
  'Yalnızca 3 renk kullanabilirsin.',
  'Yanında işe yaramaz minik bir yardımcısı olsun.',
  'Karakter tek ayak üstünde dövüş pozunda olsun.',
  'Bir gözü diğerinden büyük olsun.',
  'Hitbox belli olsun: başı minik, yumruğu dev.',
  'Kostümünde mutlaka puantiyeli bir parça olsun.',
  'Sırtında bir şeyler taşısın: market poşeti, sandık, bir çift terlik...',
  'Karakterin en sevdiği yemek çizimin bir yerinde saklı olsun.',
  'Ağzı sonuna kadar açık, kahkaha atarken çiz.',
  'Karaktere bir isim bul ve çizimin altına yaz.',
  'Süper hamlesinin adını çizimin altına yaz.',
  'Siluetine bakınca kim olduğu anlaşılmalı.',
  'Karakterin muhteşem bir bıyığı olsun, olmasa bile.',
];

// crypto ile adil zar: Math.random bu iş için fazla gevşek.
function pick(list) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return list[buf[0] % list.length];
}

export function makeMission() {
  const prompt = `Silah olarak ${pick(WEAPONS)} kullanan ${pick(MOODS)} ${pick(CHARACTERS)} yarat!`;
  return { prompt, twist: pick(TWISTS) };
}
