// Görev ambarı: silah, ruh hali ve karakter (iki parçalı) çekilir, bir de zorunlu ek şart eklenir.
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
  'zarı hep 1 atan', 'kritik başarısız atmış', 'martıdan korkan', 'son gevreği kaptırmış',
  'peruğu kayan', 'kostümü dar gelen', 'bütün gün ayakta kalmış',
];

// Karakter iki parçadan kurulur (Türkçe ek kuralı yüzünden iki kalıp var):
//   VARLIK + meslek (yalın)      -> "vampir diş hekimi", "ahtapot muhasebeci"
//   MEKÂN  + meslek (iyelikli)   -> "çöl korsanı", "uzay berberi"
// Kalıba uymayan özel karakterler HAZIR listesinden olduğu gibi çekilir ("İtalyan şef").
// Her MESLEK satırı [yalın, iyelikli] çiftidir; ikincisi ek almış hâlidir (korsan -> korsanı, kasap -> kasabı).
// Hinche "ahtapot muhasebeci"yi görünce bordroyu geri istedi, bordro kimsede çıkmadı.
const VARLIKLAR = [
  'vampir', 'kurt adam', 'mumya', 'uzaylı', 'hayalet', 'Viking', 'samuray', 'goblin', 'ork', 'elf',
  'cüce', 'zombi', 'robot', 'cadı', 'iskelet', 'peri', 'ejderha', 'dev', 'kedi', 'penguen',
  'ahtapot', 'baykuş', 'dinozor', 'kaplumbağa', 'golem', 'minotor', 'gnom', 'hortlak', 'yarı elf',
  'yarı ork', 'martı', 'peluş', 'kostümlü',
];

const MEKANLAR = [
  'çöl', 'orman', 'liman', 'buz', 'dağ', 'bataklık', 'uzay', 'yeraltı', 'gökyüzü', 'okyanus',
  'mağara', 'kale', 'gece', 'sirk', 'sokak', 'çarşı', 'mezarlık', 'köprü', 'zindan', 'tavern',
  'kule', 'Kordon', 'Kemeraltı', 'Alsancak', 'Konak', 'Karşıyaka', 'Alaçatı', 'Bornova', 'İzmircon',
  'fuar', 'stand', 'kuyruk',
];

const MESLEKLER = [
  ['korsan', 'korsanı'],
  ['şef', 'şefi'],
  ['postacı', 'postacısı'],
  ['diş hekimi', 'diş hekimi'],
  ['hemşire', 'hemşiresi'],
  ['berber', 'berberi'],
  ['kuaför', 'kuaförü'],
  ['garson', 'garsonu'],
  ['bahçıvan', 'bahçıvanı'],
  ['muhasebeci', 'muhasebecisi'],
  ['kurye', 'kuryesi'],
  ['bekçi', 'bekçisi'],
  ['balıkçı', 'balıkçısı'],
  ['dondurmacı', 'dondurmacısı'],
  ['astronot', 'astronotu'],
  ['avcı', 'avcısı'],
  ['savaşçı', 'savaşçısı'],
  ['büyücü', 'büyücüsü'],
  ['demirci', 'demircisi'],
  ['terzi', 'terzisi'],
  ['şoför', 'şoförü'],
  ['kasap', 'kasabı'],
  ['tamirci', 'tamircisi'],
  ['hakem', 'hakemi'],
  ['jonglör', 'jonglörü'],
  ['kovboy', 'kovboyu'],
  ['ninja', 'ninjası'],
  ['hurdacı', 'hurdacısı'],
  ['dedektif', 'dedektifi'],
  ['ressam', 'ressamı'],
  ['kaptan', 'kaptanı'],
  ['akrobat', 'akrobatı'],
  ['paladin', 'paladini'],
  ['bard', 'bardı'],
  ['okçu', 'okçusu'],
  ['şövalye', 'şövalyesi'],
  ['rahip', 'rahibi'],
  ['haydut', 'haydudu'],
  ['cellat', 'celladı'],
  ['simyacı', 'simyacısı'],
  ['gevrekçi', 'gevrekçisi'],
  ['boyozcu', 'boyozcusu'],
  ['çaycı', 'çaycısı'],
  ['çizer', 'çizeri'],
  ['maskot', 'maskotu'],
  ['koleksiyoncu', 'koleksiyoncusu'],
];

