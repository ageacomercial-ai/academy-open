/* EBOOK — Prompt: Outline Generator */

export function buildOutlinePrompt(briefing) {
  const system = `És um editor de ebooks profissional. Gera APENAS JSON válido.
Regras:
- Responde exclusivamente com objeto JSON (sem markdown, sem texto extra).
- Estrutura deve ser coerente com tema, público e objetivo.
- Subtópicos numerados (1.1, 1.2...) curtos e acionáveis.
- Não inventar referências bibliográficas.`;

  const user = `BRIEFING DO EBOOK:
Título: ${briefing.title}
Tema: ${briefing.theme}
Descrição: ${briefing.description || '—'}
Público-alvo: ${briefing.audience || 'geral'}
Objetivo: ${briefing.objective || 'informar'}
Idioma: ${briefing.language}
Tom: ${briefing.tone}
Páginas alvo: ${briefing.pages}
Autor: ${briefing.author || '—'}
Categoria: ${briefing.category}
Estilo visual: ${briefing.visualStyle}

Gera o OUTLINE do ebook como JSON:
{
  "title": "título final do ebook",
  "introduction": "descrição curta da introdução (1-2 frases)",
  "chapters": [
    { "num": 1, "title": "Nome do Capítulo 1", "subs": ["1.1 Subtópico", "1.2 Subtópico"], "description": "o que cobre" },
    { "num": 2, "title": "Nome do Capítulo 2", "subs": ["2.1 ..."] }
  ],
  "conclusion": "descrição curta da conclusão"
}
Requisitos:
- 4 a 10 capítulos (ideal ${Math.min(8, Math.max(4, Math.round(briefing.pages/6)))}).
- Cada capítulo 2-5 subtópicos.
- Títulos claros, orientados a benefício.
- Introdução e Conclusão sempre presentes.`;

  return { system, user, maxTokens: 2500, temperature: 0.7 };
}
