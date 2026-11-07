const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'(');return html.slice(a,html.indexOf('\n}',a)+2)}
const a=html.indexOf('const nutritionSubstitutionCatalog='),catalog=html.slice(a,html.indexOf('\n];',a)+3);
const context=vm.createContext({console,structuredClone});
vm.runInContext(`${catalog}
${['nutritionSafetyNorm','nutritionSwapNormalize','nutritionSwapFindFood','nutritionSwapMacros','nutritionAdjustmentTotals','nutritionEditorMealFingerprint','nutritionEditorFitMeal','nutritionEditorNewMeal','nutritionEditorRedistribute'].map(fn).join('\n')}
const nutritionRuleReason=()=>'',nutritionGlobalRules=()=>({});`,context);
const run=s=>vm.runInContext(s,context),json=s=>JSON.parse(run('JSON.stringify('+s+')'));
const food=(food_name,amount,prepared_amount=null)=>({food_name,amount,unit:'g',prepared_amount,prepared_unit:prepared_amount==null?null:'g'});
const source=[
 {id:'breakfast',name:'Desayuno',time:'08:00',foods:[food('Avena',70),food('Claras de huevo',220),food('Almendras',15)]},
 {id:'morning',name:'Media mañana',time:'11:00',foods:[food('Pan integral',80),food('Pechuga de pavo',100),food('Aguacate',50)]},
 {id:'lunch',name:'Comida',time:'14:00',food_rules:{enabled:true,exclude_groups:['fruit']},foods:[food('Arroz en crudo',100,300),food('Pechuga de pollo',180,135),food('Aceite de oliva virgen extra',15),food('Brócoli',200)]},
 {id:'snack',name:'Merienda',time:'18:00',foods:[food('Pan de molde integral',80),food('Atún al natural',140),food('Aceite de oliva virgen extra',10)]},
 {id:'dinner',name:'Cena',time:'21:00',foods:[food('Patata',263,224),food('Pescado blanco',163,130),food('Aceite de oliva virgen extra',15),food('Ensalada variada',220)]}
].map((m,i)=>({...m,order:i+1,notes:'Nota del entrenador',food_rules:m.food_rules||{}}));
context.source=source;
run('const original=JSON.stringify(source);const before=nutritionAdjustmentTotals(source);const four=nutritionEditorRedistribute(source,4);const after=nutritionAdjustmentTotals(four)');
assert.equal(run('JSON.stringify(source)===original'),true,'source must remain unchanged');
assert.deepEqual(json('four.map(m=>m.id)'),['breakfast','morning','lunch','dinner']);
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(before.${key}-after.${key})<=Math.max(${key==='k'?10:1},before.${key}*.01)`),key+' daily total');
assert.ok(run('four.every(m=>m.foods.every(f=>source.find(s=>s.id===m.id).foods.some(o=>o.food_name===f.food_name)))'),'no concatenated foods');
assert.ok(run('four.every(m=>nutritionAdjustmentTotals([m]).k>nutritionAdjustmentTotals([source.find(s=>s.id===m.id)]).k)'),'calories spread among all remaining meals');
assert.deepEqual(json('four[2].food_rules'),source[2].food_rules);
for(const m of json('four'))for(const f of m.foods){const old=source.find(s=>s.id===m.id).foods.find(o=>o.food_name===f.food_name);if(old.prepared_amount)assert.ok(Math.abs(f.prepared_amount/f.amount-old.prepared_amount/old.amount)<.005);}
// A saved four-meal plan can gain a distinct fifth meal, without cloning a donor.
run('const five=nutritionEditorRedistribute(four,5);const increased=nutritionAdjustmentTotals(five)');
assert.equal(run('new Set(five.map(nutritionEditorMealFingerprint)).size'),5);
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(increased.${key}-after.${key})<=Math.max(${key==='k'?10:1},after.${key}*.01)`),key+' increase total');
assert.equal(run('five.filter(m=>m.id).length'),4);
assert.throws(()=>run('nutritionEditorRedistribute([{foods:[{food_name:"Desconocido",amount:1,unit:"unidad"}]}],2)'),/gramos/);
assert.throws(()=>run('nutritionEditorRedistribute(source,0)'),/1 y 8/);
// Run the actual selector handler with editor serialization and manual edits.
vm.runInContext(`let nutritionMealRedistributionState=null,nutritionEditingPlanId='diet',nutritionSaving=false,current=structuredClone(source),messages=[];
const nutritionEditorMealSignature=meals=>JSON.stringify(meals),nutritionBuilderCollectMeals=()=>structuredClone(current);
const document={getElementById(){return {set innerHTML(v){current=[]},value:''}},querySelectorAll(){return current}};
const addNutritionMealEditor=m=>current.push(structuredClone(m)),nutritionQuickInvalidate=()=>{},nutritionEditorReview=()=>{},scheduleNutritionBuilderSafety=()=>{},toast=m=>messages.push(m);
${fn('nutritionEditorChangeMealCount')}`,context);
run("nutritionEditorChangeMealCount('4');nutritionEditorChangeMealCount('5')");
assert.deepEqual(json('current'),source,'5→4→5 restores exact original menus and quantities');
run("nutritionEditorChangeMealCount('4');current[0].foods[0].amount+=10;const edited=nutritionAdjustmentTotals(current);nutritionEditorChangeMealCount('5')");
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(nutritionAdjustmentTotals(current).${key}-edited.${key})<=Math.max(${key==='k'?10:1},edited.${key}*.01)`),'manual edits retained '+key);
console.log('PASS: 5→4→5, fresh 4→5, no concatenation/cloned meals, macros, IDs/rules, raw/cooked ratios, manual edits and atomic errors');
