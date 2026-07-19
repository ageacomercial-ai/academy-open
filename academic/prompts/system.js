/* academic/prompts/system.js
   Perfis, contexto geográfico, anti-IA — partilhado entre frontend e backend
============================================================================= */

/* ── Perfis por nível académico ── */
export const PERFIL_NIVEL = {
  'ensino médio': {
    profundidade: `Linguagem clara para estudantes 14-18 anos. Conceitos desde o básico. Para Ciências: fórmulas básicas com cada variável explicada. Exemplos reconhecíveis do contexto do tema. 3-4 parágrafos densos por subtópico.`,
    citacoes: `2-3 citações por subtópico formato (Apelido, Ano). Exemplo: "Segundo Cardoso (2019),..." ou "...processo fundamental (Lima & Santos, 2020)." OBRIGATÓRIO: pelo menos 1 citação em CADA parágrafo principal.`,
    refs_min: 8, refs_africanos: 2,
  },
  licenciatura: {
    profundidade: `Nível universitário 1º ciclo. Rigor conceptual. Análise crítica: comparar perspectivas de pelo menos 2 autores. Dados estatísticos e factos verificáveis com anos e instituições (contexto do tema). 4-5 parágrafos densos por subtópico.`,
    citacoes: `2-3 citações por subtópico. Exemplos: "De acordo com Ferreira (2021),..." / "(Neto, 2019; Costa, 2022)." / "Silva (2020, p.45) argumenta que..." OBRIGATÓRIO: pelo menos 1 citação em CADA parágrafo principal, não apenas no fim.`,
    refs_min: 10, refs_africanos: 3,
  },
  mestrado: {
    profundidade: `Pós-graduação. Confrontar teorias, identificar lacunas. Síntese original com voz argumentativa. OBRIGATÓRIO: pelo menos 1 tensão teórica por subtópico (Autor A defende X, Autor B argumenta Y). 5-7 parágrafos de alta densidade por subtópico.`,
    citacoes: `3-4 citações por subtópico, directas e indirectas alternadas. Citação directa: Segundo Lopes (2018, p.112), "a gestão estratégica implica..." Citação indirecta: (Banda, 2020; Kiala & Mabiala, 2021). OBRIGATÓRIO: 1 tensão teórica por subtópico.`,
    refs_min: 12, refs_africanos: 4,
  },
  doutoramento: {
    profundidade: `Investigação original. Mapear estado da arte, propor contribuição nova. Posicionamento epistemológico. Obras seminais + investigação recente (últimos 5 anos). OBRIGATÓRIO: identificar lacuna na literatura por subtópico. 6-8 parágrafos de alta densidade.`,
    citacoes: `4-6 citações por subtópico. Obras fundacionais E investigação recente. Exemplo: "A teoria de Bourdieu (1980) foi revisitada por Mabiala (2019), que argumenta..." OBRIGATÓRIO: lacuna na literatura por subtópico.`,
    refs_min: 15, refs_africanos: 5,
  },
};

/* ── Perfis por área ── */
export const PERFIL_AREA = {
  ciencias: {
    label: 'Ciências Naturais/Exactas',
    instrucoes: `ÁREA Ciências (Física, Química, Biologia, Matemática, Geologia):
- OBRIGATÓRIO para subtópicos quantitativos: fórmulas com notação correcta e variáveis explicadas
- Unidades de medida SI sempre que relevante
- Fenómenos observáveis relevantes ao tema
- Referências: Nature, Science, African Journal of Science
- PROIBIDO: referências de ciências sociais ou gestão sem nexo científico`,
  },
  humanidades: {
    label: 'Humanidades e Ciências Sociais',
    instrucoes: `ÁREA Humanidades (História, Filosofia, Literatura, Sociologia, Comunicação):
- Perspectiva histórica com datas e actores concretos do contexto
- Factos históricos verificáveis com anos e fontes
- Teorias sociais aplicadas ao contexto do tema
- Referências: revistas de ciências sociais, história africana, estudos lusófonos
- PROIBIDO: referências de engenharia ou saúde clínica`,
  },
  gestao: {
    label: 'Gestão e Economia',
    instrucoes: `ÁREA Gestão, Economia, Administração, Finanças, Marketing:
- Indicadores económicos verificáveis com anos e fontes
- Dados quantitativos com fontes e anos verificáveis
- Modelos de gestão: SWOT, Porter, Balanced Scorecard quando pertinente
- Exemplos de empresas e sectores relevantes ao tema
- Referências de revistas académicas reconhecidas na área
- PROIBIDO: referências de saúde, ciências naturais ou direito sem nexo`,
  },
  direito: {
    label: 'Direito e Ciências Jurídicas',
    instrucoes: `ÁREA Direito (Constitucional, Penal, Civil, Comercial, Administrativo):
- Citar artigos de lei relevantes com número e ano
- Legislação relevante ao tema
- Jurisprudência aplicável ao tema
- Referências jurídicas académicas reconhecidas
- PROIBIDO: referências de gestão, saúde ou engenharia sem nexo jurídico`,
  },
  saude: {
    label: 'Saúde e Ciências da Vida',
    instrucoes: `ÁREA Saúde (Medicina, Enfermagem, Farmácia, Saúde Pública, Nutrição):
- Dados epidemiológicos relevantes ao tema com fontes (OMS, estudos peer-reviewed)
- Dados MINSA/OMS com anos e províncias: "Segundo MINSA (2022), a mortalidade infantil..."
- Protocolos clínicos ou guidelines OMS quando pertinente
- Nomenclatura médica correcta com equivalente comum na primeira ocorrência
- Referências: Lancet, NEJM, revistas africanas de saúde, publicações MINSA/OMS
- PROIBIDO: referências de gestão empresarial ou direito sem nexo clínico`,
  },
  engenharia: {
    label: 'Engenharia e Tecnologia',
    instrucoes: `ÁREA Engenharia (Civil, Informática, Eléctrica, Mecânica, Petrolífera, TIC):
- OBRIGATÓRIO: especificações numéricas, normas técnicas (ISO, IEEE), unidades
- Dados técnicos e infra-estruturas relevantes ao tema
- Exemplos de empresas e sectores relevantes ao tema
- IEEE, ASME, revistas de engenharia internacionais reconhecidas
- PROIBIDO: referências de humanidades ou direito sem nexo tecnológico`,
  },
};

