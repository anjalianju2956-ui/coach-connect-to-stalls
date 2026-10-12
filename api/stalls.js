import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
const names={NDLS:'New Delhi',BCT:'Mumbai Central',MAS:'Chennai Central',HWH:'Howrah Junction',SBC:'KSR Bengaluru City',UJN:'Ujjain Junction',NAD:'Nagda Junction',BPL:'Bhopal Junction',JHS:'Jhansi Junction',AGC:'Agra Cantt',NGP:'Nagpur Junction',ET:'Itarsi Junction',KOTA:'Kota Junction',PUNE:'Pune Junction',CSMT:'Chhatrapati Shivaji Maharaj Terminus'};
const demo=[
{id:'demo-nad-1',name:'Chai Point',category:'Tea & snacks',station_key:'NAD',station:'Nagda Junction',platform:'Platform 2',coachMin:4,coachMax:6,emoji:'☕',status:'DEMO LISTING',description:'Sample tea and snack stall, seeded for the product demo.',menu:[{name:'Masala chai',price:'₹15'},{name:'Samosa',price:'₹20'},{name:'Poha',price:'₹35'}]},
{id:'demo-nad-2',name:'Nagda Fresh Bites',category:'Meals',station_key:'NAD',station:'Nagda Junction',platform:'Platform 1',coachMin:7,coachMax:10,emoji:'🍱',status:'DEMO LISTING',description:'Sample meal counter, not a verified vendor.',menu:[{name:'Veg thali',price:'₹90'},{name:'Idli plate',price:'₹35'},{name:'Water bottle',price:'₹20'}]},
{id:'demo-nad-3',name:'Journey Essentials',category:'Essentials',station_key:'NAD',station:'Nagda Junction',platform:'Platform 2',coachMin:1,coachMax:3,emoji:'🧃',status:'DEMO LISTING',description:'Sample essentials counter, not a verified vendor.',menu:[{name:'Water bottle',price:'₹20'},{name:'Juice',price:'₹35'},{name:'Tissues',price:'₹15'}]},
{id:'demo-nad-4',name:'Central Snack Corner',category:'Snacks',station_key:'NAD',station:'Nagda Junction',platform:'Platform 3',coachMin:12,coachMax:15,emoji:'🥪',status:'DEMO LISTING',description:'Sample snack stall, not a verified vendor.',menu:[{name:'Veg sandwich',price:'₹45'},{name:'Chips',price:'₹20'},{name:'Coffee',price:'₹25'}]}
];
function score(s,coach){const c=Number(coach); if(!Number.isFinite(c))return 3; if(c>=Number(s.coachMin)&&c<=Number(s.coachMax))return 1;if(c>=Number(s.coachMin)-2&&c<=Number(s.coachMax)+2)return 2;return 3;}
function shape(row){let menu=row.menu_json||row.menu||[];if(typeof menu==='string'){try{menu=JSON.parse(menu)}catch{menu=[]}}return {id:row.id,name:row.name,category:row.category,stationCode:row.station_key||row.stationCode,station:row.station||row.station_name||names[row.station_key]||row.station_key,platform:row.platform||row.platform_label||'Platform not specified',platformNo:Number(String(row.platform||row.platform_label||'').match(/\d+/)?.[0]||0),coachMin:Number(row.coach_min??row.coachMin??1),coachMax:Number(row.coach_max??row.coachMax??24),emoji:row.emoji||'🥪',status:row.status||row.demo_label||'DEMO LISTING',description:row.description||'Demo listing; verify on arrival.',menu};}
export default async function(req,res){
 const station=String(req.query.station||'NAD').trim().toUpperCase().slice(0,12); const coach=String(req.query.coach||'').trim();
 try {
  const r=await db.query('SELECT id,name,category,station_key,station_name AS station,platform_label AS platform,description,demo_label AS status,menu_json AS menu,emoji FROM passenger_stalls WHERE UPPER(station_key)=$1 AND is_active=true ORDER BY name LIMIT 50',[station]);
  if(r.rows.length){const stalls=r.rows.map(shape).map(s=>({...s,coachPriority:score(s,coach)})).sort((a,b)=>a.coachPriority-b.coachPriority||a.platformNo-b.platformNo||a.name.localeCompare(b.name));return res.json({source:'database',demo:true,stationCode:station,station:names[station]||r.rows[0].station,stalls});}
 }catch(e){console.error('Stall database query failed',String(e).slice(0,160));}
 const rows=demo.filter(s=>s.station_key===station).map(shape).map(s=>({...s,coachPriority:score(s,coach)})).sort((a,b)=>a.coachPriority-b.coachPriority||a.name.localeCompare(b.name));
 return res.json({source:'demo',demo:true,stationCode:station,station:names[station]||rows[0]?.station||station,stalls:rows});
}