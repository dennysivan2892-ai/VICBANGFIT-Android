const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const ctx=vm.createContext({document:{getElementById:()=>null},nutritionDateISO:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
vm.runInContext('let clientPlanningBillingConfigured,clientPlanningAccessUntil,clientPlanningAccessAllowed;'+html.slice(html.indexOf('function clientPlanningAccessLabel()'),html.indexOf('async function refreshClientPlanningAccess()')),ctx);
for(const billing of [null,{access_suspended:false,planning_access_until:'2000-01-01'},{access_suspended:false,next_due_date:'2000-01-01',status:'paused'}]){
 ctx.billing=billing;assert.equal(vm.runInContext('applyManualPlanningAccess(billing);clientPlanningAccessAllowed',ctx),true);
}
ctx.billing={access_suspended:true,planning_access_until:'9999-12-31'};assert.equal(vm.runInContext('applyManualPlanningAccess(billing);clientPlanningAccessAllowed',ctx),false);
vm.runInContext(html.slice(html.indexOf('function paymentAddMonthISO('),html.indexOf('async function loadDashboardPaymentKpi()')),ctx);
for(const [date,months,expected] of [['2026-01-31',1,'2026-02-28'],['2028-01-31',1,'2028-02-29'],['2026-10-30',3,'2027-01-30'],['2026-08-31',6,'2027-02-28'],['2028-02-29',12,'2029-02-28']])assert.equal(vm.runInContext(`paymentAddMonthISO('${date}',${months})`,ctx),expected);
assert.equal(vm.runInContext("paymentMonthISO(new Date('2026-10-31T23:30:00Z'))",ctx),'2026-11');
for(const id of ['paymentSummaryMonth','paymentRevenueGoal','paymentBillingMonths','paymentPaidDate','paymentPaidNextDue'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
// Parse every classic inline script: Vite does not parse these scripts in this app.
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/src=|type="module"/.test(match[1]))new vm.Script(match[2]);
console.log('PASS manual suspension independent of dates, 1/3/6/12-month rollover, Madrid month boundaries, UI fields and inline script syntax');
