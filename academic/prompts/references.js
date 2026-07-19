/* academic/prompts/references.js
   Geração e validação de referências bibliográficas
============================================================================= */

import { detectarNivel, detectarArea, detectarContextoGeo, PERFIL_NIVEL, PERFIL_AREA } from './system.js';

/* ── Montar prompt de referências ── */
export function montarPromptReferencias({
  tema, tipo, nivel, area, pais, totalPags, refStyle = 'APA',
}) {
  const areaKey  = detectarArea(tema, area);
  const pNivel   = PERFIL_NIVEL[detectarNivel(nivel)];
  const pArea    = PERFIL_AREA[areaKey];
  const geoCtxR  = detectarContextoGeo(tema, pais);
  const numRefs  = Math.min(18, Math.max(10, Math.round(totalPags * 0.6)));

  const geoRefsInstrucao = geoCtxR === 'angola'
    ? `O tema é sobre Angola. Inclui fontes relevantes combinadas com literatura internacional.`
    : `As referências devem ser de revistas académicas internacionais. Evita fontes específicas de qualquer país a menos que o tema o exija.`;

  return {
    numRefs,
    MIN_VALIDAS: Math.max(6, Math.round(numRefs * 0.6)),
    promptPadrao: (reforcar) => `És um bibliotecário académico especialista em ${pArea.label}, a preparar a lista de referências bibliográficas de um ${tipo} de nível ${nivel} sobre "${tema}".

TAREFA: gera exactamente ${numRefs} referências bibliográficas reais e plausíveis, em formato ${refStyle}.

${geoRefsInstrucao}
${pNivel.citacoes}

FORMATO OBRIGATÓRIO — uma referência por bloco, cada bloco separado por LINHA EM BRANCO:
Apelido, I. (Ano). Título da obra. Editora ou Revista, volume(número), páginas.

REGRAS RÍGIDAS:
- CADA entrada TEM de conter o padrão "(Ano)." logo a seguir ao(s) autor(es)
- Ano entre 1950 e ${new Date().getFullYear()}
- NUNCA repitas o mesmo autor+título
- Mistura livros, artigos de revista e fontes institucionais se fizer sentido
- Sem bullets, sem numeração, sem markdown — só texto
- Português formal, normas ${refStyle}
${reforcar ? '\nATENÇÃO: a tentativa anterior teve referências inválidas. Confirma que TODAS têm autor, ano entre parêntesis, título e editora.' : ''}

Escreve as ${numRefs} referências agora.`,
  };
}

/* ── Peneira de referências (validação de formato) ── */
export function peneirarReferencias(texto) {
  if (!texto || typeof texto !== 'string') return { texto: '', validas: [], invalidas: 0 };
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const validas = [];
  let invalidas = 0;
  const padraoRef = /^[\wçãáàâéêíóôúõüñÇÃÁÀÂÉÊÍÓÔÚÕÜÑ'.`,\-\s]{3,120}\s*\((\d{4})\)\.\s*.{10,}/;
  for (const linha of linhas) {
    if (padraoRef.test(linha)) validas.push(linha);
    else invalidas++;
  }
  return {
    texto: validas.join('\n\n'),
    validas,
    invalidas,
  };
}
