import {createEngine,fuseEvidence,detectBlinkCandidate} from './engine.js';
import {MedicationTimeline,signTestOrder,enforceDwell} from './platform.js';
import {createClient} from './transport.js';
import {decodeVideoFixture} from './video.js';
import {LocalLanguageModel} from './language.js';
import {Vocabulary} from './vocabulary.js';
import {PostureReplay} from './posture.js';
const $=id=>document.getElementById(id), engine=createEngine(), model=new LocalLanguageModel();
const client=createClient(), medication=new MedicationTimeline();
let mode='quick', lastRequest=null, dwellTimer=null;
const phrases=['I would like some water.','Please give me more time.','I need to change position.','Let’s talk for a while.','That is not what I meant.','Thank you for being here.'];
client.getProfile('demo-user').catch(async error=>{if(error.status===404)return client.createProfile('demo-user',{language:'en',phrases,voice:'default'});throw error;}).catch(error=>{$('profile-result').textContent='Profile service: '+error.message;});
try{engine.setDraft(localStorage.getItem('neuralbridge-draft')||'');const memory=localStorage.getItem('neuralbridge-memory');if(memory)engine.importMemory(JSON.parse(memory));}catch{}
$('draft').value=engine.state.draft;
function notice(text){$('notice').textContent=text;}
function save(){try{localStorage.setItem('neuralbridge-draft',engine.state.draft);localStorage.setItem('neuralbridge-memory',JSON.stringify(engine.exportMemory()));}catch{document.querySelector('.session').textContent='Draft is held in this tab only';}}
function result(value,success){notice(value?.ok===false?value.reason:success);render();}
function render(){
 const s=engine.state;
 document.documentElement.style.setProperty('--scale',s.config.targetScale);
 $('configuration').textContent=`Current access: ${s.config.modality} · Confirmation: ${s.config.confirmation} · Target size: ${Math.round(s.config.targetScale*100)}% · Dwell: ${s.config.dwellMs} ms. Physical keyboard and speech stop remain available.`;
 $('proposal-text').textContent=s.recovery?.reason||s.proposal?.reason||'No change is needed. Refuse and undo remain available.';
 $('apply').disabled=!s.proposal;
 $('selection').textContent=s.selected?`Selected: ${s.selected.text}`:'No phrase selected';
 $('confirm').textContent=s.config.confirmation==='switch'?'Press Space or confirm switch':s.config.confirmation==='blink'?'Use blink replay to confirm':s.config.confirmation==='dwell'?'Focus or hold pointer over a phrase to dwell':'Confirm selection';
 $('confirm').disabled=['blink','dwell'].includes(s.config.confirmation);
 for(const b of document.querySelectorAll('.phrase'))b.classList.toggle('selected',b.dataset.text===s.selected?.text);
 $('reliability').replaceChildren();
 for(const [name,r] of Object.entries(s.reliability)){
  const row=document.createElement('div');const label=document.createElement('span');label.textContent=name;
  const val=document.createElement('span');val.textContent=`${r.status} · ${Math.round(r.coverage*100)}% coverage`;row.append(label,val);$('reliability').append(row);
 }
 $('evidence').textContent=s.history.slice(-12).map(e=>`${new Date(e.timestamp).toLocaleTimeString()}  ${e.type}${e.reason?' — '+e.reason:''}`).join('\n')||'No observations yet.';
 save();
}
function updateDraft(){ $('draft').value=engine.state.draft;render(); }
function confirm(method){result(engine.confirm(method),'Phrase added. Review your words before speaking.');updateDraft();}
function pick(text){result(engine.select(text),'Phrase selected. Confirm to add it to your draft.');}
phrases.forEach((text,i)=>{const b=document.createElement('button');b.className='phrase';b.dataset.text=text;const symbol=document.createElement('span');symbol.textContent=['◡','◷','↔','☏','↶','♡'][i];symbol.setAttribute('aria-hidden','true');b.append(symbol,document.createTextNode(text));b.addEventListener('click',()=>{if(engine.state.config.confirmation!=='dwell')pick(text);});b.addEventListener('pointerenter',()=>{if(engine.state.config.confirmation==='dwell'){pick(text);clearTimeout(dwellTimer);dwellTimer=setTimeout(()=>{if(engine.state.selected)confirm('dwell');},engine.state.config.dwellMs+20);}});b.addEventListener('pointerleave',()=>clearTimeout(dwellTimer));b.addEventListener('focus',()=>{if(engine.state.config.confirmation==='dwell'){pick(text);clearTimeout(dwellTimer);clearTimeout(dwellTimer);dwellTimer=setTimeout(()=>{if(engine.state.selected)confirm('dwell');},engine.state.config.dwellMs+20);}});b.addEventListener('blur',()=>clearTimeout(dwellTimer));$('board').append(b);});
$('draft').addEventListener('input',()=>{engine.setDraft($('draft').value);save();});
$('confirm').onclick=()=>confirm(engine.state.config.confirmation);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&engine.state.config.confirmation==='switch'&&!['TEXTAREA','INPUT','SELECT','BUTTON'].includes(e.target.tagName)){e.preventDefault();confirm('switch');}if(e.code==='Escape'){window.speechSynthesis?.cancel();notice('Speech stopped.');}});
$('clear').onclick=()=>{engine.setDraft('');updateDraft();notice('Draft cleared.');};
$('speak').onclick=()=>{if(!engine.state.draft.trim())return notice('Write or confirm a message first.');if(!('speechSynthesis'in window))return notice('Speech is unavailable in this browser. Your text remains visible.');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(engine.state.draft);u.voice=speechSynthesis.getVoices().find(v=>v.voiceURI===$('voice').value)||null;u.onerror=()=>notice('Speech could not play. Your text remains available; choose another device voice.');u.onend=()=>notice('Speech finished. Whether the message was understood remains unknown.');speechSynthesis.speak(u);notice('Speaking your approved draft. Stop speech is always available.');};
$('stop').onclick=()=>{if('speechSynthesis'in window)speechSynthesis.cancel();notice('Speech stopped.');};
function voices(){if(!('speechSynthesis'in window))return;const choice=$('voice').value;$('voice').replaceChildren(new Option('Default device voice',''));for(const v of speechSynthesis.getVoices())$('voice').add(new Option(`${v.name} (${v.lang})`,v.voiceURI));$('voice').value=choice;}
if('speechSynthesis'in window){voices();speechSynthesis.onvoiceschanged=voices;}
$('quick').onclick=()=>{mode='quick';$('quick').setAttribute('aria-pressed','true');$('story').setAttribute('aria-pressed','false');$('draft').rows=3;};
$('story').onclick=()=>{mode='story';$('quick').setAttribute('aria-pressed','false');$('story').setAttribute('aria-pressed','true');$('draft').rows=7;notice('Story mode: compose a longer message. Nothing is spoken until you choose Speak.');};
$('suggest').onclick=()=>{const suggestions=model.suggest(engine.state.draft,mode);$('suggestions').replaceChildren();if(!suggestions.length){$('suggestions').textContent='The small model has no continuation for these words. Keep writing freely.';return;}for(const text of suggestions){const b=document.createElement('button');b.textContent=text;b.onclick=()=>{engine.setDraft(text);updateDraft();notice('Suggestion copied to your editable draft. Review before speaking.');};$('suggestions').append(b);}};
$('apply').onclick=()=>result(engine.apply(engine.state.proposal?.id),'Change applied. Your draft has been preserved.');
$('refuse').onclick=()=>result(engine.reject(engine.state.proposal?.id),'Change refused. Your current setup remains active.');
$('undo').onclick=()=>result(engine.undo(),'Previous setup restored. Your draft has been preserved.');
$('replay').onclick=()=>{
 const kind=$('scenario').value,modality=kind==='recovery'?'pointer':engine.state.config.modality;
 if(kind==='recovery'){for(const m of ['pointer','keyboard'])engine.observe({modality:m,quality:.95,available:true,error:false,latencyMs:700});engine.reviewRecovery?.();}
 for(let i=0;i<6;i++)engine.observe({modality:kind==='voice'?'voice':kind==='missing'?'physiology':modality,quality:kind==='missing'?0:.95,missing:kind==='missing',available:kind==='loss'?false:(posture.channels[modality]?.validated ?? true),error:kind==='difficulty'||kind==='voice',latencyMs:kind==='difficulty'?1800:700,provenance:'synthetic-scenario',context:'synthetic-demo'});
 engine.propose();render();notice(kind==='loss'?'Synthetic route loss detected. A fallback needs your approval.':kind==='recovery'?'Synthetic visibility restored. Undo can now return to the previous usable setup.':'Synthetic observations processed; no clinical inference was made.');
};
function fusion(conflict){const now=Date.now();const f=fuseEvidence({gaze:{target:phrases[0],quality:.9,timestamp:now},eeg:{target:conflict?phrases[1]:phrases[0],quality:.9,timestamp:now}});$('signal-result').textContent=`Synthetic fusion: ${f.status}. ${f.target?'Candidate selected; explicit confirmation still required.':'No selection made.'}`;if(f.target)pick(f.target);}
$('fusion').onclick=()=>fusion(false);$('conflict').onclick=()=>fusion(true);
$('blink').onclick=()=>{const frames=[1,.1,.1,.1,1].map((openness,i)=>({openness,timestamp:i*80,quality:.95}));const b=detectBlinkCandidate(frames);$('signal-result').textContent=`Synthetic openness replay: ${b.candidate?'blink candidate':'abstain'}, ${b.durationMs} ms. Not a camera/video decoder.`;if(b.candidate&&engine.state.config.confirmation==='blink')confirm('blink');};
$('voice-draft').onclick=()=>{result(engine.voiceContribution($('transcript').value),'Qualified simulated transcript copied to draft. Review before speaking.');updateDraft();};
// Explicit proposals exercise alternative confirmation routes without inferring consent.
for(const method of ['switch','blink','dwell']){const b=document.createElement('button');b.textContent=`Try ${method} confirmation`;b.onclick=()=>{engine.observe({modality:method,available:true,quality:.95,provenance:'synthetic-enabled-route'});engine.requestConfiguration({confirmation:method});render();};$('signal-result').before(b);}
async function safely(fn,target){try{const r=await fn();$(target).textContent=typeof r==='string'?r:JSON.stringify(r,null,2);}catch(e){$(target).textContent=e.message;}}
$('transfer').onclick=()=>safely(async()=>{const r=await client.getProfile('demo-user');return `Server profile v${r.version} is available. Open host B and perform its separate local check.`;},'profile-result');
$('validate-host').onclick=()=>{window.open('/host-b.html','neuralbridge-host-b','noopener');};
function download(name,text,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
$('export-profile').onclick=()=>safely(async()=>{download('neuralbridge-profile.json',JSON.stringify(await client.exportProfile('demo-user')));return 'Profile exported without device calibration.';},'profile-result');
$('import-profile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error('Profile file too large.');const profile=await client.importProfile(await file.text());$('profile-result').textContent=`Imported ${profile.id} into the local profile service. Fresh local validation required. Existing IDs are never overwritten.`;}catch(error){$('profile-result').textContent=error.message;}};
$('help').onclick=()=>safely(async()=>{lastRequest='help-'+crypto.randomUUID();return client.request({id:lastRequest,action:'help'});},'care-result');
$('ack').onclick=()=>safely(()=>client.acknowledge(lastRequest),'care-result');
$('complete').onclick=()=>safely(()=>client.complete(lastRequest),'care-result');
$('timeout').onclick=()=>safely(()=>client.simulateTimeout(lastRequest),'care-result');
function mi(noIntent){const now=Date.now();lastRequest='mi-'+crypto.randomUUID();return client.routeMI({id:lastRequest,intent:'help',confidence:.98,quality:.95,connected:true,timestamp:now,noIntent});}
$('mi').onclick=()=>safely(()=>mi(false),'care-result');$('no-intent').onclick=()=>safely(()=>mi(true),'care-result');
$('med-ack').onclick=()=>{const r=medication.acknowledge('fictional-1');$('med-result').textContent=`Reminder acknowledged. Administration: ${r.administration}. Acknowledgement does not mean taken.`;};
$('order').onclick=()=>{const now=Date.now();const order=signTestOrder({author:'demo-clinician',subject:'demo-user',purpose:'interaction',version:now,effectiveAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+5000).toISOString(),permissions:['interaction:dwell'],minDwellMs:1000});const validation=engine.installOrder(order);const dwellMs=enforceDwell(engine.state.config.dwellMs,order,{now});engine.requestConfiguration({dwellMs,confirmation:'dwell'});$('order-result').textContent=`Installed sample order checks: ${validation.ok?'passed':'failed'}. Minimum dwell ${dwellMs} ms proposed for your approval. Expires after 5 seconds for the demo. Review expiry below. Test checksum only.`;render();};
$('export-log').onclick=()=>download('neuralbridge-evidence.json',JSON.stringify({schemaVersion:1,simulation:true,clinicalEvidence:false,events:engine.state.history},null,2));
$('demo-toggle').onclick=()=>{$('demo').hidden=!$('demo').hidden;$('demo-toggle').setAttribute('aria-expanded',String(!$('demo').hidden));};
render();

$('video-replay').onclick=async()=>{
 const button=$('video-replay');button.disabled=true;
 try{
  const outcome=await decodeVideoFixture($('blink-video'),`/assets/blink-${$('video-kind').value}.webm`);
  $('video-result').textContent=`Decoded ${outcome.frames.length} video frames. ${outcome.candidate?'Candidate accepted':'Abstained'}; closure ${outcome.durationMs||0} ms. ${outcome.reason} Openness: ${outcome.frames.map(f=>f.openness.toFixed(1)).join(', ')}; quality minimum ${Math.min(...outcome.frames.map(f=>f.quality))}.`;
  if(outcome.candidate && engine.state.config.confirmation==='blink')confirm('blink');
 }catch(error){$('video-result').textContent=error.message;}finally{button.disabled=false;}
};

$('approve-transcript').onclick=()=>{engine.setDraft($('transcript').value);updateDraft();notice('Your corrected text was approved. Speech still requires your action.');};
$('review-order').onclick=()=>{result(engine.reviewExpiredOrder(),'Expired test order reviewed. Existing settings kept; fresh adaptation is available.');$('order-result').textContent=engine.getOrderStatus()?'Order is still active; wait until expiry.':'No active test order.';};
$('helpful').onclick=()=>result(engine.reportOutcome('helpful'),'Your feedback is saved locally. It does not establish clinical benefit.');
$('unhelpful').onclick=()=>result(engine.reportOutcome('unhelpful'),'Feedback saved. Use Undo if you want the previous setup.');
$('forget-history').onclick=()=>{localStorage.removeItem('neuralbridge-memory');location.reload();};
let vocabulary;
function showVocabulary(){
 if(!vocabulary)return;
 $('word-results').replaceChildren();
 for(const word of vocabulary.search($('word-search').value,$('word-environment').value)){
  const b=document.createElement('button');b.textContent=word;
  b.onclick=()=>{if(engine.state.config.confirmation!=='dwell')pick(word);};
  b.onpointerenter=()=>{if(engine.state.config.confirmation==='dwell'){pick(word);clearTimeout(dwellTimer);dwellTimer=setTimeout(()=>{if(engine.state.selected)confirm('dwell');},engine.state.config.dwellMs+20);}};
  b.onpointerleave=()=>clearTimeout(dwellTimer);b.onfocus=()=>{if(engine.state.config.confirmation==='dwell'){pick(word);clearTimeout(dwellTimer);clearTimeout(dwellTimer);dwellTimer=setTimeout(()=>{if(engine.state.selected)confirm('dwell');},engine.state.config.dwellMs+20);}};b.onblur=()=>clearTimeout(dwellTimer);$('word-results').append(b);
 }
 $('personal-words').textContent=vocabulary.export().personal.map(p=>p.term+' ('+p.environment+')').join(', ')||'No personal words saved.';
}
fetch('/assets/vocabulary-en.json').then(r=>{if(!r.ok)throw Error('Vocabulary unavailable');return r.json();}).then(data=>{
 vocabulary=new Vocabulary(data);try{const saved=localStorage.getItem('neuralbridge-vocabulary');if(saved)vocabulary.import(JSON.parse(saved));}catch{}
 showVocabulary();
}).catch(error=>{$('word-results').textContent=error.message+'. Free text still works.';});
$('word-search').oninput=showVocabulary;$('word-environment').onchange=showVocabulary;
for(const action of ['add','remove'])$('word-'+action).onclick=()=>{
 try{if(!vocabulary)throw Error('Vocabulary is still loading');vocabulary[action]($('personal-term').value,$('word-environment').value);localStorage.setItem('neuralbridge-vocabulary',JSON.stringify(vocabulary.export()));showVocabulary();notice('Personal vocabulary updated only at your request.');}catch(error){notice(error.message);}
};
$('word-export').onclick=()=>{if(vocabulary)download('personal-vocabulary.json',JSON.stringify(vocabulary.export()));};
const posture=new PostureReplay(engine);
for(const [id,action] of Object.entries({'posture-start':()=>posture.start(),'posture-loss':()=>posture.lose(),'posture-restore':()=>posture.restoreGeometry(),'check-gaze':()=>posture.revalidate('gaze'),'check-blink':()=>posture.revalidate('blink'),'check-pupil':()=>posture.revalidate('pupil')})) {
 $(id).onclick=()=>{const value=action();$('posture-result').textContent=JSON.stringify({phase:posture.phase,channels:posture.channels,result:value},null,2);render();};
}

const schedule=new MedicationTimeline([{id:'morning',name:'Fictional A',scheduledAt:'09:00'},{id:'evening',name:'Fictional A',scheduledAt:'21:00'}]);
function scheduleView(){ $('med-timeline').textContent=schedule.list().map(e=>`${e.scheduledAt} ${e.name} | reminder: ${e.acknowledged?'acknowledged':'unacknowledged'} | administration: ${e.administration}`).join('\n'); }
$('med-ack').onclick=()=>{schedule.acknowledge('morning');scheduleView();$('med-result').textContent='Morning reminder acknowledged; administration remains unknown. Evening reminder remains unacknowledged.';};
$('med-reported').onclick=()=>{schedule.report('morning','reported-taken');scheduleView();};
$('med-unknown').onclick=()=>{schedule.report('morning','unknown');scheduleView();};
$('reposition-request').onclick=()=>safely(()=>client.request({id:'reposition-'+crypto.randomUUID(),action:'help',recipient:'sandbox-positioning-assistant'}),'posture-result');
scheduleView();
