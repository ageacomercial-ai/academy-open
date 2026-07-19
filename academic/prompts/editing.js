/* academic/prompts/editing.js
   Prompts para edição de texto (melhorar, expandir, resumir, edição completa)
============================================================================= */

export const INSTRUCOES_EDICAO = {
  melhorar:   'Melhora o estilo académico mantendo o conteúdo. Português formal académico.',
  expandir:   'Expande com mais detalhe académico (+30%). Português formal académico.',
  resumir:    'Resume mantendo as ideias principais (-40%). Português formal académico.',
  formalizar: 'Formaliza a linguagem para nível universitário.',
};

export function montarPromptEdicaoSimples(subacao, texto) {
  const instrucao = INSTRUCOES_EDICAO[subacao] || INSTRUCOES_EDICAO.melhorar;
  return `${instrucao}\n\nTexto:\n${texto}\n\nDevolve apenas o texto editado.`;
}

export function montarPromptEdicaoDocumento(pedido, texto) {
  return [
    `És um orientador académico. O documento abaixo mostra blocos de conteúdo.`,
    `\n\nPedido do utilizador: "${(pedido||'').substring(0,500)}"`,
    `\n\nDocumento actual (blocos separados por ---):`,
    `\n${texto}`,
    `\n\nResponde APENAS com JSON no formato:`,
    `{"operacoes":[`,
    `  {"accao":"editar","chapterIdx":0,"blockId":"...","conteudo":"novo texto"},`,
    `  {"accao":"inserir","chapterIdx":0,"afterBlockId":"...","conteudo":"novo parágrafo","type":"paragraph"},`,
    `  {"accao":"remover","chapterIdx":0,"blockId":"..."}`,
    `]}`,
    `\nRegras:`,
    `- Mantém tom académico formal português`,
    `- Preserva conteúdo não mencionado no pedido`,
    `- Usa os mesmos blockId existentes para editar`,
    `- Para inserir, usa afterBlockId do bloco anterior (ou null para fim)`,
    `- Remove apenas se o pedido explicitamente pedir`,
    `- Devolve array vazio se não houver alterações: {"operacoes":[]}`,
    `- APENAS JSON, sem markdown, sem explicações`,
  ].join('\n');
}
