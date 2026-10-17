// Soru ambarı: dövüş turlarında seyirciye sorulan abidik gubidik sorular.
// Her soru iki dövüşçüden birini seçtirir. Gizli kural soru çekilirken zarla belirlenir:
//   'most'  -> en ÇOK oy alanın canı gider
//   'least' -> en AZ oy alanın canı gider
// Soru metninden kural anlaşılmaz; seyirci tahmin eder, kural tur bitince ilan edilir.
// Yeni soru eklemek için listeye bir satır yeter (en fazla 90 harf, "Hangi karakter ...?" kalıbı iyi oturur).
// Brund bu listeyi kalafat sırasında okudu, 13. soruda güldü ve bir daha direksiyona geçmedi.

import { rnd } from './bracket.js';

export const QUESTIONS = [
  'Hangi karakter sabahları dişini fırçalamıyor?',
  'Hangi karakter sinemada hep telefonuyla oynuyor?',
  'Hangi karakter asansörde kimseye selam vermiyor?',
  'Hangi karakter ıslak çorapla ev içinde geziyor?',
  'Hangi karakter pizzaya ananas koyuyor?',
  'Hangi karakter sınavdan önceki gece hiç uyumuyor?',
  'Hangi karakter kedisine gizlice kaşar yediriyor?',
  'Hangi karakter banyoda en yüksek sesle şarkı söylüyor?',
  'Hangi karakter alışveriş merkezinde kaybolup anons yaptırıyor?',
  'Hangi karakter son kurabiyeyi yiyip kimseye söylemiyor?',
  'Hangi karakter alarmı beş kere erteliyor?',
  'Hangi karakter trafikte kornaya basıp sonra özür diliyor?',
  'Hangi karakter yemek siparişini hep yanlış adrese veriyor?',
  'Hangi karakter patatesi çatalla değil elle yiyor?',
  'Hangi karakter kar yağınca ilk dışarı fırlıyor?',
  'Hangi karakter filmlerin sonunu önceden söylüyor?',
  'Hangi karakter tatilde bile e-postalarına bakıyor?',
  'Hangi karakter her fırsatta "ben demiştim" diyor?',
  'Hangi karakter dişçi koltuğunda bayılıyor?',
  'Hangi karakter komşusunun wifi şifresini biliyor?',
  'Hangi karakter uçak inince alkışlıyor?',
  'Hangi karakter ayakkabısını ters giyip fark etmiyor?',
  'Hangi karakter çayı sütle içiyor?',
  'Hangi karakter pazarda simitçiyle bile pazarlık ediyor?',
  'Hangi karakter ödevini otobüste yapıyor?',
  'Hangi karakter yastığını sabaha kadar tekmeliyor?',
  'Hangi karakter navigasyona hiç güvenmiyor?',
  'Hangi karakter mutfakta yangın alarmını çaldırıyor?',
  'Hangi karakter kasaya gelince hep bir şey unuttuğunu hatırlıyor?',
  'Hangi karakter gece yarısı buzdolabına üç kere bakıyor?',
  'Hangi karakter hapşırınca kimseyi uyarmıyor?',
  'Hangi karakter eşofmanla düğüne gidiyor?',
  'Hangi karakter sürpriz doğum gününü bozuyor?',
  'Hangi karakter güneş kremini hep unutuyor?',
  'Hangi karakter parmaklarını çıtlatıp herkesi çıldırtıyor?',
  'Hangi karakter kitabın son sayfasını önce okuyor?',
  'Hangi karakter yalnız kalınca aynayla konuşuyor?',
  'Hangi karakter patron gelince birden çok çalışkan oluyor?',
  'Hangi karakter aynı çorapla bir ay geziyor?',
  'Hangi karakter yoğurda şeker koyuyor?',
  'Hangi karakter mikrofonu görünce kendinden geçiyor?',
  'Hangi karakter bisiklet zilini çalıp "kaçın!" diye bağırıyor?',
  'Hangi karakter her konuşmayı kendi çizimini överek bitiriyor?',
  'Hangi karakter deadline\'ı hep son dakikaya bırakıyor?',
  'Hangi karakter Art Director\'ün kahvesine dokunmaya cesaret ediyor?',
  'Hangi karakter son 5 dakikada bütün çizimi baştan yapmaya karar veriyor?',
  'Hangi karakter market arabasını park yerine bırakıp gidiyor?',
  'Hangi karakter pastadaki mumu üflemeden önce üç dilek tutuyor?',
  'Hangi karakter "bir bardak şeker" isteyip bir saat sohbet ediyor?',
  'Hangi karakter tabaktaki son lokmayı kimseye kaptırmıyor?',
];

// Kullanılmamış sorulardan birini çeker; hepsi bittiyse havuz baştan dolar.
// used: şimdiye kadar sorulanların sıra numaraları (ağaçta saklanır, aynı soru turnuvada tekrar etmesin).
export function pickQuestion(used = []) {
  let pool = QUESTIONS.map((_, i) => i).filter(i => !used.includes(i));
  let nextUsed = used;
  if (!pool.length) { pool = QUESTIONS.map((_, i) => i); nextUsed = []; }
  const idx = pool[rnd(pool.length)];
  return { idx, text: QUESTIONS[idx], used: [...nextUsed, idx] };
}
