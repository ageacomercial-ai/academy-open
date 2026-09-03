const t=async()=>{
  const r=await fetch('https://academy-open.vercel.app/api/engine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'gerar_capitulo',payload:{tema:'Impacto das TIC no rendimento académico em Angola',tipoTrabalho:'Outro Trabalho',nivel:'Licenciatura',totalPags:15,capNum:1,capTitulo:'Introdução',capSubs:['Contextualização do Tema','Justificativa da Pesquisa','Objetivos da Investigação'],totalCaps:5,palavrasPorCap:600,paginasAlvo:15,instrucaoSubtitulos:'',memoriaDocumento:''}})});
  const txt=await r.text();
  console.log('status:',r.status);
  console.log(txt.substring(0,500));
};
t().catch(e=>console.log('ERRO:',e.message));
