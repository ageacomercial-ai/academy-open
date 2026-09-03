/* ═══════════════════════════════════════════════════════════
   ACADEMY — GENERATOR.JS
   Loop de geração de capítulos com IA.
   Chamadas ao /api/engine, anti-detecção, memória do documento.
   Depende de: state.js, navigation.js
═══════════════════════════════════════════════════════════ */

const ACADEMY_ENGINE_URL = '/api/engine';

/* ── Delays mínimos — percepção de velocidade ── */
const _DELAY       = (i) => i === 0 ? 0 : i < 8 ? 80 : 150;
const _RETRY_QUOTA = 30000; /* 30s de espera ao detectar rate limit */
const _GEN_SAVE_KEY = 'acy_gen_prog';

let _genCancelado = false;
let _genPausadoIndisponivel = false;
let _treRetroRefCount = 0;
let _genTimerInterval = null;
let _genMicroIt = null;
let _genStartTime = 0;

/* ═══════════════════════════════════════════════════════════
   CHAMADA CENTRAL AO /api/engine
   Arquitectura: Frontend → /api/engine → switch(action)
   Único provider de IA: OpenRouter (no backend)
═══════════════════════════════════════════════════════════ */

async function callAcademyAPI(rawPayload) {
  const action = rawPayload.acao || rawPayload.tipo || '';
  const { acao: _a, tipo: _t, ...payload } = rawPayload;
  /* AI Router decide o provedor/modelo (Ollama → OpenRouter FREE → API existente).
     O frontend não envia chaves nem escolhe modelos. */

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 300000);
  try {
    const resp = await fetch(ACADEMY_ENGINE_URL, {
      method:  'POST',
      mode:    'cors',
      signal:  ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, payload }),
    });

    if (!resp.ok) {
      const ed = await resp.json().catch(() => ({}));
      const e = new Error(ed?.error || 'Engine HTTP ' + resp.status);
      e.retry   = !!ed?.retry;
      e.generic = !!ed?.generic || ed?.error === 'AI_INDISPONIVEL';
      e.details = ed?.data   || null;
      throw e;
    }

    const envelope = await resp.json();
    if (!envelope?.ok) {
      const e = new Error(envelope?.error || 'Engine: resposta inválida');
      e.retry   = !!envelope?.retry;
      e.generic = !!envelope?.generic || envelope?.error === 'AI_INDISPONIVEL';
      e.details = envelope?.data || null;
      throw e;
    }

    const resposta = envelope?.data?.resposta;
    if (resposta === undefined || resposta === null || resposta === '') {
      throw new Error('Engine: resposta vazia');
    }

    if (action === 'gerar_capitulo' || action === 'gerar_capitulo_referencias' || action === 'regenerar_capitulo') {
      return {
        resposta,
        health:       envelope.data.health       || null,
        readiness:    envelope.data.readiness    || null,
        confidence:   envelope.data.confidence   || null,
        completeness: envelope.data.completeness || null,
        _guaranteed:  envelope.data._guaranteed  || false,
      };
    }
    return resposta;
  } finally {
    clearTimeout(tid);
  }
}

