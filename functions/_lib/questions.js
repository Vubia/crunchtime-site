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
  'Hangi karakter zar atmadan önce zarı üfleyip dua ediyor?',
  'Hangi karakter her sandığın mimik olduğundan şüpheleniyor?',
  'Hangi karakter tavernada hesabı ödemeden pencereden kaçıyor?',
  'Hangi karakter ejderhayla pazarlık etmeyi deniyor?',
  'Hangi karakter zindanda her tuzağa birinci basıyor?',
  'Hangi karakter kritik başarısızlıktan sonra "bir daha atsam?" diyor?',
  'Hangi karakter büyü kitabını otobüste unutuyor?',
  'Hangi karakter oyun yöneticisine börek ısmarlayıp zar kayırması umuyor?',
  'Hangi karakter seviye atlar atlamaz kıyafet mağazasına koşuyor?',
  'Hangi karakter orkla kavga ederken bile "pardon" diyor?',
  'Hangi karakter büyücü kulesinde asansör arıyor?',
  'Hangi karakter ganimeti bölüşürken hesap makinesi çıkarıyor?',
  'Hangi karakter büyülü kılıcıyla ekmek kesiyor?',
  'Hangi karakter ejderha uyurken tam o anda hapşırıyor?',
  'Hangi karakter iksirin etiketini okumadan içiyor?',
  'Hangi karakter martıya gevrek kaptırıp arkasından bağırıyor?',
  'Hangi karakter vapura son saniyede koşarak yetişiyor?',
  'Hangi karakter Kordon\'da bisiklet yolunda yürüyüp herkesi çıldırtıyor?',
  'Hangi karakter Alsancak\'ta park yeri için bir saat dönüyor?',
  'Hangi karakter boyozun yanında üç yumurta yiyor?',
  'Hangi karakter Kemeraltı\'nda pazarlığı kaybedip yine de teşekkür ediyor?',
  'Hangi karakter Saat Kulesi\'nin önünde sürekli selfie çekiyor?',
  'Hangi karakter İZBAN\'da ayakta uyuyup durağını kaçırıyor?',
  'Hangi karakter lokma için "tek porsiyon" deyip üçüncüyü sipariş ediyor?',
  'Hangi karakter martıyla göz göze gelip pes ediyor?',
  'Hangi karakter ejderhasını Kordon\'da gezdirmeye çalışıyor?',
  'Hangi karakter büyü yapıp vapuru bekletmeye çalışıyor?',
  'Hangi karakter Kemeraltı\'nda büyülü kılıcı pazarlıkla alıyor?',
  'Hangi karakter İzmircon\'a kostümle gelip kapıdan sığamıyor?',
  'Hangi karakter peruğuyla tuvalete girmeye çalışıyor?',
  'Hangi karakter cosplay yarışmasında sahneden inmek bilmiyor?',
  'Hangi karakter İzmircon\'da her zaman aynı kostümle geziyor?',
  'Hangi karakter standlarda "sadece bakıyorum" deyip iki poşetle çıkıyor?',
  'Hangi karakter figür standında "çok pahalı" deyip yine de alıyor?',
  'Hangi karakter çizer masasında "bunu da çizer misiniz?" diye listeyi uzatıyor?',
  'Hangi karakter oyun turnuvasında kaybedince fişi çekmek istiyor?',
  'Hangi karakter workshop\'ta kalemini unutup komşusunun kalemini kapıyor?',
  'Hangi karakter İzmircon\'da Art Director\'ü görünce çizimini saklıyor?',
  'Hangi karakter İzmircon\'un son günü standın altında uyuyakalıyor?',
  'Hangi karakter İzmircon çıkışında ayakkabılarını elinde taşıyor?',
  'Hangi karakter ejderhasını İzmircon bilet kuyruğuna sokmaya çalışıyor?',
  'Hangi karakter büyücü cübbesiyle sıcakta İzmircon kuyruğunda pişiyor?',
  'Hangi karakter "Fus Ro Dah!" diye bağırıp önündeki masayı deviriyor?',
  'Hangi karakter Hadouken yapmak için gerçekten sokakta kollarını açıyor?',
  'Hangi karakter boss savaşından önce kaydetmeyi hep unutuyor?',
  'Hangi karakter yüzüğü kaybedince bütün mahalleyi ayağa kaldırıyor?',
  'Hangi karakter Mario gibi her boruya girmeye çalışıyor?',
  'Hangi karakter her mantarı yiyip büyüyeceğini umuyor?',
  'Hangi karakter Gandalf gibi "geçemezsin!" diyip kapıyı tutuyor?',
  'Hangi karakter Yoda gibi cümleyi ters kurup öyle konuşuyor?',
  'Hangi karakter "Pasta yalandır" deyip yine de pastayı yiyor?',
  'Hangi karakter Rocky müziğiyle merdiven çıkıp yarı yolda pes ediyor?',
  'Hangi karakter Pokémon topunu bozuk para gibi cebinde taşıyor?',
  'Hangi karakter oyunda tuzak görünce "bu bir tuzak" deyip yine de giriyor?',
];

// Kullanılmamış sorulardan birini çeker; havuzdaki HER soru bir kez sorulmadan hiçbiri tekrar gelmez.
// used: şimdiye kadar sorulanların METİNLERİ (veritabanında ağaçtan bağımsız saklanır: ağaç yeniden kurulsa da,
// soru listesi düzenlenip numaralar kaysa da tekrar çıkmaz). Havuz bitince tur baştan başlar; yalnızca yeni
// turun ilk sorusu, önceki turun son sorusu olmasın.
export function pickQuestion(used = []) {
  const seen = new Set(used);
  let pool = QUESTIONS.filter(q => !seen.has(q));
  let base = used;
  if (!pool.length) {
    const last = used[used.length - 1];
    base = [];
    pool = QUESTIONS.filter(q => q !== last);
    if (!pool.length) pool = QUESTIONS.slice();   // tek soruluk havuz
  }
  const text = pool[rnd(pool.length)];
  return { text, used: [...base, text] };
}
