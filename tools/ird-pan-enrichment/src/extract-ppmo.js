const fs=require('node:fs');const path=require('node:path');const {readCsv,writeCsv}=require('./csv');const paths=require('./paths');const {log}=require('./log');
const source=process.argv[2]?path.resolve(process.argv[2]):path.resolve(paths.root,'../../shared/data/contractor/contract_details.csv');
if(!fs.existsSync(source)){console.error(`Missing PPMO source: ${source}`);process.exit(1)}
const field=(row,name)=>String(row[`contractRecordsTO.${name}`]||'').trim();
const normalize=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
function unusable(name,pan){const value=normalize(name);if(!value||value===pan||/^\d+$/.test(value)||!/[\p{L}]/u.test(value))return true;const visible=value.replace(/[?"'`\s.]/g,'');return visible.length<3||((value.match(/\?/g)||[]).length/Math.max(value.length,1))>.25}
const byPan=new Map();
for(const row of readCsv(source))for(const index of [1,2,3]){const pan=field(row,`vat_no${index}`);const name=field(row,`contractorName${index}`);if(!/^\d{9}$/.test(pan))continue;const current=byPan.get(pan)||[];current.push(name);byPan.set(pan,current)}
const output=[];for(const [pan,names] of byPan){const usable=names.map(normalize).find(name=>!unusable(name,pan));if(usable)continue;const name=names.map(normalize).find(Boolean)||'';output.push({contractor_name:name,pan})}
output.sort((a,b)=>a.pan.localeCompare(b.pan));writeCsv(paths.input,output,['contractor_name','pan']);log(paths.log,'PPMO_WORKLIST_EXTRACTED',{source,contractors:output.length});console.log(`Created input/contractors.csv with ${output.length} malformed-name contractors and valid known PANs.`);
