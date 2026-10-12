import { db } from 'hatchable';
export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
 const b=req.body||{}; const train=String(b.trainNumber||'').trim(); const coach=String(b.coachNumber||'').trim().toUpperCase();
 if(!/^\d{4,5}$/.test(train)) return res.status(400).json({error:'Enter a valid 4–5 digit train number.'});
 if(!/^(S[1-9]\d?|B[1-3]|A[1-2]|HA|CC|EC|D[1-9])$/.test(coach)) return res.status(400).json({error:'Enter a valid coach such as S1, B1, A1 or CC.'});
 return res.json({ok:true,journey:{trainNumber:train,coachNumber:coach,mode:'demo',verification:'unverified',message:'Demo journey started. GPS and live train data have not verified this journey.',currentStation:'Demo Central',nextStation:'Sample Junction',eta:'Unavailable',updatedAt:new Date().toISOString(),source:'Clearly labelled demo data'}});
}