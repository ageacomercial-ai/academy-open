/* ═══════════════════════════════════════════════════════════
   ACADEMY — CHAT.JS
   Chat IA · Voz (STT) · Texto para Voz (TTS)
   Editor Conversacional Inteligente
   Documento Vivo — edição por blocos via chat
   Depende de: state.js, navigation.js, generator.js, doc-blocks.js, doc-history.js
╔═══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   ESTADO DO CHAT
╔═══════════════════════════════════════════════════════════ */

let chatPrimeiro   = true;
let chatHistorico  = [];
let _chatUserScrolled = false;
let _chatContextoCap  = null; /* contexto do capítulo activo no editor */
let _chatModoDocumento = false; /* true quando o chat tem acesso ao documento aberto */

const CHAT_LIMITE = 20; /* mensagens por sessão (gratuito) */
let _chatMsgsJanela = 0;

const SUGESTOES_INICIAIS = [
  'Como funciona o ACADEMY?',
  'Qual a diferença entre TFC e monografia?',
  'Como exporto em PDF?',
  'O ACADEMY é gratuito?',
];

const SUGESTOES_POS = [
  'Como regenero um capítulo?',
  'Como adiciono membros do grupo?',
  'Que tipos de trabalho posso criar?',
  'Como funciona o DOCX?',
];

