/* ═══════════════════════════════════════════════════════════
   ACADEMY — DOC-BLOCKS.JS
   Sistema de blocos: documento estruturado em blocos
   independentes com serviços de edição, localização e
   manipulação.
   Depende de: state.js (State)
   ═══════════════════════════════════════════════════════════ */

function _blkId() {
  return 'blk_' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
}

function _detectBlockType(parag) {
  const t = parag.trim();
  if (!t) return 'paragraph';
  if (/^#{1,6}\s/.test(t)) return 'heading';
  if (/^\[.+?\]\(.+?\)/.test(t)) return 'reference';
  if (/^[\-\*]\s/.test(t) || /^\d+[\.\)]\s/.test(t)) return 'list';
  if (/\|.+\|/.test(t) && t.includes('\n')) return 'table';
  return 'paragraph';
}

/* ════════════════════════════════════════════════════════════
   CONVERSÃO TEXTO ↔ BLOCOS
╔═══════════════════════════════════════════════════════════ */

function blkExtrair(sec) {
  if (sec.blocks && sec.blocks.length > 0) return sec.blocks;
  const text = sec.c || sec.conteudo || '';
  const pars = text.split('\n\n').filter(p => p.trim().length > 0);
  if (pars.length === 0) {
    return [{ id: _blkId(), type: 'paragraph', content: '', order: 0, level: 0, chapterIdx: -1, meta: {}, history: [] }];
  }
  return pars.map((p, i) => ({
    id: _blkId(),
    type: _detectBlockType(p),
    content: p.trim(),
    order: i,
    level: 0,
    chapterIdx: -1,
    meta: {},
    history: []
  }));
}

function blkUnir(blocks) {
  return blocks.map(b => b.content).join('\n\n');
}

function blkSync(secs) {
  if (!secs) return secs;
  secs.forEach((sec, ci) => {
    if (sec.blocks && sec.blocks.length > 0) {
      sec.c = blkUnir(sec.blocks);
      sec.blocks.forEach(b => { b.chapterIdx = ci; });
    }
  });
  return secs;
}

/* ════════════════════════════════════════════════════════════
   LOCALIZAR BLOCOS
╔═══════════════════════════════════════════════════════════ */

function blkLocalizar(secs, query) {
  const q = query.toLowerCase();
  const results = [];
  secs.forEach((sec, ci) => {
    const blocks = sec.blocks || blkExtrair(sec);
    blocks.forEach((b, bi) => {
      const score =
        (b.content.toLowerCase().includes(q) ? 2 : 0) +
        ((sec.titulo || '').toLowerCase().includes(q) ? 1 : 0);
      if (score > 0) {
        results.push({ chapterIdx: ci, block: b, blockIdx: bi, section: sec, score });
      }
    });
  });
  results.sort((a, b) => b.score - a.score);
  return results.length > 0 ? results[0] : null;
}

function blkLocalizarPorId(secs, chapterIdx, blockId) {
  const sec = secs[chapterIdx];
  if (!sec) return null;
  const blocks = sec.blocks || blkExtrair(sec);
  const bi = blocks.findIndex(b => b.id === blockId);
  if (bi < 0) return null;
  return { chapterIdx, block: blocks[bi], blockIdx: bi, section: sec };
}

function blkLocalizarProximos(secs, chapterIdx, blockIdx, limite) {
  limite = limite || 1;
  const sec = secs[chapterIdx];
  if (!sec) return { anterior: null, posterior: null };
  const blocks = sec.blocks || blkExtrair(sec);
  return {
    anterior: blockIdx > 0 ? blocks[blockIdx - 1] : null,
    posterior: blockIdx < blocks.length - 1 ? blocks[blockIdx + 1] : null
  };
}

/* ════════════════════════════════════════════════════════════
   OPERAÇÕES EM BLOCOS
╔═══════════════════════════════════════════════════════════ */

function blkAtualizar(secs, chapterIdx, blockId, newContent, source) {
  const sec = secs[chapterIdx];
  if (!sec) return false;
  const blocks = sec.blocks || blkExtrair(sec);
  const block = blocks.find(b => b.id === blockId);
  if (!block) return false;
  if (block.content === newContent) return true;
  block.history.push({
    date: new Date().toISOString(),
    previousContent: block.content,
    newContent,
    source: source || 'user',
  });
  if (block.history.length > 20) block.history.splice(0, block.history.length - 20);
  block.content = newContent;
  sec.blocks = blocks;
  sec.c = blkUnir(blocks);
  return true;
}

function blkInserir(secs, chapterIdx, afterBlockId, newBlock) {
  const sec = secs[chapterIdx];
  if (!sec) return null;
  const blocks = sec.blocks || blkExtrair(sec);
  const insertIdx = afterBlockId
    ? blocks.findIndex(b => b.id === afterBlockId) + 1
    : blocks.length;
  const nb = {
    id: _blkId(),
    type: newBlock.type || 'paragraph',
    content: newBlock.content || '',
    order: insertIdx,
    level: newBlock.level || 0,
    chapterIdx,
    meta: newBlock.meta || {},
    history: []
  };
  blocks.splice(insertIdx, 0, nb);
  blocks.forEach((b, i) => { b.order = i; });
  sec.blocks = blocks;
  sec.c = blkUnir(blocks);
  return nb;
}

function blkRemover(secs, chapterIdx, blockId) {
  const sec = secs[chapterIdx];
  if (!sec) return false;
  const blocks = sec.blocks || blkExtrair(sec);
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return false;
  blocks.splice(idx, 1);
  blocks.forEach((b, i) => { b.order = i; });
  sec.blocks = blocks;
  sec.c = blkUnir(blocks);
  return true;
}

