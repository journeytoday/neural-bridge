import {createEngine} from '../src/engine.js';
import {writeFile,mkdir} from 'node:fs/promises';
// Frozen, fictional mechanism: larger targets reduce synthetic misses but add selection time.
// All deployable policies receive previous observed outcome only, never the latent phase.
const policies=['fixed','reactive','personalized','fallback','neuralbridge'];
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function episode(policy,seed){
 const rng=random(seed),e=createEngine();let previousError=false,changes=0,completed=0,elapsedMs=0,prompts=0;
 let config={...e.state.config}, recent=[];
 for(let t=0;t<60;t++) {
  // Hidden environment is shared across policies; the same variate is used for each trial.
  const latentDifficulty=t>=20&&t<40,draw=rng();
  const observation={modality:'pointer',quality:.95,available:true,error:previousError,latencyMs:previousError?1800:800};
  recent.push(previousError);recent=recent.slice(-6);
  const rate=recent.filter(Boolean).length/recent.length;
  e.observe(observation);
  let next={...config};
  if(policy==='reactive')next.targetScale=previousError?1.5:1;
  if(policy==='personalized'&&recent.length===6)next.targetScale=rate>=.5?1.5:rate<=.15?1:config.targetScale;
  if(policy==='fallback'&&recent.length===6&&rate>=.5)next.modality='keyboard';
  if(policy==='neuralbridge'){
   const proposal=e.propose();
   if(proposal){prompts++;e.apply(proposal.id);}
   next={...e.state.config};
  } else if(JSON.stringify(next)!==JSON.stringify(config)) {
   const proposal=e.requestConfiguration({targetScale:next.targetScale,modality:next.modality});prompts++;e.apply(proposal.id);next={...e.state.config};
  }
  if(JSON.stringify(next)!==JSON.stringify(config))changes++;
  config=next;
  const missProbability=config.modality==='keyboard'?.12:(latentDifficulty?.5:.08)/config.targetScale;
  previousError=draw<missProbability;if(!previousError)completed++;
  elapsedMs+=config.modality==='keyboard'?1700:Math.max(800,config.confirmation==='dwell'?config.dwellMs:800)+(config.targetScale-1)*700;
 }
 return {seed,policy,trials:60,completed,misses:60-completed,elapsedMs,changes,prompts};
}
export async function evaluate(){
 const seeds=[901,902,903,904,905,906,907,908,909,910];
 const rows=policies.flatMap(policy=>seeds.map(seed=>episode(policy,seed)));
 const totals=policies.map(policy=>{const group=rows.filter(r=>r.policy===policy);return {policy,...Object.fromEntries(['trials','completed','misses','elapsedMs','changes','prompts'].map(key=>[key,group.reduce((n,r)=>n+r[key],0)]))};});
 const result={schemaVersion:1,seeds,simulationOnly:true,assumptions:'60 fictional selections/episode; trials 20–39 harder; target size reduces misses and adds time; keyboard has fixed error/time. Feedback perfectly observed by simulator; not natural communication ground truth. No training or parameter fitting on these seeds.',limitations:'Small deterministic mechanism test, not a powered study or evidence of clinical advantage. Shared action-dependent outcomes and random numbers; raw per-episode results retained. All proposed changes are approved by a scripted user, an unrealistic acceptance assumption.',totals,episodes:rows};
 await mkdir('docs/evaluation',{recursive:true});await writeFile('docs/evaluation/results.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(totals,null,2));return result;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/evaluate.js'))await evaluate();
