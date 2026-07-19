/* =======================================================================
   ACADEMY ENGINE - SAAS BLINDADO (PRODUÇÃO)
   v66: DOCUMENT AST — backend gera JSON estruturado
    OpenRouter + Gemini
======================================================================= */

const OR_SITE  = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://academy-open.vercel.app';
const OR_TITLE = 'ACADEMY';



/* ---------------- RATE LIMIT ---------------- */
const RATE = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const d = RATE.get(ip) || { count: 0, start: now };
  if (now - d.start > 60000) { RATE.set(ip, { count: 1, start: now }); return true; }
  if (d.count >= 25) return false;
  d.count++; RATE.set(ip, d); return true;
}

/* ---------------- CORS ---------------- */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

/* ---------------- POOLS ANTI-IA ---------------- */
const EXEMPLOS = [
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
];
const HIPOTESES = [
  'A tese central deste trabalho é que',
  'A análise conduz à conclusão de que',
  'Os dados permitem inferir que',
  'A investigação aponta para o facto de que',
  'O exame crítico da literatura revela que',
  'A posição defendida neste estudo é que',
  'A leitura dos factos sugere que',
  'A evidência disponível indica que',
];
const CONCLUSOES = [
  'A análise evidencia, portanto, que',
  'Os dados apresentados confirmam que',
  'O exame crítico demonstra que',
  'A síntese dos argumentos aponta para',
  'O quadro analítico traçado revela que',
  'A investigação permite concluir que',
  'Os elementos reunidos sustentam que',
  'O percurso argumentativo culmina em',
];
const TRANSICOES = [
  'Aprofundando esta perspectiva,',
  'A análise revela ainda que',
  'Numa leitura mais crítica,',
  'Articulando com o argumento anterior,',
  'A dimensão analítica exige reconhecer que',
  'Complementando a perspectiva teórica,',
  'O debate académico evidencia que',
  'A revisão da literatura aponta que',
];
const CONECTORES_PROIBIDOS = [
  'Cumpre referir que','Importa sublinhar que','Convém notar que',
  'Vale a pena salientar que','É relevante destacar que',
  'Neste sentido,','Neste quadro,','A este respeito,',
  'Do exposto decorre que','Perante o analisado,',
];

function antiIA(capNum, totalCaps, geoInstrucao) {
  const n = Math.max(0, (capNum||1) - 1);
  const pick = (arr, s) => arr[(n*7 + s*3) % arr.length];
  const fase = !totalCaps||totalCaps<=1 ? 'análise' :
    (n/(totalCaps-1))<=0.1 ? 'introdução' :
    (n/(totalCaps-1))<=0.35 ? 'fundamentação teórica' :
    (n/(totalCaps-1))<=0.65 ? 'análise crítica' :
    (n/(totalCaps-1))<=0.88 ? 'síntese' : 'conclusão';
  const proibidos = CONECTORES_PROIBIDOS.slice(0,4).join('", "');
  return `REGRAS DE ESTILO OBRIGATÓRIAS — APLICAR RIGOROSAMENTE:

TOM E VOZ:
1. Escreve com VOZ ANALÍTICA — não apenas descrever conceitos, mas comparar, questionar, posicionar
2. Cada subtópico deve incluir: (a) posição teórica, (b) contraponto ou limitação, (c) aplicação ao contexto do tema
3. PROIBIDO usar estes conectores mecânicos que revelam texto IA: "${proibidos}"
4. PROIBIDO iniciar dois parágrafos consecutivos com a mesma palavra ou estrutura
5. Para exemplos usa: "${pick(EXEMPLOS,1)}" — nunca a mesma expressão duas vezes no mesmo capítulo
6. Para hipótese/posição usa: "${pick(HIPOTESES,2)}"
7. Para concluir usa: "${pick(CONCLUSOES,3)}"
8. Para transições usa: "${pick(TRANSICOES,4)}"

CITAÇÕES — OBRIGATÓRIO:
9. Cada dado estatístico DEVE ter citação inline: (Autor, Ano) ou (Instituição, Ano)
10. Não escrever "segundo dados do INE" sem especificar o ano: "segundo INE (2023)"
11. Mínimo 2 citações por parágrafo de desenvolvimento — integradas no argumento, não no fim

CONTEXTO GEOGRÁFICO: ${geoInstrucao}

POSIÇÃO NO DOCUMENTO: ${fase} — adequa profundidade analítica`;
}

/* ---------------- PERFIS POR NÍVEL ---------------- */
const PERFIL_NIVEL = {
  'ensino médio': {
    profundidade: `Linguagem clara para estudantes 14-18 anos. Conceitos desde o básico. Para Ciências: fórmulas básicas com cada variável explicada. Exemplos reconhecíveis do contexto do tema. 3-4 parágrafos densos por subtópico.`,
    citacoes: `1-2 citações por subtópico formato (Apelido, Ano). Exemplo: "Segundo Cardoso (2019),..." ou "...processo fundamental (Lima & Santos, 2020)."`,
    refs_min: 8, refs_africanos: 2,
  },
  'licenciatura': {
    profundidade: `Nível universitário 1º ciclo. Rigor conceptual. Análise crítica: comparar perspectivas de pelo menos 2 autores. Dados estatísticos e factos verificáveis com anos e instituições (contexto do tema). 4-5 parágrafos densos por subtópico.`,
    citacoes: `2-3 citações por subtópico. Exemplos: "De acordo com Ferreira (2021),..." / "(Neto, 2019; Costa, 2022)." / "Silva (2020, p.45) argumenta que..." OBRIGATÓRIO: pelo menos 1 citação no meio de cada parágrafo principal, não apenas no fim.`,
    refs_min: 10, refs_africanos: 3,
  },
  'mestrado': {
    profundidade: `Pós-graduação. Confrontar teorias, identificar lacunas. Síntese original com voz argumentativa. OBRIGATÓRIO: pelo menos 1 tensão teórica por subtópico (Autor A defende X, Autor B argumenta Y). 5-7 parágrafos de alta densidade por subtópico.`,
    citacoes: `3-4 citações por subtópico, directas e indirectas alternadas. Citação directa: Segundo Lopes (2018, p.112), "a gestão estratégica implica..." Citação indirecta: (Banda, 2020; Kiala & Mabiala, 2021). OBRIGATÓRIO: 1 tensão teórica por subtópico.`,
    refs_min: 12, refs_africanos: 4,
  },
  'doutoramento': {
    profundidade: `Investigação original. Mapear estado da arte, propor contribuição nova. Posicionamento epistemológico. Obras seminais + investigação recente (últimos 5 anos). OBRIGATÓRIO: identificar lacuna na literatura por subtópico. 6-8 parágrafos de alta densidade.`,
    citacoes: `4-6 citações por subtópico. Obras fundacionais E investigação recente. Exemplo: "A teoria de Bourdieu (1980) foi revisitada por Mabiala (2019), que argumenta..." OBRIGATÓRIO: lacuna na literatura por subtópico.`,
    refs_min: 15, refs_africanos: 5,
  },
};

