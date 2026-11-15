const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('web/index.html','utf8');
function fn(name){const start=html.indexOf('function '+name+'(');return html.slice(start,html.indexOf('\n}',start)+2)}
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const ids=[...new Set([...html.matchAll(/id="(smartNut[^"]+)"/g)].map(m=>m[1]))];
 await page.setContent(ids.map(id=>id==='smartNutFatKg'?`<select id="${id}"><option value="1">1</option></select>`:`<input id="${id}">`).join(''));
 await page.addScriptTag({content:`const toast=()=>{};function smartNutritionEstimate(){return {weight:Number(document.getElementById('smartNutWeight').value),bmr:1600,maintenance:2000,target:2000,adjustment:0}}\n${['nutritionFatPercent','nutritionFatPercentText','nutritionFatPercentChanged','smartNutritionNum','smartNutritionPreset','smartNutritionCalculate','smartNutritionFitCarbs','smartNutritionClear'].map(fn).join('\n')}`});
 await page.evaluate(()=>{for(const [id,v] of Object.entries({smartNutWeight:80,smartNutTargetCalories:2000,smartNutProteinKg:2,smartNutFatKg:1,smartNutCarbKg:2}))document.getElementById(id).value=v;smartNutritionCalculate(false)});
 assert.equal(await page.locator('#smartNutFatPercent').inputValue(),'36');
 assert.match(await page.locator('#smartNutFatCalc').textContent(),/36 %/);
 await page.locator('#smartNutFatPercent').fill('30');await page.evaluate(()=>nutritionFatPercentChanged('smart'));
 assert.equal(await page.locator('#smartNutFatPercent').inputValue(),'30');
 assert.match(await page.locator('#smartNutFatCalc').textContent(),/66.7 g/);
 assert.equal(await page.locator('#smartNutTargetCalories').inputValue(),'2000');
 assert.equal(await page.locator('#smartNutProteinKg').inputValue(),'2');
 await page.locator('#smartNutFatPercent').fill('20');await page.evaluate(()=>nutritionFatPercentChanged('smart'));
 assert.equal(await page.locator('#smartNutFatPercent').inputValue(),'20');
 await page.evaluate(()=>smartNutritionClear());assert.equal(await page.locator('#smartNutFatPercent').inputValue(),'');
 console.log('PASS: fat percentages use diet calories; 36%, 30%, 20%, precise g/kg, preserved calories/protein and empty state');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
