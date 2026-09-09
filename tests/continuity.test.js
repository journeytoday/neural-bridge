import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine.js';
import {signTestOrder} from '../src/platform.js';
test('a rejected support offer is not repeated after restoring local memory',()=>{
 const a=createEngine();for(let i=0;i<5;i++)a.observe({modality:'pointer',quality:.9,error:true});a.reject(a.propose().id);
 const b=createEngine();b.importMemory(a.exportMemory());for(let i=0;i<5;i++)b.observe({modality:'pointer',quality:.9,error:true});assert.equal(b.propose(),null);
});
test('persisted evidence retains feedback but never restores live reliability or private text',()=>{
 const a=createEngine();a.select('private phrase');a.confirm();a.reportOutcome('helpful');const memory=a.exportMemory();
 assert.equal(JSON.stringify(memory).includes('private phrase'),false);
 const b=createEngine();assert.equal(b.importMemory(memory).ok,true);assert.equal(b.state.draft,'');assert.deepEqual(b.state.reliability,{});
 assert.ok(b.state.history.some(e=>e.feedback==='helpful'&&e.historical));
});
test('missing context increases evidence required without implying decline',()=>{
 const e=createEngine();e.observe({modality:'physiology',missing:true});
 for(let i=0;i<3;i++)e.observe({modality:'pointer',quality:.9,error:true});
 assert.equal(e.propose(),null);
 for(let i=0;i<2;i++)e.observe({modality:'pointer',quality:.9,error:true});
 assert.ok(e.propose());
});
test('voice quality changes whether a transcript may become a draft',()=>{
 const e=createEngine();assert.equal(e.voiceContribution('hello').ok,false);
 for(let i=0;i<3;i++)e.observe({modality:'voice',quality:.9,error:false});
 assert.equal(e.voiceContribution('hello').ok,true);
 for(let i=0;i<6;i++)e.observe({modality:'voice',quality:.9,error:true});
 assert.equal(e.voiceContribution('wrong').ok,false);assert.equal(e.state.draft,'hello');
});
test('expired test orders require review, preserve version floor, and survive reload',()=>{
 let now=1000;const e=createEngine({now:()=>now});
 const order=signTestOrder({author:'demo-clinician',subject:'demo-user',purpose:'interaction',version:1,effectiveAt:new Date(0).toISOString(),expiresAt:new Date(2000).toISOString(),permissions:['interaction:dwell'],minDwellMs:1000});
 e.installOrder(order);assert.equal(e.reviewExpiredOrder().ok,false);now=3000;
 const b=createEngine({now:()=>now});b.importMemory(e.exportMemory());assert.equal(b.getOrderStatus().expired,true);assert.equal(b.reviewExpiredOrder().ok,true);assert.equal(b.getOrderStatus(),null);
});
