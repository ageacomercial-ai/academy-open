/* EBOOK — Prompt: Chapter Content */

export function buildChapterPrompt({ briefing, chapter, outline, previousChapters = [] }) {
  const system = `És um escritor de ebooks profissional. Gera APENAS JSON válido com este esquema:
{"chapter_id":"1","title":"...","sections":[{"section_id":"1.1","title":"...","paragraphs":["..."]}] }
Regras:
- 3-5 parágrafos por subtópico, 3-5 frases cada, texto corrido, sem markdown, sem bullets.
- Tom: ${briefing.tone || 'didatico'}, idioma: ${briefing.language || 'pt'}.
- Conteúdo prático, útil, sem enrolação. Evita clichês de IA.
- Resposta DEVE ser exclusivamente o objeto JSON.`;

  const memory = previousChapters.length
    ? `Capítulos já escritos (evita repetição):\n${previousChapters.map(c=>`- ${c.title}: ${c.preview||''}`).join('\n')}\n`
    : '';

  const user = `EBOOK: ${briefing.title} — ${briefing.theme}
Categoria: ${briefing.category} | Público: ${briefing.audience || 'geral'} | Objetivo: ${briefing.objective || 'informar'}

CAPÍTULO ${chapter.num}: ${chapter.title}
Subtópicos obrigatórios:
${(chapter.subs||[]).map(s=>`- ${s}`).join('\n')}

${memory}
Gera o conteúdo do capítulo ${chapter.num}. Cada subtópico deve virar uma section.
Palavras alvo: ~${Math.round((briefing.pages*260)/ (outline.chapters.length||5))} palavras.`;

  return { system, user, maxTokens: 8000, temperature: 0.7 };
}
