import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const DEMO_LABEL = 'DEMO · SAMPLE ONLY · NOT VERIFIED';
const KNOWN_STATIONS = [
  {key:'BRC',name:'Vadodara Junction'},
  {key:'SBC',name:'KSR Bengaluru City Junction'},
  {key:'MYS',name:'Mysuru Junction'},
  {key:'MAS',name:'Chennai Central'},
  {key:'NDLS',name:'New Delhi Railway Station'}
];
const TEMPLATES = [
  {slug:'tea-snacks',name:'Sample Tea & Snacks Stall',category:'beverages',emoji:'☕',status:'open',menu:[['Tea',15,'IN_STOCK'],['Coffee',25,'IN_STOCK'],['Biscuits',10,'OUT_OF_STOCK']]},
  {slug:'meals-corner',name:'Sample Meals Corner',category:'food',emoji:'🍱',status:'open',menu:[['Idli plate',40,'IN_STOCK'],['Veg meal',90,'OUT_OF_STOCK']]},
  {slug:'essentials',name:'Sample Essentials Kiosk',category:'groceries',emoji:'🧃',status:'unavailable',menu:[['Water bottle',20,'IN_STOCK'],['Tissues',15,'IN_STOCK']]},
  {slug:'coffee-counter',name:'Sample Coffee Counter',category:'beverages',emoji:'☕',status:'closed',menu:[['Filter coffee',30,'IN_STOCK'],['Hot chocolate',45,'OUT_OF_STOCK']]},
  {slug:'south-indian-bites',name:'Sample South Indian Bites',category:'snacks',emoji:'🥪',status:'open',menu:[['Idli (2 pcs)',35,'IN_STOCK'],['Vada',20,'OUT_OF_STOCK']]}
];
function clean(v,max=160){return String(v??'').trim().replace(/[<>]/g,'').slice(0,max)}
function slug(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24)||'UNKNOWN'}
async function seedOne(station){
  const key=slug(station.key), name=clean(station.name,160), ids=[];
  for(let i=0;i<TEMPLATES.length;i++){
    const t=TEMPLATES[i], id='demo-'+key.toLowerCase()+'-'+t.slug; ids.push(id);
    const menu=t.menu.map((m,j)=>({id:key.toLowerCase()+'-'+t.slug+'-'+(j+1),name:m[0],price:m[1],stock_status:m[2]}));
    await db.query(
      `INSERT INTO passenger_stalls
       (id,name,category,station_key,station_name,platform_label,description,demo_label,menu_json,emoji,is_active,
        owner_user_id,vendor_name,vendor_contact,coach_location,location_description,coach_area_label,coach_area_verified,
        directions,latitude,longitude,stall_status,publication_status,updated_at)
       VALUES($1,$2,$3,$4,$5,NULL,$6,$7,$8::jsonb,$9,TRUE,NULL,'','','',$10,'',FALSE,$11,NULL,NULL,$12,'published',NOW())
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,station_key=EXCLUDED.station_key,
        station_name=EXCLUDED.station_name,platform_label=NULL,description=EXCLUDED.description,
        demo_label=EXCLUDED.demo_label,menu_json=EXCLUDED.menu_json,emoji=EXCLUDED.emoji,is_active=TRUE,
        coach_location='',location_description=EXCLUDED.location_description,coach_area_label='',coach_area_verified=FALSE,
        directions=EXCLUDED.directions,latitude=NULL,longitude=NULL,stall_status=EXCLUDED.stall_status,
        publication_status='published',updated_at=NOW()
       WHERE passenger_stalls.owner_user_id IS NULL AND COALESCE(passenger_stalls.demo_label,'') <> ''
       RETURNING id`,
      [id,t.name,t.category,key,name,
       'DEMO DATA ONLY — fictional sample, not a real or verified business.',DEMO_LABEL,
       JSON.stringify(menu),t.emoji,'Demo sample only; exact stall location and coach-side area are not verified.',
       'Demo location only; exact stall position is not verified.',t.status]
    );
  }
  const deleted=await db.query(
    "DELETE FROM passenger_stalls WHERE station_key=$1 AND owner_user_id IS NULL AND COALESCE(demo_label,'')<>'' AND NOT (id = ANY($2::text[])) RETURNING id",
    [key,ids]
  );
  await db.query(
    'INSERT INTO demo_station_seed_registry(station_key,station_name,enabled) VALUES($1,$2,TRUE) ON CONFLICT(station_key) DO UPDATE SET station_name=EXCLUDED.station_name,enabled=TRUE,seeded_at=NOW()',
    [key,name]
  );
  const count=await db.query("SELECT COUNT(*)::int AS count FROM passenger_stalls WHERE station_key=$1 AND owner_user_id IS NULL AND demo_label=$2",[key,DEMO_LABEL]);
  return {stationCode:key,stationName:name,expected:5,actual:Number(count.rows[0]?.count||0),deletedExtras:deleted.rows.length};
}
export default async function(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Use POST to intentionally seed demo stalls.'});
  try{
    const code=clean(req.body?.stationCode,32).toUpperCase();
    const name=clean(req.body?.stationName,160);
    const stations=code||name?[{key:code||slug(name),name:name||code}]:KNOWN_STATIONS;
    const results=[];
    for(const station of stations)results.push(await seedOne(station));
    return res.json({
      ok:true,operation:'intentional_demo_seed',stationCount:results.length,stations:results,
      expectedTotal:results.length*5,
      note:'New stations receive five samples on first passenger stall lookup. A seed registry prevents refresh from recreating deleted samples. Only this explicit admin operation restores deleted demo rows.'
    });
  }catch(error){
    console.error('Demo stall seed failed',String(error?.message||error).slice(0,180));
    return res.status(500).json({ok:false,error:'Demo stalls could not be seeded.'});
  }
}