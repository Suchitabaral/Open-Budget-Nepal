const fs=require('node:fs');
function log(file,event,data={}){fs.appendFileSync(file,`${JSON.stringify({timestamp:new Date().toISOString(),event,...data})}\n`)}
module.exports={log};
