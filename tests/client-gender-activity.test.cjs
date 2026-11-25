const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync(new URL('../web/index.html',`file://${__dirname}/`),'utf8');

assert.match(html,/data-client-gender="male"/);
assert.match(html,/data-client-gender="female"/);
assert.match(html,/client_details'\)\.select\('[^']*sex/);
assert.match(html,/function loadClientListActivity\(ids\)/);
assert.match(html,/workout_sessions[^\n]+gte\('completed_at',since30\)/);
assert.match(html,/nutrition_meal_logs[^\n]+gte\('log_date',sinceDate\)/);
assert.match(html,/sort\(\(a,b\)=>\(b\.activityScore\|\|0\)-\(a\.activityScore\|\|0\)/);

console.log('PASS gender groups, filters and 30-day meal/workout activity ordering');