function blkMover(secs, chapterIdx, blockId, newOrder) {
  const sec = secs[chapterIdx];
  if (!sec) return false;
  const blocks = sec.blocks || blkExtrair(sec);
  const from = blocks.findIndex(b => b.id === blockId);
  if (from < 0) return false;
  const to = Math.max(0, Math.min(newOrder, blocks.length - 1));
  const [item] = blocks.splice(from, 1);
  blocks.splice(to, 0, item);
  blocks.forEach((b, i) => { b.order = i; });
  sec.blocks = blocks;
  sec.c = blkUnir(blocks);
  return true;
}

function blkDividir(secs, chapterIdx, blockId, position) {
  const sec = secs[chapterIdx];
  if (!sec) return null;
  const blocks = sec.blocks || blkExtrair(sec);
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return null;
  const orig = blocks[idx];
  const splitPos = Math.min(position, orig.content.length);
  const left = orig.content.slice(0, splitPos).trim();
  const right = orig.content.slice(splitPos).trim();
  if (!right) return null;
  orig.content = left;
  const nb = {
    id: _blkId(), type: orig.type, content: right,
    order: idx + 1, level: orig.level, chapterIdx,
    meta: {}, history: []
  };
  blocks.splice(idx + 1, 0, nb);
  blocks.forEach((b, i) => { b.order = i; });
  sec.blocks = blocks;
  sec.c = blkUnir(blocks);
  return nb;
}

function blkUnirBlocos(secs, chapterIdx, blockIdA, blockIdB) {
  const sec = secs[chapterIdx];
  if (!sec) return false;
  const blocks = sec.blocks || blkExtrair(sec);
  const idxA = blocks.findIndex(b => b.id === blockIdA);
  const idxB = blocks.findIndex(b => b.id === blockIdB);
  if (idxA < 0 || idxB < 0) return false;
  const first = Math.min(idxA, idxB);
  const second = Math.max(idxA, idxB);
  blocks[first].content = blocks[first].content + '\n\n' + blocks[second].content;
  blocks.splice(second, 1);
  blocks.forEach((b, i) => { b.order = i; });
  sec.blocks = blocks;
  sec.c = blkUnir(blocks);
  return true;
}

/* ════════════════════════════════════════════════════════════
   RENDER BLOCOS → HTML
╔═══════════════════════════════════════════════════════════ */

function blkRender(blocks) {
  if (!blocks || blocks.length === 0) return '<p style="color:var(--t4);font-style:italic">[vazio]</p>';
  return blocks.map((b, i) => {
    if (!b.content) return '';
    const html = _blkMdParaHtml(b.content);
    const dataAttr = `data-blk-id="${b.id}" data-blk-idx="${i}"`;
    switch (b.type) {
      case 'heading':
        return `<h3 ${dataAttr} style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--t1);margin:12px 0 6px;line-height:1.5">${html}</h3>`;
      case 'subtitle':
        return `<h4 ${dataAttr} style="font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t2);margin:8px 0 4px;line-height:1.5">${html}</h4>`;
      case 'list':
        return `<p ${dataAttr} style="padding-left:12px;margin:2px 0">${html}</p>`;
      case 'reference':
        return `<p ${dataAttr} style="padding-left:20px;text-indent:-20px;font-size:10px;color:var(--t3);margin:2px 0">${html}</p>`;
      default:
        return `<p ${dataAttr} style="margin:4px 0;line-height:1.7">${html}</p>`;
    }
  }).filter(Boolean).join('\n');
}

function _blkMdParaHtml(txt) {
  if (!txt) return '';
  return txt
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/^\[(.+?)\]\((.+?)\)/gm, '<a href="$2" target="_blank" style="color:var(--b)">$1</a>')
    .trim();
}

/* ════════════════════════════════════════════════════════════
   RE-RENDER PARCIAL — apenas um bloco no DOM
╔═══════════════════════════════════════════════════════════ */

function blkRenderUnico(block, idx) {
  if (!block || !block.content) return '';
  const html = _blkMdParaHtml(block.content);
  const dataAttr = `data-blk-id="${block.id}" data-blk-idx="${idx}"`;
  switch (block.type) {
    case 'heading':
      return `<h3 ${dataAttr} style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--t1);margin:12px 0 6px;line-height:1.5">${html}</h3>`;
    case 'subtitle':
      return `<h4 ${dataAttr} style="font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t2);margin:8px 0 4px;line-height:1.5">${html}</h4>`;
    case 'list':
      return `<p ${dataAttr} style="padding-left:12px;margin:2px 0">${html}</p>`;
    case 'reference':
      return `<p ${dataAttr} style="padding-left:20px;text-indent:-20px;font-size:10px;color:var(--t3);margin:2px 0">${html}</p>`;
    default:
      return `<p ${dataAttr} style="margin:4px 0;line-height:1.7">${html}</p>`;
  }
}

/* ════════════════════════════════════════════════════════════
   ACTUALIZAR APENAS UM BLOCO NO DOM
╔═══════════════════════════════════════════════════════════ */

function blkAtualizarDOM(chapterIdx, blockId, secaoSufixo) {
  const suf = secaoSufixo || '';
  const sc = document.getElementById(`sc-${chapterIdx}${suf}`);
  if (!sc) return false;
  const secs = State.get('secs');
  const sec = secs[chapterIdx];
  if (!sec) return false;
  const blocks = sec.blocks || blkExtrair(sec);
  const bi = blocks.findIndex(b => b.id === blockId);
  if (bi < 0) return false;
  const el = sc.querySelector(`[data-blk-id="${blockId}"]`);
  if (el) {
    el.outerHTML = blkRenderUnico(blocks[bi], bi);
    return true;
  }
  sc.innerHTML = blkRender(blocks);
  return true;
}
