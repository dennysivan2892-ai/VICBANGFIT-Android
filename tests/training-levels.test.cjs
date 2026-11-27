const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const start=html.indexOf('const SMART_BIG_MUSCLES=');
const end=html.indexOf('function smartSetDistribution',start);
assert.ok(end>start);
const ctx=vm.createContext({smartClamp:(n,min,max)=>Math.max(min,Math.min(max,n))});
vm.runInContext(html.slice(start,end),ctx);
vm.runInContext(html.slice(html.indexOf('function smartExerciseSlots('),html.indexOf('function smartPlannedExerciseCount(')),ctx);
for(const level of ['beginner','intermediate','advanced']){
 for(const profile of ['male','female_lower','female_balanced']){
  for(const muscle of ['Pecho','Espalda','Cuádriceps','Femoral','Glúteos','Bíceps','Tríceps','Hombros','Gemelos','Abdominales']){
   const big=['Pecho','Espalda','Cuádriceps','Femoral','Glúteos'].includes(muscle);
   const slots=level==='beginner'?(big?2:1):level==='intermediate'?(big?3:2):(big?4:2);
   for(const frequency of [1,2,3]){
    Object.assign(ctx,{muscle,profile,level,frequency,days:Array.from({length:frequency},(_,i)=>({day:i+1,muscles:[muscle]}))});
    assert.equal(vm.runInContext('smartWeeklySeries(muscle,[],profile,level,frequency)',ctx),slots*3*frequency);
    assert.equal(vm.runInContext('days.reduce((sum,day)=>sum+smartSessionSeries(muscle,day,days,[],profile,level),0)',ctx),slots*3*frequency);
    assert.equal(vm.runInContext("days.reduce((sum,day)=>sum+smartSessionSeries(muscle,day,days,[{muscle,bonus:2}],profile,level),0)",ctx),slots*3*frequency+2);
   }
  }
 }
}
assert.equal((html.match(/id="routineAutoLevel"/g)||[]).length,1);
assert.ok(html.indexOf('id="routineAutoLevel"')<html.indexOf('id="routineSystemBox"'));
console.log('PASS: all levels and profiles, exact weekly totals across sessions, editable priorities, prominent level selector.');
// Exercise selection must never fall back to complex lifts for a beginner.
const selection=html.slice(html.indexOf('const smartExercisePriority='),html.indexOf('async function smartPlanToRoutineBuilder'));
vm.runInContext("const smartNorm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();let routineExerciseLibrary=[];"+selection,ctx);
const run=s=>vm.runInContext(s,ctx);
run(`routineExerciseLibrary=[
 {id:'rdl',name:'Peso muerto rumano',muscle_group:'Femoral',equipment:'Barra'},
 {id:'curl',name:'Curl femoral sentado',muscle_group:'Femoral',equipment:'Máquina'},
 {id:'squat',name:'Sentadilla con barra',muscle_group:'Cuádriceps',equipment:'Barra'},
 {id:'press',name:'Prensa de piernas',muscle_group:'Cuádriceps',equipment:'Máquina'},
 {id:'advanced',name:'Prensa unilateral',muscle_group:'Cuádriceps',equipment:'Máquina'}];`);