const HAZIR = [
  'İtalyan şef', 'emekli kovboy', 'yarı balık yarı muhasebeci', 'gezgin dondurmacı',
  'emekli astronot', 'hayalet apartman yöneticisi', 'dev kaplumbağa sürücüsü',
  'zaman yolcusu kurye', 'yeraltı satranç ustası', 'mafya babası kedi', 'yorgun süper kahraman',
  'emekli ejderha avcısı', 'çaylak paladin', 'kaçak tavern sahibi', 'sarhoş cüce bard',
  'emekli zindan efendisi', 'sinirli gnom simyacı', 'martıyla savaşan gevrekçi',
  'Kordon\'un efsanevi dondurmacısı', 'vapura yetişemeyen samuray', 'kuyrukta bekleyen büyücü',
  'kostümü sıkışmış şövalye', 'imza kuyruğundaki ejderha',
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
  ['yirmi yüzlü dev bir zar', 'zar'],
  ['büyülü bir asa', 'büyülü asa'],
  ['kırık bir kılıç', 'kırık kılıç'],
  ['tavernadan çalınmış bir tabure', 'tabure'],
  ['bir şişe iksir', 'iksir'],
  ['ejderha yumurtası', 'ejderha yumurtası'],
  ['martıdan kurtarılmış bir gevrek', 'gevrek'],
  ['dev bir boyoz', 'boyoz'],
  ['vapur halatı', 'vapur halatı'],
  ['kumru ekmeği', 'kumru'],
  ['lokma tepsisi', 'lokma tepsisi'],
  ['dev bir peluş', 'peluş'],
  ['poster tüpü', 'poster tüpü'],
  ['plastik bir cosplay kılıcı', 'cosplay kılıcı'],
  ['yaka kartı ipi', 'yaka kartı'],
  ['figür kutusu', 'figür kutusu'],
];

