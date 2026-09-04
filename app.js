/* Offline educational interface. All numerical dynamics are delegated to engine.js. */
(function() {
'use strict';
const $=id=>document.getElementById(id), E=window.CET, DT=.05, FULL_DURATION=100, TRIAL_DURATION=30;
const defs=[
 ['expectation','Sözel beklenti · E',-1,1,.05,-.7,'− rahatlama','+ tehdit','Negatif beklenti daha az belirtiyi, pozitif beklenti daha fazla belirtiyi temsil eder. Öğrenilmiş ilişki ℓ ayrı tutulur.'],
 ['prior_weight','Öncüle ağırlık · w',0,1,.05,.6,'duyuma ağırlık','öncüle ağırlık','Algılanan belirtide E + 0.6ℓ öncülünün ağırlığı. Biyolojik olarak ölçülmüş güven puanı değildir.'],
 ['association','Öğrenilmiş ilişki · ℓ',-1,1,.05,0,'rahatlama izi','tehdit izi','Önceki deneyimin bıraktığı ilişki. E sıfırken de ağı etkileyebilir. Eğitim denemesi tamamlandıktan sonra güncellenir.'],
 ['coupling','Ağ bağlantı gücü · κ',0,1.5,.05,1,'bağlantı yok','daha güçlü ağ','W ağ bağlantıları ve H duyusal geri beslemesi birlikte ölçeklenir. Doğrudan girişler ölçeklenmez.'],
 ['opioid_gate','Opioid → duyusal kapı',0,1,.05,1,'kapalı','açık','Opioid düğümünün duyusal geri besleme katsayısını ayarlar. Sıfır, opioid düğümünü veya diğer yolları bütünüyle kapatmaz.'],
 ['nocebo_gate','Nocebo → duyusal kapı',0,1,.05,1,'kapalı','açık','Tehdit/nocebo düğümünün duyusal katkısını ayarlar. Pozitif ve negatif beklenti yolları simetrik değildir.'],
 ['autonomic_gate','Otonom → perifer kapısı',0,1,.05,1,'aktarımı kes','aktarımı aç','Otonom düğümden kardiyovasküler ve immün eksenlere giden iki oku kapatır/açar; otonom düğüm çalışmaya devam edebilir.'],
 ['endocrine_gate','Endokrin → perifer kapısı',0,1,.05,1,'aktarımı kes','aktarımı aç','Endokrin düğümden kardiyovasküler ve immün eksenlere giden iki oku kapatır/açar; endokrin düğüm çalışmaya devam edebilir.']
];
const advDefs=[
 ['drug','Ortak ilaç girdisi · D',0,1,.05,0,'yok','1.00','İki kola eşit girer: kardiyovasküler eksene +0.15D, immün eksene −0.15D. Gerçek bir ilacın farmakolojisini temsil etmez.'],
 ['disease_initial','Başlangıç hastalık süreci',0,1,.05,.6,'0.00','1.00','İki kolda aynı d(t)=d(0) exp(−0.02t). Bağlam bu süreci değiştirmez. Bu bağımsızlık model varsayımıdır.'],
 ['sensory','Ortak duyusal girdi',-1,1,.05,0,'−1.00','+1.00','Ağdan önce iki kola eşit eklenen duyusal girdi. Ölçülmüş ağrı veya uyaran birimi değildir.'],
 ['learning_rate','Öğrenme hızı · α',0,1,.05,.25,'değişim yok','tam güncelleme','Her tamamlanan eğitim denemesinde ilişki, tahmin hatasının α kadarını alır. Deneme içi ağ dinamiğinden ayrıdır.']
];
const allDefs=defs.concat(advDefs), initial=Object.fromEntries(allDefs.map(d=>[d[0],d[5]]));
let settings={...initial}, history=[], completed=new Set(), running=false,trial=null,lastFrame=null,accumulator=0;
let t=0,duration=FULL_DURATION,x=Array(7).fill(0),neutral=Array(7).fill(0),records=[],session=null,renderAt=0;
const num=(v,n=3)=>Math.abs(v)<.5*Math.pow(10,-n)?(0).toFixed(n):(v>0?'+':'')+v.toFixed(n);
const plain=(v,n=3)=>Math.abs(v)<.5*Math.pow(10,-n)?(0).toFixed(n):v.toFixed(n);
const controlKeys=['prior_weight','coupling','opioid_gate','nocebo_gate','autonomic_gate','endocrine_gate','learning_rate'];
const presets={
 relief:{...initial,expectation:-.7},
 threat:{...initial,expectation:.7},
 conditioning:{...initial,expectation:0,association:-.8},
 blockade:{...initial,expectation:-.7,opioid_gate:0},
 isolation:{...initial,expectation:-.7,association:-.5,autonomic_gate:0,endocrine_gate:0},
 neutral:{...initial,expectation:0}
};
function controlMarkup(d) {
 return '<div class="control"><div class="control-header"><label for="'+d[0]+'">'+d[1]+'</label><button class="help" type="button" data-tooltip="'+d[8]+'" aria-label="'+d[1]+': '+d[8]+'">ⓘ</button><output id="'+d[0]+'Value" for="'+d[0]+'">'+plain(d[5],2)+'</output></div><input type="range" id="'+d[0]+'" min="'+d[2]+'" max="'+d[3]+'" step="any" value="'+d[5]+'"><div class="range-labels"><span>'+d[6]+'</span><span>'+d[7]+'</span></div></div>';
}
$('controls').innerHTML=defs.map((d,i)=>(i===4?'<div class="control-divider"><p class="eyebrow">MEKANİZMA KAPILARI</p></div>':'')+controlMarkup(d)).join('');
$('advancedControls').innerHTML=advDefs.map(controlMarkup).join('');
function syncControls() {
 allDefs.forEach(d=>{$(d[0]).value=settings[d[0]];$(d[0]+'Value').value=plain(settings[d[0]],2);});
}
function configure() {return E.configuration(Object.fromEntries(controlKeys.map(k=>[k,settings[k]])));}
function inputAt(time,isNeutral=false) {
 const s=session.settings;
 return E.inputs({expectation:isNeutral?0:s.expectation,association:isNeutral?0:s.association,drug:s.drug,sensory:s.sensory,disease:E.diseaseTrajectory(time,s.disease_initial,0,session.p.disease_decay)});
}
function record() {
 const a=E.observations(x,session.p,inputAt(t)),b=E.observations(neutral,session.p,inputAt(t,true));
 records.push({t,x:x.slice(),neutral:neutral.slice(),a,b,delta:a.map((v,j)=>v-b[j])});
}
function disableControls(active) {
 allDefs.forEach(d=>{$(d[0]).disabled=active;});
 document.querySelectorAll('.preset').forEach(b=>b.disabled=active);
 ['trainRelief','trainThreat','trainNeutral','importJson','clearLearning'].forEach(id=>$(id).disabled=active);
 $('parameterNotice').textContent=active?'Eğitim sırasında ayarlar sabittir. Sıfırla, denemeyi öğrenme güncellemesi olmadan iptal eder.':'Bir ayarı değiştirmek yeni, eşleştirilmiş bir deney başlatır.';
}
function resetExperiment() {
 running=false;trial=null;lastFrame=null;accumulator=0;t=0;duration=FULL_DURATION;
 x=Array(7).fill(0);neutral=Array(7).fill(0);records=[];
 session={p:configure(),settings:{...settings}};record();disableControls(false);
 $('learningStatus').classList.remove('in-training');
 render(true);
}
function updatePresetState(name) {
 document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
}
function selectPreset(name,autostart=false) {
 if(!presets[name])return;
 settings={...presets[name]};syncControls();updatePresetState(name);resetExperiment();
 $('learningStatus').textContent='Hazır deney yüklendi. Önceki öğrenme kaydı korunur; bu deneyin ℓ değeri hazır ayardan gelir.';
 if(autostart)play();
}
allDefs.forEach(d=>$(d[0]).addEventListener('input',()=>{
 settings[d[0]]=Number($(d[0]).value);$(d[0]+'Value').value=plain(settings[d[0]],2);
 updatePresetState(null);resetExperiment();
}));
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>selectPreset(b.dataset.preset)));
function play() {
 if(t>=duration-1e-9)resetExperiment();
 running=!running;lastFrame=null;render(true);
}
$('playButton').addEventListener('click',play);
$('resetButton').addEventListener('click',()=>{
 const cancelled=!!trial;resetExperiment();
 if(cancelled)$('learningStatus').textContent='Deneme iptal edildi. Öğrenilmiş ilişki güncellenmedi.';
});
function step() {
 const midpoint=t+DT/2;
 x=E.rk4Step(x,DT,session.p,inputAt(midpoint));
 neutral=E.rk4Step(neutral,DT,session.p,inputAt(midpoint,true));
 t=Math.min(duration,Math.round((t+DT)*1e10)/1e10);
 record();
 if(t>=duration-1e-9){
  running=false;
  if(trial){finishTrial();return;}
 }
}
function frame(stamp) {
 if(running) {
  if(lastFrame!==null) {
   accumulator+=Math.min((stamp-lastFrame)/1000,.15)*Number($('speed').value);
   let steps=0;
   while(accumulator>=DT&&running&&steps<100) {accumulator-=DT;step();steps++;}
  }
  lastFrame=stamp;
  if(stamp-renderAt>80){render();renderAt=stamp;}
 } else lastFrame=null;
 requestAnimationFrame(frame);
}

