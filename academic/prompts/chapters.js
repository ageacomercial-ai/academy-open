import { gerarInstrucaoAntiIA, gerarInstrucaoGeo } from './system.js';
import { isStrict } from '../policies/integrity.js';

/* ── Abordagens analíticas (rotação) ── */
export const ABORDAGENS = [
  `Abordagem histórico-crítica: traça a evolução do conceito com datas concretas, questiona a narrativa dominante, propõe leitura alternativa fundamentada.`,
  `Abordagem teórico-comparativa: confronta pelo menos 2 perspectivas teóricas divergentes, posiciona o argumento, aplica ao contexto do tema com dados específicos.`,
  `Abordagem empírico-analítica: parte de dados quantitativos verificáveis, analisa causas e efeitos, não se limita a descrever — interpreta e questiona.`,
  `Abordagem crítico-reflexiva: identifica contradições ou tensões no tema, examina limitações das abordagens existentes, propõe síntese fundamentada.`,
  `Abordagem prospectiva-propositiva: analisa o estado actual com rigor, identifica lacunas e desafios estruturais, formula recomendações concretas.`,
];

export function escolherAbordagem(capNum) {
  return ABORDAGENS[(capNum - 1) % 5];
}

/* ── Montar prompt principal do capítulo ── */
export function montarPromptCapitulo({
  tema, tipo, nivel, inst, prof, area,
  capNum, capTit, totalCaps, totalPags, capSubs,
  nivelKey, areaKey, pNivel, pArea, geoCtx, escopo, fontesContexto,
  palavras, subs, maxTok, instrucaoSubtitulos,
}) {
  const geoInstrucao = escopo ? `Escopo: ${JSON.stringify({global_scope: escopo.global_scope, geographic_scope: escopo.geographic_scope, platform_scope: escopo.platform_scope})}. ${gerarInstrucaoGeo(tema, null, geoCtx)}` : gerarInstrucaoGeo(tema, null, geoCtx);
  const abordagemAnalitica = escolherAbordagem(capNum);

  const isFirstChapter = capNum === 1;
  const isLastChapter = capNum === totalCaps;
  const strictBlock = isStrict() ? `
═══ MODO STRICT — INTEGRIDADE ACADÊMICA (NÃO NEGOCIÁVEL) ═══
Nunca invente: autores, livros, artigos, DOI, URL, instituições, pesquisas, questionários, entrevistados, amostra, percentagens, estatísticas, resultados, datas de coleta, tabelas, gráficos, referências.
Se não tiver fonte verificável: NÃO FABRICAR. Em vez disso:
1) Reformule sem atribuição, ou 2) Marque [CITAÇÃO A VERIFICAR] / [DADO NÃO VERIFICADO] / [RESULTADO SEM DATASET], ou 3) Escreva "Não foi encontrada fonte verificável suficiente para confirmar".
Não crie DOI/URL. Não atribua estatística a INE/Banco Mundial/OMS sem publicação verificada. Não transforme fonte semelhante em exata.
Preferir admitir falta a inventar é OBRIGATÓRIO e será auditado.
` : '';

  const prompt = `${strictBlock}És um professor universitário especialista em ${pArea.label} a escrever o Capítulo ${capNum} de um ${tipo} de nível ${nivel} sobre "${tema}".
${inst ? `\nInstituição: ${inst}` : ''}${prof ? `\nOrientador: ${prof}` : ''}${area ? `\nÁrea do curso: ${area}` : ''}

CAPÍTULO: ${capNum}. ${capTit}

SUBTÓPICOS OBRIGATÓRIOS (usa esta numeração exacta, cada um em linha própria):
${subs}

ABORDAGEM ANALÍTICA OBRIGATÓRIA:
${abordagemAnalitica}
${fontesContexto || ''}

═══ ESTRUTURA ACADÉMICA OBRIGATÓRIA ═══
${isFirstChapter ? `Este é o PRIMEIRO CAPÍTULO (Introdução). DEVE incluir obrigatoriamente:
- 1.1 Contextualização do tema (2-3 parágrafos)
- 1.2 Problema de pesquisa (1-2 parágrafos com questão/problemática concreta)
- 1.3 Objectivos geral e específicos (listar explicitamente)
- 1.4 Justificativa da pesquisa (por que este tema é relevante)
- 1.5 Metodologia resumida (abordagem utilizada)
` : ''}${isLastChapter ? `Este é o ÚLTIMO CAPÍTULO (Conclusão). DEVE incluir obrigatoriamente:
- Síntese das principais descobertas por capítulo
- Resposta explícita ao problema de pesquisa
- Confirmação ou rejeição da hipótese
- Recomendações concretas e específicas
- Limitações do estudo e sugestões para futuras investigações
` : ''}${!isFirstChapter && !isLastChapter ? `Cada parágrafo DEVE conter:
- Afirmação clara com dados verificáveis
- Análise crítica (não apenas descrição)
- Comparação de perspectivas (mínimo 2 autores)
- Aplicação ao contexto do tema
` : ''}

═══ REGRA 1 — CITAÇÕES: FONTE ÚNICA DE VERDADE ═══
- NUNCA inventes um nome de autor + ano dentro do corpo do texto sem que essa mesma referência exista, com dados completos e coerentes, na secção de Bibliografia.
- Mantém internamente uma LISTA VIVA de citações à medida que escreves. Cada vez que citares "Autor (Ano)" no corpo, adiciona (ou reutiliza) a entrada correspondente nessa lista.
- No final, a secção "Referências Bibliográficas" deve ser gerada A PARTIR DESSA LISTA, não escrita de forma independente. Não é permitido existirem citações no texto sem entrada na bibliografia, nem entradas na bibliografia que nunca foram citadas no corpo.
- Se não tiveres uma fonte real e verificável, tens duas opções — NUNCA inventes a fonte:
  1. Reformula a frase como afirmação geral, sem atribuição a autor específico; ou
  2. Sinaliza explicitamente com [CITAÇÃO A VERIFICAR] para o utilizador substituir por uma fonte real.
 - Limite de densidade: no máximo 1 citação nova a cada 2–3 frases. Texto sobrecarregado de citações por parágrafo é sinal de preenchimento artificial, não de rigor.
 - REGRA: cada parágrafo factual com SOURCE_ID verificado deve ter 1-2 citações; parágrafos interpretativos podem ter 0 e devem ser identificados como interpretação.

═══ REGRA 2 — DADOS E ESTATÍSTICAS: NUNCA FABRICAR NÚMEROS ═══
- Não apresentes números específicos (percentagens, toneladas, valores monetários, taxas de crescimento) como se fossem factos verificados, a menos que:
  a) tenhas acesso a uma fonte real, ou
  b) o utilizador os tenha fornecido.
- Se precisares de um número para ilustrar um argumento e não tiveres fonte, usa linguagem qualificada: "estima-se que...", "segundo projeções gerais...", e marca com [DADO A VERIFICAR COM FONTE PRIMÁRIA].
- NUNCA atribuas um número inventado a uma instituição real (Banco Mundial, INE, ONU, KPMG, etc.). Isso constitui uma citação falsa atribuída a uma entidade real — é mais grave do que um dado genérico inventado.

═══ REGRA 3 — NUNCA ENTREGAR SECÇÕES CORTADAS ═══
- Antes de finalizar, percorre cada secção e confirma que:
  - Nenhuma frase termina a meio (ex: "Decreto Legislativo Presidencial n.").
  - Nenhum número está partido (ex: "50. 000" em vez de "50.000").
  - Todas as secções prometidas no índice foram efectivamente desenvolvidas.
- Se o limite de tokens for atingido antes de completar, é preferível REDUZIR o número de secções desenvolvidas em profundidade do que entregar secções truncadas a meio da frase.

═══ REGRA 4 — VARIAR A ESTRUTURA INTERNA ═══
- NÃO repitas em todas as secções o mesmo molde rígido (Contextualização → Desenvolvimento → Dados e Análise → Análise Crítica → Síntese).
- Varia: ordem dos elementos, tamanho dos parágrafos, forma de introduzir dados (às vezes no início, às vezes a meio do argumento), transições entre ideias.
- Cada secção deve ler-se como progressão de um argumento humano, não como preenchimento de uma grelha fixa.
- RÓTULOS VISÍVEIS: cada bloco DEVE ter um mini-cabeçalho visível (ex: **Contextualização:**, **Desenvolvimento:**) a negrito, para identificação rápida da estrutura.

═══ REGRAS DE CITAÇÃO — FORMATO EXACTO ═══
Cada parágrafo factual DEVE conter citação explícita (Autor, Ano) SOMENTE se houver SOURCE_ID verificado no bloco FONTES acima. Se sem fonte, NÃO inventar — escrever como interpretação qualificada ou marcar [CITAÇÃO A VERIFICAR].
Exemplo correcto COM FONTE: "Segundo Santos (2020) — SOURCE_ID:doi:10.xxxx — o turismo cresceu, evidência abstract: ..." 
Exemplo correcto SEM FONTE: "Estima-se que o turismo tenha relevância económica, mas não foi encontrada fonte verificável para quantificar [CITAÇÃO A VERIFICAR]."
NUNCA uses percentagem inventada atribuída a INE/Banco Mundial/OMS. Cada parágrafo: 3-5 frases.

═══ REGRA 5 — FUNÇÃO POR SUBTÓPICO (ANTI-REPETIÇÃO) ═══
Cada subtópico tem FUNÇÃO distinta definida pelos seus TÍTULO e POSIÇÃO no capítulo — não repitas "A literatura indica que X é dimensão central" em todos.
Estrutura por subtópico (escolhe 2-3 elementos, ordem variável): tese, evidência com SOURCE_ID, contraponto, dado concreto só com fonte, implicação, limite, recomendação.
Diversifica conectores e extensão (3 vs 6 frases). Se dois subtópicos ficarem >0.82 similaridade Jaccard, regenerar o segundo.
NUNCA usar template fixo Contextualização→Desenvolvimento→Dados→Análise em todos.

NÍVEL ACADÉMICO — ${nivelKey.toUpperCase()}:
${pNivel.profundidade}

CITAÇÕES POR NÍVEL:
${pNivel.citacoes}

${pArea.instrucoes}

FORMATAÇÃO OBRIGATÓRIA:
- Português formal académico, SEM aspas a envolver parágrafos inteiros
- Cada parágrafo: 3-5 frases completas, sem bullets
- NÃO uses markdown (***, **, *, acentos graves) dentro dos parágrafos
${instrucaoSubtitulos ? '\n' + instrucaoSubtitulos : ''}
${gerarInstrucaoAntiIA(capNum, totalCaps, geoInstrucao, pArea.label)}`;

  return prompt;
}