/* ── Detectores ── */
export function detectarNivel(n) {
  const s = (n||'').toLowerCase();
  if (/médio|secundário|12\.º|11\.º|10\.º|\b12\b|\b11\b|\b10\b/.test(s)) return 'ensino médio';
  if (/mestrado|2\.º ciclo|pós.grad/.test(s)) return 'mestrado';
  if (/doutoramento|doutorado|phd|3\.º ciclo/.test(s)) return 'doutoramento';
  return 'licenciatura';
}

export function detectarArea(tema, areaParam) {
  if (areaParam && PERFIL_AREA[areaParam.toLowerCase()]) return areaParam.toLowerCase();
  const t = (tema||'').toLowerCase();
  if (/física|química|biologia|matemática|geologia|ecologia|botânica|astronomia/.test(t)) return 'ciencias';
  if (/direito|lei\b|jurídic|constitucional|penal|civil|comercial|legisl|tribunal/.test(t)) return 'direito';
  if (/saúde|médic|enfermagem|farmáci|hospital|doença|paludismo|nutrição|clínic/.test(t)) return 'saude';
  if (/gestão|economia|finanças|marketing|contabilidade|administração|empresa|negócio|empreendedorismo/.test(t)) return 'gestao';
  if (/engenharia|informática|software|hardware|eléctric|mecânic|construção|telecomunic|tic\b/.test(t)) return 'engenharia';
  return 'humanidades';
}

export function detectarContextoGeo(tema, pais) {
  const t = (tema||'').toLowerCase();
  const p = (pais||'').toLowerCase();
  if (/angola|luanda|benguela|huambo|cabinda|namibe|malanje/.test(t)) return 'angola';
  if (/cabo.?verde|mindelo|praia|fogo|sal\b|barlavento/.test(t)) return 'cabo_verde';
  if (/moçambique|mozambique|maputo|beira\b|nampula/.test(t)) return 'mocambique';
  if (/brasil|são paulo|rio de janeiro|brasília|nordeste/.test(t)) return 'brasil';
  if (/portugal|lisboa|porto\b|coimbra|algarve/.test(t)) return 'portugal';
  if (/africa do sul|joanesburgo|cape town|pretória/.test(t)) return 'africa_sul';
  if (/estados unidos|eua|usa|new york|washington|california/.test(t)) return 'eua';
  if (/europa|ue\b|união europeia|berlim|paris|madrid|roma\b/.test(t)) return 'europa';
  if (/china|beijing|xangai|asia\b|japão|índia/.test(t)) return 'asia';
  if (/africa\b|africano|subsaariana|continente africano/.test(t)) return 'africa_geral';
  if (p && p !== 'angola') return p;
  if (p === 'angola') return 'angola';
  return 'global';
}

