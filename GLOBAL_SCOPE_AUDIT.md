# GLOBAL SCOPE AUDIT — ACADEMY

**Data:** 2025-09-01  
**Plataforma:** https://academy-open.vercel.app  
**Missão:** PLATFORM_SCOPE = GLOBAL (nunca ANGOLA)

---

## 1. Resumo Executivo

A auditoria encontrou **7 pontos onde Angola é injetado como contexto padrão**, violando `PLATFORM_SCOPE=GLOBAL`. O tema determina o escopo, mas 3 camadas reintroduzem Angola: (1) sugestões de tema hard-coded 100% Angola, (2) `pbe.js` pool contém token `angola`, (3) `api/engine.js` penaliza `ast._angola_count` quando `geoCtx=global`, (4) `export.js` fallback refs 100% lusófonas, (5) `system.js` `detectarContextoGeo` tem `angola` como primeiro match, (6) `references.js` instrução geo, (7) UI `pt-AO` como língua padrão.

Nenhuma camada implementa `PLATFORM_SCOPE=GLOBAL` explícito, nem `geographic_scope[]` derivado do tema, nem hierarquia L1→L4.

---

## 2. Onde Angola é Injetado Hoje

### 2.1 Frontend — Sugestões (ALTA)
**`js/screens-flow.js:301-308`**
```js
const _SUGESTOES_TEMA = [
  'Impacto das TIC no rendimento académico em Angola', // 8/8 Angola
  'Empreendedorismo juvenil ... em Angola',
  'Gestão de resíduos ... Luanda',
  'Qualidade do ensino superior em Angola',
  'Saúde pública em Angola',
  ... // 100% Angola
];
const _SUG_P5 = ['em Angola','em Luanda','em Benguela', ... 'na província do Uíge' ] // 12/12 Angola
```
**Efeito:** Usuário novo vê só exemplos Angola → assume plataforma é angolana → escreve tema sem país mas espera fontes angolanas.

### 2.2 PBE Pool (MÉDIA)
**`js/pbe.js:68-71`**
```js
const _PBE_POOL = ('... contexto angola resultado processo ... bibliografia instituição económico').split(' ');
```
Token `angola` contamina calibração sintética de `pbeMedirPaginas` — páginas de teste contêm `angola`, infla `angola_count`.

### 2.3 Engine Penalidade (MÉDIA)
**`api/engine.js:231`**
```js
if (geoCtx === 'global' && ast._angola_count > 10) warnings.push('Texto contém referências geográficas inesperadas');
```
Quando tema é global, mas IA gera `Angola` (por prompt enviesado), é tratado como *warning*, não como erro de escopo. Não previne, só alerta.

### 2.4 Referências Fallback (ALTA)
**`js/export.js:93-114` `refGerarFallback()`**
```
Graça, A. (2020). Metodologias ... Edições Maianga.
UNESCO. (2023). Relatório global ... // 1 global em 10
Universidade Agostinho Neto. (2020). Regulamento ... UAN.
```
9/10 refs são Angola/lusófonas, usadas quando LLM falha — contamina trabalhos globais.

### 2.5 Detecção Geográfica (MÉDIA)
**`academic/prompts/system.js:112-124`**
```js
if (/angola|luanda|benguela.../.test(t)) return 'angola';
if (/cabo.?verde.../.test(t)) return 'cabo_verde';
...
if (p && p !== 'angola') return p;
if (p === 'angola') return 'angola';
return 'global';
```
Ordem correta (angola primeiro), mas **sem `PLATFORM_SCOPE` explícito** e sem `geographic_scope[]` — só retorna 1 string, não array. `references.js:17-19` usa esse `geoCtxR` para decidir `geoRefsInstrucao` — se tema não menciona país, vira `global` (ok), mas se usuário em Angola não mencionou país, deveria continuar `global`, o que já faz. Porém `p` (pais do payload) nunca é enviado do frontend (`generator.js` não envia `pais`), então sempre cai no `tema` — **usuário em Angola com tema global não é contaminado**, mas **tema sem país com sugestão Angola leva a crer que precisa mencionar Angola**.

### 2.6 Prompts Geo (BAIXA)
**`academic/prompts/system.js:234`**
```js
if (ctx === 'angola') return 'O tema refere-se especificamente a Angola. Quando relevante, usa dados angolanos...';
return 'Trata o tema de forma universal... NÃO faças referência a Angola...';
```
Correto quando `ctx` é derivado do tema, mas **sem validação de que `ctx` veio do tema, não da plataforma**.

