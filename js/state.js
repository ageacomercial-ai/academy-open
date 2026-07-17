/* ═══════════════════════════════════════════════════════════
   ACADEMY — STATE.JS
   Fonte única de verdade para todo o estado da aplicação.
   Nenhum outro ficheiro deve guardar estado — lê e escreve
   sempre aqui através de State.get() / State.set().
═══════════════════════════════════════════════════════════ */

/* ── Storage local (prefixado para evitar conflitos) ── */
const LS = {
  get(k)    { try { return JSON.parse(localStorage.getItem('acy_' + k) || 'null'); } catch { return null; } },
  set(k, v) { localStorage.setItem('acy_' + k, JSON.stringify(v)); },
  list(k)   { try { return JSON.parse(localStorage.getItem('acy_' + k) || '[]'); }  catch { return []; } },
  del(k)    { localStorage.removeItem('acy_' + k); },
};

/* ── Estado inicial da aplicação ── */
const _estado = {
  /* Sessão */
  u:    null,          /* utilizador { nome, email, whatsapp, nivel } */
  ecra: 'entrada',     /* ecrã activo */
  nav:  'inicio',      /* separador de navegação activo */
  tema: 'claro',      /* 'escuro' | 'claro' */

  /* Configuração do documento em curso */
  cfg: {
    tipo:             null,   /* id do tipo: 'tfc','mono','rel',... */
    tema:             '',     /* tema/título do trabalho */
    nivel:            '',     /* nível académico */
    turma:            '',     /* turma/ano */
    area:             '',     /* área do curso */
    prof:             '',     /* nome do professor/orientador */
    inst:             '',     /* nome da instituição */
    logo:             null,   /* logo da instituição (base64) */
    logoPrev:         null,   /* preview do logo */
    pags:             15,     /* número de páginas pretendido */
    numCaps:          5,      /* número de capítulos */
    mbs:              [],     /* membros do grupo */
    refStyle:         'APA',  /* estilo de referências */
    estruturaProf:    '',     /* estrutura definida pelo professor */
    dedicatoria:      '',
    agradecimentos:   '',
    epigrafe:         '',
    epigrafAutor:     '',
    mediaItems:       [],     /* gráficos/tabelas/esquemas */
    postextuais:      [],     /* anexos, apêndices */
  },

  /* Documento gerado */
  plano:  null,   /* plano de estrutura gerado pela IA */
  est:    null,   /* estrutura final aprovada */
  secs:   [],     /* secções geradas [ { t, c, ... } ] */
  qual:   null,   /* análise de qualidade */

  /* Media e chat */
  graficos:       [],
  mea:            [],
  lingua:         'pt-AO',

  /* Capa */
  capa: {
    imagem:        null,
    usarCapa:      true,
    logoInst:      null,
    logoRepublica: null,
  },

  /* UI / UX */
  instrutorAtivo: true,
  genFim:         false,
  load:           false,
  guardarEst:     'guardado',  /* 'guardado' | 'guardando' | 'erro' */
  exAberto:       null,        /* id do exemplar aberto */
};

/* ═══════════════════════════════════════════════════════════
   API PÚBLICA DO STATE
═══════════════════════════════════════════════════════════ */
const State = {

  /* Leitura de qualquer chave de topo: State.get('cfg'), State.get('secs') */
  get(chave) {
    return _estado[chave];
  },

  /* Escrita de qualquer chave de topo */
  set(chave, valor) {
    _estado[chave] = valor;
  },

  /* Leitura de sub-chave do cfg: State.getCfg('tipo'), State.getCfg('pags') */
  getCfg(chave) {
    return _estado.cfg[chave];
  },

  /* Escrita de sub-chave do cfg */
  setCfg(chave, valor) {
    _estado.cfg[chave] = valor;
  },

  /* Actualizar múltiplos campos do cfg de uma vez */
  mergeCfg(obj) {
    Object.assign(_estado.cfg, obj);
  },

  /* Reset completo do documento em curso (mantém sessão e plano) */
  resetDocumento() {
    _estado.cfg          = { ..._estado.cfg, tipo: null, tema: '', nivel: '', turma: '', area: '', prof: '', inst: '', logo: null, logoPrev: null, pags: 15, numCaps: 5, mbs: [], refStyle: 'APA', estruturaProf: '', dedicatoria: '', agradecimentos: '', epigrafe: '', epigrafAutor: '', mediaItems: [], postextuais: [] };
    _estado.plano        = null;
    _estado.est          = null;
    _estado.secs         = [];
    _estado.qual         = null;
    _estado.graficos     = [];
    _estado.mea          = [];
    _estado.capa         = { imagem: null, usarCapa: true, logoInst: null, logoRepublica: null };
    _estado.genFim       = false;
    _estado.guardarEst   = 'guardado';
  },

  /* Acesso directo ao objecto inteiro (só para leitura) */
  raw() {
    return _estado;
  },
};