/* ════════════════════════════════════════════════════════════
   ABRIR / FECHAR CHAT
════════════════════════════════════════════════════════════ */
function togChat() {
  chatAberto = !chatAberto;
  const overlay = document.getElementById('chatModal');
  const pill    = document.getElementById('chatPill');

  if (chatAberto) {
    overlay?.classList.add('aberto');
    document.body.style.overflow = 'hidden';
    if (pill) pill.classList.add('oculta');
    if (chatPrimeiro) { chatPrimeiro = false; _chatBoasVindas(); }
    _chatScrollInicio();
    _chatKbStart();
    setTimeout(() => {
      const inp  = document.getElementById('chatInp');
      const msgs = document.getElementById('chatMsgs');
      if (inp) {
        inp.focus();
        inp.addEventListener('focus', () => {
          setTimeout(() => inp.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
        }, { once: false });
      }
      if (msgs && !_chatUserScrolled) msgs.scrollTop = msgs.scrollHeight;
    }, 320);
  } else {
    overlay?.classList.remove('aberto');
    document.body.style.overflow = '';
    if (pill) pill.classList.remove('oculta');
    _chatKbStop();
    pararTTS();
    if (_vozAtiva && _voiceRec) _voiceRec.stop();
    _chatContextoCap = null;
  }
}

/* ════════════════════════════════════════════════════════════
   CONTEXTO E PROACTIVIDADE
════════════════════════════════════════════════════════════ */
function updateChatContext(ecra) {
  const ctx = {
    inicio:      '🏠 Início',
    tipo:        '📝 Passo 1 — Missão',
    tema_:       '📝 Passo 2 — Tema',
    nivel:       '📝 Passo 3 — Contexto',
    identidade:  '📝 Passo 4 — Identidade',
    preview_gen: '📝 Confirmar',
    plano:       '🔬 Plano de Investigação',
    est:         '📐 Estrutura',
    geracao:     '⏳ A Gerar…',
    editor:      '📄 Documento Pronto',
    exemplares:  '◉ Exemplares',
    documentos:  '◈ Documentos',
  };
  const el = document.getElementById('chatCtx');
  if (el) el.textContent = ctx[ecra] || '● Assistente Académico';

  /* Mensagens proactivas por ecrã */
  const proativos = {
    editor:  () => _chatProativo(`O teu documento está pronto! 🎓 Posso ajudar-te a preparar a **pré-defesa**, melhorar o **resumo** ou verificar a **coerência académica**. O que preferes?`),
    tema_:   () => _chatProativo(`Define um tema específico e concreto — quanto mais detalhado, melhor o resultado.`),
    plano:   () => _chatProativo(`O plano académico foi gerado. Verifica se o objectivo e a hipótese estão alinhados com o teu tema.`),
  };
  if (proativos[ecra]) setTimeout(proativos[ecra], 900);
}

function _chatProativo(msg) {
  if (!chatAberto) return;
  _adicionarMsgChat('acad', msg);
}

/* ════════════════════════════════════════════════════════════
   RENDER DAS MENSAGENS
════════════════════════════════════════════════════════════ */
function _renderMarkdownChat(txt) {
  return (txt || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g,  '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:3px;font-family:var(--fm);font-size:11px">$1</code>')
    .replace(/^(\d+\.) (.+)$/gm, '<div style="display:flex;gap:7px;margin:3px 0"><span style="color:var(--b);font-family:var(--fm);font-size:10px;flex-shrink:0">$1</span><span>$2</span></div>')
    .replace(/^[-•] (.+)$/gm,    '<div style="display:flex;gap:7px;margin:3px 0"><span style="color:var(--b);flex-shrink:0">·</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
}

function _adicionarMsgChat(tipo, texto) {
  const c    = document.getElementById('chatMsgs');
  const sugs = document.getElementById('chatSugs');
  if (!c) return;
  const d      = document.createElement('div');
  d.className  = `cm ${tipo === 'user' ? 'u' : 'a'}`;
  d.innerHTML  = _renderMarkdownChat(texto);
  if (sugs) c.insertBefore(d, sugs);
  else c.appendChild(d);
  if (!_chatUserScrolled) c.scrollTop = c.scrollHeight;
  return d;
}

function _tiparMsgChat(texto, onFim) {
  const c    = document.getElementById('chatMsgs');
  const sugs = document.getElementById('chatSugs');
  if (!c) { if (onFim) onFim(); return; }

  const d     = document.createElement('div');
  d.className = 'cm a';
  if (sugs) c.insertBefore(d, sugs);
  else c.appendChild(d);

  const palavras = texto.split(' ');
  const vel      = Math.max(18, Math.min(60, 4200 / palavras.length));
  let i = 0;

  function passo() {
    if (i < palavras.length) {
      d.innerHTML = _renderMarkdownChat(palavras.slice(0, i + 1).join(' ')) + '<span style="opacity:.4">▍</span>';
      i++;
      if (!_chatUserScrolled) c.scrollTop = c.scrollHeight;
      setTimeout(passo, vel);
    } else {
      d.innerHTML = _renderMarkdownChat(texto);
      if (onFim) onFim();
    }
  }
  passo();
}

function _mostrarSugestoesChat(sugs) {
  const msgs = document.getElementById('chatMsgs');
  let c = document.getElementById('chatSugs');
  if (!msgs) return;
  if (!c) {
    c = document.createElement('div');
    c.id = 'chatSugs';
    c.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 4px';
    msgs.appendChild(c);
  }
  c.innerHTML = sugs.map(s =>
    `<div class="chat-sh" onclick="enviarMsgChat('${s.replace(/'/g, "\\'")}')">${s}</div>`
  ).join('');
  if (!_chatUserScrolled) msgs.scrollTop = msgs.scrollHeight;
}

function _chatBoasVindas() {
  const nome = State.get('u')?.nome?.split(' ')[0] || '';
  _adicionarMsgChat('acad', `${nome ? `Olá, ${nome}! ` : 'Olá! '}Estás a trabalhar num projecto académico? Diz-me o tema e começo contigo agora. 🎓`);
  _mostrarSugestoesChat(SUGESTOES_INICIAIS);
}

/* ════════════════════════════════════════════════════════════
   ENVIAR MENSAGEM
════════════════════════════════════════════════════════════ */
function _chatVerificarLimite() {
  const plano = planoActivo();
  if (plano !== 'gratuito') return null; /* sem limite nos planos pagos */
  _chatMsgsJanela++;
  if (_chatMsgsJanela > CHAT_LIMITE) {
    return `Atingiste o limite de ${CHAT_LIMITE} mensagens nesta sessão.\n\nUpgrade para um plano Pro para chat ilimitado. 🚀`;
  }
  return null;
}

async function enviarChat() {
  if (!prontoParaConexao) return;
  const inp  = document.getElementById('chatInp');
  const btn  = document.getElementById('chatSend');
  const texto = inp?.value?.trim();
  if (!texto || btn?.disabled) return;

  /* Verificar limite */
  const limiteMsg = _chatVerificarLimite();
  if (limiteMsg) { _adicionarMsgChat('acad', limiteMsg); inp.value = ''; inp.style.height = 'auto'; return; }

  _adicionarMsgChat('user', texto);
  _chatUserScrolled = false;
  inp.value = ''; inp.style.height = 'auto';

  const sugs = document.getElementById('chatSugs');
  if (sugs) sugs.innerHTML = '';

  chatHistorico.push({ role: 'user', content: texto });
  if (chatHistorico.length > 10) chatHistorico.splice(0, chatHistorico.length - 10);

  /* Typing indicator */
  const c = document.getElementById('chatMsgs');
  const typing = document.createElement('div');
  typing.className = 'cm a load';
  typing.innerHTML = '<div class="pts"><span></span><span></span><span></span></div>';
  if (sugs) c?.insertBefore(typing, sugs); else c?.appendChild(typing);
  if (c && !_chatUserScrolled) c.scrollTop = c.scrollHeight;
  if (btn) btn.disabled = true;

  try {
    const tp = tipoActual() || { n: 'Trabalho Académico' };
    const contextoCap = _chatContextoCap
      ? `\n\n[Contexto do capítulo activo]\nTítulo: ${_chatContextoCap.titulo}\nPreview: ${_chatContextoCap.preview}`
      : '';

    /* ── Modo Documento Vivo: processar edição via blocos ── */
    if (_chatModoDocumento && _detectarComandoEdicao(texto)) {
      typing.remove();
      await _chatProcessarEdicao(texto);
      if (btn) btn.disabled = false;
      inp?.focus();
      return;
    }

    /* Contexto completo do documento para o chat */
    let docContexto = '';
    if (_chatModoDocumento) {
      const secs = State.get('secs') || [];
      docContexto = '\n\n[Documento actual]\n';
      secs.forEach((s, i) => {
        const titulo = s.titulo || `Capítulo ${i + 1}`;
        const num = s.num || i + 1;
        const preview = (s.c || '').substring(0, 200);
        docContexto += `Cap.${num} — ${titulo}\nPreview: ${preview}\n\n`;
      });
    }

    const resposta = await callAcademyAPI({
      acao:         'chat',
      tema:         State.getCfg('tema') || '',
      tipoTrabalho: tp.n,
      historico:    chatHistorico.slice(-3),
      pedido:       texto + contextoCap + docContexto,
    });

    typing.remove();
    const respostaStr = typeof resposta === 'string' ? resposta : JSON.stringify(resposta);
    chatHistorico.push({ role: 'assistant', content: respostaStr });
    _tiparMsgChat(respostaStr, () => _mostrarSugestoesChat(SUGESTOES_POS));
  } catch (e) {
    typing.remove();
    _adicionarMsgChat('acad', `⚠ Erro ao contactar o servidor: ${e.message || 'sem resposta'}. Tenta novamente.`);
  } finally {
    if (btn) btn.disabled = false;
    inp?.focus();
  }
}

function enviarMsgChat(texto) {
  const inp = document.getElementById('chatInp');
  if (inp) inp.value = texto;
  enviarChat();
}

/* ════════════════════════════════════════════════════════════
   MODO DOCUMENTO VIVO — Edição por blocos via chat
╔═══════════════════════════════════════════════════════════ */

const _COMANDOS_EDICAO = [
  'melhora', 'melhore', 'reduz', 'reduza', 'explica', 'explique',
  'reorganiza', 'reorganize', 'transforma', 'transforme', 'corrige', 'corrija',
  'torna', 'torne', 'adiciona', 'adicione', 'remove', 'remova',
  'expande', 'expanda', 'reescreve', 'reescreva', 'edita', 'edite',
  'altera', 'altere', 'actualiza', 'actualize', 'refaz', 'refaça',
  'insere', 'insira', 'apaga', 'delete', 'muda', 'mude',
];

function _detectarComandoEdicao(texto) {
  const t = texto.toLowerCase().trim();
  return _COMANDOS_EDICAO.some(cmd => t.includes(cmd));
}

async function _chatProcessarEdicao(pedido) {
  const secs = State.get('secs');
  if (!secs || !secs.length) {
    _adicionarMsgChat('acad', '⚠ Nenhum documento aberto. Gera um documento primeiro.');
    return;
  }

  const alvo = blkLocalizar(secs, pedido);
  if (!alvo) {
    await _chatEditarViaIA(pedido, secs);
    return;
  }

  const { chapterIdx, block, blockIdx, section } = alvo;
  const proximos = blkLocalizarProximos(secs, chapterIdx, blockIdx);
  const cfg = State.get('cfg');
  const tp = tipoActual() || { n: 'Trabalho Académico' };

  const promptEdicao = [
    `És um orientador académico. Edita o bloco seguinte conforme o pedido do utilizador.`,
    `\n\nPedido: "${pedido}"`,
    `\n\nContexto do documento:`,
    `Tema: ${cfg.tema || '—'}`,
    `Tipo: ${tp.n}`,
    `Capítulo: ${section.titulo || `Cap.${chapterIdx + 1}`}`,
    `\n\nBloco ANTERIOR:\n${proximos.anterior ? proximos.anterior.content.substring(0, 300) : '(início do capítulo)'}`,
    `\n\nBLOCO A EDITAR:\n${block.content}`,
    `\n\nBloco SEGUINTE:\n${proximos.posterior ? proximos.posterior.content.substring(0, 300) : '(fim do capítulo)'}`,
    `\n\nNormas:`,
    `- Mantém o tom académico formal`,
    `- Preserva o estilo APA se aplicável`,
    `- Não inventes referências bibliográficas`,
    `- Responde APENAS com o novo conteúdo do bloco editado, sem explicações`,
    `- Mantém o mesmo tipo de conteúdo (parágrafo, lista, etc.)`,
  ].join('\n');

  try {
    _adicionarMsgChat('acad', `✏️ A editar "${block.content.substring(0, 60)}…" no capítulo "${section.titulo}"…`);

    const resposta = await callAcademyAPI({
      acao:   'editar_texto',
      texto:  block.content,
      subacao: 'editar_bloco',
      pedido: pedido,
      tema:   cfg.tema || '',
      tipoTrabalho: tp.n,
    });

    const novoConteudo = typeof resposta === 'string' ? resposta.trim() : null;
    if (!novoConteudo || novoConteudo.length < 3) {
      _adicionarMsgChat('acad', '⚠ A IA não conseguiu editar este bloco. Tenta reformular o pedido.');
      return;
    }

    const antigo = block.content;
    DocHistory.fromBlkAtualizar(secs, chapterIdx, block.id, novoConteudo, 'ia');
    blkAtualizar(secs, chapterIdx, block.id, novoConteudo, 'ia');
    State.set('secs', secs);
    blkAtualizarDOM(chapterIdx, block.id);
    autoGuardar();

    _adicionarMsgChat('acad', `✓ Bloco editado com sucesso.`);
    _mostrarSugestoesChat([
      'Melhora o tom académico',
      'Reduz este parágrafo',
      'Torna mais formal',
      'Adiciona uma referência',
    ]);
  } catch (e) {
    _adicionarMsgChat('acad', `⚠ Erro ao editar: ${e.message || 'sem resposta'}. Tenta novamente.`);
  }
}

async function _chatEditarViaIA(pedido, secs) {
  const cfg = State.get('cfg');
  const tp  = tipoActual() || { n: 'Trabalho Académico' };

  const contextoDoc = secs.map((s, i) => {
    const blocks = s.blocks || blkExtrair(s);
    return blocks.map((b, bi) =>
      `[sec.${s.num||i+1} bloco.${b.id}] ${b.content.substring(0, 200)}`
    ).join('\n');
  }).join('\n---\n');

  try {
    _adicionarMsgChat('acad', '🔍 A analisar o documento para aplicar a edição…');

    const resposta = await callAcademyAPI({
      acao:         'editar_texto',
      texto:        contextoDoc,
      subacao:      'editar_documento_completo',
      pedido,
      tema:         cfg.tema || '',
      tipoTrabalho: tp.n,
    });

    const novaResposta = typeof resposta === 'string' ? resposta : JSON.stringify(resposta);
    if (novaResposta.length < 10) throw new Error('Resposta vazia');

    /* Tentar parsear como JSON de edição estruturada */
    let edits = null;
    try {
      const jsonMatch = novaResposta.match(/```json\n?([\s\S]*?)\n?```/);
      const raw = jsonMatch ? jsonMatch[1] : novaResposta;
      edits = JSON.parse(raw.trim());
    } catch {}

    if (edits && Array.isArray(edits.operacoes)) {
      let aplicadas = 0;
      for (const op of edits.operacoes) {
        if (op.accao === 'editar' && op.chapterIdx != null && op.blockId) {
          const ok = blkAtualizar(secs, op.chapterIdx, op.blockId, op.conteudo, 'ia');
          if (ok) { blkAtualizarDOM(op.chapterIdx, op.blockId); aplicadas++; }
        } else if (op.accao === 'inserir' && op.chapterIdx != null) {
          const nb = blkInserir(secs, op.chapterIdx, op.afterBlockId || null, {
            type: op.type || 'paragraph',
            content: op.conteudo || '',
          });
          if (nb) { aplicadas++; blkRender(secs[op.chapterIdx], op.chapterIdx, true); }
        } else if (op.accao === 'remover' && op.chapterIdx != null && op.blockId) {
          const ok = blkRemover(secs, op.chapterIdx, op.blockId);
          if (ok) { aplicadas++; blkRender(secs[op.chapterIdx], op.chapterIdx, true); }
        }
      }
      State.set('secs', secs);
      autoGuardar();
      if (aplicadas > 0) {
        _adicionarMsgChat('acad', `✓ ${aplicadas} edição(ões) aplicada(s) com sucesso.`);
      } else {
        _adicionarMsgChat('acad', '⚠ Não consegui identificar o que editar. Reformula o pedido.');
      }
    } else {
      /* Resposta textual da IA — adicionar como notificação + tentar aplicar */
      chatHistorico.push({ role: 'assistant', content: novaResposta });
      _tiparMsgChat(novaResposta, () => {
        _adicionarMsgChat('acad', '💡 Para editar, diz exatamente o que queres mudar (ex: "melhora o parágrafo sobre metodologia").');
      });
    }
  } catch (e) {
    _adicionarMsgChat('acad', `⚠ Erro: ${e.message || 'sem resposta'}. Tenta novamente.`);
  }
}

function ativarChatDocumento() {
  const secs = State.get('secs');
  if (!secs || !secs.length) {
    _adicionarMsgChat('acad', '⚠ Gera um documento primeiro.');
    return;
  }
  _chatModoDocumento = true;
  secs.forEach((sec, i) => {
    if (!sec.blocks) sec.blocks = blkExtrair(sec);
    sec.blocks.forEach(b => { b.chapterIdx = i; });
  });
  State.set('secs', secs);
  _adicionarMsgChat('acad', '📄 **Modo Documento activo.**\n\nPodes pedir edições como:\n• *"Melhora a introdução"*\n• *"Reduz o parágrafo sobre metodologia"*\n• *"Adiciona uma referência no capítulo 2"*\n• *"Corrige o português da conclusão"*');
  _mostrarSugestoesChat([
    'Melhora a introdução',
    'Torna o capítulo 3 mais acadêmico',
    'Corrige o português da conclusão',
    'Adiciona uma referência',
  ]);
}

/* ════════════════════════════════════════════════════════════
   KEYBOARD — Visual Viewport API (Android/iOS)
════════════════════════════════════════════════════════════ */
let _vvHandler = null;

function _chatScrollInicio() {
  const c = document.getElementById('chatMsgs');
  if (c) c.addEventListener('scroll', () => {
    const emBaixo = (c.scrollHeight - c.scrollTop - c.clientHeight) < 60;
    _chatUserScrolled = !emBaixo;
  }, { passive: true });
}

function _chatKbStart() {
  if (!window.visualViewport) return;
  _chatKbAdapt();
  _vvHandler = () => _chatKbAdapt();
  window.visualViewport.addEventListener('resize', _vvHandler);
  window.visualViewport.addEventListener('scroll', _vvHandler);
}

function _chatKbStop() {
  if (!window.visualViewport || !_vvHandler) return;
  window.visualViewport.removeEventListener('resize', _vvHandler);
  window.visualViewport.removeEventListener('scroll', _vvHandler);
  _vvHandler = null;
}

function _chatKbAdapt() {
  if (!window.visualViewport) return;
  const box = document.getElementById('chatBox');
  if (!box) return;
  const vvH   = window.visualViewport.height;
  const vvTop = window.visualViewport.offsetTop;
  box.style.maxHeight = vvH + 'px';
  const msgs = document.getElementById('chatMsgs');
  if (msgs && !_chatUserScrolled) requestAnimationFrame(() => msgs.scrollTop = msgs.scrollHeight);
  const inp = document.getElementById('chatInp');
  if (inp && document.activeElement === inp) requestAnimationFrame(() => inp.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
}

/* ════════════════════════════════════════════════════════════
   VOZ — SpeechRecognition (STT)
════════════════════════════════════════════════════════════ */
let _voiceRec = null;
let _vozAtiva = false;

function togVoz() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) { mostrarToast('⚠ Voz não suportada. Usa Chrome.'); return; }
  if (_vozAtiva) { _voiceRec?.stop(); return; }

  _voiceRec = new SpeechRec();
  _voiceRec.lang = 'pt-PT';
  _voiceRec.continuous = false;
  _voiceRec.interimResults = true;

  _voiceRec.onstart = () => {
    _vozAtiva = true;
    const btn = document.getElementById('vozBtn');
    if (btn) btn.classList.add('gravando');
    mostrarToast('🎤 A ouvir-te…');
  };

  _voiceRec.onresult = e => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    const inp = document.getElementById('chatInp');
    if (inp) { inp.value = transcript; inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 100) + 'px'; }
  };

  _voiceRec.onend = () => {
    _vozAtiva = false;
    const btn = document.getElementById('vozBtn');
    if (btn) btn.classList.remove('gravando');
    const inp = document.getElementById('chatInp');
    if (inp?.value?.trim()) enviarChat();
  };

  _voiceRec.onerror = e => {
    _vozAtiva = false;
    const btn = document.getElementById('vozBtn');
    if (btn) btn.classList.remove('gravando');
    if (e.error === 'not-allowed' || e.error === 'permission-denied')
      mostrarToast('⚠ Microfone bloqueado — autoriza nas definições do browser.');
    else if (e.error === 'no-speech')
      mostrarToast('Nenhuma voz detectada. Tenta novamente.');
    else if (e.error !== 'aborted')
      mostrarToast('⚠ Voz não disponível: ' + e.error);
  };

  _voiceRec.start();
}

