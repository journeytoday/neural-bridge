import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vocabulary } from '../src/vocabulary.js';

const bootstrap = JSON.parse(readFileSync(new URL('../assets/vocabulary-en.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

test('bootstrap contains 1000 unique real word tokens with attribution', () => {
  assert.equal(bootstrap.words.length, 1000);
  assert.equal(new Set(bootstrap.words).size, 1000);
  assert.ok(bootstrap.words.every(word => /^[a-z]+(?:'[a-z]+)?$/.test(word)));
  for (const word of ['you', 'the', 'water', 'help']) assert.ok(bootstrap.words.includes(word));
  assert.equal(bootstrap.source.license, 'CC-BY-SA-4.0');
});

test('prefix search caps at eight and preserves bootstrap ranking without learning', () => {
  const vocabulary = new Vocabulary(bootstrap);
  const before = vocabulary.export();
  assert.deepEqual(vocabulary.search('T'), bootstrap.words.filter(word => word.startsWith('t')).slice(0, 8));
  assert.equal(vocabulary.search('t').length, 8);
  assert.deepEqual(vocabulary.search(''), []);
  vocabulary.search('unseen phrase');
  assert.deepEqual(vocabulary.export(), before);
});

test('personal terms are explicit, unrestricted, scoped and removed independently', () => {
  const vocabulary = new Vocabulary(['hello', 'help']);
  assert.equal(vocabulary.add('Hello 🐈 / private phrase', 'work'), true);
  vocabulary.add('Help me please');
  assert.deepEqual(vocabulary.search('he', 'work'), ['Hello 🐈 / private phrase', 'Help me please', 'hello', 'help']);
  assert.deepEqual(vocabulary.search('he', 'home'), ['Help me please', 'hello', 'help']);
  assert.equal(vocabulary.add('HELP ME PLEASE'), false);
  vocabulary.add('hello');
  assert.equal(vocabulary.search('hello', 'home').length, 1);
  vocabulary.remove('HELLO');
  assert.deepEqual(vocabulary.search('hello', 'home'), ['hello']);
  assert.equal(vocabulary.remove('Hello 🐈 / private phrase', 'work'), true);
});

test('versioned imports round trip and malformed input is atomic', () => {
  const vocabulary = new Vocabulary(bootstrap);
  vocabulary.add('  任意の文章\n🦋  ', 'creative');
  const exported = vocabulary.export();
  const restored = new Vocabulary(bootstrap);
  restored.import(JSON.stringify(exported));
  assert.deepEqual(restored.export(), exported);
  exported.personal[0].term = 'mutated';
  assert.notDeepEqual(vocabulary.export(), exported);
  assert.throws(() => restored.import({version: 2, personal: []}));
  assert.throws(() => restored.import({version: 1, personal: [{term:'new',environment:'global'}, {term:''}]}));
  assert.deepEqual(restored.export(), vocabulary.export());
});
