/* ═══════════════════════════════════════════════════════════
   ACADEMY — DOC-HISTORY.JS
   Histórico de alterações com suporte a undo/redo
   Depende de: doc-blocks.js, state.js
   ═══════════════════════════════════════════════════════════ */

const DocHistory = {
  _stack: [],
  _pointer: -1,
  _maxSize: 50,

  push(entry) {
    this._pointer++;
    this._stack.splice(this._pointer);
    const e = {
      date: new Date().toISOString(),
      chapterIdx: entry.chapterIdx,
      blockId: entry.blockId,
      previousContent: entry.previousContent,
      newContent: entry.newContent,
      source: entry.source || 'user',
      action: entry.action || 'edit',
      blockType: entry.blockType || 'paragraph',
    };
    this._stack.push(e);
    if (this._stack.length > this._maxSize) {
      this._stack.splice(0, this._stack.length - this._maxSize);
      this._pointer = this._stack.length - 1;
    }
    this._persistir();
    return e;
  },

  undo() {
    if (this._pointer < 0) return null;
    const entry = this._stack[this._pointer];
    const secs = State.get('secs');
    const ok = blkAtualizar(secs, entry.chapterIdx, entry.blockId, entry.previousContent, 'undo');
    if (ok) {
      State.set('secs', secs);
      this._pointer--;
      this._persistir();
      return entry;
    }
    return null;
  },

  redo() {
    if (this._pointer >= this._stack.length - 1) return null;
    const entry = this._stack[this._pointer + 1];
    const secs = State.get('secs');
    const ok = blkAtualizar(secs, entry.chapterIdx, entry.blockId, entry.newContent, 'redo');
    if (ok) {
      State.set('secs', secs);
      this._pointer++;
      this._persistir();
      return entry;
    }
    return null;
  },

  getHistory(blockId) {
    return this._stack.filter(e => e.blockId === blockId);
  },

  getAll() {
    return this._stack.slice(0, this._pointer + 1);
  },

  clear() {
    this._stack = [];
    this._pointer = -1;
    this._persistir();
  },

  _persistir() {
    try {
      LS.set('doc_history', { stack: this._stack.slice(0, this._pointer + 1), pointer: this._pointer });
    } catch (_) {}
  },

  _restaurar() {
    try {
      const saved = LS.get('doc_history');
      if (saved && saved.stack) {
        this._stack = saved.stack;
        this._pointer = saved.pointer || this._stack.length - 1;
      }
    } catch (_) {}
  },

  fromBlkAtualizar(secs, chapterIdx, blockId, newContent, source) {
    const sec = secs[chapterIdx];
    if (!sec) return null;
    const blocks = sec.blocks || blkExtrair(sec);
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.content === newContent) return null;
    return this.push({
      chapterIdx,
      blockId,
      previousContent: block.content,
      newContent,
      source: source || 'user',
      action: 'edit',
      blockType: block.type,
    });
  },

  canUndo() { return this._pointer >= 0; },
  canRedo() { return this._pointer < this._stack.length - 1; },
};

DocHistory._restaurar();
