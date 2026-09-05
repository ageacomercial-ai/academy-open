# ACADEMY — Ambiente STAGING (teste antes de produção)

> Regra de ouro: **NUNCA editar `C:\Users\EXMO PRINS\Desktop\academy` (produção) diretamente.**
> Todo o trabalho é feito aqui em `academy-staging` (branch `staging`).

## Pastas e URLs

| Ambiente | Pasta local | Branch | Vercel | URL |
|---|---|---|---|---|
| PRODUÇÃO | `Desktop\academy` | `master` (protegido, exige PR) | `academy-open` (Production) | https://academy-open.vercel.app |
| TESTE | `Desktop\academy-staging` | `staging` | `academy-staging` (Production Branch = staging) | https://academy-staging.vercel.app |

## Fluxo obrigatório

```powershell
# 1. TRABALHAR SEMPRE AQUI
cd "C:\Users\EXMO PRINS\Desktop\academy-staging"
git checkout staging
# ... editar, testar local ...
git add -A
git commit -m "feat: descricao clara"
git push origin staging
# → abrir https://academy-staging.vercel.app e validar o PDF

# 2. SÓ DEPOIS DE VALIDAR → PROMOVER
# GitHub → Pull Request staging → master → Merge
# → a produção faz deploy sozinha

# 3. SINCRONIZAR TESTE COM PRODUÇÃO (quando preciso)
git checkout staging
git merge master
git push origin staging
```

## Variáveis de ambiente (Vercel → academy-staging → Settings → Environment Variables)

Copiar da produção (`academy-open`), EXCETO pagamentos (ver tabela no relatório):

- `OPENROUTER_API_KEY` — copiar (ou chave separada com limite)
- `GROQ_API_KEY` / `EXISTING_FREE_API_KEY` — copiar
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — copiar (aceitar poluição em `academy_ai_logs`/`academy_history`, ou criar projeto Supabase separado para isolamento total)
- `ADMIN_PIN` — usar valor DE TESTE diferente da produção
- `VANQIR_HOTTOK` — DEIXAR VAZIO em staging (nunca copiar o real)
- `VANQIR_PRODUCT_ID` — DEIXAR VAZIO em staging
- Opcionais (têm default, só copiar se produção usa valor custom):
  `AC_MODELO_PRINCIPAL`, `OPENROUTER_MODEL_CHEAP/BALANCED/STRONG`,
  `PRIMARY_PROVIDER`, `SECONDARY_PROVIDER`, `TERTIARY_PROVIDER`,
  `EXISTING_FREE_API_URL`, `EXISTING_FREE_API_MODEL`,
  `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_TIMEOUT_OLLAMA_MS`
- NÃO definir manualmente: `VERCEL_URL`, `VERCEL_REGION`, `AWS_LAMBDA_FUNCTION_MEMORY_SIZE`, `PORT`, `OLLAMA_URL` (só local)

## Verificação rápida (staging)

Abrir no browser:
- `https://academy-staging.vercel.app/api/engine` via POST `{"action":"ping"}` → deve responder `pong`
- `https://academy-staging.vercel.app/api/engine` via POST `{"action":"__diagnose"}` → `hasOpenRouterKey:true`, `hasSupabaseUrl:true`, `hasAdminPin:true`

Se algum for `false`, falta env var no projeto staging.
