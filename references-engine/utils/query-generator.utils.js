/* query-generator — 5-15 queries PT/EN secção 5-6 */
export function gerarQueriesTema(tema){
  const base=tema.toLowerCase().replace(/[^a-z0-9áàâãéêíóôõú\s]/g,'').trim();
  const pt=[
    base, `${base} Angola`, `${base} África`, `${base} tecnologia educacional`,
    base.replace('inteligencia artificial','IA'), base.replace('educacao','ensino'),
  ];
  const enMap={
    'inteligencia artificial':'artificial intelligence',
    'educacao':'education',
    'empreendedorismo':'entrepreneurship',
    'digital':'digital',
    'angola':'Angola',
    'africa':'Africa'
  };
  let en=base;
  for(const [ptW,enW] of Object.entries(enMap)) en=en.replace(ptW,enW);
  const enQs=[en, `${en} Africa`, `${en} developing countries`, `digital entrepreneurship Africa`];
  const all=[...pt, ...enQs].map(s=>s.trim()).filter(Boolean);
  // expande semanticamente: remove stopwords e gera variações
  const uniq=[...new Set(all)].slice(0,12);
  return uniq.length>=5? uniq : [...uniq, `${base} revisão`, `${base} estudo`].slice(0,8);
}
export function analisarTema(tema){
  const low=tema.toLowerCase();
  const isAngola=/angola/.test(low);
  const area=/inteligencia artificial|ia/.test(low)? 'Inteligência Artificial' : /empreendedorismo/.test(low)? 'Empreendedorismo':'Geral';
  return { assunto: tema.split(' ').slice(0,3).join(' '), areaSecundaria: area, contextoGeografico: isAngola?'Angola':'Global', palavrasChave: gerarQueriesTema(tema).slice(0,6) };
}
