const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('web/index.html','utf8');
function fn(name){let start=html.indexOf('function '+name+'(');if(html.slice(start-6,start)==='async ')start-=6;return html.slice(start,html.indexOf('\n}',start)+2)}
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(section('<div id="nutritionBuilderModal"','<div id="monthlyNutritionReviewModal"')+'<select id="smartNutClient"><option value="client">Cliente</option></select><select id="smartNutMealCount"><option value="4">4</option><option value="5">5</option></select><select id="smartNutGoal"><option value="loss">Pérdida</option></select>');
 await page.addScriptTag({content:`
 let currentProfile={role:'trainer',id:'trainer'},clients=[{id:'client',name:'Cliente',services:{nutrition:true}}],trainerContentClientId='client',activeTrainerClientId='client';
 let nutritionEditingPlanId='old-five',nutritionEditingBaseline=null,nutritionSaving=false,nutritionGenerating=false,nutritionGenerationRequest=0,nutritionMealEditorSeq=0,trainerProposalBusy=false,nutritionBuilderSafetyTimer=null,nutritionBuilderSafetyLast={blocked:false};
 let nutritionAutoPreviousFoods=new Set(),nutritionAutoRevisionMode='initial',nutritionAutoCalorieDirection='same',nutritionAutoRevisionPickCounter=0,mutation=false,delays=[],useDelay=false;
 let saved={plans:[{id:'old-five',status:'active'}],meals:[],foods:[]};
 const toast=()=>{},confirm=()=>true,smartNutritionEstimate=()=>({weight:80}),smartNutritionCalculate=()=>{},smartNutritionNum=(id,f)=>({smartNutProteinKg:2,smartNutCarbKg:3,smartNutFatKg:.8}[id]??f);
 const nutritionQuickReset=()=>{},nutritionProfileBlank=()=>({}),nutritionFoodAllowed=()=>true,nutritionFoodBlockedReason=()=>'',nutritionProfileActiveText=()=>'';
 const nutritionLoadSafetyProfile=()=>useDelay?new Promise(r=>delays.push(r)):Promise.resolve({});
 const validateNutritionBuilderSafety=async()=>({blocked:false}),scheduleNutritionBuilderSafety=()=>{},initNutritionBuilderSafetyListeners=()=>{};
 const vicDataMutationActive=()=>mutation,vicBeginDataMutation=()=>mutation=true,vicEndDataMutation=()=>mutation=false,vicError=(e,m)=>e.message||m,loadTrainerNutrition=async()=>{};
 const sb={functions:{invoke:async()=>({data:{}})},from(table){let payload,action;return {insert(p){payload=p;action='insert';return this},select(){return this},update(p){payload=p;action='update';return this},is(){return this},eq(){return this},neq(){return this},in(){return this},order(){return this},maybeSingle:async()=>({data:saved.plans.find(p=>p.id==='new-four')}),single:async()=>{const id=table==='nutrition_plans'?'new-four':'meal-'+(saved.meals.length+1);if(table==='nutrition_plans')saved.plans.push({...payload,id});else saved.meals.push({...payload,id});return {data:{id}}},then(resolve){if(table==='nutrition_foods'&&action==='insert')saved.foods.push(...payload);if(table==='nutrition_plans'&&action==='update')saved.plans[0].status='archived';resolve({error:null,data:table==='nutrition_meals'?saved.meals:table==='nutrition_foods'?saved.foods:[]})}}}};
 ${section('const nutritionSubstitutionCatalog=','function nutritionSwapNormalize(')}
 ${['nutritionEsc','nutritionSafetyNorm','nutritionSwapNormalize','nutritionSwapFindFood','nutritionSwapMacros','nutritionWeightDisplayName','nutritionFoodEditorLine','nutritionParseFoodLine','nutritionMealTime'].map(fn).join('\n')}
 ${section('// BEGIN NUTRITION ADJUSTMENTS','// END NUTRITION ADJUSTMENTS')}
 ${section('/* ===== GENERACIÓN AUTOMÁTICA DE COMIDAS DESDE MACROS ===== */','async function loadNutritionPlanDetails(')}
 ${['nutritionBuilderCollectMeals','addNutritionMealEditor','resetNutritionBuilder','fillNutritionClients','openNutritionBuilder','closeNutritionBuilder','smartNutritionUseInRealPlan','saveNutritionPlan','nutritionNotifyAfterSave','loadNutritionPlanDetails'].map(fn).join('\n')}
 const nutritionEnergyRulesForSave=nutritionGlobalRules;
 `});
 await page.evaluate(()=>smartNutritionUseInRealPlan());
 assert.equal(await page.evaluate(()=>nutritionEditingPlanId),null,'new action must never reuse existing five-meal plan');
 assert.equal(await page.locator('.nutrition-meal-editor').count(),4);
 assert.equal(await page.locator('#nutritionAutoMealCount').inputValue(),'4');
 assert.equal(await page.evaluate(()=>saved.plans[0].status),'active','opening draft leaves saved diet alone');
 await page.evaluate(()=>saveNutritionPlan());
 assert.equal(await page.evaluate(()=>saved.meals.length),4);
 assert.equal(await page.evaluate(()=>saved.meals.every(m=>m.plan_id==='new-four')),true);
 assert.equal(await page.evaluate(()=>saved.plans[0].status),'archived');
 assert.equal(await page.evaluate(()=>saved.foods.length>0),true);
 const reopened=await page.evaluate(()=>loadNutritionPlanDetails('new-four'));assert.equal(reopened.meals.length,4);assert.ok(reopened.meals.every(m=>m.foods.length>0));
 // A slow five-meal request cannot overwrite a later four-meal request.
 await page.evaluate(()=>{openNutritionBuilder('client');document.getElementById('nutritionCalories').value=2200;document.getElementById('nutritionProtein').value=160;document.getElementById('nutritionCarbs').value=240;document.getElementById('nutritionFat').value=60;useDelay=true;document.getElementById('nutritionAutoMealCount').value='5';window.older=generateNutritionMealsFromTargets();document.getElementById('nutritionAutoMealCount').value='4';window.newer=generateNutritionMealsFromTargets();});
 await page.evaluate(async()=>{delays[1]({});await window.newer;delays[0]({});await window.older;});
 assert.equal(await page.locator('.nutrition-meal-editor').count(),4);
 assert.deepEqual(errors,[]);
 for(const count of [3,4,5])for(const seed of [0,3,6]){
  await page.evaluate(async({count,seed})=>{useDelay=false;nutritionEditingPlanId=null;nutritionAutoVarietyCounter=seed;Date.now=()=>0;document.getElementById('nutritionAutoMealCount').value=String(count);document.getElementById('nutritionCalories').value=2340;document.getElementById('nutritionProtein').value=180;document.getElementById('nutritionCarbs').value=270;document.getElementById('nutritionFat').value=60;await generateNutritionMealsFromTargets();},{count,seed});
  assert.equal(await page.locator('.nutrition-meal-editor').count(),count,'generation '+count+' seed '+seed);
  assert.equal(await page.evaluate(()=>nutritionBuilderCollectMeals().every(m=>{const t=nutritionAdjustmentTotals([m]),n=nutritionBuilderCollectMeals().length;return Math.abs(t.p-180/n)<.6&&Math.abs(t.f-60/n)<.6})),true,'balanced generated macros');
 }
 console.log('PASS: fresh four-meal draft with existing five-meal plan; generated rows, saved rows, old-plan archive only on save; stale generation cannot overwrite selected count');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