for(const day of [1,3,6]){
 assert.equal(run(`smartFindExerciseByMuscle('Femoral',new Set(),'beginner',${day}).id`),'curl');
 assert.equal(run(`smartFindExerciseByMuscle('Cuádriceps',new Set(),'beginner',${day}).id`),'press');
}
assert.equal(run("smartFindExerciseByMuscle('Femoral',new Set(['curl']),'beginner')"),null);
assert.equal(run("smartFindExerciseByMuscle('Cuádriceps',new Set(['press']),'beginner')"),null);
assert.equal(run("smartFindExerciseByMuscle('Femoral',new Set(),'intermediate').id"),'rdl');
assert.equal(run("smartFindExerciseByMuscle('Cuádriceps',new Set(),'advanced').id"),'squat');
const prescription=html.slice(html.indexOf('function smartPrescription('),html.indexOf('function smartLimitationsNote',html.indexOf('function smartPrescription(')));
// Read only the function, avoiding unrelated UI dependencies.
const match=prescription.match(/function smartPrescription[\s\S]*?\n}/);
vm.runInContext(match[0],ctx);
for(const goal of ['strength','muscle','fatloss','general'])assert.equal(run(`smartPrescription('${goal}','beginner').rir`),3);
const build=html.slice(html.indexOf('function smartSetDistribution('),html.indexOf('function smartRenderVolumeSummary('));
vm.runInContext(build+html.slice(html.indexOf('function smartMakeSetData('),html.indexOf('const smartExercisePriority=')),ctx);
// A short library keeps three sets per available exercise; unsafe alternatives stay out.
ctx.day={day:1,muscles:['Femoral']};
assert.equal(run("smartBuildDayExercises(day,[day],'beginner',smartPrescription('muscle','beginner'),90)[0].sets.length"),3);
assert.equal(run("smartBuildDayExercises(day,[day],'beginner',smartPrescription('muscle','beginner'),90).length"),1);
run("routineExerciseLibrary=routineExerciseLibrary.filter(e=>e.id!=='curl')");
assert.equal(run("smartBuildDayExercises(day,[day],'beginner',smartPrescription('muscle','beginner'),90).length"),0);
console.log('PASS: guided beginner exercises, no unsafe fallback, intermediate/advanced progression, RIR and complete set allocation.');

vm.runInContext(html.slice(html.indexOf('function smartBaseSplit('),html.indexOf('function smartPrescription(')),ctx);
for(const count of [3,4,5,6]){
 ctx.count=count;
 const split=run("smartSplit(count,'recommended',[{muscle:'Glúteos',frequency:2,bonus:1}],'female_lower')");
 for(const muscle of ['Glúteos','Cuádriceps','Femoral'])assert.equal(split.filter(d=>d.muscles.includes(muscle)).length,2);
 const core=split.filter(d=>d.muscles.includes('Abdominales'));
 assert.equal(core.length,2);
 if(count>=4)assert.ok(core.every(d=>!d.muscles.some(m=>['Glúteos','Cuádriceps','Femoral'].includes(m))));
 ctx.split=split;
 assert.ok(run("split.every(d=>smartPlannedExerciseCount(d,split,[],'female_lower','advanced')===d.muscles.reduce((n,m)=>n+(SMART_BIG_MUSCLES.has(m)?4:2),0))"));
}
console.log('PASS: exact frequency two, core exercises away from leg days, complete lower-profile exercise counts.');

assert.ok(html.includes("select.value=data?.sex==='female'?'female_balanced':'male'"));
assert.ok(html.includes("const volumeProfile=o.sex==='female'?'female_balanced':'male'"));

