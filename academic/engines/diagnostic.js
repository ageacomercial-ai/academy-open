/* academic/engines/diagnostic.js
   Etapa 1: Análise de input → Diagnóstico Académico
   Extrai tema, problema, questão, objectivos, metodologia, contexto
============================================================================= */

import { detectarNivel, detectarArea, detectarContextoGeo, PERFIL_NIVEL, PERFIL_AREA } from '../prompts/system.js';
import { createDiagnosticSchema, createClaim, CLAIM_TYPES, CONFIDENCE_LEVELS } from '../schemas/index.js';

export function analisarInput(input) {
  const {
    tema, tipo, nivel, inst, prof, area,
    pais, totalPags, totalCaps, idioma,
  } = input;

  const nivelKey = detectarNivel(nivel);
  const areaKey  = detectarArea(tema, area);
  const pNivel   = PERFIL_NIVEL[nivelKey];
  const pArea    = PERFIL_AREA[areaKey];
  const geoCtx   = detectarContextoGeo(tema, pais);

  return {
    nivelKey,
    areaKey,
    pNivel,
    pArea,
    geoCtx,
  };
}

export function gerarDiagnostico(input) {
  const analise = analisarInput(input);

  const diagnostico = createDiagnosticSchema({
    title:    input.tema,
    topic:    input.tema,
    context:  input.contexto || `Trabalho de ${input.tipo} sobre ${input.tema}.`,
    researchProblem: '',
    researchQuestion: '',
    generalObjective: '',
    specificObjectives: [],
    methodology: {
      approach: '',
      type: '',
      methods: [],
      limitations: [],
    },
    scope: {
      geographic: '',
      temporal: '',
      thematic: input.area || input.tema,
    },
  });

  diagnostico._analise = analise;

  return diagnostico;
}
