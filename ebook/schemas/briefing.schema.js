/* EBOOK — Briefing Schema (zod-like manual, sem dependência) */

export function validateBriefing(data) {
  const errors = [];
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) errors.push('title: minimo 3 caracteres');
  if (!data.theme || typeof data.theme !== 'string' || data.theme.trim().length < 5) errors.push('theme: minimo 5 caracteres');
  if (data.pages && (data.pages < 5 || data.pages > 300)) errors.push('pages: 5..300');
  if (data.language && !['pt','pt-AO','pt-BR','en','es','fr'].includes(data.language)) errors.push('language invalido');
  if (data.tone && !['formal','casual','inspirador','tecnico','didatico','persuasivo'].includes(data.tone)) errors.push('tone invalido');
  if (errors.length) return { ok: false, error: errors.join('; ') };
  return { ok: true, data: {
    title: data.title.trim().substring(0,200),
    theme: data.theme.trim().substring(0,500),
    description: (data.description||'').substring(0,2000),
    audience: (data.audience||'').substring(0,500),
    objective: (data.objective||'').substring(0,1000),
    language: data.language || 'pt',
    tone: data.tone || 'didatico',
    pages: Math.min(300, Math.max(5, parseInt(data.pages)||30)),
    author: (data.author||'').substring(0,200),
    category: (data.category||'guia').substring(0,50),
    visualStyle: (data.visualStyle||'modern').substring(0,30),
  }};
}
