const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('web/index.html','utf8');const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [390,1000]){
 const page=await browser.newPage({viewport:{width,height:844}});
 await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style>'+block('<div id="shareRoutineModal"','<div id="routineBuilderModal"'));
 await page.addScriptTag({content:`
 let uuidCounter=0;const crypto={randomUUID:()=>String(++uuidCounter)};
 const escHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 let currentProfile={id:'trainer',role:'trainer'},routineSaving=false,trainerContentClientId=null;
 let clients=[{id:'a',name:'Juan',services:{training:true}},{id:'b',name:'Pedro',services:{training:true}},{id:'c',name:'Ana',sex:'female',services:{training:true}},{id:'d',name:'Luis',sex:'male',services:{training:true}},{id:'e',name:'Sin entrenamiento',services:{training:false}}];
 let trainerRoutines=[{id:'r1',client_id:'a',client_name:'Juan',name:'Torso & pierna',status:'active'},{id:'r2',client_id:'b',client_name:'Pedro',name:'Torso & pierna',status:'active',shared_source_routine_id:'r1'}];
 let calls=[],fail=false,loaded=0,edited=null,confirmed=[];const confirm=s=>{confirmed.push(s);return true};const toast=s=>{};
 const setAuthMessage=(id,s)=>document.getElementById(id).textContent=s;const vicError=(e,f)=>e.message||f;
 const routineRequest=p=>p;const sb={rpc:async(name,args)=>{calls.push({name,args});if(fail)throw new Error('Sin conexión');return {data:[],error:null}},from:()=>({select:()=>({eq(){return this},then(resolve){return Promise.resolve({data:[{id:'r2',client_id:'b'}],error:null}).then(resolve)}})})};
 const loadTrainerRoutines=async()=>{loaded++};const openEditRoutine=async id=>{edited=id};
 ${block('// BEGIN SHARED TRAINING','// END SHARED TRAINING')}
 `});
 await page.evaluate(()=>openShareRoutine('r2'));
 assert.equal(await page.locator('#shareRoutineModal').isVisible(),true);
 assert.match(await page.locator('#shareRoutineSource').innerText(),/Juan/);
 assert.equal(await page.locator('#shareRoutineClients input[value="a"]').count(),0);
 assert.equal(await page.locator('#shareRoutineClients input[value="e"]').count(),0);
 assert.equal(await page.locator('#shareRoutineClients input[value="b"]').isDisabled(),true);
 for(const id of ['c','d'])assert.equal(await page.locator('#shareRoutineClients input[value="'+id+'"]').isEnabled(),true);
 await page.locator('#shareRoutineSearch').fill('ana');
 assert.equal(await page.locator('#shareRoutineClients label:visible').count(),1);
 await page.locator('#shareRoutineSearch').fill('');
 await page.locator('#shareRoutineSave').click();assert.match(await page.locator('#shareRoutineMsg').innerText(),/Selecciona/);
 await page.locator('#shareRoutineClients input[value="c"]').check();
 await page.evaluate(()=>fail=true);await page.locator('#shareRoutineSave').click();
 assert.match(await page.locator('#shareRoutineMsg').innerText(),/Sin conexión/);
 await page.evaluate(()=>fail=false);await page.locator('#shareRoutineSave').click();
 const calls=await page.evaluate(()=>globalThis.__calls=calls);
 assert.equal(calls[0].args.p_source,'r1');assert.equal(calls[0].args.p_link,true);
 assert.deepEqual(calls[0].args.p_clients,['c']);assert.equal(calls[0].args.p_request,calls[1].args.p_request,'Retry must use same idempotency key');
 await page.evaluate(()=>openShareRoutine('r1'));await page.locator('#shareRoutineMode').selectOption('copy');await page.locator('#shareRoutineClients input[value="d"]').check();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
 if(width===390)await page.screenshot({path:'/tmp/vic-shared-routines-mobile.png'});
 await page.locator('#shareRoutineSave').click();assert.equal(await page.evaluate(()=>calls.at(-1).args.p_link),false);
 await page.evaluate(()=>detachSharedRoutine('r2',true));assert.equal(await page.evaluate(()=>edited),'r2');
 await page.evaluate(()=>confirmSharedRoutineSave(trainerRoutines[0]));assert.match(await page.evaluate(()=>confirmed.at(-1)),/Juan, Pedro/);
 await page.close();
 }
 console.log('PASS mobile/desktop sharing, male/female selection, service filter, search, copy/link, safe retries, group warning and individual adaptation');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
