import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine.js';
import {PostureReplay} from '../src/posture.js';
test('ocular loss suppresses selection, preserves draft, and needs per-channel validation',()=>{
 const e=createEngine(),replay=new PostureReplay(e);e.setDraft('unfinished');e.apply(replay.start().id);
 e.select('accidental');const p=replay.lose();assert.equal(e.confirm('blink').ok,false);assert.equal(e.select('invalid gaze').ok,false);
 e.apply(p.id);assert.equal(e.state.draft,'unfinished');assert.equal(e.state.config.modality,'keyboard');assert.equal(e.state.availability.eeg,true);
 replay.restoreGeometry();assert.equal(e.state.availability.gaze,false);assert.equal(e.state.availability.blink,false);
 replay.revalidate('gaze');assert.equal(e.state.availability.gaze,true);assert.equal(e.state.availability.blink,false);
 assert.equal(e.undo().ok,false);replay.revalidate('blink');assert.equal(e.undo().ok,true);assert.equal(e.state.draft,'unfinished');
 assert.equal(e.state.availability.pupil,false);replay.revalidate('pupil');assert.equal(e.state.availability.pupil,true);
});
