const t=async(i)=>{
  const ini=Date.now();
  const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),200000);
  try{
    const r=await fetch('https://academy-open.vercel.app/api/engine',{method:'POST',headers:{'Content-Type':'application/json'},signal:ctl.signal,body:JSON.stringify({action:'gerar_capitulo',payload:{tema:'Impacto das TIC no rendimento académico em Angola',tipoTrabalho:'Outro Trabalho',nivel:'Licenciatura',totalPags:15,capNum:1,capTitulo:'Introdução',capSubs:['Contextualização do Tema','Justificativa da Pesquisa','Objetivos da Investigação'],totalCaps:5,palavrasPorCap:600,paginasAlvo:15,instrucaoSubtitulos:'',memoriaDocumento:''}})});
    const txt=await r.text();
    const j=tryParse(txt);
    const ast=j?.data?.ast||j?.data?.resposta;
    const paras=ast?.sections?.reduce((a,s)=>a+(s.paragraphs||[]).length,0);
    console.log('#'+i, r.status, ((Date.now()-ini)/1000).toFixed(1)+'s', '| model:', j?.meta?.model||'-', '| sections:', ast?.sections?.length||0, '| paras:', paras||0);
  }catch(e){ console.log('#'+i,'ERRO:',e.message); }
  finally{ clearTimeout(to); }
};
const tryParse=s=>{ try{ return JSON.parse(s); }catch{ return null; } };
(async()=>{ for(let i=1;i<=3;i++) await t(i); })();
