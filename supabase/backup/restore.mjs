/* ═══════════════════════════════════════════════════════════
   ACADEMY — Restauro (missão §15 — procedimento de recuperação)
   Importa um backup JSON de volta (upsert por PK — id).

   USO:
     node supabase/backup/restore.mjs supabase/backup/dados/<timestamp>
     (restaura TODAS as tabelas presentes nessa pasta, conforme o MANIFEST)

   PRE-REQUISITO OBRIGATÓRIO:
     1. Novo projeto Supabase criado
     2. Migrations 0001–0009 aplicadas (schema 100% igual)
     3. .env apontado para o NOVO projeto (SUPABASE_SERVICE_KEY)
   ═══════════════════════════════════════════════════════════ */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('❌ FALTA SUPABASE_URL ou SUPABASE_SERVICE_KEY no .env');
  process.exit(1);
}

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('❌ Uso: node supabase/backup/restore.mjs <pasta-do-backup>');
  process.exit(1);
}

async function restaurar(tabela, linhas) {
  if (!linhas.length) { console.log(`⏭  ${tabela.padEnd(22)} 0 linhas (vazio)`); return 0; }
  const r = await fetch(`${url}/rest/v1/${tabela}?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(linhas),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${tabela}: ${(await r.text()).slice(0, 300)}`);
  console.log(`✅ ${tabela.padEnd(22)} ${String(linhas.length).padStart(6)} linhas restauradas`);
  return linhas.length;
}

console.log('╔════════════════════════════════════════════╗');
console.log('║     ACADEMY — RESTAURO SUPABASE           ║');
console.log('╚════════════════════════════════════════════╝');

const manifestPath = path.join(dir, 'MANIFEST.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ MANIFEST.json não encontrado — backup inválido.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log(`📦 Backup de ${manifest.criado_em} (${manifest.url})\n`);

let total = 0;
for (const [tabela, info] of Object.entries(manifest.tabelas)) {
  if (info.ok !== true) { console.warn(`⚠️  ${tabela}: marcado como falha no backup — ignorado.`); continue; }
  try {
    const linhas = JSON.parse(fs.readFileSync(path.join(dir, info.ficheiro), 'utf8'));
    total += await restaurar(tabela, linhas);
  } catch (e) {
    console.error(`❌ ${tabela}: ${e.message}`);
  }
}
console.log(`\n📊 Restaurados ${total} registos.`);

/* AVISO: o histórico de auditoria de tráfego futuro não é restaurado
   (impermeável por design); o audit_log volta como estava no backup. */