/* ═══════════════════════════════════════════════════════════
   CONSTANTES GLOBAIS DA APLICAÇÃO
   (nunca mudam — tipos, estruturas, planos, preços)
═══════════════════════════════════════════════════════════ */

const TIPOS = [
  { id: 'tfc',  n: 'Trabalho de Fim de Curso', s: 'TFC',      i: '◉', c: 'b' },
  { id: 'inv',  n: 'Trabalho Investigativo',   s: 'T.INV',    i: '◈', c: 'o' },
  { id: 'mono', n: 'Monografia',               s: 'MONO',     i: '▣', c: 'b' },
  { id: 'rel',  n: 'Relatório',                s: 'REL',      i: '⬡', c: 'o' },
  { id: 'art',  n: 'Artigo Científico',        s: 'ARTIGO',   i: '◎', c: 'b' },
  { id: 'sem',  n: 'Seminário',                s: 'SEM',      i: '◑', c: 'o' },
  { id: 'pre',  n: 'Pré-Projecto',             s: 'PRÉ-PROJ', i: '◇', c: 'b' },
  { id: 'out',  n: 'Outro Trabalho',           s: 'OUTRO',    i: '○', c: 'o' },
];

const ESTRUTURAS_TIPO = {
  tfc: { nome: 'Trabalho de Fim de Curso', caps: [
    { num: 1, titulo: 'Introdução',                        subs: ['1.1 Contextualização e Enquadramento','1.2 Problema de Investigação','1.3 Objectivos Gerais e Específicos','1.4 Hipóteses de Investigação','1.5 Justificação e Relevância','1.6 Estrutura do Trabalho'] },
    { num: 2, titulo: 'Revisão da Literatura',             subs: ['2.1 Fundamentos Teóricos','2.2 Estado da Arte','2.3 Conceitos Fundamentais','2.4 Modelos Teóricos de Referência'] },
    { num: 3, titulo: 'Enquadramento',                     subs: ['3.1 Contexto Nacional e Regional','3.2 Quadro Legal e Normativo','3.3 Caracterização do Objecto de Estudo'] },
    { num: 4, titulo: 'Metodologia de Investigação',       subs: ['4.1 Paradigma e Tipo de Pesquisa','4.2 Universo, População e Amostra','4.3 Técnicas e Instrumentos de Recolha','4.4 Tratamento e Análise dos Dados','4.5 Limitações Metodológicas'] },
    { num: 5, titulo: 'Análise e Discussão dos Resultados',subs: ['5.1 Apresentação dos Resultados','5.2 Análise Crítica','5.3 Discussão face à Literatura','5.4 Verificação das Hipóteses'] },
    { num: 6, titulo: 'Conclusão',                         subs: ['6.1 Síntese das Principais Conclusões','6.2 Contribuições Científicas','6.3 Limitações do Estudo','6.4 Recomendações e Pesquisa Futura'] },
    { num: 7, titulo: 'Referências Bibliográficas',        subs: [] },
    { num: 8, titulo: 'Anexos e Apêndices',                subs: ['8.1 Instrumentos de Recolha','8.2 Dados Complementares'] },
  ]},
  inv: { nome: 'Trabalho Investigativo', caps: [
    { num: 1, titulo: 'Introdução',                subs: ['1.1 Enquadramento do Tema','1.2 Problema de Pesquisa','1.3 Objectivos','1.4 Relevância do Estudo'] },
    { num: 2, titulo: 'Enquadramento Teórico',     subs: ['2.1 Revisão Sistemática da Literatura','2.2 Quadro Teórico e Conceptual','2.3 Conceitos-Chave e Definições','2.4 Lacunas na Investigação'] },
    { num: 3, titulo: 'Metodologia',               subs: ['3.1 Abordagem Metodológica','3.2 Métodos e Técnicas','3.3 Recolha e Registo de Dados','3.4 Validade e Fiabilidade'] },
    { num: 4, titulo: 'Resultados e Análise',      subs: ['4.1 Apresentação dos Resultados','4.2 Análise Crítica','4.3 Discussão e Interpretação'] },
    { num: 5, titulo: 'Conclusão',                 subs: ['5.1 Principais Conclusões','5.2 Implicações Práticas','5.3 Perspectivas Futuras'] },
    { num: 6, titulo: 'Referências Bibliográficas',subs: [] },
  ]},
  mono: { nome: 'Monografia', caps: [
    { num: 1, titulo: 'Introdução',                subs: ['1.1 Delimitação e Justificação do Tema','1.2 Problema Central','1.3 Objectivos da Monografia','1.4 Metodologia Adoptada'] },
    { num: 2, titulo: 'Revisão da Literatura',     subs: ['2.1 Perspectiva Histórica','2.2 Principais Correntes Teóricas','2.3 Estado Actual do Conhecimento','2.4 Quadro Teórico de Referência'] },
    { num: 3, titulo: 'Desenvolvimento Teórico',   subs: ['3.1 Análise Conceptual Aprofundada','3.2 Discussão Crítica das Teorias','3.3 Posicionamento Científico do Autor'] },
    { num: 4, titulo: 'Análise e Aplicação',       subs: ['4.1 Contextualização ao Caso em Estudo','4.2 Análise Comparativa','4.3 Síntese Integradora'] },
    { num: 5, titulo: 'Conclusão',                 subs: ['5.1 Síntese das Reflexões','5.2 Contribuições da Monografia','5.3 Limitações e Perspectivas'] },
    { num: 6, titulo: 'Referências Bibliográficas',subs: [] },
  ]},
  rel: { nome: 'Relatório', caps: [
    { num: 1, titulo: 'Introdução',                     subs: ['1.1 Objectivo do Relatório','1.2 Contextualização','1.3 Metodologia Adoptada'] },
    { num: 2, titulo: 'Enquadramento Institucional',    subs: ['2.1 Caracterização da Entidade','2.2 Estrutura Organizacional','2.3 Área de Intervenção'] },
    { num: 3, titulo: 'Descrição das Actividades',      subs: ['3.1 Actividades Realizadas','3.2 Procedimentos e Metodologia','3.3 Recursos Utilizados','3.4 Dificuldades e Soluções'] },
    { num: 4, titulo: 'Resultados e Análise',           subs: ['4.1 Resultados Obtidos','4.2 Análise Crítica','4.3 Impacto das Actividades'] },
    { num: 5, titulo: 'Conclusão e Recomendações',      subs: ['5.1 Conclusões','5.2 Lições Aprendidas','5.3 Recomendações'] },
  ]},
  art: { nome: 'Artigo Científico', caps: [
    { num: 1, titulo: 'Resumo e Introdução',     subs: ['1.1 Resumo (Abstract)','1.2 Palavras-chave','1.3 Contextualização','1.4 Problema e Objectivos','1.5 Estrutura do Artigo'] },
    { num: 2, titulo: 'Revisão de Literatura',   subs: ['2.1 Estado da Arte','2.2 Fundamentação Teórica','2.3 Lacunas Identificadas'] },
    { num: 3, titulo: 'Metodologia',             subs: ['3.1 Desenho da Investigação','3.2 Amostra e Recolha de Dados','3.3 Instrumentos de Análise','3.4 Critérios de Validade'] },
    { num: 4, titulo: 'Resultados',              subs: ['4.1 Resultados Principais','4.2 Análise Estatística ou Qualitativa','4.3 Tabelas e Figuras Ilustrativas'] },
    { num: 5, titulo: 'Discussão e Conclusão',   subs: ['5.1 Interpretação e Discussão','5.2 Confronto com a Literatura','5.3 Contribuições Científicas','5.4 Limitações e Pesquisa Futura','5.5 Referências Bibliográficas'] },
  ]},
  sem: { nome: 'Seminário', caps: [
    { num: 1, titulo: 'Introdução',              subs: ['1.1 Apresentação do Tema','1.2 Objectivos do Seminário','1.3 Relevância e Actualidade'] },
    { num: 2, titulo: 'Contextualização',        subs: ['2.1 Enquadramento Histórico','2.2 Relevância Actual','2.3 Conceitos Fundamentais'] },
    { num: 3, titulo: 'Análise e Desenvolvimento',subs: ['3.1 Perspectivas Teóricas','3.2 Casos e Exemplos Práticos','3.3 Debate e Reflexão Crítica'] },
    { num: 4, titulo: 'Conclusão',               subs: ['4.1 Síntese do Seminário','4.2 Reflexões Finais','4.3 Referências e Fontes'] },
  ]},
  pre: { nome: 'Pré-Projecto', caps: [
    { num: 1, titulo: 'Problema de Pesquisa',              subs: ['1.1 Identificação e Formulação do Problema','1.2 Justificação da Escolha','1.3 Delimitação do Campo de Estudo'] },
    { num: 2, titulo: 'Hipóteses de Investigação',         subs: ['2.1 Hipótese Principal','2.2 Hipóteses Secundárias','2.3 Variáveis em Estudo'] },
    { num: 3, titulo: 'Fundamentação Teórica Preliminar',  subs: ['3.1 Revisão Inicial da Literatura','3.2 Quadro Teórico Provisório'] },
    { num: 4, titulo: 'Metodologia Proposta',              subs: ['4.1 Abordagem e Paradigma','4.2 Métodos e Instrumentos Previstos','4.3 Universo e Amostra Prevista'] },
    { num: 5, titulo: 'Cronograma e Recursos',             subs: ['5.1 Fases e Calendarização','5.2 Recursos Necessários'] },
    { num: 6, titulo: 'Referências Bibliográficas',        subs: [] },
  ]},
  out: { nome: 'Trabalho Académico', caps: [
    { num: 1, titulo: 'Introdução',              subs: ['1.1 Contextualização','1.2 Objectivos','1.3 Justificação'] },
    { num: 2, titulo: 'Fundamentação Teórica',   subs: ['2.1 Revisão da Literatura','2.2 Conceitos Fundamentais'] },
    { num: 3, titulo: 'Desenvolvimento',         subs: ['3.1 Análise','3.2 Discussão Crítica'] },
    { num: 4, titulo: 'Conclusão',               subs: ['4.1 Síntese das Conclusões','4.2 Recomendações'] },
    { num: 5, titulo: 'Referências Bibliográficas',subs: [] },
  ]},
};

