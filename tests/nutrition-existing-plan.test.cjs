const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const code=html.slice(html.indexOf('async function loadNutritionPlanDetails('),html.indexOf('async function chooseNutritionPlan('));
const context=vm.createContext({console});
vm.runInContext(`
let currentProfile={role:'trainer',id:'trainer'},trainerProposalBusy=false,trainerContentClientId='client';
let clients=[{id:'client'}],trainerNutritionPlans=[],nutritionEditingPlanId=null,nutritionMealEditorSeq=0;
let queries=[],messages=[],editors=[],globalRules=null,fail=false;
const plan={id:'diet',trainer_id:'trainer',client_id:'client',name:'Dieta existente',target_carbs_g:210,food_rules:{enabled:true,exclude_groups:['rice']}};
const meals=[{id:'breakfast',plan_id:'diet',name:'Desayuno',food_rules:{enabled:true,exclude_groups:['fruit']}}];
const foods=[{id:'food',meal_id:'breakfast',food_name:'Manzana',amount:150,unit:'g'}];
const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',style:{},classList:{remove(){}},textContent:'',innerHTML:''});return elements.get(id)},querySelectorAll(){return editors}};
const sb={from(table){const query={table,filters:[]};queries.push(query);return {select(){return this},eq(k,v){query.filters.push([k,v]);return this},in(){return this},order(){return this},limit(){return this},async maybeSingle(){return {data:query.filters.some(x=>x[0]==='id'&&x[1]==='missing')?null:plan,error:fail?{message:'Sin conexión'}:null}},then(resolve){resolve({data:table==='nutrition_plans'?[plan]:table==='nutrition_meals'?meals:foods,error:fail?{message:'Sin conexión'}:null})}}}};
const toast=m=>messages.push(m),vicError=(e,m)=>e.message||m;
const resetNutritionBuilder=()=>{editors=[];nutritionEditingPlanId=null};
const nutritionSetGlobalRules=r=>globalRules=r,fillNutritionClients=id=>document.getElementById('nutritionClient').value=id;
const addNutritionMealEditor=data=>editors.push({data,dataset:{mealId:data.id},querySelector(selector){return selector==='.nutrition-rules'?{open:false}:{focus(){}}},scrollIntoView(){}});
const initNutritionBuilderSafetyListeners=()=>{},validateNutritionBuilderSafety=async()=>{},setTimeout=f=>f();
${code}`,context);
const run=code=>vm.runInContext(code,context);
(async()=>{
 // The exact saved diet opens even when the list cache is empty.
 assert.equal(await run("editNutritionPlan('diet','breakfast')"),true);
 assert.equal(run('nutritionEditingPlanId'),'diet');assert.equal(run("document.getElementById('nutritionClient').value"),'client');assert.equal(run("document.getElementById('nutritionCarbs').value"),210);
 assert.equal(run("editors[0].data.id"),'breakfast');assert.equal(run('editors[0].data.foods[0].food_name'),'Manzana');
 assert.equal(run('editors[0].data.food_rules.exclude_groups[0]'),'fruit');assert.equal(run('globalRules.exclude_groups[0]'),'rice');
 assert.equal(run("document.getElementById('nutritionBuilderModal').style.display"),'grid');
 assert.equal(run('queries[0].filters.some(([k,v])=>k===\'trainer_id\'&&v===\'trainer\')'),true);
 assert.equal(await run('editCurrentClientNutrition()'),true);
 // Missing plans, network failures and client-role access never create a new diet.
 assert.equal(await run("editNutritionPlan('missing')"),false);assert.match(run('messages.at(-1)'),/No se encontró/);
 await run("fail=true;editNutritionPlan('diet')");assert.equal(run('messages.at(-1)'),'Sin conexión');
 const count=run('queries.length');await run("currentProfile.role='client';editNutritionPlan('diet')");assert.equal(run('queries.length'),count);
 console.log('PASS: edit uncached existing diet, exact plan/meal IDs, retained foods/macros/rules, trainer ownership, errors and client access');
})().catch(error=>{console.error(error);process.exitCode=1});