const TWISTS = [
  ['Karakterin üzerinde mutlaka bir kravat ya da papyon olsun.', 'kravat / papyon'],
  ['Yanında işe yaramaz minik bir yardımcısı olsun.', 'minik yardımcı'],
  ['Karakter tek ayak üstünde dövüş pozunda olsun.', 'tek ayak'],
  ['Bir gözü diğerinden büyük olsun.', 'asimetrik göz'],
  ['Hitbox belli olsun: başı minik, yumruğu dev.', 'minik kafa, dev yumruk'],
  ['Kostümünde mutlaka puantiyeli bir parça olsun.', 'puantiye'],
  ['Sırtında bir şeyler taşısın: market poşeti, sandık, bir çift terlik...', 'sırtında yük'],
  ['Karakterin en sevdiği yemek çizimin bir yerinde saklı olsun.', 'gizli yemek'],
  ['Ağzı sonuna kadar açık, kahkaha atarken çiz.', 'kahkaha'],
  ['Karakterin muhteşem bir bıyığı olsun, olmasa bile.', 'dev bıyık'],
  ['Karakterin elinde bir zar olsun.', 'elinde zar'],
  ['Çizimde gizli bir yirmi yüzlü zar sakla.', 'gizli zar'],
  ['Arka planda bir martı belli belirsiz görünsün.', 'arka planda martı'],
  ['Karakterin bir peluş yardımcısı olsun.', 'peluş yardımcı'],
  ['Kostümün dikişlerini bile çiz.', 'kostüm dikişi'],
  ['Karakterin şapkası ya da saçı vücudundan büyük olsun.', 'dev şapka / saç'],
  ['Ayakkabıları birbirine hiç benzemesin.', 'farklı ayakkabılar'],
  ['Bir kolu diğerinden iki kat uzun olsun.', 'uzun kol'],
  ['Bir kaşı hep havada olsun.', 'havada kaş'],
  ['Gözlüğü kalın camlı ve kocaman olsun.', 'dev gözlük'],
  ['Cebinden bir şeyler taşıp dökülsün.', 'taşan cep'],
  ['Dövüş anında bile yüzü sakin olsun.', 'sakin yüz'],
  ['Gölgesi kendisine hiç benzemesin.', 'tuhaf gölge'],
  ['Vücudunda en az bir bandaj ya da yama olsun.', 'bandaj / yama'],
  ['Gülünce altın bir dişi görünsün.', 'altın diş'],
  ['Dili dışarıda olsun, rakibiyle dalga geçiyor.', 'dil dışarıda'],
  ['Çok sinirli ama kıyafeti çok şirin olsun.', 'sinirli ama şirin'],
  ['Çok uzun bir pelerin ya da atkı taşısın.', 'uzun pelerin'],
  ['Zırhı mutfak eşyalarından yapılmış olsun.', 'mutfak zırhı'],
  ['Kaskında ya da başında boynuz olsun.', 'boynuzlu kask'],
  ['Elinden bir büyü ışığı fışkırsın.', 'büyü ışığı'],
  ['Kemerinde bir iksir şişesi sallansın.', 'kemerde iksir'],
  ['Kalkanı bir tepsi olsun.', 'tepsi kalkan'],
  ['Belinde bir şampiyonluk kemeri olsun.', 'şampiyon kemeri'],
  ['Zafer pozu çiz: kazanmış, kolları havada.', 'zafer pozu'],
  ['Özel hamlesini yaparken etrafında enerji halkası olsun.', 'enerji halkası'],
  ['Göğsünde ya da sırtında bir amblem olsun.', 'amblem'],
  ['Dövüş pozunda ama çok sıkılmış görünsün.', 'sıkılmış dövüşçü'],
  ['Bir yumruğu alevle ya da buzla kaplı olsun.', 'alevli yumruk'],
  ['Kostümü elle yapılmış gibi görünsün, hatalarıyla birlikte.', 'el yapımı kostüm'],
  ['Dev bir maskeyle dövüşsün.', 'dev maske'],
  ['Kostümünün bir parçası kopmuş olsun.', 'kopan parça'],
  ['Peruğu hafifçe kaymış olsun.', 'kayık peruk'],
  ['Karakter bir Hadouken pozu çiziyor gibi olsun.', 'hadouken pozu'],
  ['Karakter "geçemezsin!" der gibi dursun.', 'geçemezsin pozu'],
];

// crypto ile adil zar: Math.random bu iş için fazla gevşek.
function pick(list) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return list[buf[0] % list.length];
}

// Yüzde kaç ihtimalle olacağını crypto ile adil atar.
function chance(pct) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % 100 < pct;
}

// %20 hazır karakter; kalanın yarısı mekânlı ("çöl korsanı"), yarısı varlıklı ("vampir korsan").
function makeCharacter() {
  if (chance(20)) return pick(HAZIR);
  const [yalin, iyelikli] = pick(MESLEKLER);
  return chance(50) ? `${pick(MEKANLAR)} ${iyelikli}` : `${pick(VARLIKLAR)} ${yalin}`;
}

// prompt/twist: oyuncunun telefonunda görünen tam metin.
// taskShort: "ruh hali karakter|silah" (arenada iki satıra bölünür); twistShort: kısa ek şart.
export function makeMission() {
  const [weapon, weaponShort] = pick(WEAPONS);
  const [twist, twistShort] = pick(TWISTS);
  const mood = pick(MOODS);
  const character = makeCharacter();
  return {
    prompt: `Silah olarak ${weapon} kullanan ${mood} ${character} yarat!`,
    twist,
    taskShort: `${mood} ${character}|${weaponShort}`,
    twistShort,
  };
}
