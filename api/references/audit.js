/* POST /api/references/audit — secção 23 */
import { audit } from '../../references-engine/services/reference-audit.service.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS') return res.status(204).end();
  const { references=[], citations=[], usages=[] } = req.body||{};
  const report=audit(references,citations,usages);
  return res.json({ok:true, report});
}