/* ---------------- PERFIS POR ÁREA ---------------- */
const PERFIL_AREA = {
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

/* ---------------- ABORDAGENS ESTRUTURAIS (rotação) ---------------- */
const ABORDAGENS = [
  `Abordagem histórico-evolutiva: começa pela origem/evolução do conceito, analisa o estado actual com datas e factos concretos do contexto do tema.`,
  `Abordagem analítico-crítica: apresenta o conceito, confronta perspectivas divergentes de 2+ autores, conclui com posição fundamentada.`,
  `Abordagem empírico-descritiva: apresenta dados quantitativos verificáveis (percentagens, anos, instituições), interpreta as implicações.`,
  `Abordagem comparativa: compara o contexto do tema com outros contextos relevantes, identifica semelhanças e especificidades locais.`,
  `Abordagem prospectiva: analisa o estado actual, identifica desafios estruturais, propõe recomendações concretas.`,
];

/* ---------------- DETECÇÃO AUTOMÁTICA ---------------- */
function detectarNivel(n) {
  const s = (n||'').toLowerCase();
  if (/médio|secundário|12\.º|11\.º|10\.º|\b12\b|\b11\b|\b10\b/.test(s)) return 'ensino médio';
  if (/mestrado|2\.º ciclo|pós.grad/.test(s)) return 'mestrado';
  if (/doutoramento|doutorado|phd|3\.º ciclo/.test(s)) return 'doutoramento';
  return 'licenciatura';
}

function detectarArea(tema, areaParam) {
  if (areaParam && PERFIL_AREA[areaParam.toLowerCase()]) return areaParam.toLowerCase();
  const t = (tema||'').toLowerCase();
  if (/física|química|biologia|matemática|geologia|ecologia|botânica|astronomia/.test(t)) return 'ciencias';
  if (/direito|lei\b|jurídic|constitucional|penal|civil|comercial|legisl|tribunal/.test(t)) return 'direito';
  if (/saúde|médic|enfermagem|farmáci|hospital|doença|paludismo|nutrição|clínic/.test(t)) return 'saude';
  if (/gestão|economia|finanças|marketing|contabilidade|administração|empresa|negócio/.test(t)) return 'gestao';
  if (/engenharia|informática|software|hardware|eléctric|mecânic|construção|telecomunic|tic\b/.test(t)) return 'engenharia';
  return 'humanidades';
}

function detectarContextoGeo(tema, pais) {
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

/* ---------------- TRUNCAR ---------------- */
function truncar(texto, max) {
  if (!texto) return texto;
  const p = texto.split(/\s+/);
  if (p.length <= max) return texto;
  const c = p.slice(0, max).join(' ');
  const u = Math.max(c.lastIndexOf('. '), c.lastIndexOf('.\n'));
  return (u > c.length * 0.7 ? c.substring(0, u+1) : c).trim();
}

/* ================================================================
   AST REPAIR ENGINE — v72
================================================================ */
function repararAST(raw, capNum, capTit, subs) {
  let ast = null;
  if (raw && typeof raw === 'object') {
    ast = raw;
  } else if (typeof raw === 'string') {
    try { ast = JSON.parse(raw.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim()); }
    catch (_) { ast = null; }
    if (!ast) {
      const m = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (m) try { ast = JSON.parse(m[1]); } catch (_) {}
    }
  }
  const base = {
    chapter_id : String(capNum),
    title      : capTit || `Capítulo ${capNum}`,
    status     : 'generated',
    generated_at: new Date().toISOString(),
    generated_by: 'academy-engine-v72',
    version    : 1,
    sections   : [],
  };
  if (!ast && typeof raw === 'string' && raw.length > 100) {
    const secs = [];
    const linhas = raw.split('\n').map(l => l.trim()).filter(Boolean);
    let secAtual = null;
    for (const linha of linhas) {
      const numMatch = linha.match(/^(\d+\.\d+(?:\.\d+)?)\s+(.+)/);
      if (numMatch && subs.some(s => linha.toLowerCase().includes(s.toLowerCase().substring(0, 15)))) {
        if (secAtual) secs.push(secAtual);
        secAtual = { section_id: `${capNum}.${numMatch[1]}`, title: numMatch[2], paragraphs: [] };
        continue;
      }
      if (!secAtual) {
        secAtual = { section_id: `${capNum}.1`, title: subs?.[0] || 'Introdução', paragraphs: [] };
      }
      if (linha.length > 20) secAtual.paragraphs.push(linha);
    }
    if (secAtual) secs.push(secAtual);
    if (secs.length > 0 && secs.some(s => s.paragraphs.length > 0)) {
      return { ...base, sections: secs, _repaired: true, _repair_reason: 'raw_text_parsed' };
    }
  }
  if (!ast) {
    const secsDefault = (Array.isArray(subs) && subs.length > 0 ? subs : [
      'Contextualização', 'Desenvolvimento', 'Análise Crítica'
    ]).map((s, i) => ({
      section_id  : `${capNum}.${i+1}`,
      title       : s,
      status      : 'empty',
      paragraphs  : [],
    }));
    return { ...base, sections: secsDefault, _repaired: true, _repair_reason: 'no_json' };
  }
  ast.chapter_id  = ast.chapter_id  || base.chapter_id;
  ast.title       = ast.title       || base.title;
  ast.status      = ast.status      || 'generated';
  ast.generated_at= ast.generated_at|| base.generated_at;
  ast.generated_by= ast.generated_by|| base.generated_by;
  ast.version     = ast.version     || 1;
  if (!Array.isArray(ast.sections) || ast.sections.length === 0) {
    ast.sections = base.sections;
    ast._repaired = true;
    ast._repair_reason = 'missing_sections';
  } else {
    ast.sections = ast.sections.map((sec, i) => {
      if (!sec.section_id) sec.section_id = `${capNum}.${i+1}`;
      if (!sec.title) sec.title = subs?.[i] || `${capNum}.${i+1}`;
      if (!Array.isArray(sec.paragraphs)) {
        if (typeof sec.content === 'string' && sec.content.trim()) {
          sec.paragraphs = sec.content.split('\n\n')
            .map(p => p.trim()).filter(p => p.length > 20);
        } else {
          sec.paragraphs = [];
        }
        ast._repaired = true;
        ast._repair_reason = 'paragraphs_repaired';
      }
      sec.paragraphs = sec.paragraphs
        .map(p => typeof p === 'string' ? p.trim() : '')
        .filter(p => p.length > 15);
      return sec;
    });
  }
  return ast;
}

function validarAST(ast) {
  if (!ast || !ast.sections || !Array.isArray(ast.sections)) return false;
  if (ast.sections.length === 0) return false;
  return ast.sections.some(s =>
    Array.isArray(s.paragraphs) && s.paragraphs.length >= 1
  );
}

/* ================================================================
   DOCUMENT HEALTH ENGINE — v72
================================================================ */
function calcularDocumentHealth(ast, nivel) {
  const issues = [];
  let score = 100;
  const secsVazias = ast.sections?.filter(
    s => !s.paragraphs || s.paragraphs.length === 0
  ) || [];
  if (secsVazias.length > 0) {
    score -= secsVazias.length * 15;
    issues.push({
      severity : 'error',
      code     : 'EMPTY_SECTIONS',
      message  : `${secsVazias.length} subtópico(s) sem conteúdo`,
      sections : secsVazias.map(s => s.section_id),
    });
  }
  const parasMinimos = { 'ensino médio': 60, 'licenciatura': 80, 'mestrado': 100, 'doutoramento': 120 };
  const minChars = parasMinimos[nivel] || 80;
  let parasCurtos = 0;
  (ast.sections || []).forEach(s =>
    (s.paragraphs || []).forEach(p => { if ((p||'').length < minChars) parasCurtos++; })
  );
  if (parasCurtos > 2) {
    score -= Math.min(20, parasCurtos * 4);
    issues.push({
      severity : 'warning',
      code     : 'SHORT_PARAGRAPHS',
      message  : `${parasCurtos} parágrafos abaixo do mínimo para ${nivel}`,
    });
  }
  if (ast._repaired) {
    score -= 10;
    issues.push({
      severity : 'warning',
      code     : 'AST_REPAIRED',
      message  : `Estrutura reconstruída automaticamente (razão: ${ast._repair_reason})`,
    });
  }
  score = Math.max(0, score);
  return {
    health  : score,
    issues,
    label   : score >= 85 ? 'Saudável' : score >= 60 ? 'Aceitável' : 'Necessita revisão',
  };
}

/* ================================================================
   READINESS SCORE — v72
================================================================ */
function calcularReadiness(ast, nivel, geoCtx) {
  const blockers = [];
  const warnings = [];
  if (!validarAST(ast)) {
    blockers.push('Capítulo sem conteúdo gerado');
  }
  const totalParas = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).length, 0
  );
  const minParas = { 'ensino médio': 6, 'licenciatura': 9, 'mestrado': 12, 'doutoramento': 15 };
  if (totalParas < (minParas[nivel] || 6)) {
    blockers.push(`Parágrafos insuficientes: ${totalParas} (mínimo: ${minParas[nivel] || 6})`);
  }
  if (ast._repaired) {
    warnings.push('Estrutura foi reconstruída automaticamente');
  }
  if (geoCtx === 'global' && ast._angola_count > 10) {
    warnings.push('Texto contém referências geográficas inesperadas');
  }
  const ready = blockers.length === 0;
  return {
    ready,
    verdict : ready ? 'Pronto para entrega' : 'Não recomendado para entrega',
    blockers,
    warnings,
  };
}

