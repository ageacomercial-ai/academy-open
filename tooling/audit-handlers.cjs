const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const files = [
  'js/state.js', 'js/supabase.js', 'js/navigation.js', 'js/auth.js',
  'js/doc-blocks.js', 'js/doc-history.js', 'js/generator.js', 'js/layout.js',
  'js/pbe.js', 'js/export.js', 'js/editor.js', 'js/academic-ui.js',
  'js/screens-auth.js', 'js/screens-docs.js', 'js/screens-home.js',
  'js/screens-flow.js', 'js/screens-secondary.js', 'js/modelos-doc.js',
];

let all = '';
const perFile = {};
for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) { console.log('FALTANTE:', f); continue; }
  const src = fs.readFileSync(p, 'utf8');
  perFile[f] = src;
  all += '\n' + src;
}

function definedFns() {
  const set = new Set();
  const re = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(all))) set.add(m[1]);
  const re2 = /(?:^|\n)\s*(?:window\.)?([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|class\s+)/g;
  let m2;
  while ((m2 = re2.exec(all))) set.add(m2[1]);
  return set;
}

const defined = definedFns();

const problems = {};

function check(file, src) {
  const handlers = [];
  const re = /\b(?:onclick|onchange|oninput|onsubmit|onkeydown)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(src))) handlers.push({ attr: m[1].trim().slice(0, 90), at: src.slice(0, m.index).split('\n').length });
  for (const h of handlers) {
    const fnRe = /([A-Za-z_$][\w$]*)\s*\(/g;
    let fm;
    while ((fm = fnRe.exec(h.attr))) {
      const name = fm[1];
      if (!defined.has(name)) {
        (problems[file] = problems[file] || []).push(`handler "${h.attr}" linha ${h.at} -> função AUSENTE: ${name}`);
      }
    }
  }
  const chainRe = /\b(\w+)\s*\((?:[^()]*)\)/g;
  let cm;
  while ((cm = chainRe.exec(src))) {
    const name = cm[1];
    const skip = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'delete', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'Date', 'Promise', 'console', 'document', 'window', 'navigator', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'confirm', 'alert'];
    if (skip.includes(name) || defined.has(name)) continue;
    if (/^[a-z]/.test(name) && !/^\$/.test(name)) {
      // possível variável local — reporta como suspeito
      (problems[file] = problems[file] || []).push(`chamada suspeita: ${name}(...`);
    }
  }
}

for (const f of Object.keys(perFile)) check(f, perFile[f]);

let nProblems = 0;
for (const f of Object.keys(problems)) {
  const uniq = [...new Set(problems[f])];
  console.log('\n=== ' + f + ' (' + uniq.length + ' problemas) ===');
  for (const u of uniq.slice(0, 40)) { console.log('  ' + u); nProblems++; }
}
console.log('\nTOTAL: ' + nProblems + ' ocorrências únicas de problemas candidatos.');