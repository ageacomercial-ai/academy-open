/* academic/prompts/structure.js
   Plano académico e estrutura de capítulos
============================================================================= */

export function montarPromptPlano(tema, tipoTrabalho, nivel) {
  return `Cria um plano académico para um ${tipoTrabalho||'TFC'} de nível "${nivel||''}" sobre "${tema}".
"objetivos_especificos": 3 a 5 objetivos específicos, cada um começando por um verbo no
infinitivo (Analisar, Identificar, Avaliar, Comparar, Descrever...), concretos e
verificáveis — cada capítulo do trabalho terá de responder a pelo menos um destes.
Responde APENAS com JSON válido, sem markdown:
{"objetivo":"...","objetivos_especificos":["...","...","..."],"hipotese":"...","problema":"...","metodologia":"..."}`;
}

export function montarPromptEstrutura(tema, tipoTrabalho, nivel, totalPags, objetivo) {
  return `Estrutura capítulos para um ${tipoTrabalho||'TFC'} de nível "${nivel||''}" sobre "${tema}". ${totalPags} páginas.
${objetivo ? 'Objectivo: '+objetivo : ''}
Responde APENAS com array JSON, sem markdown:
[{"num":1,"titulo":"...","subs":["Subtópico 1.1","Subtópico 1.2","Subtópico 1.3"]},...]
Regras: 3-6 capítulos, 2-4 subtópicos cada, último capítulo "Referências Bibliográficas" sem subs.`;
}
