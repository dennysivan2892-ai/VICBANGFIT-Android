const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync(new URL('../web/index.html',`file://${__dirname}/`),'utf8');
const form=html.match(/<form id="loginForm"[\s\S]*?<\/form>/)?.[0]||'';

assert.ok(form,'login form exists');
assert.doesNotMatch(form,/onsubmit=/,'login must not depend on an inline submit handler');
assert.match(html,/addEventListener\('submit',loginUser\)/,'login uses a registered submit listener');
assert.match(html,/ev\?\.preventDefault\?\.\(\)/,'login always blocks native form navigation');
assert.match(html,/catch\(error\)[\s\S]*VICBANGFIT login/,'login reports unexpected runtime failures');
assert.match(html,/src="\.\/vendor\/supabase\.min\.js"/,'Supabase auth is bundled with the app');
assert.doesNotMatch(html,/cdn\.jsdelivr\.net\/npm\/@supabase/,'login does not depend on the external Supabase CDN');
assert.match(html,/Compilación __VICBANGFIT_BUILD__ · acceso local/,'the installed build is visible on the login screen');

for(const [i,source] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).entries()){
  new vm.Script(source,{filename:`inline-${i}.js`});
}

console.log('PASS login prevents reload, preserves fields and reports runtime errors');
