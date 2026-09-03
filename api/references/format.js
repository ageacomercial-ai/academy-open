/* POST /api/references/format — secção 27 */
import { formatAPA, formatABNT } from '../../references-engine/services/reference-formatter.service.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS') return res.status(204).end();
  const { references=[], style='APA' } = req.body||{};
  const formatted=references.map(r=> style==='ABNT'? formatABNT(r): formatAPA(r));
  return res.json({ok:true, formatted});
}