/* ════════════════════════════════════════════════════════════
   TTS — SpeechSynthesis (Texto → Voz)
════════════════════════════════════════════════════════════ */
let _ttsAtivo = false;
let _ttsUtt   = null;

function pararTTS() {
  window.speechSynthesis?.cancel();
  _ttsAtivo = false;
  _ttsUtt   = null;
  document.querySelectorAll('.tts-btn').forEach(b => { b.textContent = '🔊 Ouvir'; b.classList.remove('a-ler'); });
}

/* Sobrescreve o lerTexto básico do editor.js com versão completa */
function lerTexto(texto, btnId) {
  if (!('speechSynthesis' in window)) { mostrarToast('⚠ Leitura de voz não suportada.'); return; }
  if (_ttsAtivo) { pararTTS(); return; }

  window.speechSynthesis.cancel();
  _ttsUtt = new SpeechSynthesisUtterance(texto);
  _ttsUtt.lang  = 'pt-PT';
  _ttsUtt.rate  = 0.88;
  _ttsUtt.pitch = 1.05;
  _ttsUtt.volume = 1;

  /* Selecção de voz — preferência: Google > Microsoft > Apple > qualquer pt */
  const voices = window.speechSynthesis.getVoices();
  const voz = [
    voices.find(v => v.lang === 'pt-PT' && /google/i.test(v.name)),
    voices.find(v => v.lang === 'pt-BR' && /google/i.test(v.name)),
    voices.find(v => v.lang === 'pt-PT' && /microsoft/i.test(v.name)),
    voices.find(v => v.lang === 'pt-BR' && /microsoft/i.test(v.name)),
    voices.find(v => v.lang === 'pt-PT'),
    voices.find(v => v.lang.startsWith('pt')),
  ].filter(Boolean)[0];
  if (voz) _ttsUtt.voice = voz;

  _ttsUtt.onstart = () => {
    _ttsAtivo = true;
    document.querySelectorAll('.tts-btn').forEach(b => { b.textContent = '⏹ Parar'; b.classList.remove('a-ler'); });
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('a-ler');
  };
  _ttsUtt.onend   = pararTTS;
  _ttsUtt.onerror = pararTTS;
  window.speechSynthesis.speak(_ttsUtt);
}

