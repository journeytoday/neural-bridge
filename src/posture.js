/** Labeled synthetic geometry replay. No diagnosis or capability decline estimate. */
export class PostureReplay {
 constructor(engine){this.engine=engine;this.version=0;this.channels={};this.phase='not-started';}
 publish(modality,quality,validated,headAngle=0){
  this.channels[modality]={quality,validated,geometryVersion:this.version};
  this.engine.observe({modality,quality,available:validated,missing:quality<.3,geometryVersion:this.version,headAngle,calibration:validated?'synthetic-check-passed':'requires-check',underlyingCapability:'constant-fixture',provenance:'labeled-posture-replay'});
 }
 start(){this.version++;this.phase='baseline';for(const c of ['gaze','blink','pupil','eeg'])this.publish(c,.95,true);return this.engine.requestConfiguration({modality:'gaze',confirmation:'blink'});}
 lose(){
  this.version++;this.phase='geometry-loss';
  for(const angle of [10,25,40]){this.publish('gaze',1-angle/45,false,angle);this.publish('blink',Math.max(.15,1-angle/35),false,angle);this.publish('pupil',Math.max(.05,1-angle/30),false,angle);}
  this.publish('eeg',.95,true,40);
  this.engine.state.history.push({type:'posture-explanation',timestamp:Date.now(),reason:'Labeled device/geometry loss; underlying capability constant. Ocular input withheld pending separate checks.',geometryVersion:this.version});
  return this.engine.propose();
 }
 restoreGeometry(){this.version++;this.phase='geometry-restored-unvalidated';for(const c of ['gaze','blink','pupil'])this.publish(c,.95,false);return 'Geometry restored; gaze, blink and pupil still require separate local checks.';}
 revalidate(channel){
  if(!['gaze','blink','pupil'].includes(channel)||!this.phase.startsWith('geometry-restored'))return {ok:false,reason:'Restore geometry before a channel check.'};
  this.publish(channel,.95,true);return {ok:true};
 }
}
