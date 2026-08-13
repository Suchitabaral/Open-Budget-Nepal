const path=require('node:path');
const root=path.resolve(__dirname,'..');
module.exports={root,input:path.join(root,'input','contractors.csv'),responses:path.join(root,'input','responses'),cache:path.join(root,'cache','progress.json'),output:path.join(root,'output'),log:path.join(root,'logs','collector.jsonl')};