/* ════════════════════════════════════════════════════════════
   EDITOR CONVERSACIONAL INTELIGENTE
════════════════════════════════════════════════════════════ */
const ecState = {
  aberto:            false,
  capitulos:         [],
  metadados:         {},
  mensagensChat:     [],
  historicoEdicoes:  [],
  seccoesModificadas: new Set(),
  versaoAtual:       0,
  operacaoAtiva:     false,
};

function abrirEditorConversacional() {
  const secs = State.get('secs');
  if (!secs || !secs.length) { mostrarToast('⚠ Gera um documento primeiro.'); return; }

  const tp = tipoActual() || { n: 'Trabalho Académico', s: 'TFC' };
  const cfg = State.get('cfg');

  ecState.capitulos = secs.map((s, i) => ({
    num:      s.num || i + 1,
    titulo:   s.titulo || `Capítulo ${i + 1}`,
    conteudo: s.c || s.conteudo || '',
  }));
  ecState.metadados = {
    tipo: tp.n, sigla: tp.s, tema: cfg.tema || '',
    inst: cfg.inst || '', prof: cfg.prof || '', nivel: cfg.nivel || '',
    autores: cfg.mbs?.length ? cfg.mbs : [State.get('u')?.nome || ''],
    refStyle: cfg.refStyle || 'APA',
  };
  ecState.mensagensChat     = [];
  ecState.historicoEdicoes  = [];
  ecState.seccoesModificadas.clear();
  ecState.versaoAtual       = 0;
  ecState.operacaoAtiva     = false;
  ecState.aberto            = true;

  /* Render no modal */
  const ecBody = document.getElementById('ecBody');
  if (ecBody) ecBody.innerHTML = _ecRenderUI();

  const modal = document.getElementById('ecModal');
  if (modal) modal.classList.add('aberto');

  /* Ocultar chat pill */
  const pill = document.getElementById('chatPill');
  if (pill) pill.classList.add('oculta');
}