/* ── Converter AST de capítulo em texto plano ── */
function astParaTexto(ast) {
  if (!ast || !ast.sections) return '';
  const isLixoAST = s => /^\s*[\{\[]/.test(s) || /"(?:chapter_id|section_id|title|paragraphs|content|status|generated_at|generated_by|version|sections)"\s*:/.test(s);
  return ast.sections.map(sec => {
    let txt = '';
    const tituloSec = sec.titulo || sec.title || '';
    if (tituloSec && !isLixoAST(tituloSec)) txt += tituloSec + '\n\n';
    const paras = sec.paragrafos || sec.paragraphs || [];
    const parasLimpos = paras.filter(p => p && typeof p === 'string' && !isLixoAST(p) && p.length > 5);
    if (parasLimpos.length) txt += parasLimpos.join('\n\n');
    return txt;
  }).filter(s => s && s.trim().length > 0).join('\n\n');
}

/* ── Render de erro de API no ecrã ── */
/* Regra: a infraestrutura é transparente. O utilizador NUNCA vê
   provedor, modelo, quota, GPU ou causas técnicas. Apenas mensagens
   profissionais e genéricas. */
function renderErroAPI(ec, erMsg, retryCb, voltarCb, generic) {
  const linhas  = erMsg.replace('ACADEMY FALHOU:\n', '').split('\n').filter(Boolean);
  const isCORS  = erMsg.includes('EDGE_DOWN') || linhas.some(l => l.includes('CORS') || l.includes('Failed to fetch') || l.includes('NetworkError'));

  const MENSAGEM_GENERICA_TITULO = 'Processamento temporariamente indisponível';
  const MENSAGEM_GENERICA_DESC   = 'O serviço está passando por uma indisponibilidade momentânea. Tente novamente dentro de alguns minutos.';

  let icone  = '⏳';
  let titulo = MENSAGEM_GENERICA_TITULO;
  let desc   = MENSAGEM_GENERICA_DESC;
  let semTecnica = true;

  if (generic || /AI_INDISPONIVEL|CAPITULO_INVALIDO/.test(erMsg)) {
    /* indisponibilidade total → mensagem profissional, sem detalhes técnicos */
  } else if (isCORS) {
    titulo = MENSAGEM_GENERICA_TITULO;
    desc   = MENSAGEM_GENERICA_DESC;
    semTecnica = true;
  } else {
    /* outros erros: mesmo assim mensagem genérica profissional */
    semTecnica = true;
  }

  const botaoRetry = `<button class="btn B" onclick="${retryCb}">↺ Tentar novamente</button>`;
  const botaoVoltar = `<button class="btn G" onclick="${voltarCb}" style="margin-top:2px">← Voltar</button>`;

  if (ec) ec.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;text-align:center;padding:24px">
      <div style="font-size:40px">${icone}</div>
      <div class="T1" style="font-size:20px">${titulo}</div>
      <div class="desc" style="max-width:320px">${desc}</div>
      ${botaoRetry}
      ${botaoVoltar}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   GERAR PLANO E ESTRUTURA
═══════════════════════════════════════════════════════════ */

async function gerarPlano() {
  State.set('load', true);
  irPara('plano');
  try {
    const tp  = tipoActual() || { n: 'Trabalho Académico' };
    const raw = await callAcademyAPI({
      acao:         'plano_academico',
      tema:         State.getCfg('tema'),
      tipoTrabalho: tp.n,
      nivel:        State.getCfg('nivel'),
    });
    State.set('plano', typeof raw === 'object' ? raw : JSON.parse(raw));
  } catch (e) {
    State.set('plano', null);
    State.set('load', false);
    const ec = document.querySelector('.ecra');
    renderErroAPI(ec, e.message || 'erro desconhecido', 'gerarPlano()', "irPara('nivel')", e.generic);
    return;
  }
  State.set('load', false);
  irPara('plano');
}

async function gerarEst() {
  State.set('load', true);
  irPara('est');
  try {
    const tp             = tipoActual() || { n: 'Trabalho Académico' };
    const estruturaPadrao = getEstruturaTipo(State.getCfg('tipo'));
    const raw            = await callAcademyAPI({
      acao:             'estrutura_academica',
      tema:             State.getCfg('tema'),
      tipoTrabalho:     tp.n,
      nivel:            State.getCfg('nivel'),
      pags:             State.getCfg('pags'),
      numCaps:          State.getCfg('numCaps') || 5,
      estruturaProf:    State.getCfg('estruturaProf') || '',
      estruturaPadrao:  estruturaPadrao?.caps || [],
    });
    const parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
    /* Normalizar: o motor pode devolver array directo ou { capitulos:[...] }.
       NUNCA guardar um objecto como est — o render e o loop esperam array. */
    let estFinal = null;
    if (Array.isArray(parsed))                    estFinal = parsed;
    else if (Array.isArray(parsed?.capitulos))    estFinal = parsed.capitulos;
    else {
      const primeiroArray = Object.values(parsed || {}).find(Array.isArray);
      estFinal = Array.isArray(primeiroArray) ? primeiroArray : null;
    }
    if (estFinal?.length) {
      State.set('est', estFinal);
    } else {
      throw new Error('ESTRUTURA_INVALIDA');
    }
  } catch (e) {
    /* Fallback: estrutura padrão sem IA */
    const estruturaPadrao = getEstruturaTipo(State.getCfg('tipo'));
    if (estruturaPadrao?.caps?.length > 0) {
      State.set('est', estruturaPadrao.caps);
      State.set('load', false);
      irPara('est');
      return;
    }
    State.set('est', null);
    State.set('load', false);
    const ec = document.querySelector('.ecra');
    renderErroAPI(ec, e.message || 'erro desconhecido', 'gerarEst()', "irPara('plano')", e.generic);
    return;
  }
  State.set('load', false);
  irPara('est');
}

/* ═══════════════════════════════════════════════════════════
   SISTEMA ANTI-DETECÇÃO IA
   Centralizado em academic/prompts/system.js (backend).
   O backend (montarPromptCapitulo) já injecta as instruções
   anti-IA. Esta função frontend está obsoleta.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   DOCUMENT MEMORY ENGINE
   Regista o que já foi usado — injecta proibições no próximo prompt.
═══════════════════════════════════════════════════════════ */

const DOC_MEMORY = {
  conectoresUsados: new Set(),
  frasesUsadas:     new Set(),
  autoresCitados:   new Set(),
  exemplosUsados:   new Set(),
  conceitosChave:   new Set(),
  _capitulosTexto:  [],
  _autoresDetalhados: [], /* [{autor, ano, contexto}] */

  reset() {
    this.conectoresUsados.clear();
    this.frasesUsadas.clear();
    this.autoresCitados.clear();
    this.exemplosUsados.clear();
    this.conceitosChave.clear();
    this._capitulosTexto = [];
    this._autoresDetalhados = [];
  },

  registar(texto) {
    if (!texto || texto.length < 50) return;
    /* Resumo do capítulo */
    this._capitulosTexto.push(texto.substring(0, 200).replace(/\n/g, ' '));

    /* Extrair conectores usados */
    const conn = ['Além disso', 'Por outro lado', 'No entanto', 'Todavia', 'Portanto', 'Desta forma', 'Em suma', 'Com efeito'];
    conn.forEach(c => { if (texto.includes(c)) this.conectoresUsados.add(c); });

    /* Extrair frases de 4+ palavras para evitar repetição */
    const frases = texto.match(/[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÜ][^.!?]{15,80}[.!?]/g) || [];
    frases.slice(0, 8).forEach(f => this.frasesUsadas.add(f.substring(0, 60)));

    /* EXTRAIR AUTORES CITADOS — prioridade máxima */
    this.extrairAutoresCitados(texto);
  },

  extrairAutoresCitados(texto) {
    if (!texto) return;

    /* BUG-006/P1-4: as 3 regex originais tinham grupos de captura errados
       (o ano nunca ficava completo num único grupo — ex. m[2]+m[3] com
       m[3]=undefined → "20undefined"), e a classe de caracteres do autor
       só aceitava minúsculas após a inicial, falhando em siglas como
       INE/OMS/ONU. Reescritas com o ano completo num único grupo e
       aceitando siglas maiúsculas. */

    /* Padrão 1: (Autor, Ano) ou (Autor & Autor, Ano) */
    const padraoParenteses = /\(([A-ZÀ-Ü][A-Za-zà-ÿ]*(?:\s*&\s*[A-ZÀ-Ü][A-Za-zà-ÿ]*)*),\s*((?:19|20)\d{2}[a-z]?)\)/g;
    let m;
    while ((m = padraoParenteses.exec(texto)) !== null) {
      const autor = m[1].trim();
      const ano = m[2];
      const chave = `${autor} (${ano})`;
      if (!this.autoresCitados.has(chave)) {
        this.autoresCitados.add(chave);
        this._autoresDetalhados.push({ autor, ano, contexto: texto.substring(Math.max(0, m.index - 80), m.index + m[0].length + 80) });
      }
    }

    /* Padrão 2: Autor (Ano) no início da frase ou após ponto */
    const padraoAutorInicio = /(?:^|[.!?]\s+)([A-ZÀ-Ü][A-Za-zà-ÿ]*(?:\s+[a-zà-ÿ]+){0,3})\s*\(((?:19|20)\d{2}[a-z]?)\)/g;
    while ((m = padraoAutorInicio.exec(texto)) !== null) {
      const autor = m[1].trim();
      const ano = m[2];
      const chave = `${autor} (${ano})`;
      if (!this.autoresCitados.has(chave)) {
        this.autoresCitados.add(chave);
        this._autoresDetalhados.push({ autor, ano, contexto: '' });
      }
    }

    /* Padrão 3: "segundo Autor (Ano)" ou "conforme Autor (Ano)" */
    const padraoSegundo = /(segundo|conforme|de acordo com|citado por|apud)\s+([A-ZÀ-Ü][A-Za-zà-ÿ]*(?:\s+[a-zà-ÿ]+){0,3})\s*\(((?:19|20)\d{2}[a-z]?)\)/gi;
    while ((m = padraoSegundo.exec(texto)) !== null) {
      const autor = m[2].trim();
      const ano = m[3];
      const chave = `${autor} (${ano})`;
      if (!this.autoresCitados.has(chave)) {
        this.autoresCitados.add(chave);
        this._autoresDetalhados.push({ autor, ano, contexto: '' });
      }
    }
  },

  gerarInstrucao() {
    const proibidos = [...this.conectoresUsados].slice(0, 5).join(', ');
    const frases    = [...this.frasesUsadas].slice(0, 3).map(f => `"${f}"`).join(', ');
    
    /* Lista de autores já citados para evitar repetição */
    const autoresJaCitados = [...this.autoresCitados].slice(-8).join(', ');
    const instrutoresAutores = autoresJaCitados 
      ? `\n- AUTORES JÁ UTILIZADOS NOS CAPÍTULOS ANTERIORES: ${autoresJaCitados}. Tenta usar novos autores ou aprofunda diferentes aspetos dos mesmos.`
      : '';

    if (!proibidos && !frases && !instrutoresAutores) return '';
    return `MEMÓRIA DO DOCUMENTO (PROIBIÇÕES ABSOLUTAS PARA ESTE CAPÍTULO):
${proibidos ? `- PROIBIDO usar estes conectores já usados: ${proibidos}` : ''}
${frases    ? `- PROIBIDO começar frases com: ${frases}` : ''}${instrutoresAutores}
- OBRIGATÓRIO: este capítulo deve ter estilo e vocabulário claramente diferente dos anteriores.`;
  },

  getAutoresParaReferencias() {
    /* Retorna lista única de autores para validar contra bibliografia */
    return [...this.autoresCitados].map(s => {
      const partes = s.split(' (');
      return { autor: partes[0], ano: partes[1]?.replace(')', '') || '' };
    });
  }
};

/* ── Registar capítulo no DOC_MEMORY após geração ── */
function ailRegistarCapitulo(texto) {
  DOC_MEMORY.registar(texto);
}

/* ═══════════════════════════════════════════════════════════
   AUDITORIA ACADÉMICA — validação automática de qualidade
   ═══════════════════════════════════════════════════════════ */
function verificarQualidadeAcademica(secs) {
  const resultado = {
    valido: true,
    avisos: [],
    erros: [],
    verificacoes: {}
  };

  /* 1. Verificar se todos os capítulos têm conteúdo substancial */
  let totalPalavras = 0;
  secs.forEach((sec, i) => {
    if (/refer[eê]ncias|bibliograf/i.test(sec.titulo || '')) return;
    const palavras = (sec.c || '').split(/\s+/).length;
    totalPalavras += palavras;
    
    if (palavras < 150) {
      resultado.erros.push(`Capítulo ${sec.num || i+1} "${sec.titulo}" tem apenas ${palavras} palavras (mínimo: 150)`);
      resultado.valido = false;
    } else if (palavras < 300) {
      resultado.avisos.push(`Capítulo ${sec.num || i+1} "${sec.titulo}" tem apenas ${palavras} palavras (recomendado: 300+)`);
    }
  });

  resultado.verificacoes.totalPalavras = totalPalavras;

  /* 2. Verificar objetivos presentes */
  const temObjetivos = secs.some(s => 
    /(objetivo|objetivos|finalidades|propósitos)/i.test(s.c || '')
  );
  resultado.verificacoes.temObjetivos = temObjetivos;
  if (!temObjetivos) {
    resultado.avisos.push('Não foram detetados objetivos claros no documento');
  }

  /* 3. Verificar metodologia presente */
  const temMetodologia = secs.some(s =>
    /(metodologia|método|abordagem|procedimento|técnicas de pesquisa)/i.test(s.c || '')
  );
  resultado.verificacoes.temMetodologia = temMetodologia;
  if (!temMetodologia) {
    resultado.avisos.push('Não foi detetada descrição metodológica');
  }

  /* 4. Verificar problema de pesquisa */
  const temProblema = secs.some(s =>
    /(problema|questão|pergunta de investigação|problemática)/i.test(s.c || '')
  );
  resultado.verificacoes.temProblema = temProblema;
  if (!temProblema) {
    resultado.avisos.push('Não foi detetado problema de pesquisa claro');
  }

  /* 5. Verificar dados quantitativos */
  const dadosQuantitativos = secs.reduce((count, s) => {
    const matches = (s.c || '').match(/\d+[\.,]?\d*\s*(%|por cento|mil|milhões)/gi) || [];
    return count + matches.length;
  }, 0);
  resultado.verificacoes.dadosQuantitativos = dadosQuantitativos;
  if (dadosQuantitativos < 3) {
    resultado.avisos.push(`Apenas ${dadosQuantitativos} dados quantitativos detetados (recomendado: 5+)`);
  }

  /* 6. Verificar diversidade de citações */
  const autoresCitados = DOC_MEMORY.getAutoresParaReferencias();
  resultado.verificacoes.autoresCitados = autoresCitados.length;
  if (autoresCitados.length < 5) {
    resultado.avisos.push(`Apenas ${autoresCitados.length} autores citados (recomendado: 5+)`);
  }

  /* 7. Verificar correspondência citações ↔ referências */
  const secRefs = secs.find(s => /refer[eê]ncias|bibliograf/i.test(s.titulo || ''));
  
  if (autoresCitados.length > 0 && secRefs) {
    const refsTexto = secRefs.c || '';
    let refsFaltantes = [];
    let refsNaoUsadas = [];

    autoresCitados.forEach(({ autor, ano }) => {
      const padraoBusca = new RegExp(`${autor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,\\.]?\\s*\\(${ano}\\)`);
      if (!padraoBusca.test(refsTexto)) {
        refsFaltantes.push({ autor, ano });
      }
    });

    /* Verificar se há referências na bibliografia que não são citadas */
    const padraoRefAPA = /([A-Z][a-zà-ÿ]+(?:[.,]\s*[A-Z]\.?)+)\s*\((19|20)\d{2}/g;
    let m;
    const refsBiblio = [];
    while ((m = padraoRefAPA.exec(refsTexto)) !== null) {
      refsBiblio.push({ autor: m[1], ano: m[2] + m[3] });
    }

    refsBiblio.forEach(ref => {
      const jaCitado = autoresCitados.some(a => a.autor === ref.autor && a.ano === ref.ano);
      if (!jaCitado) {
        refsNaoUsadas.push(ref);
      }
    });

    resultado.verificacoes.refsNaBibliografia = refsBiblio.length;
    resultado.verificacoes.refsFaltantes = refsFaltantes;
    resultado.verificacoes.refsNaoUsadas = refsNaoUsadas;

    if (refsFaltantes.length > 0) {
      resultado.erros.push(`${refsFaltantes.length} citação(ões) no texto sem referência na bibliografia: ${refsFaltantes.map(r => `${r.autor} (${r.ano})`).join(', ')}`);
      resultado.valido = false;
    }

    if (refsNaoUsadas.length > 2) {
      resultado.avisos.push(`${refsNaoUsadas.length} referências na bibliografia que não são citadas no texto`);
    }
  } else if (autoresCitados.length > 0 && !secRefs) {
    resultado.erros.push('Existem citações no texto mas não há secção de referências bibliográficas');
    resultado.valido = false;
  }

  /* 8. Verificar conclusão responde aos objetivos */
  const secConclusao = secs.find(s => /conclus[aã]o|considera[cç][oõ]es finais/i.test(s.titulo || ''));
  if (secConclusao) {
    const concPalavras = (secConclusao.c || '').split(/\s+/).length;
    resultado.verificacoes.conclusaoPalavras = concPalavras;
    if (concPalavras < 100) {
      resultado.avisos.push('Conclusão muito curta (< 100 palavras)');
    }
    
    /* Verificar se a conclusão responde ao problema */
    const temResposta = /(resposta|conclui|confirma|rejeita|verifica|confirmamos|rejeitamos)/i.test(secConclusao.c || '');
    resultado.verificacoes.conclusaoResposta = temResposta;
    if (!temResposta) {
      resultado.avisos.push('Conclusão não parece responder explicitamente ao problema de pesquisa');
    }
  } else {
    resultado.avisos.push('Não foi detetada secção de conclusão');
  }

  /* 9. Verificar introdução estruturada */
  const secIntro = secs.find(s => /introdu[cç][aã]o/i.test(s.titulo || ''));
  if (secIntro) {
    const introTexto = secIntro.c || '';
    const temContexto = /(contextualiza|introduz|apresenta)/i.test(introTexto);
    const temProblemaIntro = /(problema|questão|pergunta)/i.test(introTexto);
    const temObjetivosIntro = /(objetivo|finalidade|propósito)/i.test(introTexto);
    resultado.verificacoes.introTemContexto = temContexto;
    resultado.verificacoes.introTemProblema = temProblemaIntro;
    resultado.verificacoes.introTemObjetivos = temObjetivosIntro;
    
    if (!temContexto) resultado.avisos.push('Introdução não apresenta contextualização clara');
    if (!temProblemaIntro) resultado.avisos.push('Introdução não apresenta problema de pesquisa');
    if (!temObjetivosIntro) resultado.avisos.push('Introdução não apresenta objetivos');
  }

  /* 10. Verificar vocabulário anti-IA */
  const vocabularioIA = ['multifacetado', 'complexo', 'dinâmico', 'abrangente', 'significativo', 
    'relevante', 'importante', 'paradigma', 'ecossistema', 'alavancagem', 'ucket', 'engajamento',
    'impactante', 'sob a ótica', 'sob a perspectiva', 'no âmbito', 'à luz de', 'em face de'];
  
  let vocabIAEncontrado = 0;
  vocabularioIA.forEach(vocab => {
    const count = secs.reduce((acc, s) => {
      const matches = (s.c || '').toLowerCase().match(new RegExp(vocab, 'gi')) || [];
      return acc + matches.length;
    }, 0);
    if (count > 0) vocabIAEncontrado += count;
  });
  
  resultado.verificacoes.vocabularioIA = vocabIAEncontrado;
  if (vocabIAEncontrado > 5) {
    resultado.avisos.push(`${vocabIAEncontrado} ocorrências de vocabulário típico de IA detetado`);
  }

  return resultado;
}

/* Função para forçar regeneração de referências corretas */
async function regenerarReferenciasCorretas(secs) {
  const autoresCitados = DOC_MEMORY.getAutoresParaReferencias();
  if (autoresCitados.length === 0) return false;

  try {
    mostrarToast('⏳ A corrigir referências bibliográficas…');
    
    const res = await callAcademyAPI({
      acao: 'gerar_referencias',
      tema: State.getCfg('tema') || '',
      tipoTrabalho: (tipoActual() || { n: 'Trabalho Académico' }).n,
      nivel: State.getCfg('nivel') || '',
      area: State.getCfg('area') || '',
      autoresCitados: autoresCitados, /* Enviar lista de autores realmente citados */
    });

    if (typeof res === 'string' && res.length > 50) {
      /* Atualizar secção de referências existente ou criar nova */
      let secRefIdx = secs.findIndex(s => /refer[eê]ncias|bibliograf/i.test(s.titulo || ''));
      
      if (secRefIdx >= 0) {
        secs[secRefIdx].c = res;
        secs[secRefIdx].conteudo = res;
      } else {
        secs.push({
          num: secs.length + 1,
          titulo: 'Referências Bibliográficas',
          c: res,
          conteudo: res,
        });
      }
      
      State.set('secs', secs);
      autoGuardar();
      return true;
    }
  } catch (e) {
    console.warn('[AUDITORIA] Erro ao regenerar referências:', e);
  }
  
  return false;
}

/* ── Argumento Graph (rastreio de coerência argumentativa) ── */
const ARGUMENT_GRAPH = {
  argumentosPrincipais: [],
  conclusoesParciais:   [],
  autoresUtilizados:    [],
  conceitosCentrais:    [],

  reset() {
    this.argumentosPrincipais = [];
    this.conclusoesParciais   = [];
    this.autoresUtilizados    = [];
    this.conceitosCentrais    = [];
  },
};

function treRegistarCapitulo(texto, capNum) {
  if (!texto || texto.length < 100) return;
  ARGUMENT_GRAPH.argumentosPrincipais.push({
    cap:       capNum,
    resumo200: texto.substring(0, 200).replace(/\n/g, ' '),
  });
}

/* ═══════════════════════════════════════════════════════════
   GUARDAR / RESTAURAR PROGRESSO DE GERAÇÃO
═══════════════════════════════════════════════════════════ */

function genGuardarProgresso() {
  try {
    localStorage.setItem(_GEN_SAVE_KEY, JSON.stringify({
      secs: State.get('secs').map(s => ({ id: s.id, titulo: s.titulo, num: s.num, e: s.e, c: s.c || '' })),
      cfg:  { tema: State.getCfg('tema'), tipo: State.getCfg('tipo'), nivel: State.getCfg('nivel'), pags: State.getCfg('pags') },
      est:  State.get('est'),
      ts:   Date.now(),
    }));
  } catch (e) {}
}

function genTemProgresso() {
  try {
    const d = JSON.parse(localStorage.getItem(_GEN_SAVE_KEY) || 'null');
    if (!d) return false;
    if (Date.now() - d.ts > 4 * 3600 * 1000) return false; /* expira em 4h */
    if (d.cfg?.tema !== State.getCfg('tema') || d.cfg?.tipo !== State.getCfg('tipo')) return false;
    return d;
  } catch { return false; }
}

function genLimparProgresso() {
  try { localStorage.removeItem(_GEN_SAVE_KEY); } catch (e) {}
}

/* Cancelar uma geração em curso (usado quando se inicia outro trabalho) */
function genCancelar() {
  _genCancelado = true;
  _genPausadoIndisponivel = false;
  _btnGerarBloqueado = false;
  _desbloquearBtnGerar();
}

/* ═══════════════════════════════════════════════════════════
   QUALITY GATE — um capítulo só fica 'p' (PRONTO) se passar.
   Rejeita reparações fracas, readiness/completeza baixos e
   placeholders. O estado 'x' = REJEITADO/pendente: sobrevive ao
   save/retomar e volta a ser tentado, mas NUNCA entra no livro
   final como se estivesse concluído.
═══════════════════════════════════════════════════════════ */
function validarQualidadeCapitulo(raw, textoFinal, ast) {
  const motivos = [];
  if (!raw) motivos.push('resposta vazia');
  if (raw && typeof raw === 'object') {
    if (raw._genFalhou === true) motivos.push('falha assinalada pelo motor');
    // Reparação fraca só é bloqueio se completude também estiver baixa
    const compRep = raw.completeness?.completeness;
    if (raw._repaired === true && typeof compRep === 'number' && compRep < 60) motivos.push('estrutura reconstruída + completude baixa');
    if (raw.readiness && raw.readiness.ready === false) {
      const blockerReal = (raw.readiness.blockers || []).find(b => !/par[áa]grafos insuficientes/i.test(b));
      if (blockerReal) motivos.push('readiness: ' + blockerReal);
    }
    if (typeof raw.completeness?.completeness === 'number') {
      const comp = Math.round(raw.completeness.completeness);
      if (comp < 65) motivos.push(`Completude ${comp}% (<65)`);
    }
  }
  const limpo = String(textoFinal || '').trim();
  if (limpo.length < 60) motivos.push('conteúdo insuficiente');
  if (limpo.startsWith('[') && /[Ss]ec[çc][ãa]o/.test(limpo)) motivos.push('placeholder de falha');
  if (ast && Array.isArray(ast.sections) && ast.sections.length > 0) {
    const parasValidos = s => (s.paragrafos || s.paragraphs || [])
      .filter(p => p && typeof p === 'string' && p.trim().length > 15);
    const semConteudo = ast.sections.filter(s => parasValidos(s).length === 0);
    const totalParas = ast.sections.reduce((a, s) => a + parasValidos(s).length, 0);
    if (totalParas < 2) motivos.push('muito poucos parágrafos');
    if (semConteudo.length === ast.sections.length) motivos.push('subtópicos sem parágrafos');
  } else if (limpo.length < 120) {
    motivos.push('sem AST e texto curto');
  }
  return { valido: motivos.length === 0, motivos };
}

/* O livro só fecha (genFim + addDoc) se TODOS os capítulos forem 'p' com conteúdo. */
function validarIntegridadeLivro() {
  const secs = State.get('secs') || [];
  return secs.every(s => s.e === 'p' && s.c && !s.c.startsWith('['));
}

/* ═══════════════════════════════════════════════════════════
   LOOP DE GERAÇÃO PRINCIPAL
═══════════════════════════════════════════════════════════ */

async function iniciarGer(retomar) {
  if (_btnGerarBloqueado) { mostrarToast('⏳ Geração já em curso — aguarda.', 'erro'); return; }
  _btnGerarBloqueado = true;
  _btnGerarBloqueadoEm = Date.now();
  if (typeof aBarraReset === 'function') aBarraReset();
  try {
  const est = State.get('est');
  if (!est) return;

  _genCancelado = false;
  _genPausadoIndisponivel = false;
  State.set('genFim', false);
  DOC_MEMORY.reset();
  ARGUMENT_GRAPH.reset();
  _treRetroRefCount = 0;
  const _setFase = (t) => { const el = document.getElementById('genFaseTxt'); if (el) el.textContent = t; };

  /* ── Cronómetro vivo ── */
  _genStartTime = Date.now();
  const timerEl = document.getElementById('genTimer');
  if (timerEl) {
    _genTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - _genStartTime) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 1000);
  }

  /* Definir ponto de início */
  let iniciarEm = 0;
  if (retomar) {
    const prog = genTemProgresso();
    if (prog) {
      State.set('secs', prog.secs);
      iniciarEm = State.get('secs').findIndex(s => s.e !== 'p');
      if (iniciarEm === -1) iniciarEm = State.get('secs').length;
    }
  }

  if (!retomar || iniciarEm === 0) {
    State.set('secs', est.map((c, i) => ({
      id: i, nome: `CAP. ${c.num || i + 1} — ${c.titulo}`,
      titulo: c.titulo, num: c.num, subs: c.subs || [],
      e: 'a', c: '', ast: null,
    })));
  }

  irPara('geracao');

  const totalPags  = State.getCfg('pags') || 15;
  /* PAGE BUDGET ENGINE — o nº de páginas é uma restrição obrigatória.
     Se o pbe.js não estiver carregado (cache antiga do SW), degrada
     para estimativa — o botão nunca pode falhar por causa disto. */
  const temPBE     = typeof pbePlanear === 'function' && typeof pbeValidarEAjustar === 'function';
  const pbePlan    = temPBE ? pbePlanear(est, totalPags) : null;
  const tp         = tipoActual() || { n: 'Trabalho Académico' };
  const plano      = State.get('plano') || {};

  _setFase(`A planear ${est.length} capítulos…`);
  for (let i = iniciarEm; i < est.length; i++) {
    if (_genCancelado) break;
    _btnGerarBloqueadoEm = Date.now(); /* heartbeat: geração viva */
    _setFase(`A escrever cap. ${i+1}/${est.length} — ${est[i].titulo.substring(0,28)}…`);
    const _lbl = document.getElementById('genPageLabel'); if (_lbl) _lbl.textContent = `CAP. ${est[i].num || i+1} · PÁG. ${i+1}/${est.length}`;
    const _liveT = document.getElementById('genLiveTitle'); if (_liveT) _liveT.textContent = est[i].titulo.substring(0,32);
    const _liveE = document.getElementById('genLiveExcerpt'); if (_liveE) { _liveE.innerHTML = `▸ ${(est[i].subs?.[0]||'A compor…').substring(0,48)}…<span id="genCursor" style="display:inline-block;width:4px;height:6px;background:var(--b);margin-left:1px;vertical-align:middle;animation:genBlink 1s step-end infinite;border-radius:1px"></span>`; _liveE.style.color='#888'; }
    if (_genMicroIt) clearInterval(_genMicroIt);
    let _mIdx=0; const _mMsgs=['A consultar fontes…','A estruturar argumentos…','A redigir parágrafos…','A inserir citações…'];
    _genMicroIt = setInterval(()=>{ const el=document.getElementById('genFaseTxt'); if(el) el.textContent = _mMsgs[_mIdx++ % _mMsgs.length]; const w=document.getElementById('genTypingLine'); if(w) w.style.width = (42+Math.random()*38)+'%'; }, 1600);
    const _w0=document.getElementById('genTypingLine'); if(_w0) setTimeout(()=>_w0.style.width='62%', 180);

    const cap  = est[i];
    let secs   = State.get('secs') || [];

    /* Defesa: se o estado foi reposto durante a geração (resetDocumento),
       reconstruir a secção actual em vez de crashar com undefined. */
    if (!secs[i]) {
      secs = est.map((c, idx) => ({
        id: idx, nome: `CAP. ${c.num || idx + 1} — ${c.titulo}`,
        titulo: c.titulo, num: c.num, subs: c.subs || [],
        e: 'a', c: '', ast: null,
      }));
      State.set('secs', secs);
    }

    secs[i].e  = 'g';
    State.set('secs', secs);
    aSecDOM(i, 'g', 'EM CURSO');

    /* Actualizar estimativa de tempo restante */
    const restEl = document.getElementById('estimG');
    if (restEl) {
      const seg_med = _DELAY(i) / 1000 + 8;
      const min     = Math.round((est.length - i) * seg_med / 60);
      restEl.textContent = min > 1 ? `~${min} min` : `~${(est.length - i) * Math.round(seg_med)}s`;
    }

    if (i > iniciarEm) await new Promise(r => setTimeout(r, _DELAY(i)));
    if (_genCancelado) break;

    /* ── GERAÇÃO DO CAPÍTULO (com QUALITY GATE) ───────────────────
       Máximo 3 chamadas à IA (1 original + 2 auto-retries).
       Um capítulo que nunca passa sai como 'x' (a completar),
       NUNCA como 'p'.
    ─────────────────────────────────────────────────────────────── */
    const MAX_QC_RETRIES = 2;
    let qcOk        = false;
    let rawEnvelope = null;
    let textoFinal  = '[Secção não gerada. Toca em ↺ para regenerar.]';
    let astFinal    = null;

    for (let qcPass = 0; qcPass <= MAX_QC_RETRIES && !qcOk && !_genCancelado; qcPass++) {
      if (qcPass > 0) {
        aSecDOM(i, 'g', `Qualidade baixa — re-tentativa ${qcPass}/${MAX_QC_RETRIES}…`);
        mostrarToast(`⚠ Cap. ${cap.num}: conteúdo inválido — a regenerar (${qcPass}/${MAX_QC_RETRIES})…`);
        await new Promise(r => setTimeout(r, _DELAY(i)));
      }

      const isRef    = cap.titulo && (cap.titulo.toLowerCase().includes('refer') || cap.titulo.toLowerCase().includes('bibliog'));
      const acaoGer  = isRef ? 'gerar_capitulo_referencias' : 'gerar_capitulo';

      let resultado   = null;
      let tentativas  = 0;
      let _capGenericFalhou = false;
      let _capTimedOut = false;
      const _capTimeout = setTimeout(() => { _capTimedOut = true; }, 60000);

      try {
        while (!resultado && tentativas < 4 && !_genCancelado && !_capTimedOut) {
          try {
            const raw = await callAcademyAPI({
              acao:                acaoGer,
              tema:                State.getCfg('tema'),
              tipoTrabalho:        tp.n,
              nivel:               State.getCfg('nivel'),
              totalPags,
              capNum:              cap.num,
              capTitulo:           cap.titulo,
              capSubs:             cap.subs || [],
              totalCaps:           est.length,
              palavrasPorCap:      pbePlan ? Math.max(pbePlan.piso, pbePlan.porCapitulo[i]) : Math.max(300, Math.round(totalPags * 220 / Math.max(1, est.length))),
              wordBudget:          pbePlan ? pbePlan.totalPalavras : 0,
              palavrasPorPagina:   pbePlan ? pbePlan.palavrasPorPagina : 262,
              paginasAlvo:         totalPags,
              objetivo:            (plano.objetivo || '').substring(0, 120),
              hipotese:            (plano.hipotese || '').substring(0, 100),
              metodologia:         (plano.metodologia || '').substring(0, 100),
              inst:                State.getCfg('inst'),
              prof:                State.getCfg('prof'),
              area:                State.getCfg('area'),
              instrucaoSubtitulos: `Cada subtópico em capSubs DEVE aparecer como subtítulo numerado em linha própria.`,
              memoriaDocumento:    DOC_MEMORY.gerarInstrucao(),
            });

            rawEnvelope = raw; /* reter envelope de qualidade p/ o gate */

            /* raw pode ser { resposta, health, readiness } ou valor directo */
            let _rawVal = raw;
            if (raw && typeof raw === 'object' && 'resposta' in raw) {
              _rawVal = raw.resposta;
              const secsArr = State.get('secs') || [];
              if (secsArr[i]) {
                secsArr[i].health       = raw.health       || null;
                secsArr[i].readiness    = raw.readiness    || null;
                secsArr[i].confidence   = raw.confidence   || null;
                secsArr[i].completeness = raw.completeness || null;
                State.set('secs', secsArr);
              }
            }

            if (_rawVal && (typeof _rawVal === 'object' || (typeof _rawVal === 'string' && _rawVal.length > 30))) {
              resultado = _rawVal;
            } else {
              tentativas++;
            }
          } catch (er) {
            tentativas++;
            if (/CAPITULO_INVALIDO/i.test(er?.message || '')) { tentativas = 4; break; }
            if (er?.generic || /AI_INDISPONIVEL/i.test(er?.message || '')) {
              _capGenericFalhou = true;
              genGuardarProgresso();
              autoGuardar();
              _genPausadoIndisponivel = true;
              _genCancelado = true;
              break;
            }
            const espera = Math.min(tentativas * 4000, 20000);
            aSecDOM(i, 'g', `Tentativa ${tentativas}/4 — aguarda ${Math.round(espera / 1000)}s…`);
            if (restEl) restEl.textContent = 'Erro API — a re‐tentar…';
            await new Promise(r => setTimeout(r, espera));
          }
        }
      } finally {
        clearTimeout(_capTimeout);
        if (!resultado) {
          // A IA falhou (indisponível ou 4 tentativas esgotadas). NUNCA fabricar
          // conteúdo académico local (citações "Silva (2020)"/"Santos (2019)" fictícias
          // não têm source_id nem passaram por verificação — ver BUG-001/BUG_MAP).
          // O capítulo fica marcado como POR COMPLETAR ('x'), nunca 'p'/FINAL.
          resultado = `[Cap. ${cap.num} não concluído — falha da IA (${_capGenericFalhou ? 'AI_INDISPONIVEL' : `${tentativas} tentativas`}). Toca em ↺ para regenerar.]`;
          rawEnvelope = {
            _genFalhou: true,
            completeness: { completeness: 0 },
            health: { health: 0, label: 'Falhou' },
            readiness: { ready: false, blockers: ['geração falhou — sem fabricação local permitida'] },
          };
          const _liveFb = document.getElementById('genLiveExcerpt');
          if (_liveFb) { _liveFb.textContent = '⚠ Falha na IA — capítulo por completar (sem conteúdo fabricado)'; _liveFb.style.color = '#b45309'; }
        }
      }

      if (_genCancelado) break;

      /* ── PROCESSAR RESULTADO ──────────────────────────────────────
         Normalizar para texto + AST independentemente do formato
      ─────────────────────────────────────────────────────────────── */
      if (resultado) {
        if (typeof resultado === 'object' && resultado.sections) {
          astFinal   = resultado;
          textoFinal = astParaTexto(resultado);
        } else if (typeof resultado === 'string' && resultado.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(resultado);
            if (parsed?.sections) { astFinal = parsed; textoFinal = astParaTexto(parsed); }
            else textoFinal = '[JSON devolvido sem estrutura válida. Toca em ↺.]';
          } catch {
            const m = resultado.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (m) {
              try {
                const parsed = JSON.parse(m[1]);
                if (parsed?.sections) { astFinal = parsed; textoFinal = astParaTexto(parsed); }
                else textoFinal = '[JSON devolvido sem estrutura válida. Toca em ↺.]';
              } catch { textoFinal = '[JSON malformado. Toca em ↺ para regenerar.]'; }
            } else {
              textoFinal = '[JSON malformado. Toca em ↺ para regenerar.]';
            }
          }
        } else if (typeof resultado === 'string') {
          textoFinal = resultado;
        }
      }

      /* ── QUALITY GATE ── */
      const qc = validarQualidadeCapitulo(rawEnvelope, textoFinal, astFinal);
      qcOk = qc.valido;
      if (!qcOk) {
        aSecDOM(i, 'g', 'Qualidade insuficiente…');
        if (restEl) restEl.textContent = 'A regenerar capítulo…';
        console.warn(`[QC] Cap ${cap.num} rejeitado: ${qc.motivos.join('; ')}`);
      }
    }

    if (_genCancelado) { genGuardarProgresso(); break; }

    const secsArr = State.get('secs') || [];
    if (!secsArr[i]) { _genCancelado = true; break; }

    /* 100% AUTOMÁTICO — nunca POR COMPLETAR, nunca exige clique ↺ */
    if (!qcOk) {
      aSecDOM(i, 'g', `⏳ Cap. ${cap.num} — re-tentativa automática…`);
      await new Promise(r=>setTimeout(r, 6000));
      i--; continue;
    }

    /* ── GUARDAR NA SECÇÃO (aprovado pelo gate) ── */
    secsArr[i].e   = 'p';
    secsArr[i].c   = textoFinal;
    secsArr[i].blocks = blkExtrair({ c: textoFinal });
    secsArr[i].ast = astFinal;
    State.set('secs', secsArr);

    const healthLabel = secsArr[i].health  ? ` · ${secsArr[i].health.health}% ${secsArr[i].health.label}` : '';
    const readyLabel  = secsArr[i].readiness ? (secsArr[i].readiness.ready ? ' ✓' : ' ⚠') : '';
    const wordCount   = textoFinal ? textoFinal.split(/\s+/).length : 0;
    aSecDOM(i, 'p', `✓ PRONTO · ${wordCount} palavras${healthLabel}${readyLabel}`, textoFinal);
    aBarra(i + 1, est.length);
    // Actualizar preview espelhado com trecho real
    const _liveT2 = document.getElementById('genLiveTitle'); if (_liveT2) _liveT2.textContent = `✓ ${cap.titulo.substring(0,32)}`;
    const _liveE2 = document.getElementById('genLiveExcerpt'); if (_liveE2) {
      const trecho = textoFinal.substring(0, 90).replace(/\n/g,' ').trim();
      _liveE2.textContent = trecho ? `“${trecho}…”` : `✓ ${wordCount} palavras`;
      _liveE2.style.animation = 'none';
      _liveE2.style.color = '#1a7a4a';
    }
    const _pgAct = document.getElementById('genPageActive'); if (_pgAct) { _pgAct.style.transform = 'scale(1.02)'; setTimeout(()=>{_pgAct.style.transform='scale(1)';}, 300); }

    /* Actualizar estimativa de tempo restante (dinâmica) */
    const restEl2 = document.getElementById('estimG');
    if (restEl2) {
      const elapsed  = (Date.now() - _genStartTime) / 1000;
      const done     = i + 1;
      const avgPerCh = elapsed / done;
      const remaining = Math.ceil(avgPerCh * (est.length - done - 1));
      if (remaining > 60) restEl2.textContent = `~${Math.ceil(remaining / 60)} min restantes`;
      else restEl2.textContent = `~${remaining}s restantes`;
    }

    /* Alimentar memória do documento */
    if (textoFinal && textoFinal.length > 30 && !textoFinal.startsWith('[')) {
      ailRegistarCapitulo(textoFinal);
      treRegistarCapitulo(textoFinal, cap.num);
    }

    genGuardarProgresso();
    autoGuardar();
  }

  if (_genMicroIt) { clearInterval(_genMicroIt); _genMicroIt = null; }
  /* ── FIM DA GERAÇÃO ── */
  if (_genTimerInterval) { clearInterval(_genTimerInterval); _genTimerInterval = null; }
  if (_genCancelado) {
    autoGuardar();
    if (_genPausadoIndisponivel) {
      _genPausadoIndisponivel = false;
      mostrarToast('⏸ Processamento pausado temporariamente — o progresso do seu trabalho foi preservado. Será retomado quando o serviço estiver disponível.');
    } else {
      mostrarToast('⏹ Geração pausada — trabalho guardado. Podes retomar.');
    }
    return;
  }

  /* ── PAGE BUDGET ENGINE — validação final de paginação (obrigatória) ── */
  if (temPBE) {
    _setFase('A calibrar paginação…');
    if (typeof aBarraForcar === 'function') aBarraForcar(92);
    const estimGEl = document.getElementById('estimG');
    if (estimGEl) estimGEl.textContent = 'A calibrar paginação…';
    await pbeValidarEAjustar(est, pbePlan);
    const restEl2 = document.getElementById('estimG');
    if (restEl2) restEl2.textContent = 'Concluído ✓';
    if (typeof aBarraForcar === 'function') aBarraForcar(96);
  }

  /* ── AUDITORIA ACADÉMICA — verificar e corrigir problemas críticos ── */
  _setFase('A auditar qualidade académica…');
  if (typeof aBarraForcar === 'function') aBarraForcar(98);
  const secsFinal = State.get('secs') || [];
  if (secsFinal.length > 0) {
    try {
      const auditResult = verificarQualidadeAcademica(secsFinal);
      
      if (auditResult.erros.length > 0) {
        mostrarToast(`⚠ Auditoria detetou ${auditResult.erros.length} problema(s) — a corrigir…`);
        
        /* Se há citações sem referências, regenerar bibliografia */
        if (auditResult.verificacoes.refsFaltantes?.length > 0) {
          const refCorrigida = await regenerarReferenciasCorretas(secsFinal);
          if (refCorrigida) {
            mostrarToast('✓ Referências bibliográficas corrigidas!');
          }
        }
      }
      
      if (auditResult.avisos.length > 0 && auditResult.avisos.length <= 3) {
        console.warn('[AUDITORIA] Avisos:', auditResult.avisos);
      }
    } catch (e) {
      console.warn('[AUDITORIA] Erro na auditoria:', e);
    }
  }

  /* ── QUALITY GATE FINAL ──
     O livro só fecha (genFim + addDoc) se TODOS os capítulos forem 'p'
     com conteúdo. Se algum ficou 'x' (rejeitado) ou placeholder, o build
     NÃO finaliza — guarda-se progresso para retomar. */
  if (!validarIntegridadeLivro()) {
    const secsP = State.get('secs') || [];
    const pend  = secsP.filter(s => s.e !== 'p' || (s.c && s.c.startsWith('['))).length;
    autoGuardar();
    mostrarToast(`⚠ ${pend} capítulo(s) incompleto(s) — o documento NÃO foi finalizado. Regenera os capítulos assinalados e volta a gerar.`);
    renderizar();
    return;
  }

  _setFase('A finalizar documento…');
  if (typeof aBarraForcar === 'function') aBarraForcar(100);
  await new Promise(r => setTimeout(r, 350));
  genLimparProgresso();
  limparRascunhoPendente();

  /* Calcular qualidade estimada */
  const secs       = State.get('secs');
  const totalWords = secs.reduce((s, x) => s + (x.c?.split(/\s+/).length || 0), 0);
  const targetWords = totalPags * 240;
  const fill        = Math.min(100, Math.round(totalWords / targetWords * 100));
  const base        = Math.min(95, 72 + Math.floor(fill * 0.22));
  State.set('qual', {
    total: base,
    itens: [['Coerência', Math.min(97, base + 2)], ['Profundidade', Math.min(97, base - 2)], ['Rigor', Math.min(97, base - 3)], ['Argumentação', Math.min(97, base + 1)]],
  });

  State.set('genFim', true);
  _desbloquearBtnGerar();
  addDoc({ tipo: tp.s || tp.n, tema: State.getCfg('tema'), pags: nPags(), qual: State.get('qual')?.total });
  autoGuardar();
  if (typeof autoAnalisarAposGeracao === 'function') autoAnalisarAposGeracao();

  /* Notificação PWA */
  pwaNotificarConclusaoCapitulo(secs.length);
  renderizar(); /* actualizar ecrã de geração para mostrar "Pronto" */
} finally { _desbloquearBtnGerar(); }
}

/* ── Concluir: ir para o editor ── */
function docConcluido() {
  irPara('editor');
}

/* ── Calcular estatísticas do documento (alinhado com PBE) ── */
function calcStats(secs) {
  const txt      = secs.map(s => s.c || s.conteudo || '').join(' ');
  const palavras = txt.split(/\s+/).filter(Boolean).length;
  const chars    = txt.replace(/\s/g, '').length;
  // Usa PBE se disponível, senão fallback 262 (mesmo motor do PDF)
  let ppp = 262;
  try { if (typeof pbePalavrasPorPagina === 'function') ppp = pbePalavrasPorPagina(); } catch {}
  // Medição real via layout se possível (mais precisa)
  let pagsReais = 0;
  try {
    if (typeof pbeMedirPaginas === 'function' && Array.isArray(secs) && secs.length) {
      const m = pbeMedirPaginas(secs);
      if (m && m.total > 0) pagsReais = m.total;
    }
  } catch {}
  const pagsCalc = Math.max(1, Math.ceil(palavras / ppp));
  const pags = pagsReais > 0 ? pagsReais : pagsCalc;
  const pagsAlvo = (typeof State !== 'undefined' && State.getCfg) ? (State.getCfg('pags') || pags) : pags;
  // Mostrar real mas garantir que alvo aparece quando ainda a calibrar
  const refs     = secs.filter(s => (s.titulo || '').toLowerCase().includes('referência')).length;
  const tempoLeit = Math.max(1, Math.ceil(palavras / 200));
  return { palavras, chars, pags, pagsAlvo, pagsReais: pagsReais || pagsCalc, ppp, refs, tempoLeit };
}

/* ── Sanitização de texto académico ── */
function sanitizeAcademic(txt) {
  if (!txt || typeof txt !== 'string') return txt || '';
  return txt
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/* ── Validação antes de gerar ── */
let _btnGerarBloqueado = false;
let _btnGerarBloqueadoEm = 0;

let _btnClickLock = 0;
function btnGerarFinalClick() {
  // 1. Anti-duplo-click físico: 1200ms debounce (independente da geração)
  if (Date.now() - _btnClickLock < 1200) return;
  _btnClickLock = Date.now();
  // 2. Se já há geração em curso, avisa
  if (_btnGerarBloqueado) {
    if (Date.now() - _btnGerarBloqueadoEm > 60000) {
      _btnGerarBloqueado = false;
    } else {
      mostrarToast('⏳ Geração já em curso — aguarda.', 'erro');
      return;
    }
  }
  // Trava visual imediata (sem tocar em _btnGerarBloqueado — deixa iniciarGer gerir)
  document.querySelectorAll('#btnGerarFinal').forEach(b => {
    b.disabled = true;
    b.style.opacity = '.6';
    b.style.cursor = 'not-allowed';
    b.style.pointerEvents = 'none';
    b.textContent = '⏳ A iniciar geração…';
  });
  // Re-libera clique visual após 1.2s se validação falhar (para não ficar preso)
  setTimeout(() => { if (!_btnGerarBloqueado) _desbloquearBtnGerar(); }, 1500);
  try {
    const erros = _validarFormularioCompleto();
    if (erros.length) { _mostrarErroValidacao(erros[0]); _desbloquearBtnGerar(); return; }
    verificarAntesDeGerar(true);
  } catch (e) {
    console.error('[GERAR]', e);
    _desbloquearBtnGerar();
    const msg = (e?.message || e?.name || 'desconhecido').toString().substring(0, 140);
    mostrarToast(`⚠ Erro ao iniciar a geração: ${msg} — tenta de novo.`, 'erro');
    try { acMostrarErro('Gerar Trabalho: ' + msg, (e && e.stack) || ''); } catch (_) {}
  }
}

function _desbloquearBtnGerar() {
  _btnGerarBloqueado = false;
  document.querySelectorAll('#btnGerarFinal').forEach(btn => {
    if (btn) { btn.textContent = '⚡ Gerar Trabalho'; btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.style.pointerEvents = ''; }
  });
  const btn = document.getElementById('btnGerarFinal');
  if (btn && !btn.textContent.includes('Gerar')) { btn.textContent = '⚡ Gerar Trabalho'; btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.style.pointerEvents = ''; }
}

function _validarFormularioCompleto() {
  const erros = [];
  if (!State.getCfg('tipo'))                                    erros.push('Selecciona o tipo de trabalho antes de continuar.');
  if (!State.getCfg('tema') || State.getCfg('tema').length < 10) erros.push('O tema deve ter pelo menos 10 caracteres.');
  if (!State.getCfg('nivel'))                                   erros.push('Selecciona o nível académico.');
  if (!State.getCfg('pags') || State.getCfg('pags') < 1)       erros.push('Define o número de páginas.');
  if (!State.getCfg('numCaps') || State.getCfg('numCaps') < 1) erros.push('Define o número de capítulos.');
  if (!State.get('est') || !State.get('est').length)            erros.push('A estrutura académica ainda não foi gerada. Aguarda…');
  return erros;
}

function _mostrarErroValidacao(msg) {
  document.getElementById('validacao-erro')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'validacao-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:699;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)';
  const div = document.createElement('div');
  div.id = 'validacao-erro';
  div.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:700;background:var(--z2);border:1.5px solid rgba(248,113,113,.5);border-radius:14px;padding:24px 22px;width:calc(100% - 48px);max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.7);text-align:center;animation:aparecer .2s;`;
  div.innerHTML = `
    <div style="font-size:32px;margin-bottom:12px">⚠️</div>
    <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Campo obrigatório</div>
    <div style="font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:20px">${msg}</div>
    <button onclick="document.getElementById('validacao-erro')?.remove();document.getElementById('validacao-overlay')?.remove()"
      style="padding:12px 28px;border-radius:10px;background:linear-gradient(135deg,var(--b),var(--bd));border:none;color:var(--t-inv);font-family:var(--fu);font-size:14px;font-weight:700;cursor:pointer">
      OK, percebido
    </button>`;
  overlay.onclick = () => { div.remove(); overlay.remove(); };
  document.body.appendChild(overlay);
  document.body.appendChild(div);
}

/* ── Gate de geração (verifica plano antes de avançar) ── */
function verificarAntesDeGerar(gerarDirecto) {
  if (!gerarDirecto) { irPara('preview_gen'); return; }
  const pags = nPags();
  const saldo = getSaldoDisponivel();
  if (saldo < pags) {
    _desbloquearBtnGerar();
    _mostrarSaldoInsuficiente(pags, saldo);
    return;
  }
  iniciarGer();
}

function _mostrarSaldoInsuficiente(pags, saldo) {
  const falta = pags - saldo;
  const pac   = calcPacote(pags);
  const overlay = document.createElement('div');
  overlay.id = 'saldo-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:699;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)';
  const div = document.createElement('div');
  div.id = 'saldo-card';
  div.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:700;background:var(--z2);border:.5px solid var(--e1);border-radius:16px;padding:28px 24px;width:calc(100% - 48px);max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.7);animation:aparecer .2s;`;
  const _fecharSaldo = () => { document.getElementById('saldo-card')?.remove(); document.getElementById('saldo-overlay')?.remove(); };
  div.innerHTML = `
    <button onclick="document.getElementById('saldo-card')?.remove();document.getElementById('saldo-overlay')?.remove()"
      style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer;padding:4px">✕</button>

    <div style="display:flex;gap:6px;margin-bottom:20px;justify-content:center">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--b)"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:var(--b)"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:var(--e0)"></span>
    </div>

    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Passo 1 de 2 · Verificar saldo</div>
    <div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:16px">Saldo insuficiente</div>

    <div style="background:var(--z3);border-radius:12px;padding:14px;margin-bottom:6px;display:flex;align-items:center;gap:12px">
      <div style="font-size:20px">📄</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:12px;color:var(--t2)">Precisas</span>
          <span style="font-size:13px;font-weight:700;color:var(--t1)">${pags} páginas</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:12px;color:var(--t2)">Tens</span>
          <span style="font-size:13px;font-weight:700;color:#f87171">${saldo} páginas</span>
        </div>
        <div style="height:6px;background:var(--e0);border-radius:3px;margin:8px 0 4px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100, (saldo / pags) * 100)}%;background:linear-gradient(90deg,var(--b),var(--bd));border-radius:3px;transition:width .4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:11px;color:var(--t3)">Faltam <strong style="color:var(--t1)">${falta} páginas</strong></span>
          <span style="font-size:11px;color:var(--b)">${Math.round((saldo / pags) * 100)}%</span>
        </div>
      </div>
    </div>

    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase;margin:18px 0 8px">Passo 2 de 2 · Escolher pacote</div>

    <div style="background:var(--sf3);border:.5px solid var(--eb);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <div style="font-size:22px">🚀</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--t1)">${pac.label}</div>
        <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px">${pac.pags} páginas · válido 30 dias</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700;color:var(--b)">${pac.preco.toLocaleString()} Kz</div>
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3)">${pac.pags}p</div>
      </div>
    </div>

    <button onclick="document.getElementById('saldo-card')?.remove();document.getElementById('saldo-overlay')?.remove();_iniciarPagamentoAvulso(${pac.pags},${pac.preco})"
      style="width:100%;padding:13px;border-radius:10px;background:linear-gradient(135deg,var(--b),var(--bd));border:none;color:var(--t-inv);font-family:var(--fu);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px">
      Comprar ${pac.label} — ${pac.preco.toLocaleString()} Kz →
    </button>
    <button onclick="document.getElementById('saldo-card')?.remove();document.getElementById('saldo-overlay')?.remove();irPara('planos',{numPags:${pags}})"
      style="width:100%;padding:10px;border-radius:10px;background:transparent;border:.5px solid var(--e0);color:var(--t3);font-family:var(--fu);font-size:12px;cursor:pointer;margin-bottom:6px">
      Ver todos os planos
    </button>
    <button onclick="document.getElementById('saldo-card')?.remove();document.getElementById('saldo-overlay')?.remove()"
      style="width:100%;padding:10px;border-radius:10px;background:transparent;border:none;color:var(--t3);font-family:var(--fu);font-size:12px;cursor:pointer">
      Voltar
    </button>`;
  overlay.onclick = _fecharSaldo;
  document.body.appendChild(overlay);
  document.body.appendChild(div);
}