/* ── Prompt AST (JSON output) ── */
export function montarPromptAST(capNum, capTit, palavras) {
  return `

FORMA DE SAÍDA — JSON:
Não escrevas texto. Gera APENAS o JSON abaixo (sem \`\`\`, sem markdown, sem texto adicional):
{"chapter_id":"${capNum}","title":"${capTit}","sections":[{"section_id":"${capNum}.1","title":"Primeiro subtópico","paragraphs":["Parágrafo 1.","Parágrafo 2.","Parágrafo 3."]}],"total_paragraphs":${Math.max(3, Math.round(palavras / 90))}}
⚠ LIMITE: ~${palavras} palavras no total, divididas pelos parágrafos.
Cada parágrafo é uma string completa de texto corrido, sem formatação.
Mínimo 3 parágrafos por secção.`;
}

/* ── Prompt simplificado (retry) ── */
export function montarPromptRetry(capNum, capTit, tema, capSubs, palavrasAlvo = 400) {
  return `Gera APENAS JSON para o capítulo ${capNum} "${capTit}" sobre "${tema}".
Subtópicos: ${capSubs.join('; ')}
JSON (sem markdown, sem texto):
{"chapter_id":"${capNum}","title":"${capTit}","sections":[{"section_id":"${capNum}.1","title":"${capSubs[0]||'Introdução'}","paragraphs":["Parágrafo 1.","Parágrafo 2.","Parágrafo 3."]}],"total_paragraphs":${Math.max(3, Math.round(palavrasAlvo / 90))}}
REGRAS CRÍTICAS:
- Português formal académico, SEM aspas a envolver parágrafos inteiros.
- CADA parágrafo deve ter 1 citação (Autor, Ano) quando apropriado. Mínimo 3 parágrafos por secção.
- NUNCA inventes autores — usa [CITAÇÃO A VERIFICAR] se não tiveres fonte real.
- NUNCA atribuas números inventados a instituições reais (Banco Mundial, INE, ONU).
- Não entregues secções truncadas — reduz o número de secções se necessário.
- Varia a estrutura interna entre secções (não repitas o mesmo molde).`;
}
