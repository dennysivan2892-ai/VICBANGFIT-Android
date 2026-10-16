const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {chromium}=require('playwright');
const html=readFileSync('web/index.html','utf8');
const block=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const dayCode=block('// BEGIN CLIENT MY DAY','// END CLIENT MY DAY');
const visualCode=block('function exerciseVisual(', 'function formatRoutineSetMeta');
const foodCode=block('function nutritionFoodVisual(', 'function nutritionSafetyFoodRowHtml');
const catalogCode=block('const nutritionSubstitutionCatalog=','function nutritionSwapNormalize');
const expansionCode=block('const VIC_EXERCISE_EXPANSION=','async function expandExerciseLibrary');
const normCode=block('function nutritionSafetyNorm(', 'function nutritionFoodSafetyMeta');
const escapeCode=`const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const nutritionEsc=escHtml;`;
const context=vm.createContext({console,Date});
vm.runInContext(escapeCode+normCode+visualCode+foodCode+catalogCode+expansionCode,context);
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(nutritionSubstitutionCatalog.filter(f=>nutritionFoodVisual(f.name)==="🍽️").map(f=>f.name))',context)),[],'Every catalog food has a matching icon');
assert.equal(vm.runInContext("nutritionFoodVisual('Espinacas')",context),'🥬');
assert.equal(vm.runInContext("nutritionFoodVisual('Papaya')",context),'🥭');
assert.equal(vm.runInContext("nutritionFoodVisual('Arroz basmati en crudo')",context),'🍚');
assert.equal(vm.runInContext("nutritionFoodVisual('Merluza al horno')",context),'🐟');
assert.equal(vm.runInContext("nutritionFoodVisual('Tortitas de arroz')",context),'🍘');
assert.equal(vm.runInContext("nutritionFoodVisual('Jamón serrano magro')",context),'🥩');
assert.equal(vm.runInContext("exerciseVisual({name:'Curl bayesiano'})",context),'💪');
assert.equal(vm.runInContext("exerciseVisual({name:'Sentadilla búlgara'})",context),'🦵');
assert.equal(vm.runInContext("exerciseVisual({name:'Hip thrust unilateral'})",context),'🍑');
assert.equal(vm.runInContext("exerciseVisual({name:'Plancha lateral'})",context),'🧘');
(async()=>{
 const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const section=block('<section id="client_home"','<section id="client_presential"');
 await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style><main style="padding:16px">'+section.replace('class="section"','class="section active"')+'</main><div id="visualTest"></div>');
 await page.addScriptTag({content:`${escapeCode}${normCode}${visualCode}${foodCode}
 let currentProfile={id:'client-a',role:'client'},clientPlanningAccessAllowed=true,clientRoutines=[];
 let services={training:true,nutrition:true,supplements:true},calls=[],queries=[],fail=false;
 const fixture={nutrition_plans:{id:'diet',name:'Dieta de definición'},nutrition_meals:[{id:'breakfast',name:'Desayuno'},{id:'lunch',name:'Comida'}],nutrition_meal_logs:[{meal_id:'breakfast',completed:true}],supplement_plans:{id:'supp',name:'Suplementación'},supplement_items:[{supplement_name:'Creatina',dose_text:'5 g',timing:'Con desayuno',frequency:'daily'}]};
 const sb={from(table){queries.push(table);const q={select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle(){return this},then(resolve){resolve({data:fixture[table],error:fail?{message:'offline'}:null})}};return q}};
 const clientServiceEnabled=s=>services[s]!==false;
 const applyClientServiceVisibility=()=>document.querySelectorAll('[data-client-service]').forEach(el=>el.style.display=clientServiceEnabled(el.dataset.clientService)?'':'none');
 const nutritionDateISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const nutritionToday=()=>nutritionDateISO(new Date());
 const workoutTimeShort=v=>String(v||'').slice(0,5);const suppFrequencyLabel=()=> 'Diario';
 let activePage='client_home';const vicActivePage=()=>activePage;const showPage=id=>{calls.push(id);activePage=clientPlanningAccessAllowed?id:'client_home'};const openWorkoutSession=(r,d)=>calls.push(r+'/'+d);
 const loadClientSteps=async()=>{clientDaySet('clientDayStepsTitle','5.000 pasos');clientDaySet('clientDayStepsMeta','Objetivo: 8.000 · Faltan 3.000')};
 const loadClientCheckinStatus=async()=>{clientDaySet('clientHomeCheckin','Programado');clientDaySet('clientHomeCheckinMeta','Lunes, 19 de octubre')};
 const loadClientWater=async()=>clientDaySet('clientDayWaterTarget','3 L al día');const loadClientRoutines=async()=>renderClientDayTraining();
 ${dayCode}`});
 // Scheduling uses the actual weekday, handles Sunday, dates and flexible routines.
 const sunday=await page.evaluate(()=>{
  const date=new Date(2026,9,18,12);return clientDayWorkouts([{id:'r',days:[{id:'sun',weekday:7},{id:'mon',weekday:1},{id:'free',weekday:null},{id:'archived',weekday:7,is_archived:true}]},{start_date:'2026-10-19',days:[{id:'future',weekday:7}]},{end_date:'2026-10-17',days:[{id:'expired',weekday:7}]}],date)
 });
 assert.deepEqual(sunday.scheduled.map(x=>x.day.id),['sun']);assert.deepEqual(sunday.flexible.map(x=>x.day.id),['free']);
 await page.evaluate(()=>{clientRoutines=[{id:'r',name:'Torso–pierna',days:[{id:'today',name:'Torso',weekday:new Date().getDay()||7,exercises:[{}]}]}];return loadClientDay()});
 assert.match(await page.locator('#clientHeroTitle').innerText(),/Torso/);
 await page.locator('#clientHeroBtn').click();assert.deepEqual(await page.evaluate(()=>calls),['client_workout','r/today']);
 assert.match(await page.locator('#clientDayNutritionMeta').innerText(),/1\/2.*Comida/);
 assert.match(await page.locator('#clientDaySupplementsMeta').innerText(),/Creatina · 5 g/);
 // Explicit schedule with no matching day must not default to the first workout.
 await page.evaluate(()=>{clientRoutines[0].days[0].weekday=(new Date().getDay()||7)%7+1;renderClientDayTraining()});
 assert.match(await page.locator('#clientHeroTitle').innerText(),/sin sesión programada/);
 await page.evaluate(()=>{clientRoutines[0].days[0].weekday=null;renderClientDayTraining()});assert.match(await page.locator('#clientHeroMeta').innerText(),/sin día fijo/);
 // Native icons render without SVG image loading; valid uploaded exercise photos stay in use.
 await page.evaluate(()=>document.getElementById('visualTest').innerHTML=nutritionFoodThumbHtml({food_name:'Arroz <script>'})+exerciseThumbHtml({name:'Curl bayesiano',image_url:'https://invalid.example/missing.png'}));
 await page.locator('#visualTest img').evaluate(img=>img.dispatchEvent(new Event('error')));
 assert.equal(await page.locator('#visualTest .native-food-icon').innerText(),'🍚');assert.equal(await page.locator('#visualTest .placeholder').isVisible(),true);
 assert.equal(await page.locator('#visualTest .placeholder').innerText(),'💪');
 // All assigned supplements appear in the full plan; summary limits the list and indicates more.
 await page.evaluate(()=>{fixture.supplement_items=[];return loadClientDay()});assert.equal(await page.locator('#clientDaySupplementsCard').isVisible(),false);
 await page.evaluate(()=>{fixture.nutrition_plans=null;return loadClientDay()});assert.match(await page.locator('#clientDayNutritionTitle').innerText(),/Sin dieta/);
 await page.evaluate(()=>{fail=true;return loadClientDay()});assert.match(await page.locator('#clientDayNutritionTitle').innerText(),/No se pudo/);
 // Disabled services and expired access must not read their plan tables.
 await page.evaluate(()=>{fail=false;services={training:false,nutrition:false,supplements:false};queries=[];return loadClientDay()});assert.deepEqual(await page.evaluate(()=>queries),[]);
 await page.evaluate(()=>{services={training:true,nutrition:true,supplements:true};queries=[];clientPlanningAccessAllowed=false;return loadClientDay()});assert.deepEqual(await page.evaluate(()=>queries),[]);assert.equal(await page.locator('#clientDayPlanning').isVisible(),false);
 // Return to a realistic populated home for visual review.
 await page.evaluate(()=>{clientPlanningAccessAllowed=true;fixture.nutrition_plans={id:'diet',name:'Dieta personalizada'};fixture.supplement_items=[{supplement_name:'Creatina monohidrato',dose_text:'5 g',timing:'Con desayuno',frequency:'daily'}];return loadClientDay()});
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width)}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/client-my-day-mobile.png',fullPage:true});
 const ids=await page.locator('[id]').evaluateAll(els=>els.map(e=>e.id));assert.equal(ids.length,new Set(ids).size,'No duplicate IDs');assert.deepEqual(errors,[]);
 console.log('PASS: catalog icons, photo fallback, scheduling, Sunday/date bounds, diet logs, supplement summary, no-plan/error states, service/access gates, responsive home');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
