/* academic/prompts/evaluation.js
   Prompts para avaliação de coerência e verificação
============================================================================= */

export function montarPromptCoerencia(textoA, textoB) {
  return `Analisa a coerência entre introdução e conclusão de um trabalho académico.
Responde APENAS com JSON:
{"coerente":true/false,"problemas":["..."],"sugestoes":["..."]}
Introdução: ${textoA}
Conclusão: ${textoB}`;
}

export function montarPromptChat(systemPrompt, historico, pedido, tema, tipoTrabalho) {
  const sys = systemPrompt || `Assistente académico ACADEMY. Português formal. Contexto: "${tema||''}" (${tipoTrabalho||''}). Máx 200 palavras.`;
  return { system: sys, maxTokens: 800 };
}
