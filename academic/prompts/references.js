/* academic/prompts/references.js
   Geração e validação de referências bibliográficas
 ============================================================================= */

import { detectarNivel, detectarArea, detectarContextoGeo, PERFIL_NIVEL, PERFIL_AREA } from './system.js';
import { isStrict } from '../policies/integrity.js';

/* ── Montar prompt de referências ── */
export function montarPromptReferencias({
  tema, tipo, nivel, area, pais, totalPags, refStyle = 'APA', autoresCitados = [],
}) {
  const areaKey  = detectarArea(tema, area);
  const pNivel   = PERFIL_NIVEL[detectarNivel(nivel)];
  const pArea    = PERFIL_AREA[areaKey];
  const geoCtxR  = detectarContextoGeo(tema, pais);
  const numRefs  = Math.min(18, Math.max(10, Math.round(totalPags * 0.6)));

  const geoRefsInstrucao = geoCtxR === 'angola'
    ? `O tema é sobre Angola. Inclui fontes relevantes combinadas com literatura internacional.`
    : `As referências devem ser de revistas académicas internacionais. Evita fontes específicas de qualquer país a menos que o tema o exija.`;

  /* Instrução crítica: garantir correspondência citações ↔ referências */
  const instrucaoAutoresCitados = autoresCitados.length > 0
    ? `\n🔴 OBRIGATÓRIO — LISTA DE AUTORES CITADOS NO TEXTO (DEVEM APARECER NA BIBLIOGRAFIA):\n${autoresCitados.map(a => `   - ${a.autor} (${a.ano})`).join('\n')}

   TODOS estes autores DEVEM aparecer nas referências geradas. Se um autor está citado no texto, a respetiva referência TEM de estar na lista. Isto é uma regra acadêmica não negociável.`
    : '';

  const strictRef = isStrict() ? `\nMODO STRICT: Nunca invente DOI, URL, autores ou títulos. Se não conseguir verificar uma referência, não a apresente como real. Não crie DOI/URL. Não atribua estatística sem fonte. Preferir lista menor verificável a lista cheia fictícia.` : '';
  return {
    numRefs,
    MIN_VALIDAS: Math.max(6, Math.round(numRefs * 0.6)),
    promptPadrao: (reforcar) => `És um bibliotecário académico especialista em ${pArea.label}, a preparar a lista de referências bibliográficas de um ${tipo} de nível ${nivel} sobre "${tema}".
${strictRef}
TAREFA: gera exactamente ${numRefs} referências bibliográficas ${isStrict() ? 'verificáveis (apenas fontes que existem)' : 'reais e plausíveis'}, em formato ${refStyle}.

${geoRefsInstrucao}${instrucaoAutoresCitados}
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

ESCREVE AS ${numRefs} REFERÊNCIAS AGORA.`,
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
