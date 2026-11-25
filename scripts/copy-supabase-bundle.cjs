const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('web/vendor/supabase.min.js');
const target = path.resolve('dist/vendor/supabase.min.js');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
