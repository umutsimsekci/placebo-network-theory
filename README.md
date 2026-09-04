# Plasebo Ağ Laboratuvarı · CET-N

**Yazar:** Umut Şimşekçi · [ORCID 0000-0002-5469-1551](https://orcid.org/0000-0002-5469-1551). Department of Medical Pharmacology, Gülhane Faculty of Medicine, University of Health Sciences, Ankara, Türkiye.

Literatür incelemesi, model, yazılım, analiz ve metin hazırlığında OpenAI Codex desteği kullanılmıştır. Yapay zekâ bir yazar değildir; otomatik hesaplama kontrolleri insan bilimsel incelemesinin yerine geçmez.

Beklentiyi değiştirin, bir aktarım yolunu kapatın ve öğrenmenin bir sonraki denemeyi nasıl etkilediğini izleyin. CET-N, yedi işlevsel durumlu matematiksel bir modeli keşfetmek için hazırlanmış Türkçe bir tarayıcı simülasyonudur. Model sürümü: **1.0.0**.

**Bilimsel durum:** Parametreler örnek amaçlıdır ve biyolojik olarak kalibre edilmemiştir. Ağ anatomik bir beyin haritası değildir. Zaman ve değerler boyutsuzdur; sonuçlar klinik tahmin, ilaç dozu, bağışıklık gücü veya iyileşme yüzdesi olarak yorumlanamaz. Bu yazılımın yayımlanması modelin hakemli olarak doğrulandığı anlamına gelmez.

## Açın ve deneyin

GitHub Pages etkinleştirilirse simülatörü tarayıcıda kullanabilirsiniz. Deponun ZIP dosyasını indirip çıkardıktan sonra `index.html` dosyasını açmak da yeterlidir. `index.html`, `style.css`, `engine.js` ve `app.js` aynı klasörde kalmalıdır. Yerel kullanım için internet, Node.js, Python, hesap veya kurulum gerekmez. Çevrimiçi kullanımda dosyalar ilk açılışta barındırma hizmetinden yüklenir; hesaplamalar tarayıcıda yapılır. Uygulamada telemetri veya otomatik veri yükleme kodu bulunmaz. DOI bağlantıları isteğe bağlıdır ve internet gerektirir.

1. **Olumlu beklenti** senaryosunu seçip **Başlat** düğmesine basın.
2. **Opioid yolu kapalı** senaryosunda kalan belirti farkını inceleyin.
3. **Yalnız öğrenme** senaryosunda sözel girdi olmadan öğrenilmiş ipucunun etkisini izleyin.
4. **Periferik yollar kapalı** senaryosunda otonom ve endokrin aktarımı birlikte kesmenin sonuçlarını karşılaştırın.
5. Öğrenme oyununda rahatlama, tehdit veya nötr sonuçlar seçin. Nötr denemelerle sönmeyi keşfedin.

**Duraklat** zamanı durdurur; **Sıfırla** mevcut ayarlarla başlangıca döner. Bir sürgüyü değiştirmek yeni bir eşlenmiş deney başlatır. Hız seçimi yalnızca oynatma hızını değiştirir. Ayrıntılı açıklamalar için **Nasıl çalışır?** düğmesini, sürgü yanındaki bilgi simgelerini ve ağ düğümlerini kullanın.

## Karşılaştırmayı doğru okuyun

Düz çizgiler seçili koşulu, kesikli çizgiler nötr eşi gösterir. Kartlardaki etki **Δ = seçili − nötr** farkıdır. Nötr kolda hem `E = 0` hem `ℓ = 0` kullanılır; ağ parametreleri, aktif girdi, duyusal girdi, hastalık eğrisi ve başlangıç durumları aynıdır.

- `E < 0` rahatlama, `E > 0` tehdit yönünde atanmış sözel girdidir. `ℓ`, önceki deneyimden gelen öğrenilmiş ipucu değeridir.
- Negatif belirti farkı bu modelde daha az belirti demektir. Kardiyovasküler ve immün durumlarda artı/eksi yönleri evrensel iyi/kötü sağlık puanı değildir.
- `E = 0` iken `ℓ ≠ 0` ise içsel öncül `m = E + 0.6ℓ` hâlâ sıfır değildir. Bu koşul tek başına doğrudan koşullanma yolunu diğer öğrenilmiş etkilerden ayırmaz.
- Hastalık eğrileri örtüşür çünkü bu modelde ağdan hastalık sürecine bağlantı yoktur. Bu, gerçek hastalıklar hakkında kanıt değil, uygulamanın açık sınır varsayımıdır.
- Kapılar seçili aktarım katsayılarını azaltır. Bir kapıyı kapatmak kaynak düğümü veya tüm biyolojik sistemi kapatmak değildir; gerçek bir ilacın dozu da değildir.

## Üç fikir

    öğrenilmiş ilişki_yeni = ilişki_eski + α × (sonuç − ilişki_eski)
    algı = w × (E + 0.6ℓ) + (1−w) × duyusal_kanıt
    küçük çıktı değişimi ≈ doğrudan etki + ağ üzerinden aktarım

İlk denklem bilinen delta öğrenme kuralının basit bir uygulamasıdır. İkinci denklem tanımlı varsayımlar altında ağırlıklı çıkarımı temsil eder. Üçüncü satır yerel, küçük değişimler için bir açıklamadır. Tam motor doygunluk, işaretli bağlantılar, geri besleme ve farklı zaman sabitleri içerir. Bu temel matematik fikirleri yeni icatlar olarak sunulmaz.

Öğrenme oyunundaki −1/0/+1 sonuçlar atanmış örneklerdir, hasta verisi değildir. Öğrenilmiş değer deneme boyunca sabit tutulur ve yalnızca deneme tamamlanınca güncellenir. Örneğin `α = 0.25` ve başlangıç `ℓ = 0` iken iki rahatlama sonucu `−0.25`, ardından `−0.4375` üretir; sonraki nötr sonuç `−0.328125` olur. Görev eşikleri klinik veya istatistiksel anlamlılık sınırları değildir.

## Deneyinizi saklayın

**Veri CSV**, mevcut zaman serisini ve iki kol arasındaki farkları indirir. **Senaryo JSON**, ayarları ve öğrenme geçmişini saklar. **JSON yükle**, uyumlu ayarları alıp deneyi zaman sıfırdan hazırlar; ara animasyon karesini sürdürmez. İçe aktarma sonlu sayıları, izin verilen aralıkları, model sürümünü ve öğrenme güncellemelerini kontrol eder. Dosya sınırı 1 MB, geçmiş sınırı 1.000 satırdır.

İndirilen ve içe aktarılan dosyalar uygulama tarafından bir hizmete gönderilmez. Sekmeyi kapatmadan kaydetmediğiniz oturum kaybolur. Eğitim denemesi tamamlandıktan sonra grafik yeni deneme için sıfırlandığından, biten denemenin son belirti farkı öğrenme kaydında tutulur; CSV her zaman ekrandaki mevcut deneye aittir.

## Kod ve sınırlar

`engine.js` sayısal modeli ve tüm gerekli katsayıları içerir. `app.js` arayüzü, eşlenmiş deneyi, öğrenme sırasını ve dışa aktarmayı yönetir. `style.css` görünümü, `index.html` sayfayı sağlar. Harici JavaScript/CSS kütüphanesi veya derleme adımı yoktur.

Motor 0.05 model zaman birimlik adımlarla RK4 kullanır; girdiler her adımda orta nokta değerinde tutulur. Hastalık girdisi ve doğrultucu geçişleri nedeniyle bütün eğriler için koşulsuz dördüncü dereceden hata azalması iddiası yoktur. Ayrı bir raporlama yanlılığı parametresi uygulanmamıştır; eğriler, deneyim ile raporlamanın biyolojik olarak ayırt edildiğini göstermez.

## İlgili bilimsel kaynaklar

Bu yayınlar seçili mekanizmaların arka planını sağlar; yazılımdaki bağlantıların veya sayısal katsayıların tamamını doğrulamaz:

- Amanzio ve Benedetti (1999): [beklenti, koşullanma ve nörofarmakolojik yollar](https://doi.org/10.1523/JNEUROSCI.19-01-00484.1999).
- Zunhammer ve arkadaşları (2018): [plasebo yanıtı ile ağrıyla ilişkili beyin örüntülerinin ayrışması](https://doi.org/10.1001/jamaneurol.2018.2017).
- Livrizzi ve arkadaşları (2026): [farelerde inen ağrı düzenleme sisteminin yola özgü müdahaleleri](https://doi.org/10.1016/j.neuron.2026.03.025). Hayvan bulgularının insanlara aktarımı ayrıca sınanmalıdır.

## Lisans

Program kodu [MIT](LICENSE), bu yeni kullanım kılavuzu [CC BY 4.0](LICENSE-DOCUMENTS.md) kapsamındadır. Atıf verilen bilimsel yayınların hakları kendi sahiplerine aittir. Bu depo simülatör yazılımını dağıtır; makale, katılımcı verisi veya yazarların idari kayıtlarını içermez.
