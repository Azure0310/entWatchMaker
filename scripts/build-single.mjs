// Bundles the Vite build output into one self-contained HTML file (release/entwatchmaker.html)
// that works when opened directly from disk, without npm or a web server.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const outDir = path.resolve('release');
let html = readFileSync(path.join(dist, 'index.html'), 'utf8');

// stylesheets
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => {
  const css = readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');
  return `<style>\n${css}\n</style>`;
});

// module scripts
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const js = readFileSync(path.join(dist, src.replace(/^\.?\//, '')), 'utf8');
  // a literal "</script>" inside the bundle would end the inline script early
  const safe = js.replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${safe}\n</script>`;
});

// modulepreload hints are pointless once everything is inline
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

if (/src="\.?\/assets\//.test(html) || /href="\.?\/assets\//.test(html)) {
  throw new Error('index.html still references external assets: ' + readdirSync(path.join(dist, 'assets')).join(', '));
}

mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'entwatchmaker.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
