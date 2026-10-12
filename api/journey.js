import { db, config } from 'hatchable';
export const access = 'public';
export const methods = ['POST'];

const stationNames = {
  NDLS:'New Delhi', BCT:'Mumbai Central', MAS:'Chennai Central',
  HWH:'Howrah Junction', SBC:'KSR Bengaluru City', UJN:'Ujjain Junction',
  NAD:'Nagda Junction', BPL:'Bhopal Junction', JHS:'Jhansi Junction', AGC:'Agra Cantt',
  NGP:'Nagpur Junction', ET:'Itarsi Junction', KOTA:'Kota Junction', SUR:'Solapur',
  PUNE:'Pune Junction', CSMT:'Chhatrapati Shivaji Maharaj Terminus',
  VSKP:'Visakhapatnam', BZA:'Vijayawada Junction', SC:'Secunderabad Junction',
  GHY:'Guwahati', PNBE:'Patna Junction', LKO:'Lucknow Charbagh', CNB:'Kanpur Central'
};
const cacheMinutes = 3;
const simplify = (value) => String(value || '').replace(/[<>]/g,'').slice(0,120);
function stationCode(item) {
  if (!item) return '';
  const raw = item.stationCode || item.station_code || item.code || item.station?.code || item.station?.stationCode || item.stnCode || '';
  return String(raw).trim().toUpperCase();
}
function stationName(item) {
  if (!item) return '';
  return String(item.stationName || item.station_name || item.name || item.station?.name || stationNames[stationCode(item)] || '').trim();
}
function halt(item) {
  if (!item) return false;
  const text = String(item.stopType || item.stop_type || item.type || item.status || '').toLowerCase();
  if (item.isHalt === false || item.is_halt === false || item.halt === false || item.isStopping === false) return false;
  if (text.includes('pass') || text.includes('non-stop') || text.includes('non stop')) return false;
  return true;
}
function normalizeTrain(data, train, coach, date) {
  const root = data?.data || data?.result || data?.trainStatus || data?.train_status || data;
  const route = root.route || root.stations || root.schedule || root.routeStations || root.trainRoute || root.stationList || [];
  if (!Array.isArray(route) || route.length === 0) throw new Error('RailKit response did not include a route; check the response schema for this train.');
  const currentObj = root.currentLocation || root.current_location || root.currentStation || root.current_station || root.current || root.position || {};
  let currentCode = stationCode(currentObj) || String(root.currentStationCode || root.current_station_code || root.currentStationCode || '').toUpperCase();
  let currentIndex = Number.isInteger(root.currentStationIndex) ? root.currentStationIndex : -1;
  if (currentIndex < 0 && currentCode) currentIndex = route.findIndex(s => stationCode(s) === currentCode);
  const nextObj = root.nextStation || root.next_station || root.nextStop || root.next_stop;
  let nextIndex = -1;
  if (nextObj) nextIndex = route.findIndex(s => (stationCode(s) && stationCode(s) === stationCode(nextObj)) || (stationName(s) && stationName(s) === stationName(nextObj)));
  let current = currentIndex >= 0 ? route[currentIndex] : currentObj;
  let next = nextIndex >= 0 ? route[nextIndex] : (nextObj || null);
  if (!next && currentIndex >= 0) {
    for (let i = currentIndex + 1; i < route.length; i++) {
      if (halt(route[i])) { next = route[i]; nextIndex = i; break; }
    }
  }
  if (!next && currentCode) {
    const pos = route.findIndex(s => stationCode(s) === currentCode);
    if (pos >= 0) for (let i = pos + 1; i < route.length; i++) { if (halt(route[i])) { next=route[i]; nextIndex=i; break; } }
  }
  if (!next) {
    if (root.hasArrived || root.reachedDestination || String(root.status || '').toLowerCase().includes('reached destination')) return {arrived:true,trainNumber:train,coachNumber:coach,serviceDate:date,mode:'live',source:'RailKit',trainName:simplify(root.trainName || root.train_name || root.name || 'Train '+train),message:'Train has arrived at its destination.'};
    throw new Error('Could not determine the next halting station from the RailKit route response.');
  }
  const origin = root.source || root.origin || root.from || route[0] || {};
  const destination = root.destination || root.dest || root.to || route[route.length-1] || {};
  const delay = Number(root.delayMinutes ?? root.delay_minutes ?? root.delay ?? root.lateBy ?? root.late_by ?? 0);
  const allCodes = route.map(stationCode).filter(Boolean);
  return {
    trainNumber:train, coachNumber:coach, serviceDate:date, mode:'live', source:'RailKit',
    trainName:simplify(root.trainName || root.train_name || root.name || root.train?.name || 'Train '+train),
    sourceStation:simplify(typeof origin === 'string' ? origin : stationName(origin) || stationNames[stationCode(origin)] || stationCode(origin) || 'Source unavailable'),
    destinationStation:simplify(typeof destination === 'string' ? destination : stationName(destination) || stationNames[stationCode(destination)] || stationCode(destination) || 'Destination unavailable'),
    currentStationCode:stationCode(current) || currentCode,
    currentStation:simplify(stationName(current) || stationNames[stationCode(current)] || (currentCode ? stationNames[currentCode] || currentCode : root.currentLocationName || root.current_location_name || 'Between stations')),
    nextStationCode:stationCode(next), nextStation:simplify(stationName(next) || stationNames[stationCode(next)] || stationCode(next) || 'Next station'),
    nextStationIndex:nextIndex,
    delayMinutes:Number.isFinite(delay) ? delay : 0,
    eta:simplify(next.expectedArrival || next.expected_arrival || next.arrivalTime || next.arrival_time || next.eta || ''),
    updatedAt:new Date().toISOString(), routeCodes:allCodes,
    message:'Live status returned by RailKit. Station stop and arrival details can change; follow railway announcements.'
  };
}
export default async function(req,res){
 const body=req.body||{}; const train=String(body.trainNumber||'').trim(); const coach=String(body.coachNumber||'').trim().toUpperCase();
 if(!/^\d{4,5}$/.test(train)) return res.status(400).json({error:'Enter a valid 4–5 digit train number.'});
 if(!/^(?:[1-9]|1\d|2[0-4])$/.test(coach)) return res.status(400).json({error:'Enter a coach number from 1 to 24.'});
 const date=String(body.date || new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})).slice(0,10);
 const apiKey=await config.get('RAILKIT_API_KEY');
 if(!apiKey){
   return res.json({ok:true,journey:{trainNumber:train,coachNumber:coach,serviceDate:date,mode:'demo',verification:'unverified',trainName:'Train '+train,sourceStation:'Source not verified',destinationStation:'Destination not verified',currentStation:'Live location unavailable',currentStationCode:'',nextStation:'Nagda Junction (demo catalogue)',nextStationCode:'NAD',delayMinutes:0,eta:'Unavailable',updatedAt:new Date().toISOString(),source:'Clearly labelled demo fallback',message:'RailKit API key is not configured. Add RAILKIT_API_KEY in Hatchable Setup to enable live tracking.',fallback:true}});
 }
 try {
   const cached=await db.query('SELECT response_json, fetched_at FROM train_lookup_cache WHERE train_number=$1 AND service_date=$2 AND fetched_at > now() - interval \'3 minutes\'',[train,date]);
   if(cached.rows.length){
     const j={...cached.rows[0].response_json,coachNumber:coach,cacheHit:true,updatedAt:cached.rows[0].fetched_at};
     return res.json({ok:true,journey:j});
   }
 } catch(e){ console.error('Train cache read failed',String(e).slice(0,120)); }
 try {
   const url='https://railkit.in/api/trains/'+encodeURIComponent(train)+'/track?date='+encodeURIComponent(date);
   const response=await fetch(url,{headers:{'Authorization':'Bearer '+apiKey,'x-api-key':apiKey,'Accept':'application/json'},timeout_ms:12000});
   if(!response.ok) {
     if(response.status===404) return res.status(404).json({error:'Train not found or not scheduled for the selected date. Verify the train number and date.'});
     if(response.status===401 || response.status===403) return res.status(502).json({error:'RailKit rejected the API key. Check RAILKIT_API_KEY in Hatchable Setup.'});
     return res.status(502).json({error:'Unable to fetch train status. Check the train number or try again shortly.'});
   }
   const upstream=await response.json();
   const journey=normalizeTrain(upstream,train,coach,date);
   try { await db.query('INSERT INTO train_lookup_cache (train_number,service_date,response_json,fetched_at) VALUES ($1,$2,$3::jsonb,now()) ON CONFLICT (train_number) DO UPDATE SET service_date=EXCLUDED.service_date,response_json=EXCLUDED.response_json,fetched_at=now()',[train,date,JSON.stringify(journey)]); } catch(e){console.error('Train cache write failed',String(e).slice(0,120));}
   return res.json({ok:true,journey});
 } catch(e) {
   console.error('RailKit track failed',String(e?.message||e).slice(0,200));
   try { const cached=await db.query('SELECT response_json,fetched_at FROM train_lookup_cache WHERE train_number=$1 ORDER BY fetched_at DESC LIMIT 1',[train]); if(cached.rows.length) return res.json({ok:true,journey:{...cached.rows[0].response_json,coachNumber:coach,cacheHit:true,stale:true,updatedAt:cached.rows[0].fetched_at,message:'RailKit unavailable. Showing the last cached train status; verify with station announcements.'}}); } catch {}
   return res.status(502).json({error:'Unable to fetch train status. Check train number and RailKit connection, then try again.'});
 }
}