const {readFileSync,mkdirSync}=require('node:fs');
const {createRequire}=require('node:module');
const assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'))}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('playwright'))}
const html=readFileSync('web/index.html','utf8');
const code=html.split('// BEGIN TRAINER EXERCISE GUIDES\n')[1].split('// END TRAINER EXERCISE GUIDES')[0];
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>console.error('Browser script:',error.message));
  await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style>');
  await page.addScriptTag({content:`
   const currentProfile={id:'trainer-a',role:'trainer'};
   const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const vicError=(e,f)=>e.message||f;const toast=()=>{};
   const test={rows:[],uploaded:[],removed:[],failSave:false};
   const sb={from(table){let payload,op='read',videoFilter;const chain={select(){return chain},eq(key,value){if(key==='video_path')videoFilter=value;return chain},or(){return chain},limit(){return chain},upsert(p){payload=p;op='save';return chain},delete(){op='delete';return chain},maybeSingle(){return Promise.resolve({data:{id:'exercise-a',name:'Press con mancuernas',instructions:'Biblioteca',video_url:null}})},single(){if(test.failSave)return Promise.resolve({error:{message:'Fallo de conexión'}});const row={...payload,id:'saved'};test.rows=test.rows.filter(r=>r.client_id!==row.client_id).concat(row);return Promise.resolve({data:row})},then(resolve){resolve({data:op==='delete'?[]:videoFilter?test.rows.filter(r=>r.video_path===videoFilter):test.rows})}};return chain},storage:{from(){return {upload:async(path,file)=>{test.uploaded.push(path);return {}},remove:async(paths)=>{test.removed.push(...paths);return {}},createSignedUrl:async(path)=>({data:{signedUrl:'https://example.com/signed.mp4'}})}}}};
   ${code}
  `});
  await page.evaluate(()=>openExerciseGuide('exercise-a','trainer-a','',true));
  await page.locator('#guideInstructions').fill('Posición inicial y movimiento controlado');
  await page.locator('#guideErrors').fill('Evita balancear el torso');
  mkdirSync('test-results',{recursive:true});
  assert.equal(await page.evaluate(()=>document.getElementById('exerciseGuideDialog').getBoundingClientRect().right<=innerWidth),true);
  await page.locator('#exerciseGuideDialog').screenshot({path:'test-results/editor-mobile.png'});
  await page.locator('#guideVideoFile').setInputFiles({name:'demo.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1024)});
  await page.locator('#saveExerciseGuideBtn').click();
  await page.waitForFunction(()=>!guideState.saving);
  const saved=await page.evaluate(()=>test.rows[0]);if(!saved)throw new Error(await page.locator('#exerciseGuideMessage').innerText());
  assert.equal(saved.trainer_id,'trainer-a');assert.equal(saved.client_id,null);assert.match(saved.video_path,/^trainer-a\/exercise-a\/shared\//);
  await page.evaluate(()=>{closeExerciseGuide();return openExerciseGuide('exercise-a','trainer-a','client-a',true)});
  assert.equal(await page.locator('#guideInstructions').inputValue(),'Posición inicial y movimiento controlado');
  await page.locator('#guideInstructions').fill('Adaptación solo para este cliente');
  await page.locator('#saveExerciseGuideBtn').click();await page.waitForFunction(()=>!guideState.saving);
  assert.equal(await page.evaluate(()=>test.rows.find(r=>r.client_id===null).instructions),'Posición inicial y movimiento controlado');
  assert.equal(await page.evaluate(()=>guideResolve(test.rows,'client-b').instructions),'Posición inicial y movimiento controlado');
  await page.evaluate(()=>{closeExerciseGuide();currentProfile.id='client-a';currentProfile.role='client';return openExerciseGuide('exercise-a','trainer-a','client-a')});
  assert.equal(await page.locator('video').getAttribute('src'),'https://example.com/signed.mp4');
  assert.match(await page.locator('#exerciseGuideDialog').innerText(),/Adaptación solo para este cliente/);
  assert.equal(await page.locator('#saveExerciseGuideBtn').count(),0);
  await page.setViewportSize({width:1280,height:850});
  await page.locator('#exerciseGuideDialog').screenshot({path:'test-results/viewer-desktop.png'});
  await page.evaluate(()=>{closeExerciseGuide();currentProfile.id='trainer-a';currentProfile.role='trainer';return openExerciseGuide('exercise-a','trainer-a','',true)});
  await page.locator('#guideInstructions').fill('Cambios pendientes');
  await page.locator('#guideVideoFile').setInputFiles({name:'replacement.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1024)});
  await page.evaluate(()=>test.failSave=true);await page.locator('#saveExerciseGuideBtn').click();await page.waitForFunction(()=>!guideState.saving);
  assert.match(await page.locator('#exerciseGuideMessage').innerText(),/Fallo de conexión/);
  assert.equal(await page.locator('#guideInstructions').inputValue(),'Cambios pendientes');
  assert.equal(await page.evaluate(()=>test.removed.length),1);
  await page.locator('#guideVideoFile').setInputFiles([]);
  await page.locator('#guideVideoUrl').fill('javascript:alert(1)');await page.evaluate(()=>saveExerciseGuide());
  assert.match(await page.locator('#exerciseGuideMessage').innerText(),/https/);
  console.log('PASS: shared video upload, client adaptation, viewer video source, scope isolation, failed-save recovery, unsafe URL rejection');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
