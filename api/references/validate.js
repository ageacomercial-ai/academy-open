/* POST /api/references/validate — secção 27 */
import { validateBasic, classifyVerification } from '../../references-engine/services/reference-validator.service.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS') return res.status(204).end();
  const { references=[] } = req.body||{};
  const out=references.map(r=>({id:r.id, basic:validateBasic(r), verification:classifyVerification(r)}));
  return res.json({ok:true, validated:out});
}
