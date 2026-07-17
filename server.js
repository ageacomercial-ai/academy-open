/* ═══════════════════════════════════════════════════════════
   ACADEMY — server.js
   Servidor Express para desenvolvimento local.
   Importa e serve o mesmo api/engine.js do Vercel.
   Zero duplicação de lógica.
═══════════════════════════════════════════════════════════ */

import 'dotenv/config';
import express    from 'express';
import path       from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = process.env.PORT || 3000;

/* ── Importa o handler do Vercel directamente ── */
const { default: engineHandler } = await import('./api/engine.js');

const app = express();

/* ── Middlewares ── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Log de cada pedido ── */
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* ── API: POST /api/engine ── */
app.post('/api/engine', (req, res) => engineHandler(req, res));

/* ── Preflight CORS para /api/* ── */
app.options('/api/*', (_req, res) => res.status(204).end());

/* ── Frontend estático ── */
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  dotfiles: 'ignore',
}));

/* ── SPA fallback: tudo o resto serve o index.html ── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ── Arranque ── */
app.listen(PORT, () => {
  const key = process.env.OPENROUTER_API_KEY;
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        ACADEMY — Dev Server            ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  URL   → http://localhost:${PORT}         ║`);
  console.log(`║  API   → POST /api/engine              ║`);
  console.log(`║  KEY   → ${key ? '✅ OPENROUTER_API_KEY OK' : '❌ FALTA OPENROUTER_API_KEY'}  ║`);
  console.log('╚════════════════════════════════════════╝\n');

  if (!key) {
    console.warn('⚠️  OPENROUTER_API_KEY não encontrada.');
    console.warn('   Para usar modelos GRATUITOS:');
    console.warn('   1. Cria conta em https://openrouter.ai (sem cartão)');
    console.warn('   2. Gera uma API key em openrouter.ai/keys');
    console.warn('   3. Cria .env com: OPENROUTER_API_KEY=sk-or-v1-...\n');
  }
});
