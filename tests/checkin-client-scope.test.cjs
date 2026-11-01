const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const code=html.slice(html.indexOf('let trainerCheckinsClientId='),html.indexOf('async function openCheckinPhoto'));
const elements=Object.fromEntries(['checkList','trainerCheckinsMore','trainerCheckinsTitle','trainerCheckinsClient'].map(id=>[id,{innerHTML:'',insertAdjacentHTML(_,s){this.innerHTML+=s}}]));
const calls=[];const records=[{id:'1',client_id:'juan',checkin_date:'2026-10-01',weight_kg:80},{id:'2',client_id:'pedro',checkin_date:'2026-11-01',weight_kg:90}];
const context=vm.createContext({currentProfile:{id:'coach',role:'trainer'},clients:[{id:'juan',name:'Juan'},{id:'pedro',name:'Pedro'}],document:{getElementById:id=>elements[id]},nutritionEsc:String,checkinFmtDate:String,toast:()=>{},console,sb:{from(table){let filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){calls.push({filters,a,b});return Promise.resolve({data:records.filter(r=>filters.every(([k,v])=>k==='trainer_id'||r[k]===v)).slice(a,b+1)})},in(){return Promise.resolve({data:[{id:'juan',full_name:'Juan'},{id:'pedro',full_name:'Pedro'}]})}};return q}},showPage(){}});
vm.runInContext(code,context);
(async()=>{
 await vm.runInContext("trainerCheckinsClientId='juan';loadTrainerCheckins()",context);
 assert.match(elements.checkList.innerHTML,/Juan/);assert.doesNotMatch(elements.checkList.innerHTML,/Pedro/);
 assert(calls[0].filters.some(([k,v])=>k==='trainer_id'&&v==='coach'));
 await vm.runInContext("trainerCheckinsClientId=null;loadTrainerCheckins()",context);
 assert.match(elements.checkList.innerHTML,/Juan/);assert.match(elements.checkList.innerHTML,/Pedro/);
 await vm.runInContext('loadTrainerCheckins(true)',context);assert.equal(calls[2].a,2);
 await vm.runInContext("trainerCheckinsClientId='empty';loadTrainerCheckins()",context);assert.match(elements.checkList.innerHTML,/Todavía no hay/);assert.doesNotMatch(elements.checkList.innerHTML,/Pedro/);
 console.log('PASS client isolation, trainer scope, general list, older records and empty history');
})().catch(e=>{console.error(e);process.exit(1)});
