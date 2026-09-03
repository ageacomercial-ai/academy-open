/* EBOOK — Content QA */
export function contentQA(ebook) {
  const issues = [];
  const chapters = ebook.chapters || ebook.outline?.chapters || [];
  if (!ebook.title || ebook.title.trim().length < 3) issues.push({ severity:'error', code:'NO_TITLE', message:'Título ausente' });
  if (!chapters.length) issues.push({ severity:'error', code:'NO_CHAPTERS', message:'Nenhum capítulo' });
  chapters.forEach((c, i) => {
    const blocks = c.blocks || c.sections || [];
    const text = blocks.map(b=> (b.paragraphs||[b.content]||[]).join(' ')).join(' ');
    if (!text || text.trim().length < 80) issues.push({ severity:'error', code:'EMPTY_CHAPTER', message:`Cap ${i+1} vazio`, chapter:i });
    if (text && text.split(/\s+/).length < 40) issues.push({ severity:'warning', code:'SHORT_CHAPTER', message:`Cap ${i+1} muito curto` });
  });
  // repetição títulos
  const titles = chapters.map(c=> c.title?.toLowerCase().trim());
  const dup = titles.filter((t,i)=> titles.indexOf(t)!==i);
  if (dup.length) issues.push({ severity:'warning', code:'DUPLICATE_TITLES', message:`Títulos duplicados: ${[...new Set(dup)].join(', ')}` });
  const score = Math.max(0, 100 - issues.filter(i=>i.severity==='error').length*20 - issues.filter(i=>i.severity==='warning').length*5);
  return { score, label: score>=85?'Saudável':score>=60?'Aceitável':'Necessita revisão', issues, ready: issues.filter(i=>i.severity==='error').length===0 };
}