const NIVEIS   = ['Ensino Médio', 'Ensino Secundário', 'Licenciatura', 'Pós-Graduação', 'Mestrado', 'Doutoramento', 'Outro'];
const TURMAS   = ['10.ª Classe', '11.ª Classe', '12.ª Classe', '13.ª Classe'];
const ANOS_SUP = ['1.º Ano', '2.º Ano', '3.º Ano', '4.º Ano', '5.º Ano'];
const PAGS     = [5, 8, 10, 15, 20, 25, 30, 40, 50, 80, 100];

const PLANOS_DEF = {
  gratuito:  { n: 'Gratuito',  pags_mes: 9999, wm: true,  preco: 0,     cor: 'var(--t3)', ic: '🎁' },
  estudante: { n: 'Estudante', pags_mes: 70,   wm: false, preco: 5400,  cor: 'var(--b)',  ic: '🎓' },
  grafica:   { n: 'Gráfica',   pags_mes: 200,  wm: false, preco: 15000, cor: 'var(--o)',  ic: '🖨'  },
  premium:   { n: 'Premium',   pags_mes: 1000, wm: false, preco: 30000, cor: '#A78BFA',  ic: '⚡'  },
};

/* Helpers rápidos usados em vários módulos */
const tipoActual   = () => TIPOS.find(t => t.id === State.getCfg('tipo'));
const getEstruturaTipo = (tipoId) => ESTRUTURAS_TIPO[tipoId] || ESTRUTURAS_TIPO['out'];
const nPags = () => {
  const secs = State.get('secs');
  if (!secs.length) return State.getCfg('pags') || 15;
  return Math.max(1, Math.ceil(secs.reduce((s, x) => s + (x.c?.split(' ').length || 0), 0) / 250));
};
