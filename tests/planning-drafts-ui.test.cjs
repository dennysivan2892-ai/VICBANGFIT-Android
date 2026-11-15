const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const {Window}=await import('happy-dom');const window=new Window({url:'https://vicbangfit.test',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 const html=fs.readFileSync('web/index.html','utf8'),scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('module')&&m[2].trim());
 window.document.write(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));window.scrollTo=()=>{};window.confirm=()=>true;
 const ctx=vm.createContext(window),run=s=>vm.runInContext(s,ctx);const el=id=>window.document.getElementById(id),one=s=>window.document.querySelector(s);
 run(`window.requests=[];window.rows=[];window.live={};window.fail=false;window.supabase={createClient(){return {
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){},startAutoRefresh(){},stopAutoRefresh(){}},
 functions:{invoke:async()=>({data:{}})},rpc:async(name,args)=>{requests.push({rpc:name,args});if(name==='activate_private_plan'){const table=args.p_kind==='nutrition'?'nutrition_plans':'supplement_plans';for(const row of live[table]||[])row.status=row.id===args.p_plan_id?'active':'archived';}return {error:null};},channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},
 from(table){const q={table,action:'select',filters:[]};return {
 select(){return this},insert(payload){q.action='insert';q.payload=payload;return this},update(payload){q.action='update';q.payload=payload;return this},delete(){q.action='delete';return this},eq(k,v){q.filters.push([k,v]);return this},order(){return this},limit(){return this},in(){return this},is(){return this},
 maybeSingle(){return this.execute(true)},single(){return this.execute(true)},then(resolve,reject){return this.execute(false).then(resolve,reject)},
 async execute(single){window.requests.push(q);if(window.fail&&q.action!=='select')return {error:{message:'Sin conexión'}};const storage=table==='planning_drafts'?window.rows:(window.live[table]||=[]);let matches=storage.filter(r=>q.filters.every(([k,v])=>r[k]===v));
 if(q.action==='insert'){matches=[{id:crypto.randomUUID(),...q.payload}];storage.push(...matches)}
 if(q.action==='update')matches.forEach(r=>Object.assign(r,q.payload));
 if(q.action==='delete')window.rows=window.rows.filter(r=>!matches.includes(r));
 return {data:JSON.parse(JSON.stringify(single?(matches[0]||null):matches)),error:null};}
 }}
 }}};`);
 for(const s of scripts)run(s[2]);
 run(`currentProfile={id:'trainer',role:'trainer'};clients=[{id:'laura',name:'Laura',full_name:'Laura',services:{nutrition:true}}];trainerContentClientId='laura';
 nutritionLoadSafetyProfile=async()=>nutritionProfileBlank();loadRoutineExerciseLibrary=async()=>{};routineSyncVolumeProfileForClient=async()=>{};
 routineExerciseLibrary=[{id:'squat',name:'Sentadilla',muscle_group:'Cuádriceps',image_url:'https://vicbangfit.test/squat.jpg'},{id:'press',name:'Press inclinado con mancuernas',muscle_group:'Pecho',image_url:'https://vicbangfit.test/incline.jpg'}];`);
 // Unfinished raw food lines and empty meals persist, without live-plan writes.
 run(`openNutritionBuilder('laura');document.getElementById('nutritionPlanName').value='Laura · en preparación';document.querySelector('.nutrition-meal-foods').value='Arroz pendiente de cantidad';document.querySelector('#nutritionGlobalRules .nutrition-rules-enabled').checked=true;document.querySelector('#nutritionGlobalRules [data-nutrition-group="fruit"]').checked=true;`);
 await run('saveNutritionPlan()');assert.equal(window.rows.length,1);assert.equal(window.requests.some(q=>q.action!=='select'&&q.table!=='planning_drafts'),false);
 const dietId=window.rows[0].id;
 await run(`closeNutritionBuilder();openPlanningDraft('nutrition','${dietId}')`);
 assert.equal(one('.nutrition-meal-foods').value,'Arroz pendiente de cantidad');assert.equal(el('nutritionPlanName').value,'Laura · en preparación');assert.equal(window.document.querySelectorAll('#nutritionMealEditors .nutrition-meal-editor').length,3);assert.equal(one('#nutritionGlobalRules [data-nutrition-group="fruit"]').checked,true);
 await run('saveNutritionPlan()');window.fail=true;await run('saveNutritionPlan()');window.fail=false;
 assert.equal(window.rows.length,1);assert.match(el('nutritionBuilderMsg').textContent,/Sin conexión/);
 window.rows[0].version++;await run('saveNutritionPlan()');assert.match(el('nutritionBuilderMsg').textContent,/otro dispositivo/);run('closeNutritionBuilder()');
 // Half-written supplement rows and notes survive even without a name or dose.
 await run('openSupplementBuilder()');el('suppClient').value='laura';one('.supp-trainer-notes').value='Revisar mañana';await run('saveSupplementPlan()');
 const suppId=window.rows.find(r=>r.kind==='supplements').id;
 await run(`closeSupplementBuilder();openPlanningDraft('supplements','${suppId}')`);assert.equal(one('.supp-trainer-notes').value,'Revisar mañana');assert.equal(one('.supp-name').value,'');run('closeSupplementBuilder()');
 // Unnamed routines preserve set counts, technical notes and cardio.
 await run('openRoutineBuilder(true)');el('routineClient').value='laura';el('routineName').value='';one('.re-sets').value='4';one('.re-notes').value='Revisar técnica';run("setRoutineCardioEnabled(document.querySelector('.routine-day-editor'),true)");one('.routine-cardio-minutes').value='23';await run('saveRoutine()');
 one('.re-exercise').value='press';one('.re-exercise').dispatchEvent(new window.Event('change',{bubbles:true}));await run('saveRoutine()');
 const trainingId=window.rows.find(r=>r.kind==='training').id;
 await run(`closeRoutineBuilder();openPlanningDraft('training','${trainingId}')`);assert.equal(one('.re-sets').value,'4');assert.equal(one('.re-notes').value,'Revisar técnica');assert.equal(one('.routine-cardio-minutes').value,'23');
 assert.equal(one('.re-exercise').value,'press');assert.equal(one('.re-thumb img').getAttribute('src'),'https://vicbangfit.test/incline.jpg');assert.equal(one('.re-thumb img').getAttribute('alt'),'Press inclinado con mancuernas');
 assert.equal(window.requests.some(q=>q.action!=='select'&&q.table!=='planning_drafts'),false);
 // Activation validates completeness, leaving an incomplete draft private.
 await run(`openPlanningDraft('nutrition','${dietId}')`);await run("publishPlanningDraft('nutrition')");
 assert.equal(window.requests.some(q=>q.action!=='select'&&q.table!=='planning_drafts'),false);assert.equal(window.rows.some(r=>r.id===dietId),true);
 // Complete plans activate through the real saver and only then retire the private draft.
 run('closeRoutineBuilder();closeNutritionBuilder();loadTrainerNutrition=async()=>{};loadTrainerSupplements=async()=>{};openNutritionBuilder("laura")');
 el('nutritionPlanName').value='Dieta completa';for(const meal of window.document.querySelectorAll('.nutrition-meal-foods'))meal.value='Arroz 80 g';
 await run('publishPlanningDraft("nutrition")');
 assert.equal(window.live.nutrition_plans[0].status,'active');assert.equal(window.live.nutrition_meals.length,3);assert.equal(window.live.nutrition_foods.length,3);
 assert.equal(window.rows.some(r=>r.name==='Dieta completa'),false);assert.equal(el('nutritionBuilderModal').style.display,'none');
 run('vicDataMutationDepth=0');await run(`openPlanningDraft('supplements','${suppId}')`);one('.supp-name').value='Creatina';one('.supp-dose').value='5 g';await run('publishPlanningDraft("supplements")');
 assert.equal(window.live.supplement_plans[0].status,'active');assert.equal(window.live.supplement_items[0].supplement_name,'Creatina');assert.equal(window.rows.some(r=>r.id===suppId),false);
 run('vicDataMutationDepth=0');
 const before=window.requests.length;await run("currentProfile.role='client';savePlanningDraft('training')");await run("loadPlanningDrafts('nutrition')");assert.equal(window.requests.length,before);
 await window.happyDOM.abort();window.close();console.log('PASS DOM: incomplete private drafts in all editors, raw values/rules/cardio restored, optimistic conflict, offline recovery, activation validation and role guard');
})().catch(e=>{console.error(e);process.exitCode=1});
