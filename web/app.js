const $ = id => document.getElementById(id);
const takes = ['a','b'].map(id => ({id,video:$(`video-${id}`),file:null,url:null,ready:false}));
const canvas = $('preview'), ctx = canvas.getContext('2d',{alpha:false});
const layers = takes.map(() => document.createElement('canvas'));
let duration = 0, position = 0, playing = false, worker = null, busy = false, resultBlob = null, resultURL = null, wakeLock = null, renderPlan = null;
let seekVersion = 0, objectURLs = [], loadingDemo = false;
const fmt = n => `${String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')}:${Math.max(0,n%60).toFixed(3).padStart(6,'0')}`;
const bytes = n => n >= 1024**2 ? `${(n/1024**2).toFixed(1)} MB` : `${(n/1024).toFixed(0)} KB`;
const value = id => Number($(id).value);
function message(text,error = false) {$('message').textContent = text;$('message').classList.toggle('error',error);}
function options() {return {startA:value('start-a'),startB:value('start-b'),blend:value('blend'),tint:value('tint'),dx:value('dx'),dy:value('dy'),scale:value('scale'),duration:$('duration').value ? value('duration') : undefined,quality:$('quality').value,audio:$('audio').value};}
function hideResult() {
  $('result').hidden = true;
  if(resultURL){$('result-video').removeAttribute('src');$('result-video').load();URL.revokeObjectURL(resultURL);resultURL=null;}
  resultBlob=null;
}
function labelControls() {
  $('blend-value').textContent = `${Math.round((1-value('blend'))*100)} / ${Math.round(value('blend')*100)}`;
  $('tint-value').textContent = `${Math.round(value('tint')*100)}%`;
  for(const id of ['dx','dy','scale']) $(id+'-value').textContent = `${Math.round(value(id)*1000)/10}%`;
}
function ready() {return takes.every(t => t.ready);}
function dimensions() {
  return {width:Math.ceil(Math.max(...takes.map(t=>t.video.videoWidth))/2)*2,height:Math.ceil(Math.max(...takes.map(t=>t.video.videoHeight))/2)*2};
}
function update() {
  labelControls();
  const both=ready();
  const valid=both && takes.every(t=>Number.isFinite(value('start-'+t.id)) && value('start-'+t.id)>=0 && value('start-'+t.id)<t.video.duration);
  duration = valid ? Math.max(0,Math.min(...takes.map(t=>t.video.duration-value('start-'+t.id)))) : 0;
  position=Math.max(0,Math.min(position,duration));
  $('canvas-wrap').classList.toggle('has-takes',both);
  for(const id of ['play','back','forward','timeline']) $(id).disabled = !valid || busy;
  $('export').disabled = !valid || busy;
  $('end-time').textContent=fmt(duration);$('timeline').max=String(duration || 1);$('timeline').value=String(position);$('time').textContent=fmt(position);
  if(both){
    const d=dimensions();
    const factor=Math.min(1,1280/Math.max(d.width,d.height));
    const w=Math.max(2,Math.round(d.width*factor)),h=Math.max(2,Math.round(d.height*factor));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;layers.forEach(c=>{c.width=w;c.height=h;});}
    $('canvas-spec').textContent=`${d.width} × ${d.height} CANVAS`;
    $('export-spec').textContent=`${d.width} × ${d.height} canvas · ${duration.toFixed(2)}s overlap · source frame rate is read by the export engine`;
  }
  draw();
}
function draw() {
  if(!ready())return;
  const d=dimensions(),factor=canvas.width/d.width,p=options();
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  takes.forEach((take,i)=>{
    const c=layers[i],x=c.getContext('2d',{alpha:false});
    x.globalCompositeOperation='source-over';x.globalAlpha=1;x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);
    const w=i?Math.max(2,Math.round(take.video.videoWidth*p.scale/2)*2):take.video.videoWidth;
    const h=i?Math.max(2,Math.round(take.video.videoHeight*p.scale/2)*2):take.video.videoHeight;
    const left=Math.floor((d.width-w)/2)+(i?Math.round(p.dx*d.width):0),top=Math.floor((d.height-h)/2)+(i?Math.round(p.dy*d.height):0);
    try{x.drawImage(take.video,left*factor,top*factor,w*factor,h*factor);}catch{return;}
    x.globalAlpha=p.tint;x.fillStyle=i?'rgb(255,99,110)':'rgb(36,224,240)';x.fillRect(0,0,c.width,c.height);x.globalAlpha=1;
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=i?p.blend:1-p.blend;ctx.drawImage(c,0,0);
  });
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
function seekVideo(video,time) {
  time=Math.max(0,Math.min(time,video.duration-0.001));
  if(Math.abs(video.currentTime-time)<.0005 && video.readyState>=2)return Promise.resolve();
  return new Promise(resolve=>{
    let timer;
    const done=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);resolve();};
    video.addEventListener('seeked',done,{once:true});timer=setTimeout(done,2000);
    video.currentTime=time;
  });
}
async function seek(time) {
  if(!ready())return;
  const version=++seekVersion;
  position=Math.max(0,Math.min(Number(time),duration));
  $('timeline').value=String(position);$('time').textContent=fmt(position);
  await Promise.all(takes.map(t=>seekVideo(t.video,value('start-'+t.id)+position)));
  if(version===seekVersion)draw();
}
function pause() {playing=false;takes.forEach(t=>t.video.pause());$('play').textContent='▶';$('play').setAttribute('aria-label','Play comparison');}
function tick() {
  if(!playing)return;
  position=Math.max(0,takes[0].video.currentTime-value('start-a'));
  if(position>=duration-.01){pause();seek(duration);return;}
  const expected=value('start-b')+position;
  if(Math.abs(takes[1].video.currentTime-expected)>.08)takes[1].video.currentTime=expected;
  $('timeline').value=String(position);$('time').textContent=fmt(position);draw();requestAnimationFrame(tick);
}
async function play() {
  if(!ready() || busy)return;
  if(playing){pause();return;}
  if(position>=duration-.02)await seek(0);else await seek(position);
  takes.forEach(t=>{t.video.playbackRate=value('speed');t.video.muted=true;});
  try{await Promise.all(takes.map(t=>t.video.play()));playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause comparison');requestAnimationFrame(tick);}
  catch{pause();message('This browser could not play both takes. Use the timeline or frame buttons to compare.',true);}
}
async function loadFile(take,file) {
  pause();hideResult();take.ready=false;
  if(take.url)URL.revokeObjectURL(take.url);
  take.file=file;take.url=URL.createObjectURL(file);take.video.src=take.url;take.video.load();
  $('info-'+take.id).textContent=`Reading ${file.name}…`;
  document.querySelector(`[data-take="${take.id}"]`).classList.remove('loaded');
  update();
  await new Promise((resolve,reject)=>{
    const clear=()=>{take.video.removeEventListener('loadeddata',ok);take.video.removeEventListener('error',bad);clearTimeout(timeout);};
    const ok=()=>{clear();resolve();};
    const bad=()=>{clear();reject(Error(`Your browser cannot preview ${file.name}. Use a browser-supported MP4 or MOV original.`));};
    const timeout=setTimeout(bad,30000);
    take.video.addEventListener('loadeddata',ok,{once:true});take.video.addEventListener('error',bad,{once:true});
    if(take.video.readyState>=2)ok();
  });
  if(!Number.isFinite(take.video.duration) || take.video.duration<=0)throw Error('The video needs a finite duration.');
  take.ready=true;$('start-'+take.id).value='0';$('start-'+take.id).max=String(take.video.duration-.001);
  $('info-'+take.id).textContent=`${file.name} · ${take.video.videoWidth}×${take.video.videoHeight} · ${take.video.duration.toFixed(1)}s · ${bytes(file.size)}`;
  document.querySelector(`[data-take="${take.id}"]`).classList.add('loaded');
  position=0;update();if(ready())await seek(0);
}
async function demo() {
  if(loadingDemo||busy)return;loadingDemo=true;$('demo').disabled=true;message('Loading two sample attempts…');
  try {
    const files=await Promise.all(['a','b'].map(async id=>{const r=await fetch(`demo/take-${id}.mp4`);if(!r.ok)throw Error('Demo files could not be loaded.');return new File([await r.blob()],`demo-take-${id}.mp4`,{type:'video/mp4'});}));
    await Promise.all(takes.map((t,i)=>loadFile(t,files[i])));
    message('Demo ready. These are illustrated sample attempts. Scrub slowly, adjust the blend, or export a local MP4.');
  }catch(e){message(e.message,true);}finally{loadingDemo=false;$('demo').disabled=false;}
}
function lock(value) {
  busy=value;
  document.querySelectorAll('.controls input,.controls button,.export-settings input,.export-settings select,#demo').forEach(e=>{e.disabled=value;});
  $('job').hidden=!value;$('export').hidden=value;
  if(!value){worker?.terminate();worker=null;wakeLock?.release().catch(()=>{});wakeLock=null;}
  update();
}
async function startExport() {
  if(busy||!ready())return;
  pause();message('');hideResult();
  if(takes.some(t=>t.file.size>=2*1024**3)){message('The browser engine has a 2 GB file limit. Choose shorter originals; the app never reduces resolution automatically.',true);return;}
  const opts=options();
  if(!Number.isFinite(opts.startA)||!Number.isFinite(opts.startB)||duration<=0){message('Choose valid synchronization points.',true);return;}
  if(opts.duration!==undefined && (!(opts.duration>0)||opts.duration>duration)){message('Export length must fit within the overlapping duration.',true);return;}
  lock(true);$('progress').removeAttribute('value');$('job-label').textContent='Loading the local video engine…';$('job-detail').textContent='First load downloads about 31 MB. Your video files stay here. Keep this page open.';
  try {
    worker=new Worker(new URL('engine/crux-worker.js',import.meta.url));
    const activeWorker=worker;
    navigator.wakeLock?.request('screen').then(lock=>{
      if(busy && worker===activeWorker)wakeLock=lock;else lock.release().catch(()=>{});
    }).catch(()=>{});
    worker.onerror=()=>{lock(false);message('The local engine stopped. This can happen when a device runs out of browser memory. Try shorter clips or a device with more memory.',true);};
    worker.onmessage=({data})=>{
      if(data.type==='stage')$('job-label').textContent=data.message;
      if(data.type==='ready'){
        const fps=Math.max(...data.sources.map(s=>s.fps));
        const nearest=[24,25,30,50,60,120,240].reduce((a,b)=>Math.abs(a-fps)<Math.abs(b-fps)?a:b);
        $('step-fps').value=String(nearest);
        $('job-label').textContent='Rendering on this device…';$('job-detail').textContent='No upload. No server. Keep this page open until rendering finishes.';$('progress').value=0;
        worker.postMessage({type:'render',options:opts});
      }
      if(data.type==='plan'){
        renderPlan=data.plan;
        $('job-detail').textContent=`${data.plan.width}×${data.plan.height} · ${data.plan.fps.toFixed(3)} fps · ${data.plan.duration.toFixed(2)}s. Rendering uses this device’s CPU.`;
      }
      if(data.type==='progress'){$('progress').value=data.value;$('job-label').textContent=`Rendering locally · ${Math.floor(data.value*100)}%`;}
      if(data.type==='error'){lock(false);message(data.message,true);}
      if(data.type==='complete'){
        resultBlob=new Blob([data.bytes],{type:'video/mp4'});resultURL=URL.createObjectURL(resultBlob);
        $('download').href=resultURL;$('result-video').src=resultURL;
        $('result-info').textContent=`${data.plan.width}×${data.plan.height} · ${data.plan.fps.toFixed(3)} fps · ${data.plan.duration.toFixed(2)}s · ${bytes(resultBlob.size)}${data.plan.quality==='lossless'?' · RGB codec-lossless; some mobile players cannot play this format.':''}`;
        const file=new File([resultBlob],'crux-ghost.mp4',{type:'video/mp4'});
        $('share').hidden=!navigator.canShare?.({files:[file]});
        $('result').hidden=false;lock(false);message('Your ghost replay is ready. Save the MP4 below.');
      }
    };
    worker.postMessage({type:'load',files:takes.map(t=>t.file)});
  } catch(e) {lock(false);message(`The local engine could not start: ${e.message}`,true);}
}
// The Android bridge accepts only bundled-app calls and writes chunks to Downloads.
async function nativeSave() {
  const bridge=window.CruxSave;if(!bridge||!resultBlob)return false;
  const token=bridge.begin('crux-ghost.mp4');
  if(!token)throw Error('Could not create the MP4 in Downloads.');
  try{
    const chunkSize=192*1024;
    for(let offset=0;offset<resultBlob.size;offset+=chunkSize){
      const chunk=new Uint8Array(await resultBlob.slice(offset,offset+chunkSize).arrayBuffer());
      let binary='';for(let i=0;i<chunk.length;i+=8192)binary+=String.fromCharCode(...chunk.subarray(i,i+8192));
      if(!bridge.append(token,btoa(binary)))throw Error('Could not write the MP4. Check free space.');
    }
    if(!bridge.finish(token))throw Error('Could not finalize the MP4.');
    message('Saved to Downloads/crux-ghost.mp4.');return true;
  }catch(e){bridge.abort(token);throw e;}
}
for(const take of takes){
  $('file-'+take.id).addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;message('');try{await loadFile(take,file);}catch(err){message(err.message,true);take.ready=false;update();}e.target.value='';});
  $('mark-'+take.id).addEventListener('click',async()=>{if(!take.ready)return;pause();$('start-'+take.id).value=take.video.currentTime.toFixed(3);position=0;hideResult();update();await seek(0);});
  $('start-'+take.id).addEventListener('change',()=>{pause();position=0;hideResult();update();seek(0);});
  take.video.addEventListener('play',()=>{if(!playing)draw();});
  take.video.addEventListener('seeked',draw);
}
for(const id of ['blend','tint','dx','dy','scale'])$(id).addEventListener('input',()=>{hideResult();update();});
for(const id of ['quality','audio','duration'])$(id).addEventListener('change',hideResult);
$('reset').addEventListener('click',()=>{for(const [id,v] of Object.entries({blend:.5,tint:.18,dx:0,dy:0,scale:1}))$(id).value=v;hideResult();update();});
$('play').addEventListener('click',play);$('back').addEventListener('click',()=>{pause();seek(position-1/value('step-fps'));});$('forward').addEventListener('click',()=>{pause();seek(position+1/value('step-fps'));});
$('timeline').addEventListener('input',()=>{pause();seek(value('timeline'));});
$('speed').addEventListener('change',()=>takes.forEach(t=>{t.video.playbackRate=value('speed');}));
$('demo').addEventListener('click',demo);$('export').addEventListener('click',startExport);
$('cancel').addEventListener('click',()=>{lock(false);message('Rendering cancelled. Your originals are still on your device.');});
$('download').addEventListener('click',async e=>{if(window.CruxSave){e.preventDefault();try{await nativeSave();}catch(err){message(err.message,true);}}});
$('share').addEventListener('click',async()=>{if(!resultBlob)return;try{await navigator.share({files:[new File([resultBlob],'crux-ghost.mp4',{type:'video/mp4'})]});}catch(e){if(e.name!=='AbortError')message('Sharing is unavailable here. Use Save MP4 instead.',true);}});
$('install').addEventListener('click',()=>$('install-dialog').showModal());$('close-install').addEventListener('click',()=>$('install-dialog').close());
$('install-dialog').addEventListener('click',e=>{if(e.target===$('install-dialog'))$('install-dialog').close();});
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)||!ready()||busy||$('install-dialog').open)return;if(e.code==='Space'){e.preventDefault();play();}if(['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();pause();seek(position+(e.code==='ArrowRight'?1:-1)/value('step-fps'));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',()=>{pause();worker?.terminate();});
if('serviceWorker' in navigator && !window.CruxSave)navigator.serviceWorker.register('sw.js').catch(()=>{});
update();