const nodes=[
 {id:'command',x:450,y:67,name:'Bağlam komutu',info:'Komut: sözel beklenti, öğrenilmiş ilişki ve algısal çıkarımdan gelen birleşik işlevsel giriş. Tek bir anatomik beyin bölgesi değildir.'},
 {id:'opioid',x:200,y:169,name:'Opioid yol',info:'Opioid yol: pozitif aktivasyonlu, doyuma ulaşan örnek analjezi değişkeni. Opioid kapısı bu değişkenin duyusal geri beslemesini ölçekler.'},
 {id:'threat',x:700,y:169,name:'Tehdit / nocebo',info:'Tehdit/nocebo: pozitif aktivasyonlu, doyuma ulaşan örnek kolaylaştırıcı yol. CCK gibi bulgularla gerekçelendirilir; ölçülmüş CCK konsantrasyonu değildir.'},
 {id:'autonomic',x:300,y:301,name:'Otonom',info:'Otonom durum: bağlam komutundan ve doğrudan koşullanma yolundan etkilenir. Kapısı yalnızca iki periferik eksene aktarımı kontrol eder.'},
 {id:'endocrine',x:600,y:301,name:'Endokrin',info:'Endokrin durum: daha yavaş örnek düzenleyici eksen. Bir hormonun gerçek konsantrasyonu veya tüm endokrin sistem değildir.'},
 {id:'cardiovascular',x:270,y:429,name:'Kardiyovasküler',info:'Kardiyovasküler sapma: otonom/endokrin aktarımı ve ortak ilaç girdisini alan örnek eksen. Pozitif ya da negatif olması tek başına iyi/kötü anlamına gelmez.'},
 {id:'immune',x:630,y:429,name:'İmmün',info:'İmmün sapma: otonom/endokrin aktarımı ve ortak ilaç girdisini alan yavaş örnek eksen. Bağışıklık gücü veya klinik iyileşme yüzdesi değildir.'}
];
const edges=[
 {from:0,to:1,path:'M411 93 L239 145',sign:'−',sx:322,sy:111},
 {from:0,to:2,path:'M489 93 L661 145',sign:'+',sx:578,sy:111},
 {from:0,to:3,path:'M427 108 L323 261',sign:'+',sx:365,sy:206},
 {from:0,to:4,path:'M473 108 L577 261',sign:'+',sx:535,sy:206},
 {from:3,to:4,path:'M344 289 C415 262 485 262 556 289',sign:'+',sx:450,sy:268},
 {from:4,to:3,path:'M556 316 C485 349 415 349 344 316',sign:'+',sx:450,sy:346},
 {from:3,to:5,path:'M289 347 L279 383',sign:'+',sx:268,sy:365,gate:'autonomic_gate'},
 {from:3,to:6,path:'M339 325 C424 373 531 378 591 406',sign:'+',sx:499,sy:388,gate:'autonomic_gate'},
 {from:4,to:5,path:'M561 326 C475 372 367 376 309 405',sign:'+',sx:401,sy:386,gate:'endocrine_gate'},
 {from:4,to:6,path:'M611 347 L621 383',sign:'+',sx:641,sy:365,gate:'endocrine_gate'},
 {from:1,to:0,path:'M179 126 C123 22 302 11 405 56',sign:'−',sx:278,sy:28,feedback:true,gate:'opioid_gate'},
 {from:2,to:0,path:'M721 126 C777 22 598 11 495 56',sign:'+',sx:622,sy:28,feedback:true,gate:'nocebo_gate'},
 {from:5,to:0,path:'M225 421 C59 405 46 103 404 69',sign:'+',sx:104,sy:280,feedback:true},
 {from:6,to:0,path:'M675 421 C841 405 854 103 496 69',sign:'+',sx:796,sy:280,feedback:true}
];
function buildGraph() {
 let s='<svg viewBox="0 0 900 490" role="img" aria-labelledby="graphTitle graphDesc"><title id="graphTitle">CET-N yedi düğümlü yönlü işlevsel ağ</title><desc id="graphDesc">Komut, opioid, tehdit, otonom, endokrin, kardiyovasküler ve immün düğümler. Düz oklar ağ içi, kesikli oklar algısal geri besleme ilişkilerini gösterir.</desc><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#91b1aa"/></marker><marker id="arrow-feedback" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#a6b6c5"/></marker></defs>';
 edges.forEach((e,j)=>{
  s+='<g id="edgeGroup'+j+'"><path id="edge'+j+'" class="edge'+(e.feedback?' feedback':'')+'" d="'+e.path+'"/><text class="edge-sign" x="'+e.sx+'" y="'+e.sy+'">'+e.sign+'</text><circle id="pulse'+j+'" class="signal" r="2.5" fill="'+(e.feedback?'#7b92ae':'#0c8883')+'"><animateMotion dur="'+(2+(j%3)*.6)+'s" repeatCount="indefinite" path="'+e.path+'"/></circle></g>';
 });
 nodes.forEach((n,j)=>{s+='<g class="node" id="node'+j+'" tabindex="0" role="button" aria-label="'+n.name+': açıklamayı göster"><circle cx="'+n.x+'" cy="'+n.y+'" r="45"/><text class="node-label" x="'+n.x+'" y="'+(n.y-5)+'">'+n.name+'</text><text class="node-value" id="nodeValue'+j+'" x="'+n.x+'" y="'+(n.y+14)+'">0.000</text><text class="node-id" x="'+n.x+'" y="'+(n.y+30)+'">x'+j+'</text></g>';});
 s+='</svg>';$('network').innerHTML=s;
 nodes.forEach((n,j)=>{
  const show=()=>{$('nodeInfo').textContent=n.info;};
  $('node'+j).addEventListener('click',show);$('node'+j).addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
 });
}
function drawGraph() {
 nodes.forEach((n,j)=>{
  const v=x[j],r=Math.min(1,Math.abs(v));
  const c=$('node'+j).querySelector('circle');
  c.setAttribute('fill',v<0?'rgb('+Math.round(241-r*148)+','+Math.round(247-r*53)+','+Math.round(246-r*60)+')':'rgb('+Math.round(241+r*10)+','+Math.round(247-r*82)+','+Math.round(246-r*118)+')');
  c.style.fill=c.getAttribute('fill');
  $('nodeValue'+j).textContent=num(v);$('nodeValue'+j).setAttribute('fill',v<0?'#076e73':'#7d593e');
 });
 edges.forEach((e,j)=>{
  const closed=session.p.coupling===0||(e.gate&&session.p[e.gate]===0)||(e.feedback&&session.p.prior_weight===1);
  $('edge'+j).classList.toggle('gated',closed);
  $('pulse'+j).style.display=running&&!closed&&Math.abs(x[e.from])>.008?'':'none';
  $('edgeGroup'+j).querySelector('text').style.opacity=closed?'.25':'1';
 });
 $('network').classList.toggle('is-running',running);
}
const metricNames=['Algılanan belirti','Otonom','Endokrin','Kardiyovasküler','İmmün','Hastalık süreci'];
$('metrics').innerHTML=metricNames.map((v,j)=>'<div class="metric"><div class="metric-name">'+v+'</div><div class="metric-value" id="metric'+j+'">0.000</div><div class="metric-note">'+(j===0?'belirti farkı':j===5?'bağlamdan bağımsız':'eksen sapması farkı')+'</div></div>').join('');
function svgChart(id,indices,colors,nonnegative=false) {
 const w=440,h=180,pad={l:43,r:11,t:12,b:25},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
 const stride=Math.max(1,Math.floor(records.length/600));
 const sample=records.filter((_,j)=>j%stride===0);if(sample[sample.length-1]!==records[records.length-1])sample.push(records[records.length-1]);
 let vals=[0];sample.forEach(r=>indices.forEach(i=>{vals.push(r.a[i],r.b[i]);}));
 let low=Math.min(...vals),high=Math.max(...vals);
 const minspan=.12;
 if(high-low<minspan){const mid=(low+high)/2;low=mid-minspan/2;high=mid+minspan/2;}
 const margin=(high-low)*.12;low-=margin;high+=margin;
 if(nonnegative){low=0;high=Math.max(.12,high);}
 const px=v=>pad.l+v/duration*iw,py=v=>pad.t+(high-v)/(high-low)*ih;
 let s='';
 for(let j=0;j<=4;j++){const v=low+(high-low)*j/4,yy=py(v);s+='<line class="chart-gridline" x1="'+pad.l+'" y1="'+yy+'" x2="'+(w-pad.r)+'" y2="'+yy+'"/><text class="chart-label" x="'+(pad.l-7)+'" y="'+(yy+3)+'" text-anchor="end">'+plain(v,2)+'</text>';}
 if(low<0&&high>0)s+='<line class="chart-zeroline" x1="'+pad.l+'" y1="'+py(0)+'" x2="'+(w-pad.r)+'" y2="'+py(0)+'"/>';
 for(let j=0;j<=4;j++){const v=duration*j/4;s+='<text class="chart-label" x="'+px(v)+'" y="'+(h-6)+'" text-anchor="middle">'+plain(v,0)+'</text>';}
 const line=(i,key)=>sample.map((r,j)=>(j?'L':'M')+px(r.t).toFixed(2)+' '+py(r[key][i]).toFixed(2)).join(' ');
 indices.forEach((i,j)=>{
  const col=colors[j];
  s+='<path class="chart-line" stroke="'+col+'" d="'+line(i,'a')+'"/>';
  s+='<path class="chart-line reference" stroke="'+(id==='chartDisease'?'#c46d3b':col)+'" d="'+line(i,'b')+'"/>';
  const rr=sample[sample.length-1];s+='<circle cx="'+px(rr.t)+'" cy="'+py(rr.a[i])+'" r="2.5" fill="'+col+'"/>';
 });
 $(id).setAttribute('viewBox','0 0 '+w+' '+h);$(id).innerHTML=s;
}
const missionDefs=[
 {title:'Belirti değişsin, hastalık aynı kalsın.',description:'Olumlu beklentiyi çalıştırın. |Δbelirti| > 0.10 iken Δhastalık = 0 olmasını izleyin.',preset:'relief'},
 {title:'Bir kapı, bütün sistem değildir.',description:'Opioid kapısını kapatın. Diğer yolların bıraktığı |Δbelirti| > 0.05 farkını bulun.',preset:'blockade'},
 {title:'Sözel girdi sıfır, deneyimin izi var.',description:'E = 0 ve |ℓ| > 0.20 ile sistemi çalıştırın. İçsel öncül m = E + 0.6ℓ hâlâ sıfır değildir; |Δbelirti| > 0.02 tek başına doğrudan koşullanma yolunu ayırmaz.',preset:'conditioning'},
 {title:'Periferik bağlam aktarımını kesin.',description:'Otonom ve endokrin kapılarını birlikte kapatın. Kardiyovasküler ve immün Δ sıfır kalsın.',preset:'isolation'}
];
function buildMissions() {
 $('missions').innerHTML=missionDefs.map((m,j)=>'<li class="mission" id="mission'+j+'"><span class="mission-marker">'+(j+1)+'</span><div><strong>'+m.title+'</strong><p>'+m.description+'</p></div><button data-mission="'+j+'" aria-label="'+(j+1)+'. görev için deneyi hazırla ve başlat">Dene ↗</button></li>').join('');
 document.querySelectorAll('[data-mission]').forEach(b=>b.addEventListener('click',()=>{if(!trial){selectPreset(missionDefs[Number(b.dataset.mission)].preset,true);$('network').scrollIntoView({behavior:'smooth',block:'center'});}}));
}
function checkMissions() {
 if(t<10)return;
 const d=records[records.length-1].delta,s=session.settings;
 const tests=[
  Math.abs(d[0])>.1&&Math.abs(d[5])<1e-10,
  s.opioid_gate===0&&Math.abs(d[0])>.05,
  s.expectation===0&&Math.abs(s.association)>.2&&Math.abs(d[0])>.02,
  s.autonomic_gate===0&&s.endocrine_gate===0&&(Math.abs(s.expectation)+Math.abs(s.association)>.1)&&Math.abs(d[3])<1e-10&&Math.abs(d[4])<1e-10
 ];
 tests.forEach((yes,j)=>{if(yes)completed.add(j);});
 completed.forEach(j=>{$('mission'+j).classList.add('done');$('mission'+j).querySelector('.mission-marker').textContent='✓';});
 $('missionCount').textContent=completed.size+' / 4';
}
function render(force=false) {
 const d=records[records.length-1].delta;
 d.forEach((v,j)=>{const el=$('metric'+j);el.textContent=num(v);el.className='metric-value'+(v<-.0005?' negative':v>.0005?' positive':'');});
 $('playButton').innerHTML=running?'<span aria-hidden="true">Ⅱ</span> Duraklat':(t>=duration-1e-9?'<span aria-hidden="true">↻</span> Tekrar':t>0?'<span aria-hidden="true">▶</span> Devam':'<span aria-hidden="true">▶</span> Başlat');
 $('runStatus').textContent=running?(trial?'Eğitim denemesi':'Çalışıyor'):(t>=duration-1e-9?'Tamamlandı':t>0?'Duraklatıldı':'Hazır');
 $('runDot').classList.toggle('running',running);
 $('timeValue').textContent=t.toFixed(1);$('durationValue').textContent=duration;
 $('timeProgress').style.width=(100*t/duration)+'%';
 $('boundValue').textContent='‖K‖∞ = '+E.contractionBound(session.p).toFixed(3)+' < 1';
 drawGraph();
 svgChart('chartSymptom',[0],['#077e81']);
 svgChart('chartRegulation',[1,2],['#077e81','#c46d3b']);
 svgChart('chartPeripheral',[3,4],['#077e81','#c46d3b']);
 svgChart('chartDisease',[5],['#077e81'],true);
 checkMissions();
}
function startTrial(outcome) {
 resetExperiment();duration=TRIAL_DURATION;
 trial={before:settings.association,outcome,alpha:settings.learning_rate,settings:{...settings}};
 disableControls(true);
 $('learningStatus').classList.add('in-training');
 $('learningStatus').textContent='Deneme sürüyor: ℓ = '+num(trial.before,2)+' sabit. Sonuç '+num(outcome,0)+' yalnızca deneme sonunda öğrenilecek.';
 running=true;lastFrame=null;render(true);
}
function drawHistory() {
 if(!history.length){$('learningHistory').innerHTML='<span class="empty-state">İlk deneyiminiz burada görünecek.</span>';return;}
 $('learningHistory').innerHTML=history.slice().reverse().slice(0,30).map((r,j)=>'<div class="learning-row"><span>#'+r.n+'</span><span>sonuç '+num(r.outcome,0)+'</span><span>ℓ '+num(r.before,2)+'</span><span>→ '+num(r.after,3)+'</span></div>').join('');
}
function finishTrial() {
 const last=trial,d=records[records.length-1].delta[0],after=E.learnOne(last.before,last.outcome,last.alpha);
 history.push({n:history.length+1,before:last.before,outcome:last.outcome,alpha:last.alpha,after,symptom_delta_end:d});
 settings.association=after;syncControls();updatePresetState(null);drawHistory();resetExperiment();
 $('learningStatus').textContent='Deneme tamamlandı: ℓ '+num(last.before,3)+' → '+num(after,3)+'. Son Δbelirti '+num(d)+'. Yeni ilişki sonraki deneme için hazır.';
}
$('trainRelief').addEventListener('click',()=>startTrial(-1));
$('trainThreat').addEventListener('click',()=>startTrial(1));
$('trainNeutral').addEventListener('click',()=>startTrial(0));
$('clearLearning').addEventListener('click',()=>{
 history=[];settings.association=0;syncControls();drawHistory();updatePresetState(null);resetExperiment();
 $('learningStatus').textContent='Öğrenme kaydı ve ℓ sıfırlandı. Diğer ayarlar korundu.';
});
function download(name,content,type) {
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('exportCsv').addEventListener('click',()=>{
 const headers=['time','expectation','association','drug','sensory','disease_input',...E.NODES.map(n=>'selected_x_'+n),...E.NODES.map(n=>'neutral_x_'+n),...['symptom','autonomic','endocrine','cardiovascular','immune','disease'].flatMap(n=>['selected_'+n,'neutral_'+n,'delta_'+n])];
 const rows=records.map(r=>{
  const inp=inputAt(r.t),values=[r.t,inp.expectation,inp.association,inp.drug,inp.sensory,inp.disease,...r.x,...r.neutral];
  for(let j=0;j<6;j++)values.push(r.a[j],r.b[j],r.delta[j]);
  return values.map(v=>Number(v).toPrecision(13)).join(',');
 });
 download('cet-n-data.csv',headers.join(',')+'\n'+rows.join('\n'),'text/csv;charset=utf-8');
 $('fileStatus').textContent=records.length+' zaman noktası CSV olarak dışa aktarıldı. Ayarları da saklamak için Senaryo JSON kullanın.';
});
$('exportJson').addEventListener('click',()=>{
 const data={schema_version:'CET-N/scenario-1',model_version:E.DEFAULTS.schema_version,created_at:new Date().toISOString(),settings:{...session.settings},learning_history:history.map(r=>({...r})),neutral_definition:{expectation:0,association:0,other_settings:'identical'},parameters:session.p,simulation:{dt:DT,duration,elapsed:t},interpretation:E.DEFAULTS.interpretation};
 download('cet-n-scenario.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
 $('fileStatus').textContent='Senaryo ve öğrenme kaydı dışa aktarıldı. JSON yüklemek deneyi zaman sıfırdan yeniden hazırlar.';
});
function validateScenario(data) {
 if(!data||data.schema_version!=='CET-N/scenario-1'||data.model_version!==E.DEFAULTS.schema_version||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('Geçerli CET-N/scenario-1 ve uyumlu model sürümü bekleniyor.');
 const keys=new Set(allDefs.map(d=>d[0]));
 for(const key of Object.keys(data.settings))if(!keys.has(key))throw Error('Bilinmeyen ayar: '+key);
 const out={};
 for(const d of allDefs){const v=data.settings[d[0]];if(typeof v!=='number'||!Number.isFinite(v)||v<d[2]||v>d[3])throw Error('Geçersiz ayar: '+d[0]);out[d[0]]=v;}
 const expectedParams=E.configuration(Object.fromEntries(controlKeys.map(k=>[k,out[k]])));
 if(data.parameters){
  if(typeof data.parameters!=='object'||Array.isArray(data.parameters))throw Error('Model parametreleri geçersiz.');
  for(const k of Object.keys(data.parameters))if(!(k in expectedParams))throw Error('Bilinmeyen model parametresi: '+k);
  for(const k of Object.keys(expectedParams))if(JSON.stringify(data.parameters[k])!==JSON.stringify(expectedParams[k]))throw Error('Model katsayıları bu motorla uyuşmuyor: '+k);
 }
 const list=data.learning_history||[];if(!Array.isArray(list)||list.length>1000)throw Error('Öğrenme kaydı geçersiz veya çok uzun.');
 const safe=list.map((r,j)=>{
  if(!r||!['before','outcome','alpha','after','symptom_delta_end'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])))throw Error('Geçersiz öğrenme satırı.');
  if(Math.abs(r.before)>1||Math.abs(r.outcome)>1||Math.abs(r.after)>1||r.alpha<0||r.alpha>1||Math.abs(E.learnOne(r.before,r.outcome,r.alpha)-r.after)>1e-10)throw Error('Öğrenme güncellemesi denkleme uymuyor.');
  return {n:j+1,before:r.before,outcome:r.outcome,alpha:r.alpha,after:r.after,symptom_delta_end:r.symptom_delta_end};
 });
 return {settings:out,history:safe};
}
$('importJson').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>1000000)throw Error('Dosya 1 MB sınırını aşıyor.');
  const valid=validateScenario(JSON.parse(await file.text()));
  settings=valid.settings;history=valid.history;syncControls();drawHistory();updatePresetState(null);resetExperiment();
  $('fileStatus').textContent='Senaryo yüklendi. İki kol zaman sıfırdan hazırlandı; Başlat ile çalıştırın.';
 }catch(err){$('fileStatus').textContent='Yüklenemedi: '+err.message;}
 event.target.value='';
});
const dialog=$('guideDialog');
$('guideButton').addEventListener('click',()=>dialog.showModal());
$('closeGuide').addEventListener('click',()=>dialog.close());
$('guideStart').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
buildGraph();buildMissions();syncControls();resetExperiment();requestAnimationFrame(frame);
window.CETLab={getState:()=>({settings:{...settings},t,running,trial:trial?{...trial}:null,history:history.map(r=>({...r})),last:records[records.length-1],records:records.length,completed:[...completed]}),validateScenario};
})();