function fecharEditorConversacional() {
  ecState.capitulos.forEach((cap, i) => {
    const secs = State.get('secs');
    if (secs[i]) {
      secs[i].c = cap.conteudo;
      secs[i].blocks = blkExtrair({ c: cap.conteudo });
    }
    State.set('secs', secs);
  });
  autoGuardar();

  const modal = document.getElementById('ecModal');
  if (modal) modal.classList.remove('aberto');
  ecState.aberto = false;

  const pill = document.getElementById('chatPill');
  if (pill) pill.classList.remove('oculta');

  mostrarToast('✓ Documento guardado com alterações.');
}

function _ecRenderUI() {
  return `
  <div style="margin-bottom:14px">
    <div style="font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:12px">
      Descreve em linguagem natural o que queres editar — ex: <em style="color:var(--b)">"Melhora a introdução do capítulo 2"</em> ou <em style="color:var(--b)">"Adiciona mais exemplos no capítulo 4"</em>.
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
      ${ecState.capitulos.slice(0, 6).map((c, i) => `
      <div style="padding:5px 10px;border-radius:20px;background:var(--z3);border:1px solid var(--e0);font-family:var(--fm);font-size:8px;color:var(--t2);cursor:pointer"
        onclick="document.getElementById('ecPedidoInp').value='Melhora o capítulo ${c.num}: ${c.titulo.substring(0,30)}'">
        Cap.${c.num}
      </div>`).join('')}
    </div>
    <textarea id="ecPedidoInp" class="inp" placeholder="Ex: Melhora a introdução do capítulo 1, adiciona mais fundamentos teóricos…"
      style="min-height:80px;resize:vertical;margin-bottom:10px"></textarea>
    <button class="btn B w" onclick="_ecEnviarPedido()" id="ecBtnEnviar">⚡ Aplicar com IA →</button>
    <div id="ecStatus" style="margin-top:10px;font-family:var(--fm);font-size:10px;color:var(--t3)"></div>
  </div>
  <div id="ecHistorico" style="display:flex;flex-direction:column;gap:8px"></div>`;
}

