/* EBOOK — Design QA */
export function designQA(ebook) {
  const issues = [];
  // Sem DOM aqui — checks estruturais
  const chapters = ebook.chapters || [];
  chapters.forEach((c,i)=>{
    const blocks = c.blocks || [];
    blocks.forEach(b=>{
      if (b.type==='image' && !b.content?.src) issues.push({ severity:'error', code:'BROKEN_IMAGE', message:`Cap ${i+1} imagem sem src` });
      if (b.content && String(b.content).length > 5000) issues.push({ severity:'warning', code:'OVERFLOW', message:`Cap ${i+1} bloco muito longo` });
    });
  });
  // cover check
  if (ebook.cover && !ebook.cover.title) issues.push({ severity:'warning', code:'COVER_NO_TITLE', message:'Capa sem título' });
  const score = Math.max(0, 100 - issues.filter(i=>i.severity==='error').length*25 - issues.filter(i=>i.severity==='warning').length*5);
  return { score, label: score>=85?'OK':score>=60?'Ajustes leves':'Revisar layout', issues, ready: issues.filter(i=>i.severity==='error').length===0 };
}
