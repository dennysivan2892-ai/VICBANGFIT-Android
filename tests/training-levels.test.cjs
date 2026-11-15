const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const start=html.indexOf('const SMART_BIG_MUSCLES=');
const end=html.indexOf('function smartSetDistribution',start);
assert.ok(end>start);
const ctx=vm.createContext({smartClamp:(n,min,max)=>Math.max(min,Math.min(max,n))});
vm.runInContext(html.slice(start,end),ctx);
for(const [level,big,small] of [['beginner',6,4],['intermediate',10,6],['advanced',15,8]]){
 for(const profile of ['male','female_lower','female_balanced']){
  for(const muscle of ['Pecho','Espalda','Cuádriceps','Femoral','Glúteos','Bíceps','Tríceps','Hombros','Gemelos','Abdominales']){
   const args=JSON.stringify([muscle,[],profile,level]).slice(1,-1);
   const profileBig=profile==='male'?big:level==='beginner'?6:8;
   const profileSmall=profile==='male'?small:level==='beginner'?3:4;
   const expected=muscle==='Abdominales'?4:['Pecho','Espalda','Cuádriceps','Femoral','Glúteos'].includes(muscle)?profileBig:profileSmall;
   assert.equal(vm.runInContext(`smartWeeklySeries(${args})`,ctx),expected);
   const days=[1,2,3].map(day=>({day,muscles:[muscle]}));
   ctx.days=days;ctx.muscle=muscle;ctx.profile=profile;ctx.level=level;
   assert.equal(vm.runInContext('days.reduce((sum,day)=>sum+smartSessionSeries(muscle,day,days,[],profile,level),0)',ctx),expected);
  }
  ctx.profile=profile;ctx.level=level;
  assert.equal(vm.runInContext("smartWeeklySeries('Glúteos',[{muscle:'Glúteos',bonus:2}],profile,level)",ctx),(profile==='male'?big:level==='beginner'?6:8)+2);
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
// One compatible exercise still receives all planned sets; unsafe alternatives stay out.
ctx.day={day:1,muscles:['Femoral']};
assert.equal(run("smartBuildDayExercises(day,[day],'beginner',smartPrescription('muscle','beginner'),90)[0].sets.length"),6);
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
 assert.equal(core.length,1);
 assert.ok(!core[0].muscles.some(m=>['Glúteos','Cuádriceps','Femoral'].includes(m)));
 ctx.split=split;
 assert.ok(run("split.every(d=>smartPlannedExerciseCount(d,split,[],'female_lower','advanced')<=10)"));
}
console.log('PASS: exact frequency two, four core sets away from leg days, bounded lower-profile exercise counts.');

assert.ok(html.includes("select.value=data?.sex==='female'?'female_lower':'male'"));
assert.ok(html.includes("const volumeProfile=o.sex==='female'?'female_lower':'male'"));