async function _ecEnviarPedido() {
  const inp    = document.getElementById('ecPedidoInp');
  const btn    = document.getElementById('ecBtnEnviar');
  const status = document.getElementById('ecStatus');
  const pedido = inp?.value?.trim();
  if (!pedido || ecState.operacaoAtiva) return;

  ecState.operacaoAtiva = true;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A processar…'; }
  if (status) { status.style.color = 'var(--b)'; status.textContent = 'A analisar o pedido…'; }

  try {
    const tp = tipoActual() || { n: 'Trabalho Académico' };

    /* Detectar capítulos mencionados no pedido */
    const caps = ecState.capitulos;
    const mencionados = caps.filter((c, i) => {
      const num = (c.num || i + 1).toString();
      return pedido.includes(num) || pedido.toLowerCase().includes((c.titulo || '').toLowerCase().substring(0, 15));
    });
    const alvo = mencionados.length > 0 ? mencionados : caps.slice(0, 2);

    const contextoCaps = alvo.map(c =>
      `Cap.${c.num} — ${c.titulo}:\n${(c.conteudo || '').substring(0, 600)}`
    ).join('\n\n---\n\n');

    if (status) status.textContent = 'A gerar edição com IA…';

    const res = await callAcademyAPI({
      acao:         'editar_texto',
      texto:        contextoCaps,
      subacao:      'editar_conversacional',
      pedido,
      tipoTrabalho: tp.n,
      tema:         State.getCfg('tema') || '',
    });

    const novoTexto = typeof res === 'string' ? res : null;
    if (!novoTexto) throw new Error('Resposta vazia da IA.');

    /* Aplicar ao primeiro capítulo alvo */
    const idxAlvo = caps.indexOf(alvo[0]);
    if (idxAlvo >= 0) {
      ecState.capitulos[idxAlvo].conteudo = novoTexto;
      ecState.seccoesModificadas.add(idxAlvo);
    }

    /* Registar no histórico */
    const hist = document.getElementById('ecHistorico');
    if (hist) {
      const item = document.createElement('div');
      item.style.cssText = 'background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:12px';
      item.innerHTML = `
        <div style="font-family:var(--fm);font-size:8px;color:var(--b);margin-bottom:4px">✓ EDITADO · Cap.${alvo[0]?.num}</div>
        <div style="font-size:12px;color:var(--t2);margin-bottom:6px;font-style:italic">"${pedido.substring(0, 60)}"</div>
        <button onclick="this.closest('div').remove()" style="font-family:var(--fm);font-size:8px;color:var(--t3);background:none;border:none;cursor:pointer">Dispensar</button>`;
      hist.insertBefore(item, hist.firstChild);
    }

    if (status) { status.style.color = 'var(--b)'; status.textContent = `✓ Cap.${alvo[0]?.num} editado com sucesso.`; }
    if (inp) inp.value = '';
    mostrarToast('✓ Edição aplicada!');

    /* Guardar automaticamente */
    ecState.capitulos.forEach((cap, i) => {
      const secs = State.get('secs');
      if (secs[i]) {
        secs[i].c = cap.conteudo;
        secs[i].blocks = blkExtrair({ c: cap.conteudo });
      }
      State.set('secs', secs);
    });
    autoGuardar();

  } catch (e) {
    if (status) { status.style.color = '#f87171'; status.textContent = '✗ Erro: ' + (e.message || 'sem resposta'); }
    mostrarToast('✗ Erro ao editar: ' + (e.message || ''), 'erro');
  } finally {
    ecState.operacaoAtiva = false;
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Aplicar com IA →'; }
  }
}