/* ================================================================
   CONFIDENCE SCORE — v73
================================================================ */
function calcularConfidence(ast, meta) {
  let score = 100;
  const factores = [];
  if (ast._repaired || meta.ast_repaired) {
    const penalty = meta.repair_reason === 'no_json' ? 25 : 12;
    score -= penalty;
    factores.push({ factor: 'ast_repaired', impact: -penalty, reason: meta.repair_reason });
  }
  if (meta.retry_count > 0) {
    const penalty = meta.retry_count * 8;
    score -= Math.min(penalty, 20);
    factores.push({ factor: 'retries', count: meta.retry_count, impact: -Math.min(penalty, 20) });
  }
  const secsVazias = (ast.sections || []).filter(
    s => !s.paragraphs || s.paragraphs.length === 0
  ).length;
  if (secsVazias > 0) {
    score -= secsVazias * 10;
    factores.push({ factor: 'empty_sections', count: secsVazias, impact: -secsVazias * 10 });
  }
  const totalParas = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).length, 0
  );
  if (totalParas < 6) {
    score -= 15;
    factores.push({ factor: 'low_paragraph_count', count: totalParas, impact: -15 });
  }
  if (meta.generation_time_ms > 60000) {
    score -= 5;
    factores.push({ factor: 'slow_generation', ms: meta.generation_time_ms, impact: -5 });
  }
  score = Math.max(0, score);
  return {
    confidence : score,
    label      : score >= 85 ? 'Alta' : score >= 65 ? 'Média' : 'Baixa',
    factores,
  };
}

/* ================================================================
   TELEMETRIA — v73
================================================================ */
async function registarTelemetria(payload) {
  const record = {
    ts               : new Date().toISOString(),
    tema             : payload.tema,
    nivel            : payload.nivel,
    area             : payload.area,
    tipo             : payload.tipo,
    cap_num          : payload.cap_num,
    ast_generated    : payload.ast_generated,
    ast_repaired     : payload.ast_repaired     || false,
    repair_reason    : payload.repair_reason    || null,
    retry_count      : payload.retry_count      || 0,
    health           : payload.health           || null,
    confidence       : payload.confidence       || null,
    ready            : payload.ready            || false,
    generation_time_ms: payload.generation_time_ms || 0,
    pages_requested  : payload.pages_requested  || null,
    word_count       : payload.word_count       || 0,
    model_used       : payload.model_used       || 'unknown',
  };
  console.log('[TELEMETRIA v73]', JSON.stringify(record));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 5000);
  try {
    await fetch(`${url}/rest/v1/academy_ai_logs`, {
      method  : 'POST',
      signal  : ctrl.signal,
      headers : {
        'Content-Type'  : 'application/json',
        'apikey'        : key,
        'Authorization' : `Bearer ${key}`,
        'Prefer'        : 'return=minimal',
      },
      body: JSON.stringify(record),
    });
  } catch (_) {}
  finally { clearTimeout(t); }
}

/* ================================================================
   COMPLETENESS SCORE — v74
================================================================ */
function calcularCompleteness(ast, palavrasAlvo, totalCaps, nivelKey) {
  const dimensoes = {};
  const totalPalavras = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).join(' ').split(/\s+/).filter(Boolean).length, 0
  );
  const coberturaRatio = Math.min(1, totalPalavras / Math.max(palavrasAlvo, 1));
  dimensoes.paginas = Math.round(coberturaRatio * 100);
  const secCounts = (ast.sections || []).map(s => (s.paragraphs || []).length);
  const minPorSec = { 'ensino médio': 3, 'licenciatura': 4, 'mestrado': 5, 'doutoramento': 6 };
  const min = minPorSec[nivelKey] || 4;
  const densidadeRatio = secCounts.length > 0
    ? secCounts.reduce((a, n) => a + Math.min(1, n / min), 0) / secCounts.length
    : 0;
  dimensoes.densidade = Math.round(densidadeRatio * 100);
  const secsComConteudo = (ast.sections || []).filter(s => (s.paragraphs || []).length > 0).length;
  const totalSecs = Math.max((ast.sections || []).length, 1);
  dimensoes.cobertura = Math.round((secsComConteudo / totalSecs) * 100);
  const todasParas = (ast.sections || []).flatMap(s => s.paragraphs || []);
  const charsMedios = todasParas.length > 0
    ? todasParas.reduce((a, p) => a + (p || '').length, 0) / todasParas.length
    : 0;
  const charMin = { 'ensino médio': 200, 'licenciatura': 300, 'mestrado': 400, 'doutoramento': 500 };
  dimensoes.profundidade = Math.min(100, Math.round((charsMedios / (charMin[nivelKey] || 300)) * 100));
  const score = Math.round(
    dimensoes.paginas    * 0.35 +
    dimensoes.densidade  * 0.25 +
    dimensoes.cobertura  * 0.25 +
    dimensoes.profundidade * 0.15
  );
  return {
    completeness : score,
    label        : score >= 85 ? 'Completo' : score >= 65 ? 'Parcial' : 'Superficial',
    dimensoes,
    palavras     : _totalWords(ast),
    paginas_est  : Math.round(_totalWords(ast) / 320 * 10) / 10,
  };
}

