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
   const expected=['Pecho','Espalda','Cuádriceps','Femoral','Glúteos'].includes(muscle)?big:small;
   assert.equal(vm.runInContext(`smartWeeklySeries(${args})`,ctx),expected);
   const days=[1,2,3].map(day=>({day,muscles:[muscle]}));
   ctx.days=days;ctx.muscle=muscle;ctx.profile=profile;ctx.level=level;
   assert.equal(vm.runInContext('days.reduce((sum,day)=>sum+smartSessionSeries(muscle,day,days,[],profile,level),0)',ctx),expected);
  }
  ctx.profile=profile;ctx.level=level;
  assert.equal(vm.runInContext("smartWeeklySeries('Glúteos',[{muscle:'Glúteos',bonus:2}],profile,level)",ctx),big+2);
 }
}
assert.equal((html.match(/id="routineAutoLevel"/g)||[]).length,1);
assert.ok(html.indexOf('id="routineAutoLevel"')<html.indexOf('id="routineSystemBox"'));
console.log('PASS: all levels and profiles, exact weekly totals across sessions, editable priorities, prominent level selector.');
