/* academic/engines/argumentation.js
   Etapa 4: Estrutura Argumentativa
   Constrói a coerência entre os blocos do documento
============================================================================= */

export const ARGUMENT_ROLES = [
  'THESIS',
  'CONTEXT',
  'EVIDENCE',
  'INTERPRETATION',
  'COUNTERARGUMENT',
  'REBUTTAL',
  'CONCLUSION',
  'TRANSITION',
];

export function analisarEstruturaArgumentativa(capitulos) {
  return capitulos.map((cap, idx) => ({
    chapterIdx: idx,
    title:      cap.title || `Capítulo ${idx + 1}`,
    sections:   (cap.sections || []).map((sec, sIdx) => ({
      sectionIdx:  sIdx,
      title:       sec.title || `Secção ${sIdx + 1}`,
      paragraphs:  (sec.paragraphs || []).map((par, pIdx) => ({
        paragraphIdx: pIdx,
        text:         par.substring(0, 100),
        role:         classificarParagrafo(par),
        hasCitation:  /\((?:[A-ZÀ-Ü][^)]*\d{4}|\d{4})\)/.test(par),
        wordCount:    par.split(/\s+/).length,
      })),
    })),
  }));
}

export function classificarParagrafo(texto) {
  const lower = texto.toLowerCase().trim();

  if (/conclui[-se]|em\s+s[iú]ntese|por\s+conseguinte|portanto|desta\s+forma|logo\b/.test(lower)) {
    return 'CONCLUSION';
  }
  if (/contudo|no\s+entanto|por[ée]m|todavia|embora|apesar\s+de/.test(lower)) {
    return 'COUNTERARGUMENT';
  }
  if (/segundo\s+|dados\s+|estudo\s+|pesquisa\s+|investiga[cç][aã]o/.test(lower)) {
    return 'EVIDENCE';
  }
  if (/contextuali[zZ]|enquadramento|hist[óo]ric|origem/.test(lower)) {
    return 'CONTEXT';
  }
  if (/argumenta[-se]|defende[-se]|sustenta[-se]|afirma[-se]/.test(lower)) {
    return 'THESIS';
  }
  if (/assim|al[ée]m\s+disso|do\s+mesmo\s+modo|igualmente|tamb[ée]m/.test(lower)) {
    return 'TRANSITION';
  }

  return 'INTERPRETATION';
}

export function verificarCoerenciaArgumentativa(estrutura) {
  const issues = [];

  for (const cap of estrutura) {
    const roles = cap.sections.flatMap(s => s.paragraphs.map(p => p.role));
    const hasThesis = roles.includes('THESIS');
    const hasConclusion = roles.includes('CONCLUSION');
    const hasEvidence = roles.includes('EVIDENCE');

    if (!hasThesis && cap.chapterIdx < 2) {
      issues.push({ chapter: cap.chapterIdx, severity: 'medium', message: `Capítulo "${cap.title}" sem tese explícita` });
    }
    if (!hasConclusion && cap.chapterIdx > 0) {
      issues.push({ chapter: cap.chapterIdx, severity: 'low', message: `Capítulo "${cap.title}" sem conclusão` });
    }
    if (!hasEvidence) {
      issues.push({ chapter: cap.chapterIdx, severity: 'high', message: `Capítulo "${cap.title}" sem evidências` });
    }

    const pCits = cap.sections.flatMap(s => s.paragraphs.filter(p => p.hasCitation));
    if (pCits.length < cap.sections.length) {
      issues.push({ chapter: cap.chapterIdx, severity: 'high', message: `Capítulo "${cap.title}" com secções sem citações` });
    }
  }

  return {
    coerente: issues.filter(i => i.severity === 'high').length === 0,
    issues,
    totalIssues: issues.length,
  };
}