function _totalWords(ast) {
  return (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).join(' ').split(/\s+/).filter(Boolean).length, 0
  );
}

/* ================================================================
   ISSUE ACTIONS — v74
================================================================ */
const ISSUE_ACTIONS = {
  EMPTY_SECTIONS     : { label: 'Regenerar secções vazias',   acao: 'regenerar_capitulo',  auto: true  },
  SHORT_PARAGRAPHS   : { label: 'Enriquecer capítulo',        acao: 'editar_texto',         auto: true  },
  AST_REPAIRED       : { label: 'Regenerar capítulo',          acao: 'regenerar_capitulo',  auto: false },
  NO_REFERENCES      : { label: 'Gerar referências',           acao: 'gerar_capitulo_referencias', auto: true },
  NO_CONCLUSION      : { label: 'Gerar conclusão',             acao: 'gerar_capitulo',       auto: false },
  NO_INTRODUCTION    : { label: 'Gerar introdução',            acao: 'gerar_capitulo',       auto: false },
  LOW_PARAGRAPH_COUNT: { label: 'Expandir conteúdo',          acao: 'editar_texto',         auto: true  },
};

function enriquecerIssuesComAccoes(issues) {
  return (issues || []).map(issue => ({
    ...issue,
    action: ISSUE_ACTIONS[issue.code] || null,
  }));
}

/* ---------------- HANDLER ---------------- */
export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) return res.status(429).json({ ok:false, error:'RATE_LIMIT' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok:false, error:'INVALID_JSON' }); }

  const action    = body?.action || '';
  const payload   = body?.payload || {};
  /* Engine opts — propagado globalmente para todas as calls a callAI */
  const ac_engine = payload.ac_engine || 'openrouter';
  const ac_model  = payload.ac_model  || 'google/gemini-2.5-flash-lite';
  globalThis.__ac_engine = ac_engine;
  globalThis.__ac_model  = ac_model;

  try {
    switch (action) {
      case 'ping':
        return res.json({ ok:true, action:'ping', data:{ resposta:'pong', pong:true, ts:Date.now(), site:OR_SITE, openrouter:!!process.env.OPENROUTER_API_KEY } });
      case 'chat':
        return res.json(ok('chat', await doChat(payload)));
      case 'generate_lesson':
      case 'gerar_capitulo':
        return res.json(ok(action, await doCapitulo(payload)));
      case 'gerar_capitulo_referencias':
      case 'gerar_referencias':
        return res.json(ok(action, await doReferencias(payload)));
      case 'regenerar_capitulo':
        return res.json(ok(action, await doCapitulo({ ...payload, regenerar:true })));
      case 'plano_academico':
        return res.json(ok(action, await doPlano(payload)));
      case 'estrutura_academica':
        return res.json(ok(action, await doEstrutura(payload)));
      case 'editar_texto':
        return res.json(ok(action, await doEditar(payload)));
      case 'verificar_coerencia':
        return res.json(ok(action, await doCoerencia(payload)));
      case 'gerar_capa':
        return res.json(ok(action, { resposta: JSON.stringify({ capa:{ titulo:payload.tema||'', tipo:payload.tipoTrabalho||'' } }) }));
      case 'verificar_admin':
        return res.json(ok(action, await doVerificarAdmin(payload)));
      case 'gerar_mea':
      case 'mea_grafico':
      case 'mea_tabela':
      case 'mea_esquema':
        return res.json(ok(action, await doMEA(action, payload)));
      case 'save_history':
        return res.json(ok(action, await doSaveHistory(payload)));
      case 'get_history':
        return res.json(ok(action, await doGetHistory(payload)));
      case 'get_stock':
        return res.json(ok(action, { items:[] }));
      case 'setup_tables':
        return res.json(ok('setup_tables', await doSetupTables()));
      case '__health':
        return res.json(ok('__health', await doHealthCheck()));
      case '__diagnose':
        return res.json({ ok:true, action:'__diagnose', data:{
          hasOpenRouterKey:!!process.env.OPENROUTER_API_KEY,
          hasSupabaseUrl:!!process.env.SUPABASE_URL,
          hasSupabaseKey:!!process.env.SUPABASE_SERVICE_KEY,
          supabaseUrl: (process.env.SUPABASE_URL||'').substring(0,30),
          hasAdminPin:!!process.env.ADMIN_PIN,
          adminPinLen: (process.env.ADMIN_PIN||'').length,
          site: OR_SITE,
          node: process.version,
          platform: process.platform,
          memory: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE||'?',
          region: process.env.VERCEL_REGION||'?',
          tables_created: true,
          version: 'v15',
        }});
      default:
        return res.status(400).json({ ok:false, error:'UNKNOWN_ACTION', action });
    }
  } catch (err) {
    console.error('[ENGINE v66]', action, err.message);
    return res.status(500).json({ ok:false, error:'INTERNAL_ERROR', detail:err.message.substring(0,200) });
  }
}

/* ---------------- VERIFICAR ADMIN ---------------- */
async function doVerificarAdmin(p) {
  const pinRecebido = String(p?.pin || '').trim();
  const pinCorreto  = String(process.env.ADMIN_PIN || '').trim();
  if (!pinCorreto) {
    console.warn('[ADMIN] ADMIN_PIN não configurado nas variáveis de ambiente da Vercel.');
    return { resposta: { ok:false } };
  }
  const autorizado = pinRecebido.length > 0 && pinRecebido === pinCorreto;
  return { resposta: { ok: autorizado } };
}

