/* ═══════════════════════════════════════════════════════════
   EBOOK CREATOR — Model Router
   Abstração sobre OpenRouter. Nenhum nome de modelo hardcodado no domínio.
   Cada tarefa pode usar modelo diferente via env OPENROUTER_MODEL_{TASK}
   ═══════════════════════════════════════════════════════════ */

const TASK_DEFAULTS = {
  outline:       process.env.OPENROUTER_MODEL_OUTLINE       || process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
  writing:       process.env.OPENROUTER_MODEL_WRITING       || process.env.OPENROUTER_MODEL_BALANCED || 'openai/gpt-4o-mini',
  rewriting:     process.env.OPENROUTER_MODEL_REWRITING     || process.env.OPENROUTER_MODEL_BALANCED || 'openai/gpt-4o-mini',
  summarization: process.env.OPENROUTER_MODEL_SUMMARIZATION || process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
  review:        process.env.OPENROUTER_MODEL_REVIEW        || process.env.OPENROUTER_MODEL_STRONG   || 'openai/gpt-4o',
  classification:process.env.OPENROUTER_MODEL_CLASSIFICATION|| process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
  planning:      process.env.OPENROUTER_MODEL_PLANNING      || process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
  research:      process.env.OPENROUTER_MODEL_RESEARCH      || process.env.OPENROUTER_MODEL_BALANCED || 'openai/gpt-4o-mini',
  cover:         process.env.OPENROUTER_MODEL_COVER         || process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
  visual:        process.env.OPENROUTER_MODEL_VISUAL        || process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
};

export const TASKS = Object.keys(TASK_DEFAULTS);

/**
 * Retorna modelo para uma tarefa.
 * @param {string} task - uma das TASKS
 * @param {string} [override] - modelo explícito (query param, admin)
 */
export function modelForTask(task, override) {
  if (override && typeof override === 'string' && override.length > 3) return override;
  return TASK_DEFAULTS[task] || TASK_DEFAULTS.writing;
}

/**
 * Tier mapping para compatibilidade com ai-router.js
 */
export function tierForTask(task) {
  const map = {
    outline: 'cheap',
    planning: 'cheap',
    summarization: 'cheap',
    classification: 'cheap',
    cover: 'cheap',
    visual: 'cheap',
    writing: 'balanced',
    rewriting: 'balanced',
    research: 'balanced',
    review: 'strong',
  };
  return map[task] || 'balanced';
}

export function getModelConfig() {
  return { ...TASK_DEFAULTS };
}
