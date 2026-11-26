const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('web/vendor/supabase.min.js');
const target = path.resolve('dist/vendor/supabase.min.js');
const htmlTarget = path.resolve('dist/index.html');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);

// Android WebView must not depend on loading a second local script before the
// application starts. Inline the already bundled Supabase client so auth and
// every button are available as soon as index.html is evaluated.
const bundle = fs.readFileSync(source, 'utf8');
const html = fs.readFileSync(htmlTarget, 'utf8');
const tag = '<script src="./vendor/supabase.min.js"></script>';
if (!html.includes(tag)) {
  throw new Error('No se encontró la etiqueta local de Supabase en dist/index.html');
}
fs.writeFileSync(htmlTarget, html.replace(tag, `<script>${bundle}</script>`));
