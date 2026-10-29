const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('web/index.html','utf8');const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style>'+block('<section id="pagos"','<section id="planes"').replace('class="section"','class="section active"')+block('<div id="paymentBillingModal"','<div id="goalModal"'));
 await page.addScriptTag({content:`const paymentMethodLabel=()=>'Bizum';const escHtml=String;const paymentMoney=n=>n+' €';const paymentDateLabel=d=>d;const paymentState=r=>({key:'pending',label:r?.status||'Sin cobro'});const paymentPlanLabel=m=>m===3?'Trimestral':'Mensual';let currentProfile={role:'trainer'};let paymentEditingBillingId;let clients=[{id:'a',name:'Cliente de prueba'}];let trainerBilling=[{id:'b',client_id:'a',monthly_fee:150,billing_months:3,status:'active',access_suspended:false,next_due_date:'2026-11-30'}];let trainerPaymentRecords=[{id:'r',billing_id:'b',amount:150,due_date:'2026-10-30',status:'paid',paid_at:'2026-10-29',collection_review_required:true}];${block('function renderTrainerPayments()','function closePaymentBilling()')}`});
 await page.evaluate(()=>renderTrainerPayments());assert.match(await page.locator('#paymentClientList').innerText(),/Trimestral · Acceso activo/);
 await page.locator('#paymentClientList summary').click();assert.equal(await page.getByRole('button',{name:'Sí lo cobré',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'No se recibió este dinero',exact:true}).count(),1);
 await page.getByRole('button',{name:'✎ Editar cuota'}).click();assert.equal(await page.locator('#paymentBillingMonths').inputValue(),'3');assert.equal(await page.locator('#paymentBillingFee').inputValue(),'150');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile layout must not overflow');
 console.log('PASS mobile payments, receipt review, quarterly total and billing editor');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
