const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
// Compile every inline classic script, which Vite intentionally leaves untouched.
for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["']module/.test(match[1]))new vm.Script(match[2]);
const code=slice('// Proposal preparation is read-only:', 'function addNutritionMealEditor(');
const ctx=vm.createContext({console});
vm.runInContext(`
const elements=new Map();
const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,style:{display:'grid'},classList:{contains:()=>true}});return elements.get(id)},querySelectorAll(){return [document.getElementById('saveNutritionBtn'),document.getElementById('nutritionClient')]}};
let currentProfile={id:'trainer',role:'trainer'},clients=[{id:'new',services:{nutrition:true}}],editingRoutineId=null,nutritionEditingPlanId=null,nutritionMealEditorSeq=0;
let row={client_id:'new',target_calories:2200,target_protein_g:180,target_carbs_g:230,target_fat_g:62,primary_goal:'Hipertrofia'},queryError=null,reads=[],generated=[],messages=[],routineCalls=0;
const sb={from(table){reads.push(table);return {select(){return this},eq(){return this},async maybeSingle(){return {data:row,error:queryError}}}}};
const toast=m=>messages.push(m),confirm=()=>true,vicError=(e,m)=>e.message||m;
const initialAssessmentCalculate=()=>null,nutritionProfileExtract=()=>({profile:{}}),scheduleNutritionBuilderSafety=()=>{};
const generateNutritionMealsFromTargets=async()=>{generated.push(['nutritionCalories','nutritionProtein','nutritionCarbs','nutritionFat'].map(id=>document.getElementById(id).value));document.getElementById('nutritionMealEditors').innerHTML='generated meals'};
const openNutritionBuilder=()=>true;
let smartTrainingPlan=null;
const loadSmartTrainingPlan=async id=>{smartTrainingPlan=row?{clientId:id}:null};
const smartPlanToRoutineBuilder=async()=>{routineCalls++};const setAuthMessage=(id,m)=>document.getElementById(id).textContent=m;
document.getElementById('nutritionClient').value='new';document.getElementById('routineClient').value='new';
${code}`,ctx);
const run=s=>vm.runInContext(s,ctx);
(async()=>{
 await run('prepareNutritionProposal(false)');
 assert.deepEqual(JSON.parse(run('JSON.stringify(generated)')),[[2200,180,230,62]]);
 assert.match(run("document.getElementById('nutritionBuilderMsg').textContent"),/privada lista/);
 assert.deepEqual(JSON.parse(run('JSON.stringify(reads)')),['client_onboarding_assessments']);
 assert.equal(run("document.getElementById('saveNutritionBtn').disabled"),false);
 // A legitimate zero carbohydrate target survives proposal preparation.
 await run('row.target_carbs_g=0;prepareNutritionProposal(false)');assert.equal(run('generated.at(-1)[2]'),0);
 await run('prepareRoutineProposal(false)');assert.equal(run('routineCalls'),1);
 // Missing assessment and network errors must be visible and unlock the editor.
 await run('row=null;prepareNutritionProposal(false)');assert.match(run("document.getElementById('nutritionBuilderMsg').textContent"),/evaluación inicial/);
 await run('queryError={message:"Sin conexión"};prepareNutritionProposal(false)');assert.equal(run("document.getElementById('nutritionBuilderMsg').textContent"),'Sin conexión');assert.equal(run('trainerProposalBusy'),false);
 await run('queryError=null;prepareRoutineProposal(false)');assert.match(run("document.getElementById('routineMsg').textContent"),/evaluación inicial/);assert.equal(run('routineCalls'),1);
 // An unassigned client cannot cause a read or create another client's proposal.
 const before=run('reads.length');await run("document.getElementById('nutritionClient').value='other';prepareNutritionProposal(false)");assert.equal(run('reads.length'),before);
 // Never overwrite an existing plan through the initial-proposal action.
 await run("document.getElementById('nutritionClient').value='new';nutritionEditingPlanId='existing';prepareNutritionProposal(false)");assert.equal(run('reads.length'),before);
 console.log('Trainer proposal tests passed: routine, macros/meals, privacy, missing data, network errors and client isolation.');
})().catch(e=>{console.error(e);process.exitCode=1});
