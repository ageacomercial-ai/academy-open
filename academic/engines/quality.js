/* academic/engines/quality.js
   Etapa 5: Scorecard de qualidade e validação do documento
   v2: Integrado com políticas de confiança e integridade
============================================================================= */

import { INTEGRITY_STATE } from '../policies/integrity.js';

export const CRITERIA = [
  { key: 'coherence',        label: 'Coerência temática', weight: 20 },
  { key: 'argumentation',    label: 'Estrutura argumentativa', weight: 18 },
  { key: 'integrity',        label: 'Integridade das evidências', weight: 16 },
  { key: 'citations',        label: 'Citações e referências', weight: 14 },
  { key: 'coverage',         label: 'Cobertura objectivos↔capítulos', weight: 12 },
  { key: 'methodology',      label: 'Metodologia', weight: 10 },
  { key: 'literacy',         label: 'Qualidade de escrita', weight: 6 },
  { key: 'formatting',       label: 'Formatação e estrutura', weight: 4 },
];

export function gerarScorecard(data) {
  const scores = {};
  let totalScore = 0;
  let totalWeight = 0;

  for (const criterion of CRITERIA) {
    const value = avalieCriterio(criterion.key, data);
    scores[criterion.key] = {
      score: value,
      max: 100,
      weighted: value * criterion.weight / 100,
    };
    totalScore += value * criterion.weight / 100;
    totalWeight += criterion.weight;
  }

  const weightedAvg = totalWeight > 0 ? Math.round(totalScore / totalWeight * 100) : 0;

  return {
    criteria: scores,
    overall: weightedAvg,
    grade: classificar(weightedAvg),
    integrityState: data.integrityState || null,
    coverageState: data.coverageState || null,
    generatedAt: new Date().toISOString(),
  };
}

function avalieCriterio(key, data) {
  switch (key) {
    case 'coherence': {
      const issues = data.argumentationIssues || [];
      const critical = issues.filter(i => i.severity === 'high').length;
      return Math.max(0, 95 - critical * 25);
    }
    case 'argumentation': {
      const structure = data.argumentationStructure || [];
      if (!structure.length) return 0;
      const vParagrafos = s => (s.sections || []).flatMap(sec => sec.paragraphs || []);
      const pCits = structure.flatMap(s => vParagrafos(s).filter(p => p.hasCitation)).length;
      const total = structure.flatMap(s => vParagrafos(s)).length;
      const citRate = total > 0 ? pCits / total : 0;
      return Math.round(citRate * 90 + 10);
    }
    case 'integrity': {
      const integ = data.integrityReport;
      if (!integ || integ.total === 0) return 50;
      const blockedPenalty = integ.blocked * 25;
      const reviewPenalty = integ.reviewRequired * 15;
      const alertPenalty = integ.alerts * 5;
      return Math.max(0, 100 - blockedPenalty - reviewPenalty - alertPenalty);
    }
    case 'citations': {
      const refs = data.references || [];
      if (!refs.length) return 10;
      const validas = refs.filter(r => r.confidence !== 'unverified' && r.confidence !== 'needs_review').length;
      return Math.round(validas / refs.length * 90 + 10);
    }
    case 'coverage': {
      const cov = data.coverageAnalysis;
      if (!cov) return 50;
      if (cov.totalObjectives === 0) return 30;
      const orfaosPenalty = (cov.orfaos?.length || 0) * 20;
      const naoRespPenalty = (cov.naoRespondidos?.length || 0) * 15;
      const capsOrfaosPenalty = (cov.orfaosCapitulos?.length || 0) * 10;
      return Math.max(0, 95 - orfaosPenalty - naoRespPenalty - capsOrfaosPenalty);
    }
    case 'methodology':
      return data.methodologyScore || 70;
    case 'literacy':
      return data.literacyScore || 75;
    case 'formatting':
      return data.formattingScore || 80;
    default:
      return 50;
  }
}

function classificar(score) {
  if (score >= 90) return { label: 'Excelente', grade: 'A' };
  if (score >= 80) return { label: 'Muito Bom', grade: 'B' };
  if (score >= 65) return { label: 'Bom', grade: 'C' };
  if (score >= 50) return { label: 'Satisfatório', grade: 'D' };
  return { label: 'Insuficiente', grade: 'F' };
}

export function simularProfessor(doc) {
  const data = doc._scoreData || {};
  const scorecard = gerarScorecard(data);

  const recomendacoes = [];

  if (data.coverageState === 'incompleto' || data.coverageState === 'objectivos_orfaos') {
    recomendacoes.push('Existem objectivos específicos sem capítulo correspondente.');
  }
  if (data.coverageState === 'conclusao_incompleta' || data.coverageState === 'incompleto') {
    recomendacoes.push('A conclusão não responde a todos os objectivos definidos.');
  }
  if (data.integrityState === 'review_required' || data.integrityState === 'blocked') {
    recomendacoes.push('Existem afirmações não verificadas que requerem revisão antes da entrega.');
  }
  if (scorecard.criteria?.integrity?.score < 60) {
    recomendacoes.push('Melhorar a qualidade e verificação das fontes e evidências.');
  }
  if (recomendacoes.length === 0) {
    recomendacoes.push('Reforçar a ligação entre objectivos e conclusão.');
    recomendacoes.push('Aumentar a diversidade de fontes.');
    recomendacoes.push('Melhorar a clareza na formulação do problema.');
  }

  return {
    comentarioGeral: `Documento sobre "${doc.metadata?.topic || 'tema definido'}" — score ${scorecard.overall}/100 (${scorecard.grade.label}).`,
    recomendacoes: recomendacoes.slice(0, 5),
    nota: scorecard.grade,
    overall: scorecard.overall,
    integrityState: data.integrityState || null,
    coverageState: data.coverageState || null,
  };
}
