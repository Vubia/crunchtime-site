// Görev ambarı: üç sandıktan birer parça çekilir, dördüncüden zorunlu ek şart.
// Kalıp: "Silah olarak {silah} kullanan {ruh hali} {karakter} yarat!"
// Her parçanın iki yüzü var: tam hâli (oyuncunun telefonuna) ve kısa hâli (arenada dövüşçünün altına).
// Yeni malzeme eklemek için ilgili listeye bir satır yeter: [tam, kısa]. Silah "kullanan"dan önce,
// ruh hali karakterden önce durabilmeli, yoksa cümle yalpalar. Sülfür tost makinesini hâlâ bırakmadı.

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
  ['devasa bir spatula', 'spatula'],
  ['kaynar bir çaydanlık', 'çaydanlık'],
  ['tost makinesi', 'tost makinesi'],
  ['uzatma kablosu', 'uzatma kablosu'],
  ['ucu kırık bir şemsiye', 'şemsiye'],
  ['dev bir diş fırçası', 'diş fırçası'],
  ['pilli matkap', 'matkap'],
  ['baget ekmek', 'baget'],
  ['ıslak bir paspas', 'paspas'],
  ['vuvuzela', 'vuvuzela'],
  ['kızgın bir ütü', 'ütü'],
  ['bowling topu', 'bowling topu'],
  ['akordeon', 'akordeon'],
  ['katlanır kamp sandalyesi', 'kamp sandalyesi'],
  ['balık ağı', 'balık ağı'],
  ['yıpranmış bir cetvel', 'cetvel'],
  ['çalar saat', 'çalar saat'],
  ['tencere kapağı', 'tencere kapağı'],
  ['dev bir çatal', 'çatal'],
  ['lastik ördek ordusu', 'lastik ördekler'],
  ['rulo duvar kâğıdı', 'duvar kâğıdı'],
  ['ağır bir daktilo', 'daktilo'],
  ['buz pateni', 'buz pateni'],
  ['sürpriz kutusu', 'sürpriz kutusu'],
];

const TWISTS = [
  ['Karakterin üzerinde mutlaka bir kravat ya da papyon olsun.', 'kravat / papyon'],
  ['Yalnızca 3 renk kullanabilirsin.', '3 renk'],
  ['Yanında işe yaramaz minik bir yardımcısı olsun.', 'minik yardımcı'],
  ['Karakter tek ayak üstünde dövüş pozunda olsun.', 'tek ayak'],
  ['Bir gözü diğerinden büyük olsun.', 'asimetrik göz'],
  ['Hitbox belli olsun: başı minik, yumruğu dev.', 'minik kafa, dev yumruk'],
  ['Kostümünde mutlaka puantiyeli bir parça olsun.', 'puantiye'],
  ['Sırtında bir şeyler taşısın: market poşeti, sandık, bir çift terlik...', 'sırtında yük'],
  ['Karakterin en sevdiği yemek çizimin bir yerinde saklı olsun.', 'gizli yemek'],
  ['Ağzı sonuna kadar açık, kahkaha atarken çiz.', 'kahkaha'],
  ['Karakterin bir sloganı olsun, çizimin altına yaz.', 'slogan'],
  ['Süper hamlesinin adını çizimin altına yaz.', 'süper hamle'],
  ['Siluetine bakınca kim olduğu anlaşılmalı.', 'net siluet'],
  ['Karakterin muhteşem bir bıyığı olsun, olmasa bile.', 'dev bıyık'],
];

// crypto ile adil zar: Math.random bu iş için fazla gevşek.
function pick(list) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return list[buf[0] % list.length];
}

// prompt/twist: oyuncunun telefonunda görünen tam metin.
// taskShort: "ruh hali karakter|silah" (arenada iki satıra bölünür); twistShort: kısa ek şart.
export function makeMission() {
  const [weapon, weaponShort] = pick(WEAPONS);
  const [twist, twistShort] = pick(TWISTS);
  const mood = pick(MOODS);
  const character = pick(CHARACTERS);
  return {
    prompt: `Silah olarak ${weapon} kullanan ${mood} ${character} yarat!`,
    twist,
    taskShort: `${mood} ${character}|${weaponShort}`,
    twistShort,
  };
}
