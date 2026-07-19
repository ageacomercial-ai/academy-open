/* academic/schemas/document.schema.js
   Modelo de dados do documento com validação de integridade
============================================================================= */

/* ── Bloco individual do documento ── */
export function createBlock({ type, content, order, level, chapterIdx, meta }) {
  return {
    id:         'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    type:       type || 'paragraph',
    content:    String(content || ''),
    order:      order || 0,
    level:      level || 0,
    chapterIdx: chapterIdx ?? null,
    meta:       meta || {},
    history:    [],
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
  };
}

/* ── Estágios do pipeline de geração ── */
export const GEN_STAGES = [
  'INPUT_ANALYSIS',
  'DIAGNOSTIC',
  'PLAN',
  'EVIDENCE',
  'STRUCTURE',
  'ARGUMENTATION',
  'GENERATION',
  'VALIDATION',
  'RENDER',
];

/* ── Schema do documento completo ── */
export function createDocumentSchema(overrides = {}) {
  return {
    metadata: {
      title:        String(overrides.title || '').substring(0, 300),
      topic:        String(overrides.topic || '').substring(0, 300),
      type:         String(overrides.type || 'tfc').substring(0, 100),
      level:        String(overrides.level || '').substring(0, 80),
      institution:  String(overrides.institution || '').substring(0, 100),
      professor:    String(overrides.professor || '').substring(0, 100),
      country:      String(overrides.country || '').substring(0, 60),
      language:     String(overrides.language || 'pt').substring(0, 10),
      citationStyle: String(overrides.citationStyle || 'APA').substring(0, 20),
      totalPages:   Math.max(1, parseInt(overrides.totalPages) || 15),
      totalChapters: Math.max(1, parseInt(overrides.totalChapters) || 5),
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
      version:      overrides.version || 1,
    },
    diagnostic: null,
    plan:       null,
    evidence:   [],
    structure:  [],
    chapters:   [],
    references: [],
    scorecard:  null,
  };
}

/* ── Validar integridade do documento ── */
export function validarIntegridadeDocumento(doc) {
  const issues = [];

  if (!doc.metadata.title || doc.metadata.title.length < 5) {
    issues.push({ code: 'MISSING_TITLE', severity: 'critical', message: 'Título ausente ou muito curto' });
  }
  if (!doc.metadata.topic || doc.metadata.topic.length < 10) {
    issues.push({ code: 'MISSING_TOPIC', severity: 'critical', message: 'Tema ausente ou muito curto' });
  }
  if (!doc.metadata.type) {
    issues.push({ code: 'MISSING_TYPE', severity: 'high', message: 'Tipo de trabalho não definido' });
  }
  if (!doc.metadata.level) {
    issues.push({ code: 'MISSING_LEVEL', severity: 'medium', message: 'Nível académico não definido' });
  }

  if (doc.diagnostic) {
    if (!doc.diagnostic.researchProblem) {
      issues.push({ code: 'MISSING_PROBLEM', severity: 'high', message: 'Problema de investigação não definido' });
    }
    if (!doc.diagnostic.researchQuestion) {
      issues.push({ code: 'MISSING_QUESTION', severity: 'high', message: 'Pergunta de investigação não definida' });
    }
    if (!doc.diagnostic.generalObjective) {
      issues.push({ code: 'MISSING_OBJECTIVE', severity: 'high', message: 'Objectivo geral não definido' });
    }
  }

  if (doc.chapters.length === 0) {
    issues.push({ code: 'NO_CHAPTERS', severity: 'critical', message: 'Nenhum capítulo gerado' });
  }

  if (doc.references.length === 0) {
    issues.push({ code: 'NO_REFERENCES', severity: 'high', message: 'Nenhuma referência bibliográfica' });
  }

  return {
    valido: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    criticalCount: issues.filter(i => i.severity === 'critical').length,
    highCount: issues.filter(i => i.severity === 'high').length,
    mediumCount: issues.filter(i => i.severity === 'medium').length,
  };
}
