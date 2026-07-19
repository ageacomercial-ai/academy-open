/* academic/engines/references.js
   Motor de referências com validação e verificação
============================================================================= */

import { createReference, validarReferencia, marcarConfianca } from '../schemas/reference.schema.js';
import { peneirarReferencias } from '../prompts/references.js';

export const FORMATO_REF = /^(.+?)\((\d{4})\)\.\s*(.+?)(?:\.\s*$|$)/;

export function parseReferencias(textoBruto) {
  const { texto, validas, invalidas } = peneirarReferencias(textoBruto);

  return {
    raw:            textoBruto,
    validas:        validas.map(r => createReference(r)),
    invalidas,
    total:          validas.length + invalidas,
    taxaAprovacao:  validas.length / Math.max(1, validas.length + invalidas),
  };
}

export function validarListaReferencias(lista) {
  const resultados = lista.map(ref => {
    const refEstruturada = createReference(ref.raw || ref);
    const validacao = validarReferencia(refEstruturada);
    return {
      ...validacao,
      estruturada: refEstruturada,
    };
  });

  return {
    resultados,
    total:        resultados.length,
    validas:      resultados.filter(r => r.valida).length,
    invalidas:    resultados.filter(r => !r.valida).length,
    taxaValidade: resultados.filter(r => r.valida).length / Math.max(1, resultados.length),
  };
}
