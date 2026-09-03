# Anchored Summary — Academy Open

## Objective
Gerar documentos académicos completos em PDF/DOCX com design profissional, múltiplas páginas, conteúdo profundo, referências bibliográficas correspondentes às citações no texto, e sistema de edição conversacional com IA que permite editar TUDO (capa, metadados, capítulos).

## Important Details
- **6 temas premium**: Safira Real, Esmeralda, Rubi Imperial, Obsidiana, Bronze Antigo, Ametista
- **Sistema anti-órfãos**: `preRenderFixOrphans()` garante subtítulos nunca ficam sozinhos no fim da página
- **Referências automáticas**: Se não existir secção de referências mas houver citações extraídas, cria-a automaticamente
- **Gráficos/tabelas automáticos**: Deteta percentagens e comparações, gera tabelas HTML formatadas
- **Capa funcional**: Usa cores do tema activo
- **PDF inline viewer**: Substitui `window.print()` — esconde app, mostra documento na mesma página com toolbar "Guardar PDF" / "Fechar"
- **`data_table` block type**: Tabelas de dados com HTML directo, sem `<p>` wrapper
- **Citação extração**: Funções `extrairCitacoesDoTexto`, `construirReferenciasCitadas` implementadas
- **Corresponência citações ↔ referências**: DOC_MEMORY agora extrai autores citados do texto (padrões: `(Autor, Ano)`, `segundo Autor (Ano)`, etc.) e valida contra bibliografia
- **Auditoria académica**: `verificarQualidadeAcademica()` verifica objetivos, metodologia, profundidade por capítulo, correspondência citações-referências
- **Regeneração automática de referências**: `regenerarReferenciasCorretas()` chama backend com lista de autores realmente citados
- **Backend atualizado**: `montarPromptReferencias` recebe `autoresCitados` e instrui IA a incluir TODOS os autores citados na bibliografia
- **Editor conversacional completo**: Pode editar TUDO — título, instituição, autor, capa, capítulos — via chat com IA
- **Ajuste de páginas**: Antes de gerar PDF, sistema mede páginas reais vs alvo e ajusta conteúdo proporcionalmente
- **`getSaldoDisponivel()` corrigido**: Verifica créditos antes do plano
- **`sbGuardarCredito()` e `sbRestaurarCredito()`** em auth.js
- **`aplicarSenha()`** chama `sbGuardarCredito()` após activação
- **Delays e timeouts reduzidos** para performance melhorada
- **CSS print actualizado** com `@page { size:210mm 297mm; margin:0 }`
- **Service Worker cache**: `academy-v104` (incrementado para forçar atualização)

## Work State
### Completed
- [x] 6 temas premium com paletas coerentes
- [x] Sistema anti-órfãos ativo
- [x] Referências automáticas criadas quando há citações
- [x] Gráficos/tabelas automáticos (data_table)
- [x] Capa funcional com cores do tema
- [x] Inline viewer PDF com toolbar
- [x] `data_table` block type suportado
- [x] Extração de citações do texto
- [x] `overflow:visible` no `.pg` (fix crítico para múltiplas páginas)
- [x] Filtro de valores null em `preRenderAgrupar` (fix para TypeError)
- [x] Correção `academic-ui.js`: substituída função `api()` desconhecida por `fetch(ACADEMY_ENGINE_URL)`
- [x] Ajuste de páginas no export: mede e ajusta conteúdo para atingir nº de páginas alvo
- [x] Editor conversacional completo: pode editar TUDO (capa, metadados, capítulos)
- [x] **Correspondência citações ↔ referências**: DOC_MEMORY extrai autores citados do texto
- [x] **Auditoria académica pós-geração**: verifica objetivos, metodologia, profundidade, correspondência citações-referências
- [x] **Regeneração automática de referências**: quando há citações sem referências, regenera com lista correta de autores
- [x] **Backend atualizado**: prompt de referências agora recebe lista de autores citados e instrui IA a incluí-los todos

### Active
- [ ] **Conteúdo mais profundo por capítulo**: Atualmente o PBE ajusta palavras mas não garante desenvolvimento académico (objetivos, problema, metodologia, discussão)
- [ ] **Estrutura académica completa**: Prompts podem produzir introduções básicas sem objetivos/problema/metodologia explícitos
- [ ] **Anti-detecção IA**: Textos ainda têm padrão genérico ("O amor é um conceito multifacetado...")

### Blocked
- [ ] Sem bloqueadores críticos

## Next Move
1. **Melhorar prompts de geração** para incluir explicitamente: objetivos, problema de pesquisa, metodologia, discussão — não só introdução/conclusão
2. **Aumentar palavra-alvo por capítulo** (atualmente ~220/pág × pags ÷ caps = pouco conteúdo)
3. **Adicionar etapa de "melhoria de profundidade"** no editor conversacional (botão dedicado para expandir conteúdo superficial)
4. **Testar auditoria académica** com documentos reais e verificar se detecção de citações funciona corretamente
5. **Considerar "Academic Quality Engine"** sugerido pela avaliação: pipeline de verificação pré-PDF com checklist obrigatório

## Relevant Files
- `js/layout.js` — `gerarJanelaPDF()` (inline viewer), `cssPDF()` (com `@media print` e tema dinâmico), `docEstruturarSemantico()` (referências automáticas, data_table), `preRenderFixOrphans()` (anti-órfãos), `linhasBloco()` (inclui `data_table`), `layoutHtmlBloco()` (trata `data_table` raw)
- `js/export.js` — `_expPDFExecutar()` (chama `gerarJanelaPDF` + ajuste de páginas), `refGateExportacao()`, `regenerarReferenciasCorretas()`
- `js/generator.js` — `iniciarGer()` (loop principal), `DOC_MEMORY` (extração de autores citados), `verificarQualidadeAcademica()` (auditoria), `regenerarReferenciasCorretas()`
- `api/engine.js` — `doReferencias()` (agora usa `autoresCitados` do payload)
- `academic/prompts/references.js` — `montarPromptReferencias()` (recebe lista de autores citados, instrui IA a incluí-los)
- `js/academic-ui.js` — `analisarDocumento()` (corrigido: agora usa `fetch(ACADEMY_ENGINE_URL)`)
- `js/chat.js` — `abrirEditorConversacional()`, `_ecEnviarPedido()` (agora edita TUDO: metadados, capa, capítulos)
- `sw.js` — `CACHE = 'academy-v104'`