/* ---------------- CHAT ---------------- */
async function doChat(p) {
  const pedido = (p.pedido||'').substring(0,2000);
  if (!pedido) throw new Error('pedido obrigatório');
  const hist = (Array.isArray(p.historico)?p.historico:[]).slice(-8)
    .map(m => ({ role:m.role==='assistant'?'assistant':'user', content:String(m.content||'').substring(0,800) }));
  const engineUsed = globalThis.__ac_engine || 'openrouter';
  const modelUsed  = globalThis.__ac_model  || 'google/gemini-2.5-flash-lite';
  const resposta = await callAI([
    { role:'system', content:`Assistente académico ACADEMY. Português formal. Contexto: "${p.tema||''}" (${p.tipoTrabalho||''}). Máx 200 palavras.` },
    ...hist,
    { role:'user', content:pedido },
  ], { max_tokens:800 });
  console.log(`[CHAT] engine=${engineUsed} model=${modelUsed}`);
  return { resposta, _engine: engineUsed, _model: modelUsed };
}

/* ---------------- CAPÍTULO (v65: estratificado) ---------------- */
async function doCapitulo(p) {
  const tema      = (p.tema||'').substring(0,300);
  const tipo      = (p.tipoTrabalho||'Trabalho Académico').substring(0,100);
  const nivel     = (p.nivel||'').substring(0,80);
  const inst      = (p.inst||'').substring(0,100);
  const prof      = (p.prof||'').substring(0,100);
  const area      = (p.area||'').substring(0,100);
  const capNum    = parseInt(p.capNum)||1;
  const capTit    = (p.capTitulo||'').substring(0,200);
  const totalCaps = parseInt(p.totalCaps)||parseInt(p.totalPags)||4;
  const totalPags = parseInt(p.totalPags)||15;
  const capSubs   = (Array.isArray(p.capSubs)?p.capSubs:[]).slice(0,8).map(s=>String(s).substring(0,150));

  if (!tema||!capTit) throw new Error('tema e capTitulo obrigatórios');
  const _startTime = Date.now();
  let retryCount = 0;

  const PAGINAS_FIXAS = 3;
  const PALAVRAS_POR_PAGINA = 320;
  const paginasConteudo = Math.max(totalPags - PAGINAS_FIXAS, 1);
  const palavrasCalc = Math.round((paginasConteudo * PALAVRAS_POR_PAGINA) / totalCaps);
  const palavras = Math.min(Math.max(parseInt(p.palavrasPorCap)||palavrasCalc, 200), 4000);

  const nivelKey  = detectarNivel(nivel);
  const areaKey   = detectarArea(tema, p.area);
  const pNivel    = PERFIL_NIVEL[nivelKey];
  const pArea     = PERFIL_AREA[areaKey];
  const geoCtx    = detectarContextoGeo(tema, p.pais);
  const isAngola  = geoCtx === 'angola';
  const isCabVerde= geoCtx === 'cabo_verde';

  const subs = capSubs.map((s,i) => `${capNum}.${i+1} ${s}`).join('\n') ||
    `${capNum}.1 Contextualização\n${capNum}.2 Desenvolvimento\n${capNum}.3 Análise crítica`;

  const maxTok = Math.min(Math.max(Math.round(palavras*1.8), 600), 12000);

  let geoInstrucao;
  if(isAngola){
    geoInstrucao = 'O tema refere-se especificamente a Angola. Quando relevante, usa dados angolanos com fonte e ano.';
  } else if(isCabVerde){
    geoInstrucao = 'O tema refere-se a Cabo Verde. Usa referências cabo-verdianas quando relevante.';
  } else {
    geoInstrucao = 'Trata o tema de forma universal e académica. NÃO faças referência a Angola, Brasil, Portugal ou qualquer país específico a não ser que o tema o exija explicitamente. Usa fontes académicas internacionais.';
  }

  const abordagemAnalitica = [
    `Abordagem histórico-crítica: traça a evolução do conceito com datas concretas, questiona a narrativa dominante, propõe leitura alternativa fundamentada.`,
    `Abordagem teórico-comparativa: confronta pelo menos 2 perspectivas teóricas divergentes, posiciona o argumento, aplica ao contexto do tema com dados específicos.`,
    `Abordagem empírico-analítica: parte de dados quantitativos verificáveis, analisa causas e efeitos, não se limita a descrever — interpreta e questiona.`,
    `Abordagem crítico-reflexiva: identifica contradições ou tensões no tema, examina limitações das abordagens existentes, propõe síntese fundamentada.`,
    `Abordagem prospectiva-propositiva: analisa o estado actual com rigor, identifica lacunas e desafios estruturais, formula recomendações concretas.`,
  ][(capNum-1) % 5];

  const prompt = `És um professor universitário especialista em ${pArea.label} a escrever o Capítulo ${capNum} de um ${tipo} de nível ${nivel} sobre "${tema}".
${inst ? `\nInstituição: ${inst}` : ''}${prof ? `\nOrientador: ${prof}` : ''}${area ? `\nÁrea do curso: ${area}` : ''}

CAPÍTULO: ${capNum}. ${capTit}

SUBTÓPICOS OBRIGATÓRIOS (usa esta numeração exacta, cada um em linha própria):
${subs}

ABORDAGEM ANALÍTICA OBRIGATÓRIA:
${abordagemAnalitica}

ESTRUTURA DE CADA SUBTÓPICO (nesta ordem exacta):
1. Contextualização teórica com pelo menos 1 citação (Autor, Ano)
2. Desenvolvimento analítico — confrontar perspectivas, não apenas descrever
3. Dado quantitativo verificável com fonte e ano (ex: "Segundo [Fonte], em [Ano], X registou Y"), 2023)"
4. Análise crítica do dado — o que significa para o tema?
5. Síntese argumentativa — qual é a posição do autor?

NÍVEL ACADÉMICO — ${nivelKey.toUpperCase()}:
${pNivel.profundidade}

CITAÇÕES OBRIGATÓRIAS:
${pNivel.citacoes}

${pArea.instrucoes}

FORMATAÇÃO OBRIGATÓRIA:
- Português formal académico
- Cada parágrafo: 3-5 frases completas, sem bullets
${p.instrucaoSubtitulos ? '\n' + p.instrucaoSubtitulos : ''}
${antiIA(capNum, totalCaps, geoInstrucao)}`;

  const promptAST = prompt + `

FORMA DE SAÍDA — JSON:
Não escrevas texto. Gera APENAS o JSON abaixo (sem \`\`\`, sem markdown, sem texto adicional):
{"chapter_id":"${capNum}","title":"${capTit}","sections":[{"section_id":"${capNum}.1","title":"Primeiro subtópico","paragraphs":["Parágrafo 1.","Parágrafo 2.","Parágrafo 3."]}],"total_paragraphs":${palavras}}
⚠ LIMITE: ~${palavras} palavras no total, divididas pelos parágrafos.
Cada parágrafo é uma string completa de texto corrido, sem formatação.
Mínimo 3 parágrafos por secção.`;

  let r1 = await callAI([{ role:'user', content:promptAST }], { max_tokens:maxTok, temperature:0.65 });
  let astRaw = null;
  try { astRaw = extrairJSON(r1); } catch (_) {}
  let rawFallback = r1;

  if (!validarAST(astRaw)) {
    console.warn(`[AST v73] T1 falhou — retry simplificado — cap ${capNum}`);
    retryCount++;
    const promptSimples = `Gera APENAS JSON para o capítulo ${capNum} "${capTit}" sobre "${tema}".
Subtópicos: ${capSubs.join('; ')}
JSON (sem markdown, sem texto):
{"chapter_id":"${capNum}","title":"${capTit}","sections":[{"section_id":"${capNum}.1","title":"${capSubs[0]||'Introdução'}","paragraphs":["Parágrafo 1.","Parágrafo 2.","Parágrafo 3."]}]}
Português formal académico. Mínimo 3 parágrafos por secção.`;
    const r2 = await callAI([{ role:'user', content:promptSimples }], { max_tokens:maxTok, temperature:0.5 });
    rawFallback = r2;
    try { astRaw = extrairJSON(r2); } catch (_) {}
  }

  const ast = repararAST(astRaw || rawFallback, capNum, capTit, capSubs);
  if (ast._repaired) {
    console.warn(`[AST v72] Reparado — cap ${capNum} — razão: ${ast._repair_reason}`);
  }

  const health   = calcularDocumentHealth(ast, nivelKey);
  const readiness = calcularReadiness(ast, nivelKey, geoCtx);

  ast.version      = (ast.version || 0) + 1;
  ast.generated_by = 'academy-engine-v73';
  ast.generated_at = new Date().toISOString();
  ast.retry_count  = retryCount;

  const confidence = calcularConfidence(ast, {
    retry_count       : retryCount,
    ast_repaired      : ast._repaired || false,
    repair_reason     : ast._repair_reason || null,
    generation_time_ms: Date.now() - _startTime,
  });

  const totalWords = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).join(' ').split(/\s+/).length, 0
  );
  registarTelemetria({
    tema, nivel, area: areaKey, tipo, cap_num: capNum,
    ast_generated      : true,
    ast_repaired       : ast._repaired || false,
    repair_reason      : ast._repair_reason || null,
    retry_count        : retryCount,
    health             : health.health,
    confidence         : confidence.confidence,
    ready              : readiness.ready,
    generation_time_ms : Date.now() - _startTime,
    pages_requested    : totalPags,
    word_count         : totalWords,
    model_used         : 'openrouter/google/gemini-2.5-flash-lite',
  });

  const completeness = calcularCompleteness(
    ast, palavras * (capSubs.length || 3), totalCaps, nivelKey
  );

  health.issues = enriquecerIssuesComAccoes(health.issues);

  const firstPassSuccess = retryCount === 0 && !ast._repaired;
  registarTelemetria({
    tema, nivel, area: areaKey, tipo, cap_num: capNum,
    ast_generated      : true,
    ast_repaired       : ast._repaired || false,
    repair_reason      : ast._repair_reason || null,
    retry_count        : retryCount,
    first_pass_success : firstPassSuccess,
    health             : health.health,
    confidence         : confidence.confidence,
    completeness       : completeness.completeness,
    ready              : readiness.ready,
    generation_time_ms : Date.now() - _startTime,
    pages_requested    : totalPags,
    word_count         : completeness.palavras,
    model_used         : 'openrouter/google/gemini-2.5-flash-lite',
  });

  return {
    resposta    : ast,
    ast         : true,
    health,
    readiness,
    confidence,
    completeness,
    _guaranteed : true,
  };
}

