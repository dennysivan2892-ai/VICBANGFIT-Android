const {readFileSync,mkdirSync}=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=readFileSync('web/index.html','utf8');
function fn(name){const start=html.indexOf('function '+name+'(');const end=html.indexOf('\n}',start)+2;return html.slice(start,end);}
const helpers=html.split('// BEGIN NUTRITION ADJUSTMENTS\n')[1].split('// END NUTRITION ADJUSTMENTS')[0];
const catalog=html.slice(html.indexOf('const nutritionSubstitutionCatalog='),html.indexOf('\n];',html.indexOf('const nutritionSubstitutionCatalog='))+3);
(async()=>{
 const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style><div id="nutritionGlobalRules"></div><div id="nutritionMealEditors"></div><input id="nutritionClient" value="client"><input id="nutritionCalories" value="2000"><input id="nutritionProtein" value="180"><input id="nutritionCarbs" value="220"><input id="nutritionFat" value="70"><input id="nutritionReductionPercent" value="15"><div id="nutritionAdjustmentResult"></div>');
 await page.addScriptTag({content:`let nutritionMealEditorSeq=0;const toast=()=>{};const scheduleNutritionBuilderSafety=()=>{};const nutritionLoadSafetyProfile=async()=>({});const nutritionFoodAllowed=()=>true;const nutritionFoodBlockedReason=()=>'';${catalog}\n${['nutritionEsc','nutritionSafetyNorm','nutritionSwapNormalize','nutritionSwapFindFood','nutritionSwapMacros','nutritionSwapBestAmount','nutritionSwapOptions','nutritionAutoLimits','nutritionAutoRound5','nutritionWeightDisplayName','nutritionFoodEditorLine','nutritionParseFoodLine','nutritionMealTime'].map(fn).join('\n')}\n${helpers}\n${['nutritionBuilderCollectMeals','nutritionBuilderSafetyConflicts','addNutritionMealEditor'].map(fn).join('\n')}`});
 await page.evaluate(()=>{nutritionSetGlobalRules();addNutritionMealEditor({id:'meal2',name:'Comida 2',foods:['Arroz 80 g crudo / 300 g elaborado','Pechuga de pollo 180 g','Manzana 150 g']});addNutritionMealEditor({id:'meal3',name:'Comida 3',foods:['Arroz 80 g','Pechuga de pollo 180 g','Manzana 150 g'],food_rules:{enabled:true,side_mode:'vegetables'}});});
 assert.equal(await page.evaluate(()=>nutritionRuleReason('Manzana',nutritionGlobalRules())), '');
 await page.locator('#nutritionGlobalRules summary').click();await page.locator('#nutritionGlobalRules .nutrition-rules-enabled').check();await page.locator('#nutritionGlobalRules [data-nutrition-group="fruit"]').check();
 assert.match(await page.evaluate(()=>nutritionRuleReason('Manzana',nutritionGlobalRules())),/Fruta/);
 assert.equal(await page.evaluate(()=>nutritionRuleReason('Manzana',{enabled:true,exclude_groups:['polyols']})), '');
 assert.match(await page.evaluate(()=>nutritionRuleReason('Maltitol',{enabled:true,exclude_groups:['polyols']})),/Polialcoholes/);
 assert.match(await page.evaluate(()=>nutritionRuleReason('Arroz',nutritionRulesMerge({enabled:true,exclude_groups:['rice']},{enabled:false}))),/Arroz/);
 assert.equal(await page.evaluate(()=>nutritionBuilderSafetyConflicts({},nutritionBuilderCollectMeals()).length),0);
 await page.evaluate(()=>nutritionPreviewAdjustments());assert.equal(await page.locator('.nutrition-meal-foods').first().inputValue(),'Arroz 80 g crudo / 300 g elaborado\nPechuga de pollo 180 g\nManzana 150 g');
 await page.evaluate(()=>nutritionApplyAdjustments());
 const first=await page.locator('.nutrition-meal-foods').first().inputValue(),last=await page.locator('.nutrition-meal-foods').last().inputValue();assert.match(first,/Arroz/);assert.doesNotMatch(first,/Manzana/);assert.doesNotMatch(last,/Arroz|Manzana/);assert.match(last,/Verduras/);
 assert.equal(await page.evaluate(()=>document.querySelector('.nutrition-meal-editor').dataset.mealId),'meal2');
 assert.equal(await page.evaluate(()=>nutritionBuilderSafetyConflicts({},nutritionBuilderCollectMeals()).length),0);
 // Stale proposals cannot overwrite later edits.
 await page.evaluate(()=>nutritionPreviewAdjustments());await page.locator('.nutrition-meal-foods').first().fill('Pavo 180 g');await page.evaluate(()=>nutritionApplyAdjustments());assert.equal(await page.locator('.nutrition-meal-foods').first().inputValue(),'Pavo 180 g');
 await page.evaluate(()=>{document.getElementById('nutritionCalories').value=2000;document.getElementById('nutritionProtein').value=180;nutritionReduceTarget();});assert.equal(await page.locator('#nutritionCalories').inputValue(),'1700');assert.equal(await page.locator('#nutritionProtein').inputValue(),'153');
 // Disabling preserves editable settings; reset removes them.
 await page.locator('#nutritionGlobalRules .nutrition-rules-enabled').uncheck();assert.equal(await page.evaluate(()=>nutritionRuleReason('Manzana',nutritionGlobalRules())), '');assert.deepEqual(await page.evaluate(()=>nutritionGlobalRules().exclude_groups),['fruit']);
 await page.locator('#nutritionGlobalRules button').click();assert.deepEqual(await page.evaluate(()=>nutritionGlobalRules().exclude_groups),[]);
 assert.equal(await page.evaluate(()=>nutritionSwapOptions('Arroz',80,{},new Set(),{enabled:true,exclude_groups:['starch']}).length),0);
 assert.equal(await page.evaluate(()=>nutritionSwapOptions('Manzana',150,{},new Set(),{enabled:true,exclude_groups:['fruit']}).length),0);
 assert.ok(await page.evaluate(()=>nutritionSwapOptions('Arroz',80,{},new Set(),{enabled:false,exclude_groups:['starch']}).length)>0);
 // Saving exclusions removes only the selected food and subtracts energy once.
 await page.evaluate(()=>{
  nutritionSetGlobalRules();document.getElementById('nutritionMealEditors').innerHTML='';
  addNutritionMealEditor({id:'paul-meal-1',name:'Comida 1',foods:['Pechuga de pollo 180 g','Manzana 150 g']});
  addNutritionMealEditor({id:'paul-meal-2',name:'Comida 2',foods:['Arroz 80 g','Manzana 150 g']});
  document.getElementById('nutritionCalories').value=2000;
 });
 await page.locator('.nutrition-meal-editor .nutrition-rules summary').first().click();
 await page.locator('.nutrition-meal-editor [data-nutrition-group="fruit"]').first().check();
 assert.equal(await page.locator('.nutrition-meal-editor .nutrition-rules-enabled').first().isChecked(),true);
 const apple=await page.evaluate(()=>nutritionAdjustmentTotals([{foods:[{food_name:'Manzana',amount:150,unit:'g'}]}]));
 await page.evaluate(()=>nutritionRemoveExcludedFoods());
 assert.doesNotMatch(await page.locator('.nutrition-meal-foods').first().inputValue(),/Manzana/);
 assert.match(await page.locator('.nutrition-meal-foods').last().inputValue(),/Manzana/);
 assert.equal(Number(await page.locator('#nutritionCalories').inputValue()),2000-apple.k);
 assert.match(await page.locator('.nutrition-meal-foods').first().inputValue(),/180 g/);
 await page.evaluate(()=>nutritionRemoveExcludedFoods());
 assert.equal(Number(await page.locator('#nutritionCalories').inputValue()),2000-apple.k);
 await page.locator('#nutritionGlobalRules summary').click();
 await page.locator('#nutritionGlobalRules [data-nutrition-group="fruit"]').check();
 await page.evaluate(()=>nutritionRemoveExcludedFoods());
 assert.doesNotMatch(await page.locator('.nutrition-meal-foods').last().inputValue(),/Manzana/);
 assert.equal(Number(await page.locator('#nutritionCalories').inputValue()),2000-2*apple.k);
 assert.deepEqual(errors,[]);mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/nutrition-mobile.png',fullPage:true});
 console.log('PASS: optional rules, global/meal precedence, fruit/polyol separation, preview/apply, preserved meal IDs, stale-preview protection, percentage change, deactivate and reset');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
