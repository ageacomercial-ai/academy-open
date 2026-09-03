# RESEARCH ENGINE AUDIT — Antes (v119)

**Data:** 2025-09-01

## Providers existentes

| Provider | Arquivo | Auth | Limite | Abstract | Full text | Uso |
|----------|---------|------|--------|----------|-----------|-----|
| CrossRef | verification.js:18 | sem chave (mailto opcional) | 50/s | Não (só se ?select) | Não | verificação existência |
| Open Library | verification.js:42 | sem chave | 100/min | Não | Não | ISBN |
| OpenRouter (gpt-4o-mini) | ai-router.js | OPENROUTER_API_KEY | 20-50/min free | — | — | geração |
| Groq | ai-router.js | GROQ_API_KEY | 30/min | — | — | fallback |

Não existem: OpenAlex, Semantic Scholar, Europe PMC, Unpaywall, Tavily, Serper.

## Fluxo antes
`LLM → refs plausíveis → peneira regex → opcional CrossRef` — sem SEARCH, sem evidence, sem claim support.

## Limitações
- Sem cache persistente (Map memória)
- Sem concorrência limitada (Promise.allSettled sem limite)
- Sem retrieval (não busca abstract/full text)
- Sem evidence extraction (page inventada)
- Sem claim support (NOT_CHECKED)
- Vercel 300s timeout para 100p (400 req ×8s)

## Custo antes
CHEAP/BALANCED/STRONG não existiam — tudo gpt-4o-mini.

## Risco
70% paywall sem Unpaywall, 100p estoura timeout, LLM inventa.