/* ── Pools anti-IA ── */
export const POOLS_ANTI_IA = {
  exemplos: [
    'A investigação académica demonstra que',
    'No contexto em análise,',
    'Num cenário concreto verificável,',
    'Os dados de campo indicam que',
    'A evidência empírica revela que',
    'Tomando como caso ilustrativo',
    'A evidência empírica mostra que',
    'Num contexto prático verificável,',
    'A análise do caso em estudo revela',
    'Os indicadores disponíveis mostram que',
    'O tema em análise ilustra bem',
    'Verificando os dados disponíveis,',
  ],
  hipoteses: [
    'A tese central deste trabalho é que',
    'A análise conduz à conclusão de que',
    'Os dados permitem inferir que',
    'A investigação aponta para o facto de que',
    'O exame crítico da literatura revela que',
    'A posição defendida neste estudo é que',
    'A leitura dos factos sugere que',
    'A evidência disponível indica que',
  ],
  conclusoes: [
    'A análise evidencia, portanto, que',
    'Os dados apresentados confirmam que',
    'O exame crítico demonstra que',
    'A síntese dos argumentos aponta para',
    'O quadro analítico traçado revela que',
    'A investigação permite concluir que',
    'Os elementos reunidos sustentam que',
    'O percurso argumentativo culmina em',
  ],
  transicoes: [
    'Aprofundando esta perspectiva,',
    'A análise revela ainda que',
    'Numa leitura mais crítica,',
    'Articulando com o argumento anterior,',
    'A dimensão analítica exige reconhecer que',
    'Complementando a perspectiva teórica,',
    'O debate académico evidencia que',
    'A revisão da literatura aponta que',
  ],
  conectores_proibidos: [
    'Cumpre referir que','Importa sublinhar que','Convém notar que',
    'Vale a pena salientar que','É relevante destacar que',
    'Neste sentido,','Neste quadro,','A este respeito,',
    'Do exposto decorre que','Perante o analisado,',
  ],
};

/* ── Instruções anti-IA (única fonte de verdade — frontend e backend) ── */
export function gerarInstrucaoAntiIA(capNum, totalCaps, geoInstrucao) {
  const n = Math.max(0, (capNum||1) - 1);
  const pick = (arr, s) => arr[(n*7 + s*3) % arr.length];
  const pools = POOLS_ANTI_IA;
  const fase = !totalCaps||totalCaps<=1 ? 'análise' :
    (n/(totalCaps-1))<=0.1 ? 'introdução' :
    (n/(totalCaps-1))<=0.35 ? 'fundamentação teórica' :
    (n/(totalCaps-1))<=0.65 ? 'análise crítica' :
    (n/(totalCaps-1))<=0.88 ? 'síntese' : 'conclusão';
  const proibidos = pools.conectores_proibidos.slice(0,4).join('", "');
  return `REGRAS DE ESTILO OBRIGATÓRIAS — APLICAR RIGOROSAMENTE:

TOM E VOZ:
1. Escreve com VOZ ANALÍTICA — não apenas descrever conceitos, mas comparar, questionar, posicionar
2. Cada subtópico deve incluir: (a) posição teórica, (b) contraponto ou limitação, (c) aplicação ao contexto do tema
3. PROIBIDO usar estes conectores mecânicos que revelam texto IA: "${proibidos}"
4. PROIBIDO iniciar dois parágrafos consecutivos com a mesma palavra ou estrutura
5. Para exemplos usa: "${pick(pools.exemplos,1)}" — nunca a mesma expressão duas vezes no mesmo capítulo
6. Para hipótese/posição usa: "${pick(pools.hipoteses,2)}"
7. Para concluir usa: "${pick(pools.conclusoes,3)}"
8. Para transições usa: "${pick(pools.transicoes,4)}"

CITAÇÕES — OBRIGATÓRIO:
9. Cada dado estatístico DEVE ter citação inline: (Autor, Ano) ou (Instituição, Ano)
10. Não escrever "segundo dados do INE" sem especificar o ano: "segundo INE (2023)"
11. Mínimo 2 citações por parágrafo de desenvolvimento — integradas no argumento, não no fim

CONTEXTO GEOGRÁFICO: ${geoInstrucao}

POSIÇÃO NO DOCUMENTO: ${fase} — adequa profundidade analítica`;
}

/* ── Contexto geográfico ── */
export function gerarInstrucaoGeo(tema, pais, geoCtx) {
  const ctx = geoCtx || detectarContextoGeo(tema, pais);
  if (ctx === 'angola') return 'O tema refere-se especificamente a Angola. Quando relevante, usa dados angolanos com fonte e ano.';
  if (ctx === 'cabo_verde') return 'O tema refere-se a Cabo Verde. Usa referências cabo-verdianas quando relevante.';
  return 'Trata o tema de forma universal e académica. NÃO faças referência a Angola, Brasil, Portugal ou qualquer país específico a não ser que o tema o exija explicitamente. Usa fontes académicas internacionais.';
}