### 2.7 UI Língua (BAIXA)
**`js/screens-secondary.js:209`**
```js
[['pt-AO','Português (Angola)'], ['pt-BR',...], ['pt-PT',...]]
```
`pt-AO` primeiro → idioma = geografia na percepção do usuário. Viola `Português ≠ Angola`.

---

## 3. Fluxo Atual (sem escopo explícito)

```
tema (string)
  → detectarContextoGeo(tema) → 'angola' | 'cabo_verde' | ... | 'global'  (1 string)
  → gerarInstrucaoGeo(ctx) → prompt ("usa dados angolanos" vs "universal")
  → montarPromptCapitulo (usa geoInstrucao + pArea)
  → montarPromptReferencias (usa geoCtxR para geoRefsInstrucao)

NÃO existe:
- PLATFORM_SCOPE constant
- geographic_scope[] array
- topic_scope / population_scope / time_scope
- discipline_scope
- hierarchy L1→L4
```

---

## 4. Hierarquia Atual vs Desejada

| Atual | Desejado L1→L4 |
|-------|----------------|
| Nenhuma (LLM escolhe) | L1: artigos/meta-análises/teses; L2: WB/UN/UNESCO/WHO/ITU/OECD; L3: nacional quando claim nacional; L4: outros confiáveis |
| `references.js` manda `numRefs = pags*0.6` sem hierarquia | `validar_integridade` + `ReferenceVerifier` escolhe `melhor fonte disponível` por claim, não por país |

---

## 5. Regra de Ouro Violada

Hoje: `tema="Impacto da IA no mercado de trabalho"` (global) + usuário em Angola → `detectarContextoGeo` retorna `global` (ok), mas `pbe.js` e `export.js fallback` e `sugestões` empurram Angola via outro caminho. Precisa `PLATFORM_SCOPE=GLOBAL` explícito em **todas** as camadas.

---

## 6. Testes G1-G6 — Estado Atual (antes do fix)

| Teste | Tema | Esperado | Atual | Passa? |
|-------|------|----------|-------|--------|
| G1 | IA mercado trabalho (global) | `global_scope=true` | `global` (ok) | ✅ mas sem garantia contra fallback |
| G2 | Empreendedorismo Brasil | `geographic_scope=[Brasil]` + fontes internacionais ok | `brasil` (ok) | ✅ |
| G3 | Negócios digitais Angola | `geographic_scope=[Angola]` + internacionais ok | `angola` (ok) | ✅ |
| G4 | Global com usuário Angola | `ANGOLA não injetada` | `global` (ok, pois `pais` não enviado) | ✅ mas frágil |
| G5 | EUA | `ANGOLA não aparece` | `eua` (ok) | ✅ |
| G6 | Global → fontes internacionais sem autor angolano | Permitido | Permitido (ok) | ✅ |
| **BUG** | `Almeida (2021) Pinto (2022) Costa (2023)` sem verificação | `NOT_VERIFIED` | Hoje aceita como `PARTIALLY_VERIFIED` via regex | ❌ |

Todos G1-G6 passam superficialmente, mas **por acaso**, não por arquitetura `PLATFORM_SCOPE=GLOBAL` robusta + hierarquia.

---

## 7. Riscos Restantes

1. **Sugestões 100% Angola** → viés de ancoragem
2. **Fallback refs 90% Angola** → contamina global quando LLM falha
3. **Sem `geographic_scope[]`** → não suporta `Angola + global` simultâneo
4. **Sem hierarquia** → LLM pode escolher fonte fraca local quando existe internacional melhor
5. **Idioma = geografia** → `pt-AO` primeiro reforça Angola
6. **Usuário = objeto** → ainda não, mas sem `population_scope` explícito, futuro risco

---

## 8. Recomendação

Implementar `PLATFORM_SCOPE=GLOBAL` como constante, `determinarEscopo(tema, objetivos, população)` retornando `{global_scope, geographic_scope[], topic_scope[], population_scope[], discipline_scope[]}`, injetar em `montarPromptCapitulo/Referencias` + `ReferenceVerifier` hierarquia L1→L4, remover Angola padrão de sugestões/fallback/pbe pool, e criar testes G1-G6 automatizados.
