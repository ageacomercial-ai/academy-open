-- ═══════════════════════════════════════════════════════════
-- 0013 — GRANTs anon estritos (permissão BASE; a RLS define linhas)
-- As policies não funcionam sem o GRANT: o anon recebia 401 em
-- INSERT pagamentos (a DB antiga tinha grants manuais fora do
-- versionamento — aqui ficam explícitos).
-- SEMPRE: nunca conceder a tabelas financeiras internas
-- (webhook_logs, transacoes, intervencoes_admin, audit_log,
--  academy_history, academy_ai_logs) — essas só service_role.
-- ═══════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON public.pagamentos        TO anon;
GRANT SELECT, INSERT, UPDATE ON public.utilizadores      TO anon;
GRANT SELECT, INSERT, UPDATE ON public.planos_utilizadores TO anon;
GRANT SELECT, INSERT ON public.senhas_usadas             TO anon;
GRANT SELECT, UPDATE ON public.precos                    TO anon;
GRANT SELECT, UPDATE ON public.planos_grafica            TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instituicoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO anon;

-- Tabelas financeiras/internas: NÃO tocar (sem GRANT anon).
-- REVOKE defensivo caso algum dia venha a existir:
REVOKE ALL ON public.webhook_logs, public.transacoes,
        public.intervencoes_admin, public.audit_log,
        public.academy_history, public.academy_ai_logs FROM anon;