/* EBOOK — Outline Schema */

export function validateOutline(data) {
  if (!data || typeof data !== 'object') return { ok:false, error:'outline deve ser objeto' };
  if (!Array.isArray(data.chapters) || data.chapters.length === 0) return { ok:false, error:'chapters vazio' };
  if (data.chapters.length > 20) return { ok:false, error:'max 20 capitulos' };
  for (let i=0;i<data.chapters.length;i++) {
    const c = data.chapters[i];
    if (!c.title || typeof c.title !== 'string' || c.title.trim().length < 2) return { ok:false, error:`cap ${i+1} title invalido` };
    if (c.subs && !Array.isArray(c.subs)) return { ok:false, error:`cap ${i+1} subs deve ser array` };
  }
  return { ok:true, data: {
    title: (data.title||'').substring(0,300),
    introduction: data.introduction ? String(data.introduction).substring(0,1000) : null,
    chapters: data.chapters.map((c, idx) => ({
      num: c.num || idx+1,
      title: String(c.title).substring(0,200),
      subs: (Array.isArray(c.subs)?c.subs:[]).slice(0,8).map(s=>String(s).substring(0,150)),
      description: (c.description||'').substring(0,500),
    })),
    conclusion: data.conclusion ? String(data.conclusion).substring(0,500) : null,
  }};
}
