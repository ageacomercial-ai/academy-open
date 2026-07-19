/* academic/engines/versioning.js
   Immutable Document Versioning Engine
   Snapshot-based versioning with diff and revert
============================================================================= */

const MAX_VERSIONS = 50;

/* ── Gerar ID único ── */
function _vId() {
  return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ── Calcular checksum simples ── */
function _checksum(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'cs_' + Math.abs(hash).toString(36);
}

/* ── Deep clone (serializável) ── */
function _clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Criar snapshot imutável do documento ── */
export function criarSnapshot(state, opts = {}) {
  const {
    source = 'manual_save',
    reason = '',
    parentVersion = null,
    docId = null,
  } = opts;

  const snapshot = {
    id: _vId(),
    docId: docId || state._docId || null,
    timestamp: new Date().toISOString(),
    source,
    reason: reason.substring(0, 500),
    parentVersion,
    checksum: null,
    data: {
      secs: _clone(state.secs || []),
      cfg: _clone(state.cfg || {}),
      diagnostic: _clone(state.diagnostic || null),
      refs: _clone(state.refs || []),
      qual: _clone(state.qual || null),
      plano: _clone(state.plano || null),
      est: _clone(state.est || null),
      academicAnalysis: _clone(state.academicAnalysis || null),
      refVerification: _clone(state.refVerification || null),
    },
  };

  snapshot.checksum = _checksum(snapshot.data);
  return snapshot;
}

/* ── Listar snapshots armazenados ── */
export function listarSnapshots(docId, storage = {}) {
  const all = storage.versoes || [];
  return all
    .filter(v => !docId || v.docId === docId)
    .map(v => ({
      id: v.id,
      docId: v.docId,
      timestamp: v.timestamp,
      source: v.source,
      reason: v.reason,
      parentVersion: v.parentVersion,
      checksum: v.checksum,
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/* ── Obter snapshot completo por ID ── */
export function obterSnapshot(versionId, storage = {}) {
  const all = storage.versoes || [];
  return all.find(v => v.id === versionId) || null;
}

/* ── Reverter estado para um snapshot ── */
export function reverterPara(snapshot) {
  if (!snapshot || !snapshot.data) return null;
  return _clone(snapshot.data);
}

/* ── Acrescentar snapshot ao armazenamento (respeitando limite) ── */
export function guardarSnapshot(snapshot, storage = {}) {
  const all = _clone(storage.versoes || []);
  all.unshift(snapshot);
  if (all.length > MAX_VERSIONS) all.length = MAX_VERSIONS;
  return { ...storage, versoes: all };
}

/* ── Comparar dois snapshots → diff estruturado ── */
export function compararSnapshots(snapshotA, snapshotB) {
  if (!snapshotA || !snapshotB) return { error: 'Ambos os snapshots são necessários.' };

  const dataA = snapshotA.data || {};
  const dataB = snapshotB.data || {};
  const diff = { chapters: [], metadata: [], summary: [] };

  /* Comparar metadados (cfg) */
  const cfgA = dataA.cfg || {};
  const cfgB = dataB.cfg || {};
  const cfgChanges = [];
  for (const key of new Set([...Object.keys(cfgA), ...Object.keys(cfgB)])) {
    if (JSON.stringify(cfgA[key]) !== JSON.stringify(cfgB[key])) {
      cfgChanges.push({ key, from: cfgA[key], to: cfgB[key] });
    }
  }
  if (cfgChanges.length) diff.metadata.push({ section: 'config', changes: cfgChanges });

  /* Comparar capítulos */
  const secsA = dataA.secs || [];
  const secsB = dataB.secs || [];
  const maxLen = Math.max(secsA.length, secsB.length);

  for (let i = 0; i < maxLen; i++) {
    const capA = secsA[i];
    const capB = secsB[i];

    if (!capA && capB) {
      diff.chapters.push({ idx: i, type: 'added', title: capB.titulo || capB.title || `Capítulo ${i + 1}` });
      continue;
    }
    if (capA && !capB) {
      diff.chapters.push({ idx: i, type: 'removed', title: capA.titulo || capA.title || `Capítulo ${i + 1}` });
      continue;
    }

    const titleA = capA.titulo || capA.title || '';
    const titleB = capB.titulo || capB.title || '';
    const contentA = capA.c || capA.conteudo || '';
    const contentB = capB.c || capB.conteudo || '';
    const changed = titleA !== titleB || contentA !== contentB;

    if (changed) {
      const palavrasA = contentA.split(/\s+/).filter(Boolean).length;
      const palavrasB = contentB.split(/\s+/).filter(Boolean).length;
      diff.chapters.push({
        idx: i,
        type: 'modified',
        title: titleB || titleA,
        titleChanged: titleA !== titleB,
        oldTitle: titleA !== titleB ? titleA : undefined,
        oldWordCount: palavrasA,
        newWordCount: palavrasB,
        wordDiff: palavrasB - palavrasA,
      });
    }
  }

  /* Comparar qual/scorecard */
  const qualA = dataA.qual;
  const qualB = dataB.qual;
  if ((qualA?.total || 0) !== (qualB?.total || 0)) {
    diff.metadata.push({
      section: 'qualidade',
      changes: [{ key: 'total', from: qualA?.total || 0, to: qualB?.total || 0 }],
    });
  }

  /* Gerar sumário legível */
  const added = diff.chapters.filter(c => c.type === 'added').length;
  const removed = diff.chapters.filter(c => c.type === 'removed').length;
  const modified = diff.chapters.filter(c => c.type === 'modified').length;
  const totalWordDiff = diff.chapters.reduce((s, c) => s + (c.wordDiff || 0), 0);

  diff.summary.push(`Capítulos: ${added ? `+${added} adicionados ` : ''}${removed ? `${removed} removidos ` : ''}${modified ? `${modified} modificados` : ''}${!added && !removed && !modified ? 'sem alterações' : ''}`);
  if (totalWordDiff !== 0) diff.summary.push(`Palavras: ${totalWordDiff > 0 ? '+' : ''}${totalWordDiff}`);
  if (cfgChanges.length) diff.summary.push(`Configuração: ${cfgChanges.length} campo(s) alterado(s)`);

  return diff;
}
