-- ═══════════════════════════════════════════════════════════
-- 0010 — SEED OFICIAL + POLICIES DE PREÇOS
-- 1. Pacotes oficiais aprovados na validação (Parte 2 §5):
--    0-15→1.850 · 16-30→2.850 · 31-50→5.500 · 51-200→16.000
--    201-500→40.000 · 501-1.000→80.000 Kz
-- 2. Planos Gráfica e instituições: valores do seed antigo (não alterados).
-- 3. UPDATE anon em precos/planos_grafica: o painel admin (PIN) grava
--    preços directamente via anon key — SEM a policy o painel quebra.
--    Alterações ficam AUDITADAS (triggers da 0009 → audit_log).
--    DELETE fica só service role (preventivo — o admin não apaga linhas).
-- ═══════════════════════════════════════════════════════════

/* ── 1. PACOTES OFICIAIS (faixas de páginas) ── */
INSERT INTO precos (faixa_inicio, faixa_fim, preco, label, ativo) VALUES
  (0, 15,     1850,  '0-15 páginas',     true),
  (16, 30,    2850,  '16-30 páginas',    true),
  (31, 50,    5500,  '31-50 páginas',    true),
  (51, 200,   16000, '51-200 páginas',   true),
  (201, 500,  40000, '201-500 páginas',  true),
  (501, 1000, 80000, '501-1000 páginas', true)
ON CONFLICT (faixa_inicio, faixa_fim) DO NOTHING;

/* ── 2. PLANOS GRÁFICA / CYBER (valores originais) ── */
INSERT INTO planos_grafica (nome, paginas, preco, ativo) VALUES
  ('Gráfica 150', 150, 15000, true),
  ('Gráfica 300', 300, 25000, true),
  ('Gráfica 500', 500, 40000, true)
ON CONFLICT (nome) DO NOTHING;

/* ── 3. INSTITUIÇÕES (descontos — valores originais) ── */
INSERT INTO instituicoes (nome, sigla, desconto_porcentagem) VALUES
  ('Universidade Agostinho Neto','UAN',10),
  ('Universidade Independente de Angola','UNIA',10),
  ('Universidade Católica de Angola','UCAN',10),
  ('Universidade Lusíada de Angola','ULA',10),
  ('Instituto Superior Politécnico de Angola','ISPA',10)
ON CONFLICT (nome) DO NOTHING;

/* ── 4. UPDATE anon (painel admin) — auditoria nos triggers ── */
DROP POLICY IF EXISTS "anon_update_precos" ON precos;
CREATE POLICY "anon_update_precos" ON precos
  FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_planos_grafica" ON planos_grafica;
CREATE POLICY "anon_update_planos_grafica" ON planos_grafica
  FOR UPDATE TO anon USING (true);