-- ═══════════════════════════════════════════════════════════
-- 0001 — SEGURANÇA: políticas RLS de PAGAMENTOS
-- ───────────────────────────────────────────────────────────
-- PROBLEMA CORRIGIDO:
--   A política "anon_update_pagamentos" (USING true, sem WITH CHECK)
--   permitia a QUALQUER cliente, através da anon key, fazer
--   PATCH de um pagamento para estado = 'aprovado' (auto-aprovação).
--   Também permitia inserir directamente um pagamento já 'aprovado'.
--
-- POLICIES ANTERIORES (documentação, eram as existentes):
--   anon_insert_pagamentos : FOR INSERT TO anon WITH CHECK (true)
--   anon_select_pagamentos : FOR SELECT TO anon USING (true)
--   anon_update_pagamentos : FOR UPDATE TO anon USING (true)   ← vulnerável
--
-- POLICIES NOVAS (comportamento esperado):
--   anon_insert_pagamentos : cliente cria pagamento, SEMPRE estado='pendente'
--   anon_select_pagamentos : leitura mantida (polling sbCheckAprovados e admin)
--   anon_processar_pagamentos : cliente só pode transitar aprovado → processado
--
-- APROVAÇÃO/REJEIÇÃO: exclusivamente pelo backend (service role),
--   através das novas actions /api/engine: aprovar_pagamento / rejeitar_pagamento.
-- ═══════════════════════════════════════════════════════════

/* Colunas em falta no schema versionado (já usadas pelo frontend)
   — mantidas como idempotentes para não quebrar DB existente */
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS ref TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS uid TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT 'Desconhecido';
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS whatsapp TEXT;

/* Remove a política vulnerável (se existir em DBs antigos) */
DROP POLICY IF EXISTS "anon_update_pagamentos" ON pagamentos;

/* INSERT: cliente pode criar pagamento, mas apenas como 'pendente'.
   Bloqueia inserção directa com estado='aprovado'. */
DROP POLICY IF EXISTS "anon_insert_pagamentos" ON pagamentos;
CREATE POLICY "anon_insert_pagamentos" ON pagamentos
  FOR INSERT TO anon
  WITH CHECK (estado = 'pendente');

/* SELECT: mantém comportamento actual (polling + listagem admin). */
DROP POLICY IF EXISTS "anon_select_pagamentos" ON pagamentos;
CREATE POLICY "anon_select_pagamentos" ON pagamentos
  FOR SELECT TO anon
  USING (true);

/* UPDATE: o cliente só pode marcar como 'processado' um pagamento
   que já esteja 'aprovado' (fluxo de polling sbCheckAprovados).
   NÃO permite definir aprovado/rejeitado através da anon key. */
DROP POLICY IF EXISTS "anon_processar_pagamentos" ON pagamentos;
CREATE POLICY "anon_processar_pagamentos" ON pagamentos
  FOR UPDATE TO anon
  USING (estado = 'aprovado')
  WITH CHECK (estado = 'processado');