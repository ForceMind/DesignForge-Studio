#!/usr/bin/env node
import {flattenNodes} from '../src/tree.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {newProject,clone,validateProject,auditProject,standaloneHtml,exportIndexHtml,applyPatch,hashProject} from '../src/core.mjs';
const [cmd,src,arg3,arg4,arg5]=process.argv.slice(2);
const help=()=>{console.log(`DesignForge CLI v0.1
  node tools/forge.mjs validate <project.json>
  node tools/forge.mjs audit <project.json>
  node tools/forge.mjs export <project.json> <output-dir>
  node tools/forge.mjs apply <project.json> <patch.json> --out <revised.json>
  node tools/forge.mjs init <output.json>

Patches contain format=designforge.patch, version=1, baseHash=<current hash>, ops=[...].`)};
async function loadJSON(file){return JSON.parse(await fs.readFile(file,'utf8'))}
async function main(){
 if(!cmd||cmd==='help'||cmd==='--help'){help();return}
 if(!src)throw Error('Missing file path');
 if(cmd==='init'){
  const p=newProject('My Design Project');p.boards=[{id:'board1',name:'Desktop',x:0,y:60,w:1280,h:800,bg:'#FFFFFF',nodes:[]}];
  await fs.mkdir(path.dirname(path.resolve(src)),{recursive:true});await fs.writeFile(src,JSON.stringify(p,null,2)+'\n');console.log('Created:',path.resolve(src));return;
 }
 const project=await loadJSON(src);const issues=validateProject(project);
 if(issues.length){console.error('Project validation FAILED:');issues.forEach(i=>console.error(`  ${i.path}: ${i.reason}`));process.exitCode=1;return}
 if(cmd==='validate'){console.log(`VALID • ${project.title} • ${project.boards.length} boards • ${project.boards.reduce((n,b)=>n+flattenNodes(b.nodes).length,0)} nodes • hash ${hashProject(project)}`);return}
 if(cmd==='audit'){
  const findings=auditProject(project);
  console.log(JSON.stringify({project:project.title,hash:hashProject(project),findings},null,2));return;
 }
 if(cmd==='export'){
  if(!arg3)throw Error('export requires output directory');const dir=path.resolve(arg3);await fs.mkdir(dir,{recursive:true});
  await Promise.all([fs.writeFile(path.join(dir,'index.html'),exportIndexHtml(project)),fs.writeFile(path.join(dir,'designforge.project.json'),JSON.stringify(project,null,2)+'\n'),fs.writeFile(path.join(dir,'audit.json'),JSON.stringify(auditProject(project),null,2)),...project.boards.map((b,i)=>fs.writeFile(path.join(dir,`board-${i+1}.html`),standaloneHtml(b,project)))]);
  console.log(`EXPORTED ${project.boards.length} standalone artboards into ${dir}`);return;
 }
 if(cmd==='apply'){
  if(!arg3)throw Error('apply requires patch file');if(arg4!=='--out'||!arg5)throw Error('apply must specify --out <new-file.json>; original not overwritten');
  const patch=await loadJSON(arg3);const revised=applyPatch(project,patch);
  await fs.mkdir(path.dirname(path.resolve(arg5)),{recursive:true});await fs.writeFile(arg5,JSON.stringify(revised,null,2)+'\n',{flag:'wx'});
  console.log(`PATCH APPLIED • ${patch.ops.length} ops • original ${hashProject(project)} → ${hashProject(revised)} • ${arg5}`);return;
 }
 throw Error('Unknown command: '+cmd);
}
main().catch(e=>{console.error('ERROR:',e.message);process.exitCode=1});
