import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET','PUT','DELETE'];

function clean(v,max=500){return String(v??'').trim().replace(/[<>]/g,'').slice(0,max)}
function menu(v){
  if(!Array.isArray(v)||v.length>100)throw new Error('Menu must be an array of up to 100 items.');
  return v.map((i,n)=>{const name=clean(i?.name,100),price=Number(i?.price),stock=String(i?.stock_status||i?.stockStatus||'').toUpperCase();if(!name||i?.price===''||i?.price==null||!Number.isFinite(price)||price<0||price>1000000||!['IN_STOCK','OUT_OF_STOCK'].includes(stock))throw new Error('Each menu item needs a name, valid non-negative price and stock status.');return{id:clean(i.id,80)||crypto.randomUUID(),name,price,stock_status:stock}})}
export default async function(req,res){
 try{
  if(req.method==='GET'){
   const r=await db.query("SELECT id,name,category,station_key,station_name,platform_label,description,demo_label,menu_json,emoji,is_active,coach_location,location_description,coach_area_label,coach_area_verified,directions,latitude,longitude,stall_status,publication_status,updated_at FROM passenger_stalls WHERE owner_user_id IS NULL AND COALESCE(demo_label,'')<>'' ORDER BY station_name,name LIMIT 500");
   return res.json({ok:true,stalls:r.rows});
  }
  const id=clean(req.body?.id,100);if(!id)return res.status(400).json({ok:false,error:'Demo stall ID is required.'});
  const found=await db.query("SELECT id FROM passenger_stalls WHERE id=$1 AND owner_user_id IS NULL AND COALESCE(demo_label,'')<>'' LIMIT 1",[id]);
  if(!found.rows[0])return res.status(404).json({ok:false,error:'Demo stall not found.'});
  if(req.method==='DELETE'){
   await db.query("DELETE FROM passenger_stalls WHERE id=$1 AND owner_user_id IS NULL AND COALESCE(demo_label,'')<>''",[id]);
   return res.json({ok:true,deleted:true,note:'This seed row will not return on page load; only the explicit admin seed operation can restore it.'});
  }
  const b=req.body||{},name=clean(b.name,120),category=clean(b.category,80),stationName=clean(b.stationName,160),stationCode=clean(b.stationCode,20).toUpperCase();
  const status=String(b.stallStatus||'unavailable').toLowerCase(),pub=String(b.publicationStatus||'published').toLowerCase();
  if(name.length<2||!category||!stationName||!stationCode)return res.status(400).json({ok:false,error:'Name, category, station and station code are required.'});
  if(!['open','closed','unavailable'].includes(status)||!['draft','published'].includes(pub))return res.status(400).json({ok:false,error:'Invalid stall or publication status.'});
  const items=menu(b.menuItems||[]);
  const r=await db.query(`UPDATE passenger_stalls SET name=$2,category=$3,station_name=$4,station_key=$5,platform_label=NULL,
    description=$6,coach_location='',location_description=$7,coach_area_label='',coach_area_verified=FALSE,
    directions=$8,latitude=NULL,longitude=NULL,stall_status=$9,publication_status=$10,menu_json=$11::jsonb,
    updated_at=NOW() WHERE id=$1 AND owner_user_id IS NULL AND COALESCE(demo_label,'')<>'' RETURNING id,name,station_key,station_name`,
   [id,name,category,stationName,stationCode,clean(b.description,500),clean(b.locationDescription,500),clean(b.directions,500),status,pub,JSON.stringify(items)]);
  return res.json({ok:true,stall:r.rows[0]});
 }catch(error){
  if(error instanceof Error && /Menu|Each menu|array/.test(error.message))return res.status(400).json({ok:false,error:clean(error.message,240)});
  console.error('Admin demo stall operation failed',String(error?.message||error).slice(0,180));
  return res.status(500).json({ok:false,error:'Demo stall operation failed.'});
 }
}