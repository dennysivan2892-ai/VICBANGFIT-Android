const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'(');return html.slice(a,html.indexOf('\n}',a)+2)}
const a=html.indexOf('const nutritionSubstitutionCatalog='),catalog=html.slice(a,html.indexOf('\n];',a)+3);
const context=vm.createContext({console,structuredClone});
vm.runInContext(`${catalog}
${['nutritionSafetyNorm','nutritionSwapNormalize','nutritionSwapFindFood','nutritionSwapMacros','nutritionAdjustmentTotals','nutritionEditorMealFingerprint','nutritionEditorFitMeal','nutritionMainMealFlags','nutritionMealMacroTargets','nutritionEqualPortions','nutritionQuickPortions','nutritionEditorNewMeal','nutritionEditorSplitMeal','nutritionEditorBalanceProtein','nutritionEditorRedistribute'].map(fn).join('\n')}
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
for(const key of ['p','f'])assert.ok(run(`four.every(m=>Math.abs(nutritionAdjustmentTotals([m]).${key}-before.${key}/4)<.5)`),'uniform macro '+key);
assert.deepEqual(json('four[2].food_rules'),source[2].food_rules);
for(const m of json('four'))for(const f of m.foods){const old=source.find(s=>s.id===m.id).foods.find(o=>o.food_name===f.food_name);if(old.prepared_amount)assert.ok(Math.abs(f.prepared_amount/f.amount-old.prepared_amount/old.amount)<.005);}
// g/kg totals are divided by meal count, even from a heavily skewed starting diet.
run('const fiveEqual=nutritionQuickPortions(source,{p:300,c:250,f:75,k:2875})');
for(const key of ['p','f'])assert.ok(run(`fiveEqual.meals.every(m=>Math.abs(nutritionAdjustmentTotals([m]).${key}-({p:60,c:50,f:15})[${JSON.stringify(key)}])<.5)`),'five equal '+key);
run('const fourEqual=nutritionQuickPortions(four,{p:300,c:250,f:75,k:2875})');
for(const key of ['p','f'])assert.ok(run(`fourEqual.meals.every(m=>Math.abs(nutritionAdjustmentTotals([m]).${key}-({p:75,c:62.5,f:18.75})[${JSON.stringify(key)}])<.5)`),'four equal '+key);
assert.equal(run('JSON.stringify(source)===original'),true,'equal preview is nonmutating');
// Same rice in lunch/snack: vegetable carbs must not invert the rice portions.
run("const shared=JSON.parse(JSON.stringify(source));shared[3].foods=[{food_name:'Arroz en crudo',amount:55,unit:'g',prepared_amount:165,prepared_unit:'g'},{food_name:'Atún al natural',amount:190,unit:'g'},{food_name:'Aceite de oliva virgen extra',amount:11,unit:'g'}];const moderate=nutritionQuickPortions(shared,{p:270,c:200,f:80,k:2600})");
assert.ok(run('moderate.meals[2].foods.find(f=>f.food_name.includes("Arroz")).amount>moderate.meals[3].foods[0].amount'),'main rice portion exceeds snack');
assert.ok(run('(moderate.meals[2].foods.find(f=>f.food_name.includes("Arroz")).amount-moderate.meals[3].foods[0].amount)*3<100'),'cooked rice difference stays moderate');
assert.ok(run('moderate.meals.every(m=>Math.abs(nutritionAdjustmentTotals([m]).p-54)<.5)'),'same protein in every meal');
assert.ok(run('nutritionAdjustmentTotals([moderate.meals[2]]).c>nutritionAdjustmentTotals([moderate.meals[3]]).c'),'higher main meal carbs');
assert.ok(run('Math.abs(moderate.totals.c-200)<1'),'carb total conserved');
// A saved four-meal plan can gain a distinct fifth meal, without cloning a donor.
run('const five=nutritionEditorRedistribute(four,5);const increased=nutritionAdjustmentTotals(five)');
assert.equal(run('new Set(five.map(nutritionEditorMealFingerprint)).size'),5);
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(increased.${key}-after.${key})<=Math.max(${key==='k'?10:1},after.${key}*.01)`),key+' increase total');
assert.equal(run('five.filter(m=>m.id).length'),4);
assert.throws(()=>run('nutritionEditorRedistribute([{foods:[{food_name:"Desconocido",amount:1,unit:"unidad"}]}],2)'),/gramos/);
assert.throws(()=>run('nutritionEditorRedistribute(source,0)'),/1 y 8/);
// A saved diet can have meals without all three macro sources. The selector
// must still add a meal and preserve daily totals.
run("const sparse=structuredClone(source.slice(0,4));sparse[0].foods=[source[0].foods[1]];sparse[1].foods=[source[1].foods[0]];sparse[2].foods=[source[2].foods[2]];sparse[3].foods=[source[2].foods[0],source[2].foods[1]];const sparseBefore=nutritionAdjustmentTotals(sparse);const sparseFive=nutritionEditorRedistribute(sparse,5);const sparseAfter=nutritionAdjustmentTotals(sparseFive)");
assert.equal(run('sparseFive.length'),5);
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(sparseBefore.${key}-sparseAfter.${key})<=Math.max(${key==='k'?10:1},sparseBefore.${key}*.01)`),'sparse diet total '+key);
// Laura-style plan: add a lighter mid-morning meal between breakfast and lunch.
// Keep the four existing menus and move a portion of lunch's cooked rice and protein.
run("const laura=structuredClone([source[0],source[2],source[3],source[4]]);const lauraBefore=nutritionAdjustmentTotals(laura);const lauraFive=nutritionEditorRedistribute(laura,5);const lauraAfter=nutritionAdjustmentTotals(lauraFive)");
assert.deepEqual(json('lauraFive.map(m=>m.name)'),['Desayuno','Media mañana','Comida','Merienda','Cena']);
assert.deepEqual(json('lauraFive.filter(m=>m.id).map(m=>m.id)'),json('laura.map(m=>m.id)'));
assert.deepEqual(json('lauraFive[0].foods.map(f=>f.food_name)'),json('laura[0].foods.map(f=>f.food_name)'),'breakfast retains its foods');
assert.ok(run('lauraFive.every(m=>Math.abs(nutritionAdjustmentTotals([m]).p-lauraBefore.p/5)<.1)'),'five meals have equal actual protein');
assert.ok(run('lauraFive[2].foods.every(f=>laura[1].foods.some(old=>old.food_name===f.food_name))'),'lunch retains its foods');
assert.equal(run('lauraFive[2].foods.find(f=>f.food_name==="Arroz en crudo").prepared_amount'),225,'300 g cooked rice becomes 225 g');
assert.ok(run('lauraFive[1].foods.some(f=>f.food_name==="Arroz en crudo")'),'new meal gets some rice');
assert.ok(run('lauraFive[1].foods.some(f=>f.food_name==="Pechuga de pollo")'),'new meal gets some protein');
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(lauraBefore.${key}-lauraAfter.${key})<=Math.max(${key==='k'?10:1},lauraBefore.${key}*.01)`),'Laura daily total '+key);
// Run the actual selector handler with editor serialization and manual edits.
vm.runInContext(`let nutritionMealRedistributionState=null,nutritionEditingPlanId='diet',nutritionSaving=false,nutritionQuickState={plan:{}},current=structuredClone(source),messages=[];
const nutritionEditorMealSignature=meals=>JSON.stringify(meals),nutritionBuilderCollectMeals=()=>structuredClone(current);
const document={getElementById(){return {set innerHTML(v){current=[]},value:''}},querySelectorAll(){return current}};
const addNutritionMealEditor=m=>current.push(structuredClone(m)),nutritionQuickInvalidate=()=>{},nutritionEditorReview=()=>{},scheduleNutritionBuilderSafety=()=>{},toast=m=>messages.push(m);
${fn('nutritionEditorChangeMealCount')}`,context);
// The real selector handler must accept a saved four-meal diet whose meals
// contain only a subset of macro categories, as in the reported failure.
run("current=structuredClone(sparse);nutritionMealRedistributionState=null;nutritionEditorChangeMealCount('5')");
assert.equal(run('current.length'),5,'selector accepts five meals from a sparse saved plan');
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(nutritionAdjustmentTotals(current).${key}-sparseBefore.${key})<=Math.max(${key==='k'?10:1},sparseBefore.${key}*.01)`),'selector preserves sparse '+key);
run('current=structuredClone(source);nutritionMealRedistributionState=null');
run("nutritionEditorChangeMealCount('4');nutritionEditorChangeMealCount('5')");
assert.deepEqual(json('current.map(m=>({id:m.id,name:m.name,foods:m.foods.map(f=>f.food_name)}))'),source.map(m=>({id:m.id,name:m.name,foods:m.foods.map(f=>f.food_name)})),'5→4→5 restores original separate menus');
for(const key of ['p','f'])assert.ok(run(`current.every(m=>Math.abs(nutritionAdjustmentTotals([m]).${key}-before.${key}/5)<.5)`),'uniform round trip '+key);
run("nutritionEditorChangeMealCount('4');current[0].foods[0].amount+=10;const edited=nutritionAdjustmentTotals(current);nutritionEditorChangeMealCount('5')");
for(const key of ['p','c','f','k'])assert.ok(run(`Math.abs(nutritionAdjustmentTotals(current).${key}-edited.${key})<=Math.max(${key==='k'?10:1},edited.${key}*.01)`),'manual edits retained '+key);
console.log('PASS: 5→4→5, fresh 4→5, no concatenation/cloned meals, macros, IDs/rules, raw/cooked ratios, manual edits and atomic errors');
