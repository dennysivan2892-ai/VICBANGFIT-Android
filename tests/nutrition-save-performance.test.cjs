const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const code=section('function nutritionMealSaveShape(', 'async function loadTrainerNutrition(');
const pool=section('async function routineWritePool(', "document.getElementById('routineBuilderModal').addEventListener");
const ctx=vm.createContext({console,setTimeout,clearTimeout});
vm.runInContext(`
let currentProfile={id:'trainer',role:'trainer'},trainerProposalBusy=false,nutritionSaving=false,nutritionBuilderSafetyTimer=null,nutritionEditingPlanId='diet',nutritionEditingBaseline;
let nutritionBuilderSafetyLast={blocked:false},requests=[],validations=0,closed=0,notifications=0,fail=false,mutation=false;
const original=Array.from({length:5},(_,i)=>({id:'m'+i,meal_order:i+1,name:'Comida '+i,target_time:'08:00:00',notes:null,food_rules:{enabled:false},foods:[{food_name:'Arroz',amount:80,unit:'g'},{food_name:'Manzana',amount:150,unit:'g'}]}));
nutritionEditingBaseline={planId:'diet',meals:original};
const edited=JSON.parse(JSON.stringify(original));edited[0].foods.pop();
const fields=new Map();const get=id=>{if(!fields.has(id))fields.set(id,{value:'',disabled:false,textContent:'',classList:{add(){},remove(){}}});return fields.get(id)};
for(const [id,value] of Object.entries({nutritionClient:'client',nutritionPlanName:'Plan',nutritionCalories:2000,nutritionProtein:150,nutritionCarbs:200,nutritionFat:70}))get(id).value=value;
const editors=edited.map(m=>({dataset:{mealId:m.id},querySelector(sel){return {value:sel.includes('name')?m.name:sel.includes('time')?'08:00':sel.includes('notes')?'':m.foods.map(JSON.stringify).join('\\n')}},meal:m}));
const document={getElementById:get,querySelectorAll(sel){return sel==='#nutritionMealEditors .nutrition-meal-editor'?editors:[get('saveNutritionBtn'),get('nutritionClient')]}};
const nutritionMealTime=x=>String(x||'').slice(0,5),nutritionRulesClean=r=>({enabled:!!r?.enabled}),nutritionGlobalRules=()=>({enabled:false}),nutritionRulesRead=el=>el.meal.food_rules;
const nutritionParseFoodLine=JSON.parse,nutritionFoodEditorLine=JSON.stringify,nutritionEnergyRulesForSave=nutritionGlobalRules;
const validateNutritionBuilderSafety=async()=>{validations++;await Promise.resolve();return {blocked:false}};
const vicDataMutationActive=()=>mutation,vicBeginDataMutation=()=>mutation=true,vicEndDataMutation=()=>mutation=false;
const closeNutritionBuilder=()=>{closed++;nutritionEditingPlanId=null},toast=()=>{},vicError=(e,m)=>e.message||m;
const loadTrainerNutrition=()=>new Promise(()=>{});
const sb={functions:{invoke(){notifications++;return new Promise(()=>{})}},from(table){let q={table,action:'select',filters:[]};return {select(){return this},update(payload){q.action='update';q.payload=payload;return this},delete(){q.action='delete';return this},insert(payload){q.action='insert';q.payload=payload;return this},eq(k,v){q.filters.push([k,v]);return this},neq(){return this},in(){return this},order(){return this},limit(){return this},then(resolve){requests.push(q);resolve({data:q.table==='nutrition_meals'&&q.action==='select'?original:[],error:fail&&q.action==='insert'?{message:'No se pudo guardar'}:null})}}}};
${pool}\n${code}
`,ctx);
const run=s=>vm.runInContext(s,ctx);
(async()=>{
 // Pending notification and list refresh must not keep the editor locked.
 await Promise.race([run('Promise.all([saveNutritionPlan(),saveNutritionPlan()])'),new Promise((_,rej)=>setTimeout(()=>rej(Error('Save waited for notification or refresh')),500))]);
 assert.equal(run('validations'),1,'one validation and one save for double clicks');
 assert.equal(run('closed'),1);assert.equal(run('nutritionSaving'),false);assert.equal(run('notifications'),1);
 assert.equal(run('requests.length'),5,'one read, two plan writes, two food writes; not all five meals');
 assert.equal(run("requests.filter(r=>r.table==='nutrition_meals'&&r.action!=='select').length"),0,'unchanged meal metadata is not rewritten');
 assert.equal(run("requests.find(r=>r.table==='nutrition_foods'&&r.action==='delete').filters[0][1]"),'m0');
 assert.equal(run("requests.find(r=>r.table==='nutrition_foods'&&r.action==='insert').payload[0].meal_id"),'m0');
 // Metadata-only change does not delete/reinsert foods.
 await run("nutritionEditingPlanId='diet';edited[0].foods=JSON.parse(JSON.stringify(original[0].foods));edited[1].name='Comida modificada';requests=[];saveNutritionPlan()");
 assert.equal(run("requests.filter(r=>r.table==='nutrition_foods').length"),0);
 assert.equal(run("requests.filter(r=>r.table==='nutrition_meals'&&r.action==='update').length"),1);
 // Failed persistence leaves the editor open and usable, with no success notification.
 const closed=run('closed'),notify=run('notifications');
 await run("nutritionEditingPlanId='diet';edited[0].foods.pop();fail=true;saveNutritionPlan()");
 assert.equal(run('closed'),closed);assert.equal(run('notifications'),notify);assert.equal(run('nutritionSaving'),false);assert.equal(run("get('saveNutritionBtn').disabled"),false);
 console.log('PASS: five requests instead of rewriting five meals; no waiting on notifications/list; single validation/double-click guard; same meal IDs; metadata-only updates; failed-save recovery');
})().catch(e=>{console.error(e);process.exitCode=1});
