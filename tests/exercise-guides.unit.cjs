const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync('web/index.html','utf8');
for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
 if(!/type="module"|src=/.test(match[1]))new vm.Script(match[2]);
}
const code=html.split('// BEGIN TRAINER EXERCISE GUIDES\n')[1].split('// END TRAINER EXERCISE GUIDES')[0];
const elements={guideInstructions:{value:'Controlled movement'},guideErrors:{value:'No swinging'},guideVideoUrl:{value:''},guideVideoFile:{files:[]},saveExerciseGuideBtn:{},exerciseGuideMessage:{}};
const dialog={querySelectorAll:()=>Object.values(elements),innerHTML:''};
let rows=[],uploads=[],removed=[],failSave=false;
const sb={from(){let payload,videoFilter;const q={select(){return q},eq(k,v){if(k==='video_path')videoFilter=v;return q},limit(){return q},upsert(p){payload=p;return q},single:async()=>{if(failSave)return {error:{message:'offline'}};rows=rows.filter(r=>r.client_id!==payload.client_id).concat({...payload,id:'saved'});return {data:rows.at(-1)}},then(resolve){resolve({data:videoFilter?rows.filter(r=>r.video_path===videoFilter):rows})}};return q},storage:{from(){return {upload:async path=>{uploads.push(path);return {}},remove:async paths=>{removed.push(...paths);return {}}}}}};
const context=vm.createContext({URL,crypto:require('node:crypto').webcrypto,console,sb,currentProfile:{id:'trainer-a',role:'trainer'},escHtml:v=>String(v??'').replace(/</g,'&lt;'),vicError:e=>e.message,toast:()=>{},document:{getElementById:id=>id==='exerciseGuideDialog'?dialog:elements[id]}});
vm.runInContext(code,context);
// Rendering is covered by the separate browser suite; these tests exercise save failure recovery.
vm.runInContext('renderGuideEditor=()=>{}',context);
const run=source=>vm.runInContext(source,context);
(async()=>{
 run(`guideState={editable:true,trainerId:'trainer-a',exerciseId:'exercise-a',clientId:'client-a',scope:'shared',rows:[],original:null};`);
 elements.guideVideoFile.files=[{type:'video/mp4',size:1024}];await run('saveExerciseGuide()');
 assert.equal(rows.length,1);assert.equal(rows[0].client_id,null);assert.match(rows[0].video_path,/trainer-a\/exercise-a\/shared\//);
 elements.guideVideoFile.files=[];elements.guideInstructions.value='Client adaptation';run("guideState.scope='client';guideState.original=null");await run('saveExerciseGuide()');
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.client_id===null).instructions,'Controlled movement');
 assert.equal(run("guideResolve(guideState.rows,'client-a').instructions"),'Client adaptation');
 assert.equal(run("guideResolve(guideState.rows,'client-b').instructions"),'Controlled movement');
 failSave=true;elements.guideVideoFile.files=[{type:'video/mp4',size:1024}];elements.guideInstructions.value='Retain changes';await run('saveExerciseGuide()');
 assert.equal(removed.length,1);assert.equal(elements.guideInstructions.value,'Retain changes');assert.equal(elements.exerciseGuideMessage.textContent,'offline');assert.equal(run('guideState.saving'),false);
 elements.guideVideoFile.files=[{type:'video/mp4',size:51*1024*1024}];await run('saveExerciseGuide()');assert.match(elements.exerciseGuideMessage.textContent,/50 MB/);assert.equal(uploads.length,2);
 elements.guideVideoFile.files=[];elements.guideVideoUrl.value='javascript:alert(1)';await run('saveExerciseGuide()');assert.match(elements.exerciseGuideMessage.textContent,/https/);
 assert.throws(()=>run("guideHttps('http://example.com/video.mp4')"),/https/);
 console.log('PASS: all classic scripts parse; video save, per-client scope, failed-upload cleanup, input retention, size and URL validation');
})().catch(error=>{console.error(error);process.exitCode=1});
