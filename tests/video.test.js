import test from 'node:test';
import assert from 'node:assert/strict';
import {measureFixtureFrame,classifyVideoFrames} from '../src/video.js';
test('video pixels are measured and missing visibility fails closed',()=>{
 const data=new Uint8ClampedArray(160*90*4);
 for(let y=25;y<65;y++)for(let x=40;x<120;x++){const k=(y*160+x)*4;data[k]=data[k+1]=data[k+2]=255;}
 data[(5*160+5)*4+1]=255;
 assert.deepEqual(measureFixtureFrame({data,width:160,height:90}),{quality:1,openness:1});
 data[(5*160+5)*4+1]=0;assert.equal(measureFixtureFrame({data,width:160,height:90}).quality,0);
});
test('long closure candidate is distinct from short blink, no intent and frame gaps',()=>{
 const build=end=>Array.from({length:30},(_,i)=>({timestamp:i*50,quality:1,openness:i>=8&&i<end?.1:1}));
 assert.equal(classifyVideoFrames(build(16)).candidate,true);
 assert.equal(classifyVideoFrames(build(10)).candidate,false);
 assert.equal(classifyVideoFrames(build(0)).candidate,false);
 assert.equal(classifyVideoFrames(build(16).filter((_,i)=>i<7||i>10)).candidate,false);
});
