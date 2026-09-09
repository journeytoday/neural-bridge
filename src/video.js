// Pixel measurements for our labeled synthetic eye fixture only, not a human face model.
export function measureFixtureFrame({data,width,height}) {
  if(width!==160 || height!==90 || data.length!==width*height*4) return {quality:0,openness:0};
  let whiteRows=0;
  for(let y=20;y<70;y++) {
    let light=0;
    for(let x=50;x<110;x++) {const k=(y*width+x)*4;if(data[k]>170&&data[k+1]>170&&data[k+2]>170)light++;}
    if(light>30)whiteRows++;
  }
  const marker=(5*width+5)*4;
  return {openness:Math.min(1,whiteRows/40),quality:data[marker+1]>150&&data[marker]<100?1:0};
}
export function classifyVideoFrames(frames,{minClosureMs=250,maxClosureMs=700}={}) {
  if(frames.length<5 || frames.some((f,i)=>f.quality<.8||!Number.isFinite(f.timestamp)||(i&&(f.timestamp<=frames[i-1].timestamp||f.timestamp-frames[i-1].timestamp>100)))) return {candidate:false,reason:'Missing frames or invalid visibility marker.'};
  const start=frames.findIndex((f,i)=>i>0&&frames[i-1].openness>.7&&f.openness<.25);
  const end=frames.findIndex((f,i)=>i>start&&start>=0&&f.openness>.7);
  const durationMs=end<0?0:frames[end].timestamp-frames[start].timestamp;
  return {candidate:durationMs>=minClosureMs&&durationMs<=maxClosureMs,durationMs,reason:'Synthetic video closure duration; not verified human intent.'};
}
export async function decodeVideoFixture(video,url,options={}) {
  video.src=url;video.muted=true;video.load();
  await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('Video could not decode. Ordinary text access remains available.'));});
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});const frames=[];
  for(let timestamp=50;timestamp<=1500;timestamp+=50) {
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video seek timed out')),3000);video.onseeked=()=>{clearTimeout(timer);resolve();};video.currentTime=timestamp/1000;});
    ctx.drawImage(video,0,0,160,90);
    frames.push({timestamp,...measureFixtureFrame(ctx.getImageData(0,0,160,90))});
  }
  return {...classifyVideoFrames(frames,options),frames,provenance:'synthetic-webm-pixel-replay'};
}
