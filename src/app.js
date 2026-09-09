import {createEngine,fuseEvidence,detectBlinkCandidate} from './engine.js';
import {ProfileService,SandboxSink,MedicationTimeline,signTestOrder,validateOrder,enforceDwell,routeMICandidate} from './platform.js';
import {LocalLanguageModel} from './language.js';
const $=id=>document.getElementById(id), engine=createEngine(), model=new LocalLanguageModel();
const service=new ProfileService(), hostA=service.connectHost('A'), hostB=service.connectHost('B');
const sink=new SandboxSink({timeoutMs:30000}), medication=new MedicationTimeline();
let mode='quick', lastRequest=null, dwellTimer=null;
const phrases=['I would like some water.','Please give me more time.','I need to change position.','Let’s talk for a while.','That is not what I meant.','Thank you for being here.'];
service.create('demo-user',{language:'en',phrases,voice:'default'});hostA.sync('demo-user');hostA.validateLocally('demo-user',{hostId:'A',passed:true});
try{engine.setDraft(localStorage.getItem('neuralbridge-draft')||'');}catch{}
$('draft').value=engine.state.draft;
function notice(text){$('notice').textContent=text;}
function save(){try{localStorage.setItem('neuralbridge-draft',engine.state.draft);}catch{document.querySelector('.session').textContent='Draft is held in this tab only';}}
function result(value,success){notice(value?.ok===false?value.reason:success);render();}
function render(){
 const s=engine.state;
 document.documentElement.style.setProperty('--scale',s.config.targetScale);
 $('configuration').textContent=`Current access: ${s.config.modality} · Confirmation: ${s.config.confirmation} · Target size: ${Math.round(s.config.targetScale*100)}% · Dwell: ${s.config.dwellMs} ms. Physical keyboard and speech stop remain available.`;
 $('proposal-text').textContent=s.recovery?.reason||s.proposal?.reason||'No change is needed. Refuse and undo remain available.';
 $('apply').disabled=!s.proposal;
 $('selection').textContent=s.selected?`Selected: ${s.selected.text}`:'No phrase selected';
 $('confirm').textContent=s.config.confirmation==='switch'?'Press Space or confirm switch':s.config.confirmation==='blink'?'Use blink replay to confirm':s.config.confirmation==='dwell'?'Hold pointer over phrase to dwell':'Confirm selection';
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
phrases.forEach((text,i)=>{const b=document.createElement('button');b.className='phrase';b.dataset.text=text;const symbol=document.createElement('span');symbol.textContent=['◡','◷','↔','☏','↶','♡'][i];symbol.setAttribute('aria-hidden','true');b.append(symbol,document.createTextNode(text));b.addEventListener('click',()=>pick(text));b.addEventListener('pointerenter',()=>{if(engine.state.config.confirmation==='dwell'){pick(text);dwellTimer=setTimeout(()=>confirm('dwell'),engine.state.config.dwellMs+20);}});b.addEventListener('pointerleave',()=>clearTimeout(dwellTimer));$('board').append(b);});
$('draft').addEventListener('input',()=>{engine.setDraft($('draft').value);save();});
$('confirm').onclick=()=>confirm(engine.state.config.confirmation);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&engine.state.config.confirmation==='switch'&&!['TEXTAREA','INPUT','SELECT','BUTTON'].includes(e.target.tagName)){e.preventDefault();confirm('switch');}if(e.code==='Escape'){speechSynthesis?.cancel();notice('Speech stopped.');}});
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
 const kind=$('scenario').value,modality=engine.state.config.modality;
 if(kind==='recovery'){for(const m of ['pointer','keyboard','gaze'])engine.observe({modality:m,quality:.95,available:true,error:false,latencyMs:700});engine.reviewRecovery?.();}
 for(let i=0;i<6;i++)engine.observe({modality:kind==='voice'?'voice':kind==='missing'?'physiology':modality,quality:kind==='missing'?0:.95,missing:kind==='missing',available:kind==='loss'?false:true,error:kind==='difficulty'||kind==='voice',latencyMs:kind==='difficulty'?1800:700,provenance:'synthetic-scenario',context:'synthetic-demo'});
 engine.propose();render();notice(kind==='loss'?'Synthetic route loss detected. A fallback needs your approval.':kind==='recovery'?'Synthetic visibility restored. Undo can now return to the previous usable setup.':'Synthetic observations processed; no clinical inference was made.');
};
function fusion(conflict){const now=Date.now();const f=fuseEvidence({gaze:{target:phrases[0],quality:.9,timestamp:now},eeg:{target:conflict?phrases[1]:phrases[0],quality:.9,timestamp:now+20}});$('signal-result').textContent=`Synthetic fusion: ${f.status}. ${f.target?'Candidate selected; explicit confirmation still required.':'No selection made.'}`;if(f.target)pick(f.target);}
$('fusion').onclick=()=>fusion(false);$('conflict').onclick=()=>fusion(true);
$('blink').onclick=()=>{const frames=[1,.1,.1,.1,1].map((openness,i)=>({openness,timestamp:i*80,quality:.95}));const b=detectBlinkCandidate(frames);$('signal-result').textContent=`Synthetic openness replay: ${b.candidate?'blink candidate':'abstain'}, ${b.durationMs} ms. Not a camera/video decoder.`;if(b.candidate&&engine.state.config.confirmation==='blink')confirm('blink');};
$('voice-draft').onclick=()=>{engine.setDraft($('transcript').value);updateDraft();notice('Simulated transcript in draft. Correct any words before speaking.');};
// Explicit proposals exercise alternative confirmation routes without inferring consent.
for(const method of ['switch','blink','dwell']){const b=document.createElement('button');b.textContent=`Try ${method} confirmation`;b.onclick=()=>{engine.observe({modality:method,available:true,quality:.95,provenance:'synthetic-enabled-route'});engine.requestConfiguration({confirmation:method});render();};$('signal-result').before(b);}
function safely(fn,target){try{const r=fn();$(target).textContent=typeof r==='string'?r:JSON.stringify(r,null,2);}catch(e){$(target).textContent=e.message;}}
$('transfer').onclick=()=>safely(()=>{const r=hostB.sync('demo-user');return `Host B received profile v${r.profile.version}. Local validation: ${r.validated?'passed':'required'}. Calibration not copied.`;},'profile-result');
$('validate-host').onclick=()=>safely(()=>{hostB.validateLocally('demo-user',{hostId:'B',passed:true,source:'manual-sandbox-check'});return 'Host B sandbox check passed. This demonstrates the contract, not hardware calibration.';},'profile-result');
function download(name,text,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
$('export-profile').onclick=()=>download('neuralbridge-profile.json',service.export('demo-user'));
$('import-profile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error('Profile file too large.');const imported=new ProfileService();const profile=imported.import(await file.text());$('profile-result').textContent=`Imported ${profile.id} into an isolated local service. Fresh local validation required; no calibration adopted.`;}catch(error){$('profile-result').textContent=error.message;}};
function careView(){ $('care-result').textContent=JSON.stringify(sink.list(),null,2); }
$('help').onclick=()=>{lastRequest='help-'+Date.now();sink.request({id:lastRequest,action:'help'});careView();};
$('ack').onclick=()=>safely(()=>{const r=sink.acknowledge(lastRequest);return r;},'care-result');
$('complete').onclick=()=>safely(()=>sink.complete(lastRequest),'care-result');
$('timeout').onclick=()=>{sink.tick(Date.now()+31000);careView();};
function mi(noIntent){const now=Date.now();lastRequest='mi-'+now;const r=routeMICandidate({id:lastRequest,intent:'help',confidence:.98,quality:.95,connected:true,timestamp:now,noIntent},sink,now);$('care-result').textContent=JSON.stringify(r,null,2);}
$('mi').onclick=()=>mi(false);$('no-intent').onclick=()=>mi(true);
$('med-ack').onclick=()=>{const r=medication.acknowledge('fictional-1');$('med-result').textContent=`Reminder acknowledged. Administration: ${r.administration}. Acknowledgement does not mean taken.`;};
$('order').onclick=()=>{const now=Date.now();const order=signTestOrder({author:'demo-clinician',subject:'demo-user',purpose:'interaction',version:1,effectiveAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),permissions:['interaction:dwell'],minDwellMs:1000});const validation=validateOrder(order,{now});const dwellMs=enforceDwell(engine.state.config.dwellMs,order,{now});engine.requestConfiguration({dwellMs,confirmation:'dwell'});$('order-result').textContent=`Sample checks: ${validation.valid?'passed':'failed'}. Minimum dwell ${dwellMs} ms proposed for your approval. Test checksum only.`;render();};
$('export-log').onclick=()=>download('neuralbridge-evidence.json',JSON.stringify({schemaVersion:1,simulation:true,clinicalEvidence:false,events:engine.state.history},null,2));
$('demo-toggle').onclick=()=>{$('demo').hidden=!$('demo').hidden;$('demo-toggle').setAttribute('aria-expanded',String(!$('demo').hidden));};
render();
