const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=readFileSync('web/index.html','utf8');
function fn(name){const start=html.indexOf('function '+name+'(');const end=html.indexOf('\n}',start)+2;return (html.slice(start-6,start)==='async '?'async ':'')+html.slice(start,end);}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const section=html.slice(html.indexOf('<section id="client_nutrition"'),html.indexOf('<section id="client_progress"'));
 await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style>'+section.replace('class="section"','class="section active"'));
 await page.addScriptTag({content:`let currentProfile={id:'client',role:'client'},clientNutritionSupplementItems=[];let fixture={plan:{id:'plan',name:'Pauta diaria'},items:[{id:'item',supplement_name:'Creatina',dose_text:'5 g',timing:'Con desayuno',frequency:'daily'}],logs:[]};const clientServiceEnabled=()=>true;const suppToday=()=> '2026-10-17';const suppTime=v=>v||'';const suppFrequencyLabel=()=> 'Diario';const suppEvidenceClass=()=>'';const suppEvidenceLabel=()=>'';const toast=()=>{};const suppEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');const sb={from(table){let query={select(){return this},eq(){return this},order(){return this},limit(){return this},in(){return this},maybeSingle(){return this},upsert(payload){fixture.logs=[{item_id:payload.item_id,taken:payload.taken}];return Promise.resolve({error:null})},then(resolve){resolve({data:table==='supplement_plans'?fixture.plan:table==='supplement_items'?fixture.items:fixture.logs,error:fixture.error||null})}};return query}};${['renderNutritionMealSupplements','loadClientSupplements','toggleSupplementTaken'].map(fn).join('\n')}`});
 await page.evaluate(()=>{document.getElementById('clientNutritionMeals').innerHTML='<div data-nutrition-supp-meal="Desayuno"></div><div data-nutrition-supp-meal="Cena"></div>';return loadClientSupplements()});
 assert.equal(await page.locator('#clientNutritionSupplements').isVisible(),true);
 assert.match(await page.locator('#clientSuppList').innerText(),/Creatina[\s\S]*5 g/);
 assert.match(await page.locator('[data-nutrition-supp-meal="Desayuno"]').innerText(),/Creatina/);
 assert.equal(await page.locator('[data-nutrition-supp-meal="Cena"]').isVisible(),false);
 await page.locator('#clientSuppList button').click();await page.waitForFunction(()=>document.querySelector('#clientSuppList button').textContent.includes('Tomado'));
 await page.evaluate(()=>{fixture.items[0].timing='Con cada comida';return loadClientSupplements()});
 assert.match(await page.locator('[data-nutrition-supp-meal="Cena"]').innerText(),/Creatina/);
 await page.evaluate(()=>{fixture.plan=null;return loadClientSupplements()});
 assert.equal(await page.locator('#clientNutritionSupplements').isVisible(),false);
 assert.equal(await page.locator('[data-nutrition-supp-meal="Desayuno"]').isVisible(),false);
 await page.evaluate(()=>{fixture.error={message:'offline'};return loadClientSupplements()});
 assert.match(await page.locator('#clientSuppList').innerText(),/No se pudo cargar/);
 console.log('PASS: inline supplementation, meal timing, taken logs, empty plan and failure state');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
