import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const DEMO_LABEL = 'DEMO · SAMPLE ONLY · NOT VERIFIED';
const records = [
  {id:'demo-brc-tea',name:'Sample Tea & Snacks Stall',category:'beverages',station_key:'BRC',station_name:'Vadodara Junction',platform_label:'Sample Platform 1',description:'DEMO DATA ONLY — illustrative sample, not a verified business.',coach_location:'Sample: S1-side area (not verified)',directions:'Sample directions only; verify on site.',emoji:'☕',stall_status:'open',menu:[{id:'brc-tea-1',name:'Tea',price:15,stock_status:'IN_STOCK'},{id:'brc-tea-2',name:'Coffee',price:25,stock_status:'IN_STOCK'},{id:'brc-tea-3',name:'Biscuits',price:10,stock_status:'OUT_OF_STOCK'}]},
  {id:'demo-brc-meals',name:'Sample Meals Corner',category:'food',station_key:'BRC',station_name:'Vadodara Junction',platform_label:'Sample Platform 2',description:'DEMO DATA ONLY — menu and prices are fictional examples.',coach_location:'Sample: B1-side area (not verified)',directions:'Sample directions only; verify on site.',emoji:'🍱',stall_status:'open',menu:[{id:'brc-meal-1',name:'Idli plate',price:40,stock_status:'IN_STOCK'},{id:'brc-meal-2',name:'Veg meal',price:90,stock_status:'OUT_OF_STOCK'}]},
  {id:'demo-brc-essentials',name:'Sample Essentials Kiosk',category:'groceries',station_key:'BRC',station_name:'Vadodara Junction',platform_label:'Sample Platform 3',description:'DEMO DATA ONLY — not a real or verified stall listing.',coach_location:'Sample: A1-side area (not verified)',directions:'Sample directions only; verify on site.',emoji:'🧃',stall_status:'unavailable',menu:[{id:'brc-ess-1',name:'Water bottle',price:20,stock_status:'IN_STOCK'},{id:'brc-ess-2',name:'Tissues',price:15,stock_status:'IN_STOCK'}]},
  {id:'demo-brc-coffee',name:'Sample Coffee Counter',category:'beverages',station_key:'BRC',station_name:'Vadodara Junction',platform_label:'Sample Platform 4',description:'DEMO DATA ONLY — fictional sample for interface testing.',coach_location:'Sample: general coach-side area (not verified)',directions:'Sample directions only; verify on site.',emoji:'☕',stall_status:'closed',menu:[{id:'brc-coffee-1',name:'Filter coffee',price:30,stock_status:'IN_STOCK'},{id:'brc-coffee-2',name:'Hot chocolate',price:45,stock_status:'OUT_OF_STOCK'}]},
  {id:'demo-brc-idli',name:'Sample South Indian Bites',category:'snacks',station_key:'BRC',station_name:'Vadodara Junction',platform_label:'Sample Platform 5',description:'DEMO DATA ONLY — illustrative items and prices, not verified.',coach_location:'Sample: S2-side area (not verified)',directions:'Sample directions only; verify on site.',emoji:'🥪',stall_status:'open',menu:[{id:'brc-idli-1',name:'Idli (2 pcs)',price:35,stock_status:'IN_STOCK'},{id:'brc-idli-2',name:'Vada',price:20,stock_status:'OUT_OF_STOCK'}]},
  {id:'demo-brc-juice',name:'Sample Juice & Snacks',category:'snacks',station_key:'BRC',station_name:'Vadodara Junction',platform_label:'Sample Platform 6',description:'DEMO DATA ONLY — this listing is not a verified vendor.',coach_location:'Sample: B2-side area (not verified)',directions:'Sample directions only; verify on site.',emoji:'🥤',stall_status:'unavailable',menu:[{id:'brc-juice-1',name:'Lemon juice',price:25,stock_status:'IN_STOCK'},{id:'brc-juice-2',name:'Fruit cup',price:50,stock_status:'OUT_OF_STOCK'}]}
];

export default async function(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Use POST to intentionally seed the demo dataset.'});
  try{
    let createdOrUpdated=0;
    for(const s of records){
      const result=await db.query(
        `INSERT INTO passenger_stalls
          (id,name,category,station_key,station_name,platform_label,description,demo_label,menu_json,emoji,is_active,
           owner_user_id,vendor_name,vendor_contact,coach_location,directions,stall_status,publication_status,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,TRUE,NULL,'','',$11,$12,$13,'published',NOW())
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,station_key=EXCLUDED.station_key,
           station_name=EXCLUDED.station_name,platform_label=EXCLUDED.platform_label,description=EXCLUDED.description,
           demo_label=EXCLUDED.demo_label,menu_json=EXCLUDED.menu_json,emoji=EXCLUDED.emoji,is_active=TRUE,
           coach_location=EXCLUDED.coach_location,directions=EXCLUDED.directions,stall_status=EXCLUDED.stall_status,
           publication_status='published',updated_at=NOW()
         WHERE passenger_stalls.owner_user_id IS NULL AND COALESCE(passenger_stalls.demo_label,'')<> ''
         RETURNING id`,
        [s.id,s.name,s.category,s.station_key,s.station_name,s.platform_label,s.description,DEMO_LABEL,
         JSON.stringify(s.menu),s.emoji,s.coach_location,s.directions,s.stall_status]
      );
      createdOrUpdated+=result.rows.length;
    }
    const count=await db.query("SELECT COUNT(*)::int AS count FROM passenger_stalls WHERE station_key='BRC' AND owner_user_id IS NULL AND demo_label=$1",[DEMO_LABEL]);
    return res.json({ok:true,operation:'intentional_demo_seed',station:'Vadodara Junction (BRC)',expected:records.length,createdOrUpdated,stationDemoCount:count.rows[0]?.count||0,note:'Only this explicit admin endpoint restores deleted seed rows. Page loads never run the seed.'});
  }catch(error){
    console.error('Demo stall seed failed',String(error?.message||error).slice(0,180));
    return res.status(500).json({ok:false,error:'Demo stalls could not be seeded.'});
  }
}