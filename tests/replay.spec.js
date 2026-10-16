import {test,expect} from '@playwright/test';
async function chooseStart(page,take,time) {
  await page.locator('#edit-'+take).click();
  await expect(page.locator('#editor-apply')).toBeEnabled();
  await page.locator('#editor-timeline').evaluate((e,time)=>{e.value=String(time);e.dispatchEvent(new Event('input',{bubbles:true}));},time);
  await expect.poll(()=>page.locator('#editor-video').evaluate(v=>v.seeking)).toBe(false);
  await expect.poll(()=>page.locator('#editor-video').evaluate(v=>v.currentTime)).toBeCloseTo(time,2);
  await page.locator('#editor-apply').click();
  await expect(page.locator('#editor-dialog')).not.toBeVisible();
  await expect(page.locator('#start-'+take)).toHaveValue(time.toFixed(3));
}

test('local MP4 render keeps dimensions, timing and all video bytes on device',async({page})=>{
  const errors=[], requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.addInitScript(()=>{
    const OriginalWorker=window.Worker;
    window.Worker=class extends OriginalWorker {
      constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='plan')window.testRenderPlan=e.data.plan;});}
    };
  });
  await page.goto('/');await expect(page).toHaveTitle(/Crux Ghost/);
  await page.getByRole('button',{name:'Try a demo'}).click();
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#timeline').evaluate(e=>{e.value='1.5';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#time')).toHaveText('00:01.500');
  await chooseStart(page,'a',0.25);
  await chooseStart(page,'b',0.5);
  await page.locator('#duration').fill('0.75');
  await page.locator('#export').click();
  await expect(page.locator('#result')).toBeVisible({timeout:120000});
  await expect(page.locator('#result-info')).toContainText('480×640');
  await expect(page.locator('#result-info')).toContainText('30.000 fps');
  await expect(page.locator('#result-info')).toContainText('0.75s');
  expect(await page.evaluate(()=>({a:testRenderPlan.startA,b:testRenderPlan.startB,duration:testRenderPlan.duration}))).toEqual({a:.25,b:.5,duration:.75});
  await expect.poll(()=>page.locator('#result-video').evaluate(v=>v.duration)).toBeCloseTo(.75,1);
  await expect.poll(()=>page.locator('#result-video').evaluate(v=>v.videoWidth)).toBe(480);
  expect(requests.every(r=>r.method==='GET')).toBeTruthy();
  expect(requests.every(r=>r.url.startsWith('http://127.0.0.1:8080')||r.url.startsWith('blob:'))).toBeTruthy();
  expect(errors).toEqual([]);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('body')).toBeVisible();
  await page.screenshot({path:'test-results/mobile-before-check.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.locator('body *').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}))))).toBeTruthy();
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('lossless export and cancellation reset the worker',async({page})=>{
  await page.goto('/');await page.locator('#demo').click();await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#export').click();await page.locator('#cancel').click();await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#quality').selectOption('lossless');await page.locator('#duration').fill('0.3');
  await page.locator('#export').click();await expect(page.locator('#result')).toBeVisible({timeout:120000});
  await expect(page.locator('#result-info')).toContainText('RGB codec-lossless');
});

test('selected files open the mobile editor; apply, cancel, stepping and replacement preserve starts',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('#edit-a')).toBeDisabled();
  await page.locator('#file-a').setInputFiles('web/demo/take-a.mp4');
  await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#editor-apply')).toBeEnabled();
  await page.locator('#editor-forward').click();
  await expect.poll(()=>page.locator('#editor-video').evaluate(v=>v.currentTime)).toBeCloseTo(1/30,3);
  await page.locator('#editor-back').click();
  await expect.poll(()=>page.locator('#editor-video').evaluate(v=>v.currentTime)).toBeCloseTo(0,3);
  await page.locator('#editor-cancel').click();await expect(page.locator('#start-a')).toHaveValue('0');
  await chooseStart(page,'a',1.25);
  await page.locator('#edit-a').click();await expect(page.locator('#editor-apply')).toBeEnabled();
  await expect(page.locator('#editor-saved')).toContainText('00:01.250');
  await expect.poll(()=>page.locator('#editor-video').evaluate(v=>v.currentTime)).toBeCloseTo(1.25,2);
  await page.screenshot({path:'test-results/start-editor-mobile.png'});
  expect(await page.locator('#editor-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBeTruthy();
  await page.locator('#editor-forward').click();await page.locator('#editor-cancel').click();
  await expect(page.locator('#start-a')).toHaveValue('1.250');
  await expect.poll(()=>page.locator('#editor-video').evaluate(v=>v.getAttribute('src'))).toBe(null);
  await page.locator('#file-b').setInputFiles('web/demo/take-b.mp4');
  await expect(page.locator('#editor-apply')).toBeEnabled();await page.locator('#close-editor').click();
  await chooseStart(page,'b',.75);
  await expect.poll(()=>page.locator('#video-a').evaluate(v=>v.currentTime)).toBeCloseTo(1.25,2);
  await expect.poll(()=>page.locator('#video-b').evaluate(v=>v.currentTime)).toBeCloseTo(.75,2);
  await expect(page.locator('#time')).toHaveText('00:00.000');
  await page.locator('#file-a').setInputFiles('web/demo/take-a.mp4');
  await expect(page.locator('#editor-apply')).toBeEnabled();await expect(page.locator('#editor-saved')).toContainText('00:00.000');
  await page.keyboard.press('Escape');await expect(page.locator('#editor-dialog')).not.toBeVisible();
  await expect(page.locator('#start-a')).toHaveValue('0');await expect(page.locator('#start-b')).toHaveValue('0.750');
  expect(errors).toEqual([]);
});