/* ---------------- REFERÊNCIAS (com peneira + retry) ---------------- */
async function doReferencias(p) {
  const tema  = (p.tema||'').substring(0,300);
  const tipo  = (p.tipoTrabalho||'Trabalho Académico').substring(0,100);
  const nivel = (p.nivel||'').substring(0,80);
  const nivelKey = detectarNivel(nivel);
  const areaKey  = detectarArea(tema, p.area);
  const pNivel   = PERFIL_NIVEL[nivelKey];
  const pArea    = PERFIL_AREA[areaKey];
  const geoCtxR  = detectarContextoGeo(tema, p.pais);
  const geoRefsInstrucao = geoCtxR === 'angola'
    ? `O tema é sobre Angola. Inclui fontes relevantes combinadas com literatura internacional.`
    : `As referências devem ser de revistas académicas internacionais. Evita fontes específicas de qualquer país a menos que o tema o exija.`;
  const totalPags = parseInt(p.totalPags) || 15;
  const numRefs   = Math.min(18, Math.max(10, Math.round(totalPags * 0.6)));
  const MIN_VALIDAS = Math.max(6, Math.round(numRefs * 0.6));

  const montarPrompt = (reforcar) => `És um bibliotecário académico especialista em ${pArea.label}, a preparar a lista de referências bibliográficas de um ${tipo} de nível ${nivel} sobre "${tema}".

TAREFA: gera exactamente ${numRefs} referências bibliográficas reais e plausíveis, em formato APA.

${geoRefsInstrucao}
${pNivel.citacoes}

FORMATO OBRIGATÓRIO — uma referência por bloco, cada bloco separado por LINHA EM BRANCO:
Apelido, I. (Ano). Título da obra. Editora ou Revista, volume(número), páginas.

REGRAS RÍGIDAS:
- CADA entrada TEM de conter o padrão "(Ano)." logo a seguir ao(s) autor(es)
- Ano entre 1950 e ${new Date().getFullYear()}
- NUNCA repitas o mesmo autor+título
- Mistura livros, artigos de revista e fontes institucionais se fizer sentido
- Sem bullets, sem numeração, sem markdown — só texto
- Português formal, normas APA
${reforcar ? '\nATENÇÃO: a tentativa anterior teve referências inválidas. Confirma que TODAS têm autor, ano entre parêntesis, título e editora.' : ''}

Escreve as ${numRefs} referências agora.`;

  let bruta = await callAI([{ role:'user', content: montarPrompt(false) }], { max_tokens:2500, temperature:0.4 });
  let peneira = peneirarReferencias(bruta);

  if (peneira.validas.length < MIN_VALIDAS) {
    console.warn(`[Referências] ${peneira.validas.length}/${numRefs} válidas — retry reforçado`);
    const bruta2 = await callAI([{ role:'user', content: montarPrompt(true) }], { max_tokens:2500, temperature:0.35 });
    const peneira2 = peneirarReferencias(bruta2);
    if (peneira2.validas.length > peneira.validas.length) peneira = peneira2;
  }

  return {
    resposta: peneira.texto || 'Nenhuma referência válida gerada.',
    referencias_validas: peneira.validas.length,
    referencias_pedidas: numRefs,
    referencias_rejeitadas: peneira.invalidas,
  };
}

