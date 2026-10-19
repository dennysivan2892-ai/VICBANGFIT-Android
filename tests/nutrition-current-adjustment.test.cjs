const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('web/index.html','utf8');
const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function fn(name){const start=html.indexOf('function '+name+'(');return html.slice(start,html.indexOf('\n}',start)+2)}
const catalog=html.slice(html.indexOf('const nutritionSubstitutionCatalog='),html.indexOf('\n];',html.indexOf('const nutritionSubstitutionCatalog='))+3);
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style>'+block('<div id="nutritionBuilderModal"','<div id="monthlyNutritionReviewModal"'));
 await page.addScriptTag({content:`let nutritionEditingPlanId='diet',nutritionSaving=false,nutritionMealEditorSeq=0,currentProfile={id:'trainer',role:'trainer'},calls=[],messages=[];
 const toast=m=>messages.push(m),scheduleNutritionBuilderSafety=()=>{},nutritionLoadSafetyProfile=async()=>({});
 const sb={from(table){calls.push(table);return {select(){return this},eq(){return this},async maybeSingle(){return {data:{maintenance_kcal:2000,updated_at:'2026-10-20'},error:null}}}}};
 ${catalog}\n${['nutritionEsc','nutritionSafetyNorm','nutritionSwapNormalize','nutritionSwapFindFood','nutritionSwapMacros','nutritionAutoLimits','nutritionAutoRound5','nutritionWeightDisplayName','nutritionFoodEditorLine','nutritionParseFoodLine','nutritionMealTime'].map(fn).join('\n')}
 ${block('// BEGIN NUTRITION ADJUSTMENTS','// END NUTRITION ADJUSTMENTS')}
 ${block('// BEGIN CURRENT DIET ADJUSTMENT','// END CURRENT DIET ADJUSTMENT')}
 ${fn('nutritionBuilderCollectMeals')}\n${fn('addNutritionMealEditor')}
 document.getElementById('nutritionBuilderModal').style.display='grid';
 document.getElementById('nutritionClient').innerHTML='<option value="client">Cliente</option>';
 nutritionSetGlobalRules();document.getElementById('nutritionMealEditors').innerHTML='';
 addNutritionMealEditor({id:'meal1',name:'Comida 1',time:'14:00',food_rules:{enabled:true,exclude_groups:['fruit']},foods:['Arroz 140 g crudo / 420 g elaborado','Pechuga de pollo 250 g','Aceite de oliva 25 g']});
 addNutritionMealEditor({id:'meal2',name:'Comida 2',time:'21:00',foods:['Arroz 140 g crudo / 420 g elaborado','Pechuga de pollo 250 g','Aceite de oliva 25 g','Manzana 150 g']});
 const plan={id:'diet',client_id:'client',target_calories:2200,target_protein_g:150,target_carbs_g:250,target_fat_g:66.7,food_rules:{},notes:'Mantenimiento estimado ≈ 2000 kcal.'};
 for(const [id,v] of Object.entries({nutritionCalories:2200,nutritionProtein:150,nutritionCarbs:250,nutritionFat:66.7}))document.getElementById(id).value=v;
 nutritionQuickInit(plan);document.getElementById('nutritionCurrentAdjustment').open=true;
 `});
 assert.match(await page.locator('#nutritionQuickCurrent').innerText(),/2200 kcal.*150 g.*250 g/);
 assert.match(await page.locator('#nutritionQuickReference').textContent(),/superávit de 10.0/);
 // Returning from +10% to maintenance uses the maintenance baseline, not minus 10%.
 await page.locator('#nutritionQuickMode').selectOption('maintenance');assert.equal(await page.locator('#nutritionQuickCalories').inputValue(),'2000');
 assert.equal(await page.locator('#nutritionQuickProtein').inputValue(),'150');assert.equal(await page.locator('#nutritionQuickFat').inputValue(),'66.7');
 assert.ok(Math.abs(Number(await page.locator('#nutritionQuickCarbs').inputValue())-199.9)<.2);
 const before=await page.locator('.nutrition-meal-foods').evaluateAll(els=>els.map(el=>el.value));
 await page.getByRole('button',{name:'Previsualizar nuevas cantidades'}).click();
 assert.deepEqual(await page.locator('.nutrition-meal-foods').evaluateAll(els=>els.map(el=>el.value)),before,'preview must not modify the diet');
 assert.match(await page.locator('#nutritionQuickPreview').innerText(),/misma dieta y mismos alimentos/);
 // Reject a stale preview if a food is edited after preview generation.
 await page.locator('.nutrition-meal-foods').first().fill(before[0]+'\nBrócoli 100 g');
 await page.getByRole('button',{name:'Aplicar cantidades a esta dieta'}).click();assert.match(await page.evaluate(()=>messages.at(-1)),/previsualizar/);
 await page.locator('.nutrition-meal-foods').first().fill(before[0]);
 await page.getByRole('button',{name:'Previsualizar nuevas cantidades'}).click();
 const namesBefore=await page.evaluate(()=>nutritionBuilderCollectMeals().map(m=>m.foods.map(f=>f.food_name)));
 await page.getByRole('button',{name:'Aplicar cantidades a esta dieta'}).click();
 assert.deepEqual(await page.evaluate(()=>nutritionBuilderCollectMeals().map(m=>m.foods.map(f=>f.food_name))),namesBefore);
 assert.deepEqual(await page.locator('.nutrition-meal-editor').evaluateAll(els=>els.map(el=>el.dataset.mealId)),['meal1','meal2']);
 assert.deepEqual(await page.locator('.nutrition-meal-time').evaluateAll(els=>els.map(el=>el.value)),['14:00','21:00']);
 assert.equal(await page.evaluate(()=>nutritionRulesRead(document.querySelector('.nutrition-meal-editor')).exclude_groups[0]),'fruit');
 assert.equal(await page.locator('#nutritionCalories').inputValue(),'2000');
 assert.equal(await page.evaluate(()=>nutritionEnergyRulesForSave().energy_context.adjustment_pct),0);
 // +10% and -10% are both calculated from the same editable maintenance.
 await page.locator('#nutritionQuickMode').selectOption('surplus');assert.equal(await page.locator('#nutritionQuickCalories').inputValue(),'2200');
 await page.locator('#nutritionQuickMode').selectOption('deficit');assert.equal(await page.locator('#nutritionQuickCalories').inputValue(),'1800');
 // Unknown food units remain unchanged; no foods disappear or get substituted.
 const unknown=await page.evaluate(()=>nutritionQuickPortions([{name:'Prueba',foods:[{food_name:'Alimento personalizado',amount:1,unit:'unidad'}]}],{p:150,c:200,f:60,k:2000}));
 assert.equal(unknown.meals[0].foods[0].amount,1);assert.equal(unknown.totals.unknown,1);
 const prepared=await page.evaluate(()=>nutritionBuilderCollectMeals()[0].foods[0]);assert.ok(Math.abs(prepared.prepared_amount/prepared.amount-3)<.05);
 // Saved context takes priority; a missing reference falls back to an explicitly labelled estimate.
 await page.evaluate(()=>nutritionQuickInit({...plan,notes:'',food_rules:{energy_context:{maintenance_kcal:2100,reference_source:'Referencia guardada'}}}));assert.equal(await page.locator('#nutritionQuickMaintenance').inputValue(),'2100');
 await page.evaluate(async()=>{nutritionQuickInit({...plan,notes:''});await nutritionQuickLoadReference()});assert.match(await page.locator('#nutritionQuickReference').textContent(),/estimado en la evaluación/);
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.getElementById('nutritionCurrentAdjustment').open=true;document.getElementById('nutritionCurrentAdjustment').scrollIntoView()});await page.screenshot({path:'/tmp/nutrition-current-adjustment-mobile.png'});
 await page.evaluate(()=>nutritionQuickReset());assert.equal(await page.locator('#nutritionCurrentAdjustment').isVisible(),false,'no quick adjustment on new plans');
 assert.deepEqual(errors,[]);console.log('PASS: current saved plan, surplus/maintenance/deficit, fixed protein, same foods/meal IDs/times/rules, prepared weights, preview/stale guard, persisted energy reference, unknown foods and responsive controls');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
