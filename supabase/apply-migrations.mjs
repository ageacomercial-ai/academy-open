/* ═══════════════════════════════════════════════════════════
   ACADEMY — Aplicar migrations via Supabase Management API
   Uso (recuperação / primeira instalação):
     node supabase/apply-migrations.mjs
   Requer em .env ou .env.local:
     SUPABASE_URL           (projeto alvo)
     SUPABASE_ACCESS_TOKEN  (dashboard → Account → Access Tokens)
   Aplica supabase/migrations/*.sql por ordem alfabética.
   Cada chamada é uma transação própria da API de gestão.
   ═══════════════════════════════════════════════════════════ */

import 'dotenv/config';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ACCESS_TOKEN) {
  try { dotenv.config({ path: path.join(process.cwd(), '.env.local') }); } catch {}
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('❌ FALTAM SUPABASE_URL e SUPABASE_ACCESS_TOKEN (.env ou .env.local)');
  process.exit(1);
}

const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const dir = path.join(process.cwd(), 'supabase', 'migrations');
const ficheiros = fs.readdirSync(dir).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
if (!ficheiros.length) { console.error('❌ Sem migrations em', dir); process.exit(1); }

async function aplicar(sql, nome) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const corpo = await r.text();
  if (!r.ok) {
    console.error(`❌ ${nome}: HTTP ${r.status}`);
    console.error(corpo.slice(0, 1200));
    return false;
  }
  console.log(`✅ ${nome} aplicada`);
  return true;
}

console.log(`▶ Projeto: ${ref} — ${ficheiros.length} migrations\n`);
let ok = true;
for (const f of ficheiros) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!(await aplicar(sql, f))) ok = false;
}
console.log(ok ? '\n🎉 TODAS AS MIGRATIONS APLICADAS.' : '\n⚠️ HOUVE FALHAS — corrigir e reexecutar (idempotente).');
process.exit(ok ? 0 : 1);