// The automatic five-day option remains balanced at F2.
for(const system of ['recommended']){
 ctx.system=system;
 const split=run("smartSplit(5,system,[],'female_balanced',2)");
 for(const muscle of ['Pecho','Espalda','Hombros','Bíceps','Tríceps','Cuádriceps','Femoral','Glúteos','Gemelos','Aductores','Abdominales'])assert.equal(split.filter(d=>d.muscles.includes(muscle)).length,2,system+' '+muscle);
 ctx.split=split;
 assert.ok(run("split.every(d=>smartPlannedExerciseCount(d,split,[],'female_balanced','advanced')>=8&&smartPlannedExerciseCount(d,split,[],'female_balanced','advanced')<=18)"));
 assert.ok(run("split.every(d=>smartDayTotalSets(d,split,[],'female_balanced','advanced')===smartPlannedExerciseCount(d,split,[],'female_balanced','advanced')*3)"));
 assert.equal(run("split.reduce((n,d)=>n+smartSessionSeries('Abdominales',d,split,[],'female_balanced','advanced')*(d.muscles.includes('Abdominales')?1:0),0)"),12);
}
// Explicit systems must retain their selected identity instead of being
// replaced by the generic balanced five-day template.
const explicitFive={
 upper_lower:['Torso A','Pierna A','Torso B','Pierna B','Torso A 2'],
 ppl:['Empuje','Tirón','Pierna','Empuje 2','Tirón 2'],
 fullbody:['Full Body A','Full Body B','Full Body C','Full Body A 2','Full Body B 2'],
 bodypart:['Pecho + tríceps','Espalda + bíceps','Pierna completa','Hombros + abdomen','Torso mixto']
};
for(const [system,names] of Object.entries(explicitFive)){
 ctx.system=system;
 assert.deepEqual(Array.from(run("smartSplit(5,system,[],'female_balanced',2)").map(d=>d.name)),names,system);
}
// Explicit priorities override the general frequency without multiplying weekly sets.
for(const frequency of [1,2,3]){
 ctx.frequency=frequency;
 const split=run("smartSplit(5,'recommended',[{muscle:'Espalda',frequency:1,bonus:2}],'female_balanced',frequency)");
 assert.equal(split.filter(d=>d.muscles.includes('Espalda')).length,1);
 assert.equal(split.filter(d=>d.muscles.includes('Pecho')).length,frequency);
}
// Exercise style is independent of volume profile and retains the beginner filter.
run(`routineExerciseLibrary=[
 {id:'flat',name:'Press banca con barra',muscle_group:'Pecho'},
 {id:'incline',name:'Press inclinado con mancuernas',muscle_group:'Pecho'},
 {id:'machine',name:'Press en máquina',muscle_group:'Pecho'},
 {id:'pull',name:'Jalón al pecho',muscle_group:'Espalda'},
 {id:'row',name:'Remo con barra',muscle_group:'Espalda'}];`);
assert.equal(run("smartFindExerciseByMuscle('Pecho',new Set(),'advanced',1,'incline_pulldown',0).id"),'incline');
assert.equal(run("smartFindExerciseByMuscle('Pecho',new Set(),'advanced',5,'incline_pulldown',1).id"),'machine');
assert.equal(run("smartFindExerciseByMuscle('Espalda',new Set(),'advanced',1,'incline_pulldown',0).id"),'pull');
assert.equal(run("smartFindExerciseByMuscle('Pecho',new Set(['incline','machine']),'advanced',1,'incline_pulldown')"),null);
assert.equal(run("smartFindExerciseByMuscle('Pecho',new Set(),'beginner',1,'incline_pulldown').id"),'machine');
console.log('PASS: balanced five-day F2 across every muscle, useful session lengths, exercise based weekly totals, global frequency and separate exercise style.');

// Full libraries generate distinct four/two exercises on BOTH F2 days for every profile.
for(const muscle of ['Pecho','Espalda','Cuádriceps','Femoral','Glúteos','Bíceps','Tríceps','Gemelos']){
 const big=['Pecho','Espalda','Cuádriceps','Femoral','Glúteos'].includes(muscle);
 ctx.muscle=muscle;
 ctx.library=Array.from({length:8},(_,i)=>({id:muscle+i,name:'Máquina '+i,muscle_group:muscle,equipment:'Máquina'}));
 run('routineExerciseLibrary=library');
 for(const profile of ['male','female_lower','female_balanced'])for(const level of ['beginner','intermediate','advanced']){
  const count=level==='beginner'?(big?2:1):level==='intermediate'?(big?3:2):(big?4:2);
  Object.assign(ctx,{profile,level,days:[1,2].map(day=>({day,muscles:[muscle]}))});
  const results=run("days.map(day=>smartBuildDayExercises(day,days,level,smartPrescription('muscle',level),90,[],profile))");
  for(const rows of results){assert.equal(rows.length,count);assert.equal(new Set(rows.map(x=>x.exercise_id)).size,count);assert.ok(rows.every(x=>x.sets.length===3));}
 }
}
console.log('PASS: four exercises per large group and two per small group each session, equal profiles, distinct compatible exercises, three editable sets.');
