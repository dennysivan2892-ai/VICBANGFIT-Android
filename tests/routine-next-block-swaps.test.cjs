const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const code=html.slice(html.indexOf('function routineNextBlockSwaps('),html.indexOf('async function routineProgressionMap('));
const ctx=vm.createContext({Map,Set,String,Number,Math,smartNorm:x=>String(x||'').toLowerCase(),routineMovementFamily:name=>/press/i.test(name)?'press':/curl/i.test(name)?'curl':/apertura/i.test(name)?'apertura':'general'});
vm.runInContext(code,ctx);
const library=[
 {id:'a',name:'Press máquina',muscle_group:'Pecho',equipment:'Máquina'},
 {id:'b',name:'Press inclinado máquina',muscle_group:'Pecho',equipment:'Máquina'},
 {id:'c',name:'Press banca barra',muscle_group:'Pecho',equipment:'Barra'},
 {id:'d',name:'Curl polea',muscle_group:'Bíceps',equipment:'Polea'},
 {id:'e',name:'Curl martillo',muscle_group:'Bíceps',equipment:'Mancuerna'},
 {id:'f',name:'Press hombro',muscle_group:'Hombros',equipment:'Máquina'},
 {id:'g',name:'Aperturas polea',muscle_group:'Pecho',equipment:'Polea'}
];
const exercises=['a','d','c','f'].map((id,i)=>({id:'ex'+i,exercise_id:id}));
const source={days:[{exercises}]};
const progress=new Map(exercises.map(ex=>[ex.id,{rec:{type:'maintain'}}]));
let swaps=ctx.routineNextBlockSwaps(source,library,progress);
assert.equal(swaps.size,1);assert.equal(swaps.get('ex0').id,'b');
progress.set('ex0',{rec:{type:'decrease'}});
swaps=ctx.routineNextBlockSwaps(source,library,progress);
assert.equal(swaps.size,1);assert.equal(swaps.get('ex1').id,'e');
const extras=ctx.routineNextBlockExtras(source,library,new Map());assert.equal(extras.get(undefined).id,'g');
progress.clear();assert.equal(ctx.routineNextBlockSwaps(source,library,progress).size,0);
console.log('PASS safe exercise rotation preserves muscle and movement, limits swaps and respects fatigue or missing logs');
