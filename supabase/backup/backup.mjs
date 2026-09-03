/* ═══════════════════════════════════════════════════════════
   ACADEMY — Backup completo (missão §15)
   Exporta TODAS as tabelas via REST (service role) para JSON,
   com paginação e MANIFEST de verificação.

   USO:
     node supabase/backup/backup.mjs
     node supabase/backup/backup.mjs --dir supabase/backup/dados/2026-08-16

   REQUISITOS: .env com SUPABASE_URL + SUPABASE_SERVICE_KEY.
   SAÍDA: supabase/backup/dados/<timestamp>/*.json + MANIFEST.json
   ═══════════════════════════════════════════════════════════ */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TABELAS = [
  'utilizadores', 'pagamentos', 'documentos', 'senhas_usadas',
  'planos_utilizadores', 'precos', 'planos_grafica', 'academy_ai_logs',
  'academy_history', 'instituicoes', 'comissoes', 'parceiros',
  'webhook_logs', 'transacoes', 'intervencoes_admin', 'audit_log',
];

const LIMITE = 1000; /* PostgREST: máx. 1000 linhas por página */

function args() {
  const a = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--dir=')) a.dir = process.argv[i].slice(6);
  }
  return a;
}

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('❌ FALTA SUPABASE_URL ou SUPABASE_SERVICE_KEY no .env');
  process.exit(1);
}

const dest = args().dir || path.join(process.cwd(), 'supabase', 'backup', 'dados',
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'));
fs.mkdirSync(dest, { recursive: true });

async function fetchPagina(tabela, offset) {
  const r = await fetch(`${url}/rest/v1/${tabela}?select=*&order=id&offset=${offset}&limit=${LIMITE}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'public' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${tabela}@offset${offset}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

console.log('╔════════════════════════════════════════════╗');
console.log('║        ACADEMY — BACKUP SUPABASE          ║');
console.log('╚════════════════════════════════════════════╝');

const manifest = { criado_em: new Date().toISOString(), url: url.replace(/^https?:\/\//, ''), tabelas: {} };
let totalOk = 0;

for (const tabela of TABELAS) {
  const linhas = [];
  try {
    for (let offset = 0; ; offset += LIMITE) {
      const pagina = await fetchPagina(tabela, offset);
      linhas.push(...pagina);
      if (pagina.length < LIMITE) break;
    }
  } catch (e) {
    console.error(`❌ ${tabela}: ${e.message}`);
    manifest.tabelas[tabela] = { ok: false, erro: e.message };
    continue;
  }

  const ficheiro = `${tabela}.json`;
  fs.writeFileSync(path.join(dest, ficheiro), JSON.stringify(linhas, null, 1), 'utf8');
  const hash = crypto.createHash('sha256').update(JSON.stringify(linhas)).digest('hex');
  manifest.tabelas[tabela] = { ok: true, linhas: linhas.length, ficheiro, sha256: hash.slice(0, 16) };
  totalOk += linhas.length;
  console.log(`✅ ${tabela.padEnd(22)} ${String(linhas.length).padStart(6)} linhas`);
}

fs.writeFileSync(path.join(dest, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\n📦 ${TABELAS.length} tabelas · ${totalOk} linhas → ${dest}`);
console.log('   MANIFEST.json criado (verificação de integridade).');

const falhas = Object.values(manifest.tabelas).filter(t => !t.ok).length;
if (falhas > 0) {
  console.error(`⚠️  ${falhas} tabelas com erro — verificar acima.`);
  process.exit(2);
}
console.log('✅ BACKUP COMPLETO.');