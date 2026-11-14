import assert from 'node:assert/strict';
import {summarize,validateEntry} from '../web/cycle-core.js';
const base={entry_date:'2026-11-14',period_start:'2026-11-12',period_end:null,bloating:2,pain:1,cravings:2,hunger:4,energy:3,weight_kg:65,waist_cm:null,notes:''};
assert.equal(validateEntry(base,'2026-11-14'),base);
for(const change of [{entry_date:'2026-11-15'},{period_end:'2026-11-11'},{hunger:null},{energy:6},{weight_kg:-1},{period_start:null,period_end:'2026-11-13'}])assert.throws(()=>validateEntry({...base,...change},'2026-11-14'));
const records=[base,{...base,entry_date:'2026-11-13',weight_kg:65.4},{...base,entry_date:'2026-11-06',period_start:'2026-10-15',weight_kg:64},{...base,entry_date:'2026-10-17',period_start:'2026-10-15',weight_kg:66}];
const s=summarize(records);assert.equal(s.recentAverage,65.2);assert.equal(s.previousAverage,64);assert.equal(s.comparableAverage,66);assert.equal(s.comparableCount,1);assert(s.possibleFluid);assert(s.suggestions.includes('sweet'));assert(s.suggestions.includes('review_deficit'));
assert.equal(summarize([]),null);assert.equal(summarize([{...base,weight_kg:null}]).recentAverage,null);assert.equal(summarize([{...base,bloating:0}]).possibleFluid,false);
console.log('PASS date/range validation, missing optional weight, weekly averages, cycle comparison and symptom suggestions');
