import { gerarInstrucaoAntiIA, gerarInstrucaoGeo } from './system.js';

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
  nivelKey, areaKey, pNivel, pArea, geoCtx,
  palavras, subs, maxTok, instrucaoSubtitulos,
}) {
  const geoInstrucao = gerarInstrucaoGeo(tema, null, geoCtx);
  const abordagemAnalitica = escolherAbordagem(capNum);

  const prompt = `És um professor universitário especialista em ${pArea.label} a escrever o Capítulo ${capNum} de um ${tipo} de nível ${nivel} sobre "${tema}".
${inst ? `\nInstituição: ${inst}` : ''}${prof ? `\nOrientador: ${prof}` : ''}${area ? `\nÁrea do curso: ${area}` : ''}

CAPÍTULO: ${capNum}. ${capTit}

SUBTÓPICOS OBRIGATÓRIOS (usa esta numeração exacta, cada um em linha própria):
${subs}

ABORDAGEM ANALÍTICA OBRIGATÓRIA:
${abordagemAnalitica}

ESTRUTURA DE CADA SUBTÓPICO (nesta ordem exacta, com RÓTULOS VISÍVEIS):
1. 「Contextualização」— contextualização teórica com pelo menos 1 citação (Autor, Ano)
2. 「Desenvolvimento」— desenvolvimento analítico, confrontar perspectivas, não apenas descrever
3. 「Dados e Análise」— dado quantitativo verificável com fonte e ano (ex: "Segundo [Fonte], em [Ano], X registou Y")
4. 「Análise Crítica」— análise crítica do dado — o que significa para o tema?
5. 「Síntese」— síntese argumentativa — qual é a posição do autor?

⚠ IMPORTANTE: Cada bloco DEVE começar com o seu rótulo visível (ex: **Contextualização:**, **Desenvolvimento:**, **Dados e Análise:**, **Análise Crítica:**, **Síntese:**) a negrito, como mini-cabeçalho dentro do parágrafo, para que um leitor consiga identificar rapidamente a estrutura.

NÍVEL ACADÉMICO — ${nivelKey.toUpperCase()}:
${pNivel.profundidade}

CITAÇÕES OBRIGATÓRIAS:
${pNivel.citacoes}

REGRAS DE CITAÇÃO — SEGUE EXACTAMENTE ESTE EXEMPLO:
Cada parágrafo DEVE conter pelo menos 1 citação explícita no formato (Autor, Ano) ou "Autor (Ano) afirma que...".
Exemplo correcto: "Segundo Santos (2020), o turismo em Angola cresceu 15% entre 2018 e 2023, contribuindo com 3.2% para o PIB nacional (INE, 2024)."
Exemplo INCORRECTO: "Estudos indicam que o turismo é importante para a economia." (genérico, sem citação)
As citações no corpo DEVEM corresponder a autores que constam das referências finais.
NUNCA uses "estudos indicam", "investigações mostram", "pesquisas revelam" ou expressões genéricas — diz sempre QUAL estudo/Autor.
Cada parágrafo: 3-5 frases, com dados concretos (percentagens, anos, instituições).

${pArea.instrucoes}

FORMATAÇÃO OBRIGATÓRIA:
- Português formal académico, SEM aspas a envolver parágrafos inteiros
- Cada parágrafo: 3-5 frases completas, sem bullets
- NÃO uses markdown (***, **, *, acentos graves) dentro dos parágrafos
${instrucaoSubtitulos ? '\n' + instrucaoSubtitulos : ''}
${gerarInstrucaoAntiIA(capNum, totalCaps, geoInstrucao)}`;

  return prompt;
}

/* ── Prompt AST (JSON output) ── */
export function montarPromptAST(capNum, capTit, palavras) {
  return `

FORMA DE SAÍDA — JSON:
Não escrevas texto. Gera APENAS o JSON abaixo (sem \`\`\`, sem markdown, sem texto adicional):
{"chapter_id":"${capNum}","title":"${capTit}","sections":[{"section_id":"${capNum}.1","title":"Primeiro subtópico","paragraphs":["Parágrafo 1.","Parágrafo 2.","Parágrafo 3."]}],"total_paragraphs":${palavras}}
⚠ LIMITE: ~${palavras} palavras no total, divididas pelos parágrafos.
Cada parágrafo é uma string completa de texto corrido, sem formatação.
Mínimo 3 parágrafos por secção.`;
}

/* ── Prompt simplificado (retry) ── */
export function montarPromptRetry(capNum, capTit, tema, capSubs) {
  return `Gera APENAS JSON para o capítulo ${capNum} "${capTit}" sobre "${tema}".
Subtópicos: ${capSubs.join('; ')}
JSON (sem markdown, sem texto):
{"chapter_id":"${capNum}","title":"${capTit}","sections":[{"section_id":"${capNum}.1","title":"${capSubs[0]||'Introdução'}","paragraphs":["Parágrafo 1.","Parágrafo 2.","Parágrafo 3."]}]}
Português formal académico, SEM aspas a envolver parágrafos inteiros.
CADA parágrafo DEVE conter 1 citação explícita (Autor, Ano). Mínimo 3 parágrafos por secção.`;
}
