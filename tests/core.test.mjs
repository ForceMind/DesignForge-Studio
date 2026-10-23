import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateProject,auditProject,standaloneHtml,renderNode,applyPatch,hashProject,contrastRatio,newProject,diffProjects} from '../src/core.mjs';
import {zipFiles} from '../src/zip.mjs';
const project=JSON.parse(fs.readFileSync(new URL('../examples/Orbit.project.json',import.meta.url),'utf8'));
test('demo project structure accepted',()=>{assert.deepEqual(validateProject(project),[]);assert.equal(project.boards.length,3)});
test('reference checks expose hash and findings',()=>{assert.match(hashProject(project),/^[0-9a-f]{8}$/);assert.ok(Array.isArray(auditProject(project)))});
test('static board export is self-contained HTML',()=>{const h=standaloneHtml(project.boards[0],project);assert.ok(h.includes('Revenue over time'));assert.ok(!h.includes('<script'));assert.ok(h.includes('data-node-id'))});
test('markup injection must be escaped',()=>{const p=structuredClone(project);p.boards[0].nodes.push({id:'inject1',name:'Untrusted',type:'text',x:5,y:5,w:100,h:25,text:'<img src=x onerror=alert(1)>',style:{fontSize:14,color:'$ink'}});const html=standaloneHtml(p.boards[0],p);assert.equal(html.includes('<img src=x onerror=alert(1)>'),false);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))});
test('style injection must not pass CSS guard',()=>{const p=structuredClone(project);p.boards[0].nodes[0].style.fill='red;background-image:url(https://evil.test/)';const html=standaloneHtml(p.boards[0],p);assert.ok(!html.includes('evil.test'))});
test('contrast ratio follows WCAG luminance',()=>{assert.ok(Math.abs(contrastRatio('#FFFFFF','#000000')-21)<.001);assert.ok(Math.abs(contrastRatio('#FFFFFF','#FFFFFF')-1)<.001)});
test('patch applies smallest change without moving other nodes',()=>{const p=structuredClone(project);const node=p.boards[0].nodes.find(n=>n.text==='Revenue over time');const unrelated=structuredClone(p.boards[0].nodes[0]);const patch={format:'designforge.patch',version:1,baseHash:hashProject(p),ops:[{kind:'set-node',boardId:'desktop',nodeId:node.id,changes:{text:'Revenue comparison'}}]};const revised=applyPatch(p,patch);assert.equal(revised.boards[0].nodes.find(n=>n.id===node.id).text,'Revenue comparison');assert.deepEqual(revised.boards[0].nodes[0],unrelated);assert.equal(p.boards[0].nodes.find(n=>n.id===node.id).text,'Revenue over time')});
test('patches must include baseHash',()=>{const patch={format:'designforge.patch',version:1,ops:[]};assert.throws(()=>applyPatch(project,patch),/requires a valid baseHash/)});
test('stale patch blocked',()=>{const patch={format:'designforge.patch',version:1,baseHash:'00000000',ops:[]};assert.throws(()=>applyPatch(project,patch),/conflict/)});
test('unapproved patch fields are blocked',()=>{const patch={format:'designforge.patch',version:1,baseHash:hashProject(project),ops:[{kind:'set-node',boardId:'desktop',nodeId:project.boards[0].nodes[0].id,changes:{'__proto__.hacked':true}}]};assert.throws(()=>applyPatch(project,patch),/Property not editable/)});
test('color tokens cannot carry javascript',()=>{const p=structuredClone(project);p.tokens.primary='url(javascript:alert(1))';assert.ok(validateProject(p).length)});
test('zip writer emits ZIP signatures',async()=>{const blob=zipFiles([['index.html','hello'],['project.json','{}']]);const v=new DataView(await blob.arrayBuffer());assert.equal(v.getUint32(0,true),0x04034b50);assert.ok(blob.size>75)});
test('empty project needs artboard',()=>{const p=newProject('A');assert.ok(validateProject(p).length)});

test('diff isolates edited field',()=>{const p=structuredClone(project),n=p.boards[0].nodes[0];n.style.fill='#123456';const diff=diffProjects(project,p);assert.equal(diff.length,1);assert.equal(diff[0].field,'style')});

test('malformed null comments are reported instead of crashing',()=>{
 const p=structuredClone(project);p.comments=[null];
 assert.ok(validateProject(p).some(i=>i.path==='comments[0]'));
});
test('sample agent patch is valid and leaves unrelated artboards unchanged',()=>{
 const patch=JSON.parse(fs.readFileSync(new URL('../examples/Rename-revenue.patch.json',import.meta.url),'utf8'));
 const next=applyPatch(project,patch);
 assert.equal(next.boards[0].nodes.find(n=>n.id==='el64').text,'Revenue by market');
 assert.deepEqual(next.boards[1],project.boards[1]);
 assert.deepEqual(next.boards[2],project.boards[2]);
});
