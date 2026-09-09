import test from 'node:test';
import assert from 'node:assert/strict';
import {episode} from '../scripts/evaluate.js';
test('paired simulation is reproducible and outcomes depend on action',()=>{
 assert.deepEqual(episode('fixed',901),episode('fixed',901));
 const fixed=episode('fixed',901),adapted=episode('neuralbridge',901);
 assert.notEqual(fixed.elapsedMs,adapted.elapsedMs);assert.ok(adapted.changes>0);
 assert.equal(fixed.completed+fixed.misses,60);
});
