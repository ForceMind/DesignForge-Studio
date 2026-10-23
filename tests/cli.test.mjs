import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile),cli=new URL('../tools/forge.mjs',import.meta.url).pathname;
test('CLI apply refuses overwriting original, existing files and symlink aliases',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'designforge-cli-'));
 try{const original=await fs.readFile(new URL('../examples/Orbit.project.json',import.meta.url),'utf8'),src=path.join(dir,'source.json'),patch=path.join(dir,'patch.json');await fs.writeFile(src,original);await fs.copyFile(new URL('../examples/Rename-revenue.patch.json',import.meta.url),patch);
 await assert.rejects(()=>exec(process.execPath,[cli,'apply',src,patch,'--out',src]),/EEXIST/);assert.equal(await fs.readFile(src,'utf8'),original);
 const alias=path.join(dir,'alias.json');await fs.symlink(src,alias);await assert.rejects(()=>exec(process.execPath,[cli,'apply',src,patch,'--out',alias]),/EEXIST/);
 const dest=path.join(dir,'revised.json');await exec(process.execPath,[cli,'apply',src,patch,'--out',dest]);await exec(process.execPath,[cli,'validate',dest]);assert.equal(await fs.readFile(src,'utf8'),original);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
