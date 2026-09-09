import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalLanguageModel} from '../src/language.js';
test('learned transitions change suggestions; novel text is not rewritten',()=>{
 assert.match(new LocalLanguageModel(['we enjoy apples']).suggest('we')[0],/apples/);
 assert.match(new LocalLanguageModel(['we enjoy oranges']).suggest('we')[0],/oranges/);
 assert.deepEqual(new LocalLanguageModel().suggest('unseenword'),[]);
});
