import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine.js';
import {signTestOrder} from '../src/platform.js';
test('installed order constrains later apply and undo; expiry prevents stale rule execution',()=>{
 let now=1000;const e=createEngine({now:()=>now});
 const order=signTestOrder({author:'demo-clinician',subject:'demo-user',purpose:'interaction',version:1,effectiveAt:new Date(0).toISOString(),expiresAt:new Date(5000).toISOString(),permissions:['interaction:dwell'],minDwellMs:1000});
 assert.equal(e.installOrder(order).ok,true);
 assert.equal(e.apply(e.requestConfiguration({dwellMs:1000,confirmation:'dwell'}).id).ok,true);
 assert.equal(e.apply(e.requestConfiguration({dwellMs:600}).id).ok,false);
 assert.equal(e.undo().ok,false);assert.equal(e.reviewRecovery().ok,true);
 now=6000;e.select('hello');now=7100;assert.equal(e.confirm('dwell').ok,false);
});
test('route loss invalidates pending selection and previous proposal',()=>{
 const e=createEngine();const p=e.requestConfiguration({targetScale:1.25});e.select('old candidate');
 e.observe({modality:'pointer',available:false});e.observe({modality:'pointer',available:true});
 assert.equal(e.apply(p.id).ok,false);assert.equal(e.confirm().ok,false);
 assert.throws(()=>e.observe({modality:'pointer',timestamp:Date.now()+100000}));
});
