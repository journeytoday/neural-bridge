// A small, actual statistical language model trained locally on fictional phrases.
// This is not a large language model and does not infer the user's intention.
const corpus = [
 'I would like some water please', 'I would like to rest for a while',
 'I would like to talk with you', 'I would like to go outside today',
 'Please help me change my position', 'Please give me a little more time',
 'Please stay here with me', 'I need some help with my computer',
 'I need a moment to finish my message', 'I want to tell you about my day',
 'I want to choose my own words', 'I feel comfortable here today',
 'Can we listen to some music', 'Can we talk about something else',
 'Thank you for waiting for me', 'That is not what I meant',
 'Let me try to explain it again', 'I enjoyed spending time with you today',
 'I would like some coffee please', 'I need to take a break',
 'Today I went outside and enjoyed the fresh air',
 'Today I spent time with a friend and we listened to music',
 'I want to tell you about a memory that matters to me',
 'I remember a day when we walked outside together',
 'We talked about our plans and enjoyed spending time together'
];
export class LocalLanguageModel {
 constructor(sentences=corpus) {
  this.transitions=new Map();
  for(const sentence of sentences) {
   const tokens=['<s>',...sentence.toLowerCase().split(/\s+/),'</s>'];
   for(let i=0;i<tokens.length-1;i++) {
    const counts=this.transitions.get(tokens[i])||new Map();
    counts.set(tokens[i+1],(counts.get(tokens[i+1])||0)+1);this.transitions.set(tokens[i],counts);
   }
  }
 }
 suggest(prefix='',mode='quick') {
  const words=prefix.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let beams=[{tokens:words,score:0,done:false}];
  for(let step=0;step<(mode==='story'?24:10);step++) {
   const next=[];
   for(const beam of beams) {
    if(beam.done){next.push(beam);continue;}
    const counts=this.transitions.get(beam.tokens.at(-1)||'<s>');
    if(!counts){next.push({...beam,done:true});continue;}
    const total=[...counts.values()].reduce((a,b)=>a+b,0);
    for(const [word,count] of counts) next.push({tokens:word==='</s>'?beam.tokens:[...beam.tokens,word],score:beam.score+Math.log(count/total),done:word==='</s>'});
   }
   beams=next.sort((a,b)=>b.score-a.score).slice(0,12);
   if(beams.every(b=>b.done))break;
  }
  return [...new Set(beams.map(b=>b.tokens.join(' ')).filter(t=>t!==words.join(' ')))].slice(0,3).map(t=>t.charAt(0).toUpperCase()+t.slice(1)+'.');
 }
}
