#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
http.createServer(async (req,res)=>{
 try{
  let url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\0'))throw Error('Invalid path');
  const requested=path.resolve(root,'.'+pathname);
  if(requested!==root&&!requested.startsWith(root+path.sep))throw Error('Traversal rejected');
  let fp=requested;const st=await fs.stat(fp).catch(()=>null);if(st?.isDirectory())fp=path.join(fp,'index.html');
  const data=await fs.readFile(fp);res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(data);
 }catch(e){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`DesignForge Studio: http://127.0.0.1:${port}`));
