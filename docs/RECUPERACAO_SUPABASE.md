# Recuperação do Supabase — Procedimento (missão §15)

> **Princípio:** o schema vive NO GIT (migrations), os dados vivem EM BACKUPS.
> Nenhuma recuperação depende de nada exclusivo do Supabase; o `localStorage`
> do navegador é apenas estado de UI — **nunca** fonte de verdade financeira.

## 1. Arquitetura do backup

| Camada      | Onde vive                              | Como é recriado            |
|-------------|----------------------------------------|----------------------------|
| Estrutura   | `supabase/migrations/0001..0009.sql`   | Aplicar no SQL Editor      |
| Dados       | `supabase/backup/dados/<timestamp>/`   | `restore.mjs` (upsert por id) |
| Verificação | `MANIFEST.json` (SHA-256 por tabela)   | Gerado pelo `backup.mjs`   |

Tabelas cobertas (16): `utilizadores`, `pagamentos`, `documentos`,
`senhas_usadas`, `planos_utilizadores`, `precos`, `planos_grafica`,
`academy_ai_logs`, `academy_history`, `instituicoes`, `comissoes`, `parceiros`,
`webhook_logs`, `transacoes`, `intervencoes_admin`, `audit_log`.

## 2. Backup periódico (manual)

```powershell
node supabase/backup/backup.mjs
```

- Requer `.env` com `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` do projeto **ativo**.
- Cria `supabase/backup/dados/<YYYY-MM-DD-HH-mm-ss>/<tabela>.json` + `MANIFEST.json`.
- Saída de erro (código 2) se alguma tabela falhar → reexecutar.
- **Regra de negócio:** copiar a pasta `dados/` para fora do repositório
  (Google Drive, disco externo, etc.). Um backup só no Git não é um backup.

## 3. Recuperação completa (nova base após desastre)

1. **Criar novo projeto** em `supabase.com/dashboard` (plano gratuito basta).
2. **Aplicar as migrations** (SQL Editor → copiar e executar, na ordem):
   `0001` → `0002` → ... → `0009`. Confirmar sem erros.
3. **Apontar o `.env` para o novo projeto** (URL + SERVICE_KEY novas) e as
   variáveis na Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`).
4. **Restaurar os dados** (com o `.env` novo e o backup mais recente):
   ```powershell
   node supabase/backup/restore.mjs supabase/backup/dados/<timestamp>
   ```
5. **Validar** (passos obrigatórios — ver secção 4).
6. **Redeployar** `vercel --prod` e repetir a validação via HTTPS.

## 4. Validação pós-recuperação

```powershell
node vanqir-test.mjs        # testes 1–6 e 7–20 (HMAC, idempotência, RLS...)
node test-part1.mjs         # regressão do fluxo base
```

Confirmar manualmente:
- [ ] `GET /api/health` → `ok: true` (API + Supabase + 5 tabelas essenciais)
- [ ] Login + criação de utilizador funcionam (anon RLS)
- [ ] Pagamento criado fica `pendente`; NUNCA aprovado pela anon key
- [ ] Aprovação/rejeição só via `/api/engine` (PIN + service role)
- [ ] Webhook com assinatura válida cria `transacoes` + créditos uma única vez
- [ ] Reentrega (mesmo `delivery_id`+`event`) → 200 sem duplicar
- [ ] `order.refunded` revoga e cria intervenção `REVOCACAO_ACESSO_PENDENTE`
- [ ] `audit_log` regista alterações de preço/parceiro
- [ ] Preço de venda antigo em `transacoes` não mudou (histórico imutável)

## 5. Perguntas frequentes

- **E se uma migration falhar no passo 2?** Não prosseguir. Corrigir a migration
  (é idempotente: `IF NOT EXISTS`), aplicar de novo. Só restaurar dados com o
  schema 100% igual ao do backup (mesmas versões de migrations).
- **Posso restaurar só uma tabela?** Sim — `restore.mjs` lê o MANIFEST e faz
  upsert por `id`; basta apagar as entradas das tabelas que não se quer restaurar.
- **O backup tem dados de outra base?** Nunca restaurar backups de outra base
  num projeto com tráfego — `merge-duplicates` por PK não distingue origens.
- **Onde estão os logs dos webhooks?** Em `webhook_logs` (incluídos no backup).
  Auditoria financeira completa: `webhook_logs` + `transacoes` + `intervencoes_admin`.
