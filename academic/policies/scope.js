/* academic/policies/scope.js
   PLATFORM_SCOPE = GLOBAL — escopo determinado pelo trabalho, nunca pela plataforma
============================================================================= */

export const PLATFORM_SCOPE = 'GLOBAL';

/* ── Mapa de países/territórios detectáveis ── */
const MAPA_GEO = [
  { id: 'angola', re: /angola|luanda|benguela|huambo|cabinda|namibe|malanje|hu[ií]la|u[ií]ge|lunda/i, label: 'Angola' },
  { id: 'brasil', re: /brasil|brazil|s[aã]o paulo|rio de janeiro|bras[ií]lia|nordeste|sudeste/i, label: 'Brasil' },
  { id: 'portugal', re: /portugal|lisboa|porto\b|coimbra|algarve|aveiro/i, label: 'Portugal' },
  { id: 'mocambique', re: /mo[cç]ambique|mozambique|maputo|beira\b|nampula/i, label: 'Moçambique' },
  { id: 'cabo_verde', re: /cabo.?verde|mindelo|praia|fogo|sal\b|barlavento/i, label: 'Cabo Verde' },
  { id: 'guine_bissau', re: /guin[eé].*bissau/i, label: 'Guiné-Bissau' },
  { id: 'sao_tome', re: /s[aã]o tom[eé]/i, label: 'São Tomé e Príncipe' },
  { id: 'eua', re: /estados unidos|eua\b|usa\b|america\b.*norte|new york|washington|california|texas/i, label: 'EUA' },
  { id: 'reino_unido', re: /reino unido|inglaterra|uk\b|londres/i, label: 'Reino Unido' },
  { id: 'espanha', re: /espanha|madrid|barcelona/i, label: 'Espanha' },
  { id: 'franca', re: /fran[cç]a|paris/i, label: 'França' },
  { id: 'alemanha', re: /alemanha|berlim/i, label: 'Alemanha' },
  { id: 'china', re: /\bchina|beijing|pequim|xangai/i, label: 'China' },
  { id: 'japao', re: /jap[aã]o|t[oó]quio/i, label: 'Japão' },
  { id: 'india', re: /\bíndia\b|nova delhi/i, label: 'Índia' },
  { id: 'africa_sul', re: /africa do sul|joanesburgo|cape town|pret[oó]ria/i, label: 'África do Sul' },
  { id: 'africa', re: /\b[aá]frica\b|africano|subsariana/i, label: 'África' },
  { id: 'europa', re: /\beuropa|uni[aã]o europeia|ue\b/i, label: 'Europa' },
  { id: 'america_latina', re: /am[eé]rica latina|latino/i, label: 'América Latina' },
  { id: 'asia', re: /\b[aá]sia\b|asi[aá]tico/i, label: 'Ásia' },
  { id: 'global', re: /\bmundial|global|internacional|multicontinental|worldwide/i, label: 'Global' },
];

const MAPA_DISCIPLINA = [
  { id: 'gestao', re: /gest[aã]o|empreendedorismo|neg[oó]cio|marketing|economia|finan[cç]as/i, label: 'Gestão' },
  { id: 'saude', re: /sa[uú]de|m[eé]dic|enfermagem|hospital|doen[cç]a|cl[ií]nic/i, label: 'Saúde' },
  { id: 'engenharia', re: /engenharia|inform[aá]tica|software|tic\b|tecnologia/i, label: 'Engenharia' },
  { id: 'direito', re: /direito|jur[ií]dic|lei\b|tribunal/i, label: 'Direito' },
  { id: 'educacao', re: /educa[cç][aã]o|ensino|pedagogia|escola|universidade/i, label: 'Educação' },
  { id: 'ciencias', re: /f[ií]sica|qu[ií]mica|biologia|matem[aá]tica/i, label: 'Ciências' },
];

/* ── Determinar escopo a partir do trabalho (nunca da plataforma) ── */
export function determinarEscopo({ tema = '', objetivos = [], problema = '', populacao = '', disciplina = '' } = {}) {
  const texto = [tema, problema, ...(Array.isArray(objetivos) ? objetivos : [objetivos]), populacao, disciplina].join(' ').toLowerCase();

  const geographic_scope = [];
  for (const g of MAPA_GEO) {
    if (g.re.test(texto)) geographic_scope.push(g.id);
  }
  // Se menciona "global/mundial" explicitamente, limpar e marcar global
  const global_scope = geographic_scope.includes('global') || geographic_scope.length === 0;
  // Se global_scope true e não menciona país específico, geographic_scope fica []
  // Se menciona país, global_scope continua true mas geographic_scope indica foco
  // Ex: "IA nas empresas angolanas" → geographic_scope=[angola], global_scope=false? Não, global_scope=true mas com foco Angola
  // Para manter compat: global_scope = geographic_scope.length===0 || geographic_scope.includes('global')
  const isGlobal = geographic_scope.length === 0 || geographic_scope.includes('global');
  const geoFinal = geographic_scope.filter(g => g !== 'global');

  const discipline_scope = [];
  for (const d of MAPA_DISCIPLINA) if (d.re.test(texto)) discipline_scope.push(d.id);

  const topic_scope = [tema.substring(0, 80).trim()].filter(Boolean);

  return {
    platform_scope: PLATFORM_SCOPE, // sempre GLOBAL
    global_scope: isGlobal,
    geographic_scope: geoFinal, // [] = global, ['angola'] = foco Angola mas fontes podem ser globais
    topic_scope,
    population_scope: populacao ? [populacao.substring(0, 60)] : [],
    time_scope: [],
    discipline_scope,
    // Compat legada: string única para prompts antigos
    geoCtx: geoFinal[0] || (isGlobal ? 'global' : 'global'),
  };
}

/* ── Hierarquia de fontes L1→L4 ── */
export const HIERARQUIA_FONTES = {
  L1_PRIMARIAS: ['JOURNAL_ARTICLE','BOOK','THESIS','CONFERENCE'], // artigos, teses, livros
  L2_INTERNACIONAIS: ['INTERNATIONAL_ORGANIZATION','STATISTICAL_DATABASE'], // WB/UN/UNESCO/WHO/ITU/OECD
  L3_NACIONAIS: ['OFFICIAL_GOVERNMENT','REPORT'], // INE, ministérios
  L4_OUTRAS: ['WEBSITE'],
};

export function escolherNivelFonte(claimEscopo, claimTipo) {
  // Claim global → prioriza L1+L2
  // Claim sobre país específico → L3 permitido se claim menciona país
  if (claimTipo === 'OFFICIAL_STATISTIC') return ['L2_INTERNACIONAIS','L3_NACIONAIS','L1_PRIMARIAS'];
  return ['L1_PRIMARIAS','L2_INTERNACIONAIS','L3_NACIONAIS','L4_OUTRAS'];
}

/* ── Helper: nunca confundir idioma com geografia ── */
export function idiomaNaoEhGeografia(lang) {
  // 'pt' não implica Angola/Brasil/Portugal
  return { language: lang, geographic_scope: [] };
}

/* ── Helper: usuário ≠ objeto ── */
export function usuarioNaoEhObjeto(usuarioPais, escopoTrabalho) {
  // ignora usuarioPais, usa só escopoTrabalho
  return escopoTrabalho;
}