/* ---------------- PLANO ACADÉMICO ---------------- */
async function doPlano(p) {
  const tema = (p.tema||'').substring(0,300);
  if (!tema) throw new Error('tema obrigatório');
  const r = await callAI([{ role:'user', content:
    `Cria um plano académico para um ${p.tipoTrabalho||'TFC'} de nível "${p.nivel||''}" sobre "${tema}".
Responde APENAS com JSON válido, sem markdown:
{"objetivo":"...","hipotese":"...","problema":"...","metodologia":"..."}`
  }], { max_tokens:600, temperature:0.4 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- ESTRUTURA ACADÉMICA ---------------- */
async function doEstrutura(p) {
  const tema = (p.tema||'').substring(0,300);
  if (!tema) throw new Error('tema obrigatório');
  const pags = Math.min(Math.max(parseInt(p.totalPags)||15, 5), 100);
  const r = await callAI([{ role:'user', content:
    `Estrutura capítulos para um ${p.tipoTrabalho||'TFC'} de nível "${p.nivel||''}" sobre "${tema}". ${pags} páginas.
${p.objetivo ? 'Objectivo: '+p.objetivo : ''}
Responde APENAS com array JSON, sem markdown:
[{"num":1,"titulo":"...","subs":["Subtópico 1.1","Subtópico 1.2","Subtópico 1.3"]},...]
Regras: 3-6 capítulos, 2-4 subtópicos cada, último capítulo "Referências Bibliográficas" sem subs.`
  }], { max_tokens:1000, temperature:0.4 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- EDITAR TEXTO ---------------- */
async function doEditar(p) {
  const texto  = (p.texto||'').substring(0,8000);
  const subacao = p.subacao||p.acao||'melhorar';
  if (!texto) throw new Error('texto obrigatório');

  /* Edição completa do documento — IA retorna JSON estruturado */
  if (subacao === 'editar_documento_completo') {
    const prompt = [
      `És um orientador académico. O documento abaixo mostra blocos de conteúdo.`,
      `\n\nPedido do utilizador: "${(p.pedido||'').substring(0,500)}"`,
      `\n\nDocumento actual (blocos separados por ---):`,
      `\n${texto}`,
      `\n\nResponde APENAS com JSON no formato:`,
      `{"operacoes":[`,
      `  {"accao":"editar","chapterIdx":0,"blockId":"...","conteudo":"novo texto"},`,
      `  {"accao":"inserir","chapterIdx":0,"afterBlockId":"...","conteudo":"novo parágrafo","type":"paragraph"},`,
      `  {"accao":"remover","chapterIdx":0,"blockId":"..."}`,
      `]}`,
      `\nRegras:`,
      `- Mantém tom académico formal português`,
      `- Preserva conteúdo não mencionado no pedido`,
      `- Usa os mesmos blockId existentes para editar`,
      `- Para inserir, usa afterBlockId do bloco anterior (ou null para fim)`,
      `- Remove apenas se o pedido explicitamente pedir`,
      `- Devolve array vazio se não houver alterações: {"operacoes":[]}`,
      `- APENAS JSON, sem markdown, sem explicações`,
    ].join('\n');
    const r = await callAI([{ role:'user', content: prompt }],
      { max_tokens:4000, temperature:0.3 });
    /* Tentar extrair JSON */
    let json;
    try {
      const m = r.match(/```json\n?([\s\S]*?)\n?```/);
      json = JSON.parse(m ? m[1] : r);
    } catch { json = { operacoes: [] }; }
    return json;
  }

  const instrucoes = {
    melhorar:   'Melhora o estilo académico mantendo o conteúdo. Português formal académico.',
    expandir:   'Expande com mais detalhe académico (+30%). Português formal académico.',
    resumir:    'Resume mantendo as ideias principais (-40%). Português formal académico.',
    formalizar: 'Formaliza a linguagem para nível universitário.',
  };
  const r = await callAI([{ role:'user', content:`${instrucoes[subacao]||instrucoes.melhorar}\n\nTexto:\n${texto}\n\nDevolve apenas o texto editado.` }],
    { max_tokens:4000, temperature:0.5 });
  return { resposta: r };
}

/* ---------------- VERIFICAR COERÊNCIA ---------------- */
async function doCoerencia(p) {
  const a = (p.introTexto||p.textoA||'').substring(0,2000);
  const b = (p.concTexto||p.textoB||'').substring(0,2000);
  if (!a||!b) throw new Error('textos obrigatórios');
  const r = await callAI([{ role:'user', content:
    `Analisa a coerência entre introdução e conclusão de um trabalho académico.
Responde APENAS com JSON:
{"coerente":true/false,"problemas":["..."],"sugestoes":["..."]}
Introdução: ${a}
Conclusão: ${b}`
  }], { max_tokens:600, temperature:0.3 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- MEA ---------------- */
async function doMEA(action, p) {
  const tipo_mea = action==='mea_grafico'?'gráfico':action==='mea_tabela'?'tabela':'esquema';
  const tema     = (p.tema||'').substring(0,200);
  const resumo = Array.isArray(p.capitulos)
    ? p.capitulos.slice(0,5).map(c=>`${c.titulo}: ${(c.c||c.conteudo||'').substring(0,200)}`).join('\n')
    : (p.capResumo||p.capTitulo||'').substring(0,400);
  const schemas = {
    mea_grafico: '{"tipo":"grafico","titulo":"...","eixoX":"...","eixoY":"...","dados":[{"label":"...","valor":0}]}',
    mea_tabela:  '{"tipo":"tabela","titulo":"...","colunas":["..."],"linhas":[["...","..."]]}',
    mea_esquema: '{"tipo":"esquema","titulo":"...","nos":[{"id":"...","texto":"...","ligacoes":["..."]}]}',
  };
  const schema = schemas[action] || schemas.mea_esquema;
  const r = await callAI([{ role:'user', content:
    `Cria um ${tipo_mea} académico para o trabalho sobre "${tema}".
Conteúdo dos capítulos: ${resumo}
Responde APENAS com JSON neste formato exacto (sem markdown): ${schema}`
  }], { max_tokens:1000, temperature:0.5 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- SUPABASE: SAVE ---------------- */
async function doSaveHistory(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url||!key) return { saved:false };
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 10000);
  try {
    await fetch(`${url}/rest/v1/academy_history`, {
      method:'POST', signal:ctrl.signal,
      headers:{ 'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`,'Prefer':'return=minimal' },
      body:JSON.stringify({ user_id:p.user_id, tipo:p.tipo, tema:p.tema, pags:p.pags, metadata:p.metadata, created_at:new Date().toISOString() }),
    });
  } finally { clearTimeout(t); }
  return { saved:true };
}

/* ---------------- SUPABASE: GET ---------------- */
async function doGetHistory(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url||!key) return { rows:[] };
  const params = new URLSearchParams({ select:'*', user_id:`eq.${p.user_id||''}`, order:'created_at.desc', limit:String(Math.min(parseInt(p.limit)||20,100)) });
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 10000);
  let rows = [];
  try {
    const r = await fetch(`${url}/rest/v1/academy_history?${params}`, { signal:ctrl.signal, headers:{ apikey:key, Authorization:`Bearer ${key}` } });
    rows = await r.json();
  } finally { clearTimeout(t); }
  return { rows: Array.isArray(rows)?rows:[] };
}

/* ---------------- SETUP TABLES (Supabase) ---------------- */
async function doSetupTables() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url||!key) return { created:[], error:'no_supabase_creds' };
  const sql = `
CREATE TABLE IF NOT EXISTS instituicoes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT,
  desconto_porcentagem INTEGER DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO instituicoes (nome, sigla, desconto_porcentagem) VALUES
  ('Universidade Agostinho Neto','UAN',10),
  ('Universidade Independente de Angola','UNIA',10),
  ('Universidade Católica de Angola','UCAN',10),
  ('Universidade Lusíada de Angola','ULA',10),
  ('Instituto Superior Politécnico de Angola','ISPA',10)
ON CONFLICT (nome) DO NOTHING;
CREATE TABLE IF NOT EXISTS comissoes (
  id SERIAL PRIMARY KEY,
  parceiro_nome TEXT NOT NULL,
  parceiro_whatsapp TEXT,
  valor_venda INTEGER NOT NULL,
  percentagem INTEGER NOT NULL DEFAULT 10,
  valor_comissao INTEGER NOT NULL,
  estado TEXT DEFAULT 'pendente',
  pagamento_ref TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  pago_em TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS parceiros (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  comissao_porcentagem INTEGER DEFAULT 10,
  codigo TEXT UNIQUE,
  activo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO precos (faixa_inicio, faixa_fim, preco, label, ativo) VALUES
  (0, 15, 1850, '0-15 páginas', true),
  (16, 20, 2250, '16-20 páginas', true),
  (21, 30, 5500, '21-30 páginas', true),
  (31, 50, 8500, '31-50 páginas', true)
ON CONFLICT (faixa_inicio, faixa_fim) DO NOTHING;
INSERT INTO planos_grafica (nome, paginas, preco, ativo) VALUES
  ('Gráfica 150', 150, 15000, true),
  ('Gráfica 300', 300, 25000, true),
  ('Gráfica 500', 500, 40000, true)
ON CONFLICT (nome) DO NOTHING;
  `;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}` },
      body:JSON.stringify({ sql }),
    });
    return { created:true, tables:['instituicoes'], seed:5 };
  } catch(e) {
    /* Fallback: tentar via SQL direto no Management API */
    try {
      const mgmtKey = process.env.SUPABASE_SERVICE_KEY;
      const projectRef = 'avdzkucdehggueafyukw';
      await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${mgmtKey}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ query:sql }),
      });
      return { created:true, method:'mgmt_api' };
    } catch(e2) {
      return { created:false, error:e2.message };
    }
  }
}

/* ---------------- HEALTH CHECK ---------------- */
async function doHealthCheck() {
  const checks = {};
  /* 1. Variáveis de ambiente */
  checks.openrouter = !!process.env.OPENROUTER_API_KEY;
  checks.supabase_url = !!process.env.SUPABASE_URL;
  checks.supabase_key = !!process.env.SUPABASE_SERVICE_KEY;
  checks.admin_pin = !!process.env.ADMIN_PIN;
  /* 2. Supabase tables */
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    for (const table of ['utilizadores','pagamentos','documentos','senhas_usadas','planos_utilizadores','precos','planos_grafica','academy_ai_logs','academy_history','instituicoes','comissoes','parceiros']) {
      try {
        const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers:{ apikey:key, Authorization:`Bearer ${key}` } });
        checks[`table_${table}`] = r.ok;
      } catch { checks[`table_${table}`] = false; }
    }
  }

  const totalOk = Object.values(checks).filter(v => v === true).length;
  const totalChecks = Object.values(checks).filter(v => v !== undefined).length;
  return { checks, total_ok: totalOk, total_checks: totalChecks, healthy: totalOk === totalChecks };
}

/* ---------------- ENGINE IA (OpenRouter) ---------------- */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callAI(messages, opts={}) {
  const model  = opts.model  || 'google/gemini-2.5-flash-lite';
  const orKey  = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (!orKey) throw new Error('OPENROUTER_API_KEY não configurada');

  try {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 30000);
    let resp;
    try {
      resp = await fetch(OPENROUTER_URL, {
        method:'POST', signal:ctrl.signal,
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+orKey,
          'HTTP-Referer':'https://academy-open.vercel.app',
          'X-Title':'ACADEMY',
        },
        body:JSON.stringify({ model, messages, temperature:opts.temperature??0.7, max_tokens:opts.max_tokens??800, stream:false }),
      });
    } finally { clearTimeout(t); }
    if (!resp.ok) { const err=await resp.text().catch(()=>String(resp.status)); throw new Error('OpenRouter '+resp.status+': '+err); }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text || text.length<=10) throw new Error('resposta vazia ou muito curta');
    return text;
  } catch(e) { throw new Error('OpenRouter: '+e.message); }
}

/* ---------------- PENEIRA DE REFERÊNCIAS ---------------- */
function peneirarReferencias(texto) {
  if (!texto) return { validas: [], invalidas: 0, texto: '' };
  const anoAtual = new Date().getFullYear();
  const blocos = texto.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const padraoRef = /^[A-ZÀ-Ü][\wçãáéíóúâêôõüÇÃÁÉÍÓÚÂÊÔÕÜ.,&\s]{2,80}\(\d{4}\)\.\s*.{10,}/;
  const vistos = new Set();
  const validas = [];
  let invalidas = 0;
  for (const bloco of blocos) {
    const b = bloco.replace(/\s+/g, ' ').trim();
    const matchAno = b.match(/\((\d{4})\)/);
    const ano = matchAno ? parseInt(matchAno[1]) : null;
    const formaOk  = padraoRef.test(b);
    const anoOk    = ano && ano >= 1950 && ano <= anoAtual;
    const tamanhoOk = b.length >= 40 && b.length <= 400;
    if (!formaOk || !anoOk || !tamanhoOk) { invalidas++; continue; }
    const aposAno = b.split(/\(\d{4}\)\.\s*/)[1] || b;
    const chave = aposAno.toLowerCase().replace(/[^\wà-ü]/g, '').substring(0, 60);
    if (vistos.has(chave)) { invalidas++; continue; }
    vistos.add(chave);
    validas.push(b);
  }
  return { validas, invalidas, texto: validas.join('\n\n') };
}

/* ---------------- JSON EXTRACTOR ---------------- */
function extrairJSON(texto) {
  if (!texto) throw new Error('resposta vazia');
  const s = texto.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (m) try { return JSON.parse(m[1]); } catch {}
  throw new Error('JSON inválido na resposta');
}

/* ---------------- HELPER ---------------- */
function ok(action, data) {
  return { ok:true, action, data, meta:{ ts:Date.now(), provider:'openrouter', model:'google/gemini-2.5-flash-lite' } };
}
