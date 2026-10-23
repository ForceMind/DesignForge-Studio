/** DesignForge's original, dependency-free project protocol / renderer. */
export const FORMAT = 'designforge.project';
export const VERSION = 1;
export const NODE_TYPES = new Set(['rect', 'circle', 'text', 'button', 'pill', 'line', 'icon', 'input']);
export const TOKEN_KEYS = ['primary', 'primarySoft', 'surface', 'surfaceAlt', 'canvas', 'ink', 'muted', 'border', 'success', 'warning', 'danger'];
export const ICONS = {
  sparkle: '<path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z"/><path d="m19 16 .65 2.35L22 19l-2.35.65L19 22l-.65-2.35L16 19l2.35-.65L19 16Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 5-5 4 3 5-7"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18"/><path d="M16 14h2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 13.5c.1-.5.1-2.5 0-3l2-1.5-2-3.5-2.5 1c-.7-.6-1.2-.9-2-1L14 2h-4l-.5 2.5c-.8.1-1.4.4-2 1l-2.5-1L3 8l2 1.5a9 9 0 0 0 0 3L3 14l2 3.5 2.5-1c.7.6 1.2.9 2 1L10 20h4l.5-2.5c.8-.1 1.4-.4 2-1l2.5 1 2-3.5-2-1.5Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  bolt: '<path d="m13 2-9 11h7l-1 9 10-12h-7V2Z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  send: '<path d="m3 12 18-9-4 18-5-6-5 4 1-7Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>'
};
const TOKENS_DEFAULT = {
  primary: '#5C4ACF', primarySoft: '#EEEAFE', surface: '#FFFFFF', surfaceAlt: '#F7F8FB',
  canvas: '#F3F5F9', ink: '#202238', muted: '#848A9E', border: '#E4E7F0',
  success: '#13734F', warning: '#F4B754', danger: '#E16C70',
  radius: 14, fontFamily: 'system-ui'
};
export const DEFAULT_TOKENS = Object.freeze(TOKENS_DEFAULT);
export const clone = value => structuredClone(value);
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v, min, max, fallback = min) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
const safeColor = value => (typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value)) ? value : null;
const cssColor = (value, tokens, fallback='#000000') => {
  if (typeof value === 'string' && /^\$[a-zA-Z][a-zA-Z0-9]*$/.test(value)) return safeColor(tokens[value.slice(1)]) || fallback;
  return safeColor(value) || fallback;
};
const num = (v, def=0) => Number.isFinite(Number(v)) ? Number(v) : def;
const px = (v) => `${Math.round(num(v) * 100) / 100}px`;
const round = v => Math.round(num(v) * 10)/10;
export function newProject(title = 'Untitled project') {
  return {format: FORMAT,version: VERSION, id:'project-'+Date.now().toString(36),title,tokens:clone(DEFAULT_TOKENS), boards:[],comments:[],updatedAt:new Date().toISOString()};
}
export function validId(id){return typeof id === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id);}
export function validateProject(project){
  const issues = [];
  const error = (path,reason) => issues.push({severity:'error',path,reason});
  if(!isObject(project)){error('root','Project must be an object');return issues;}
  if(project.format!==FORMAT || project.version!==VERSION)error('format','Unsupported project format/version');
  if(typeof project.title!=='string'||!project.title.trim())error('title','Project title required');
  if(!isObject(project.tokens))error('tokens','Design tokens object required');
  else {
    for(const key of TOKEN_KEYS){if(!safeColor(project.tokens[key]))error('tokens.'+key,'Expected hex color');}
    if(!Number.isFinite(project.tokens.radius)||project.tokens.radius<0||project.tokens.radius>100)error('tokens.radius','Must be between 0 and 100');
    if(!['system-ui','ui-sans-serif','Georgia','Verdana','Arial'].includes(project.tokens.fontFamily))error('tokens.fontFamily','Unsupported font stack');
  }
  if(!Array.isArray(project.boards)||project.boards.length<1||project.boards.length>24){error('boards','Require 1–24 boards');return issues;}
  let globalIds=new Set();
  for(const [i,board] of project.boards.entries()){
    let p=`boards[${i}]`;
    if(!isObject(board)){error(p,'Board must be an object');continue;}
    if(!validId(board.id)||globalIds.has(board.id))error(p+'.id','Invalid or duplicate ID');
    globalIds.add(board.id);
    if(typeof board.name!=='string'||!board.name.trim())error(p+'.name','Board name required');
    if(!safeColor(board.bg))error(p+'.bg','Board background must be hex');
    if(!(Number.isFinite(board.w)&&board.w>=280&&board.w<=2400&&Number.isFinite(board.h)&&board.h>=280&&board.h<=3200))error(p+'.size','Board dimensions out of range');
    if(!Number.isFinite(board.x)||!Number.isFinite(board.y))error(p+'.position','Board position must be numeric');
    if(!Array.isArray(board.nodes)||board.nodes.length>500){error(p+'.nodes','Expected <= 500 nodes');continue;}
    let ids=new Set();
    for(const [j,node] of board.nodes.entries()){
      const n=`${p}.nodes[${j}]`;
      if(!isObject(node)){error(n,'Node must be an object');continue;}
      if(!validId(node.id)||ids.has(node.id))error(n+'.id','Invalid or duplicate node ID');
      ids.add(node.id);
      if(!NODE_TYPES.has(node.type))error(n+'.type','Unsupported element type');
      if(![node.x,node.y,node.w,node.h].every(v=>Number.isFinite(v))||node.w<1||node.h<1||node.w>2400||node.h>3200)error(n+'.bounds','Invalid element bounds');
      if(!isObject(node.style))error(n+'.style','Style object required');
      if(typeof node.text!=='string')error(n+'.text','Text must be a string');
      if(node.text?.length>10000)error(n+'.text','Text too long');
    }
  }
  if(!Array.isArray(project.comments)||project.comments.length>1000)error('comments','Expected <= 1000 comments');
  else for(const [i,c] of project.comments.entries()){
    if(!isObject(c)||!validId(c.id)||!globalIds.has(c.boardId)||typeof c.text!=='string')error(`comments[${i}]`,'Invalid comment');
  }
  return issues;
}
export function contrastRatio(first, second){
  function rgb(hex){let s = hex.replace('#','');if(s.length===3)s=s.split('').map(c=>c+c).join('');if(s.length>6)s=s.slice(0,6);return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);}
  const brightness = x => {let [r,g,b]=rgb(x);return .2126*r+.7152*g+.0722*b};
  const a=brightness(first),b=brightness(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function auditProject(project){
  const findings=[];
  const problem=(severity,boardId,node,code,message)=>findings.push({severity,boardId,nodeId:node?.id||null,code,message});
  for(const board of project.boards||[]){
    for(const node of board.nodes||[]){
      if(node.locked)continue;
      if(node.x<0||node.y<0||node.x+node.w>board.w+1||node.y+node.h>board.h+1)problem('warning',board.id,node,'OVERFLOW','Element extends outside artboard');
      if(['button','input'].includes(node.type)&&(node.w<44||node.h<44))problem('warning',board.id,node,'TOUCH_TARGET','Interactive element smaller than 44×44 px');
      if(['text','pill','button','input'].includes(node.type)){
        const size=num(node.style?.fontSize,16);
        if(size<12)problem('warning',board.id,node,'TEXT_SIZE','Text is below 12px');
        // Comparison uses declared fill, not backdrop inferred from scene geometry.
        const foreground=cssColor(node.style?.color,project.tokens,'#202238');
        const background=cssColor(node.style?.fill,project.tokens,board.bg);
        if(node.style?.fill && contrastRatio(foreground,background)<(size>=24?3:4.5))problem('warning',board.id,node,'CONTRAST','Declared foreground/background contrast below WCAG AA');
      }
      if(node.type==='icon'&&!Object.hasOwn(ICONS,node.icon||''))problem('warning',board.id,node,'ICON','Unknown icon; generic fallback will appear');
    }
  }
  return findings;
}
export function hashProject(p){
  const s=JSON.stringify(p);let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
}
function requireString(v,name){if(typeof v!=='string'||v.length>10000)throw Error(name+' must be a string');return v;}
const editableKeys=new Set(['name','text','x','y','w','h','locked','icon']);
const editStyleKeys=new Set(['fill','color','stroke','strokeWidth','radius','fontSize','fontWeight','align','opacity','letterSpacing']);
function getBoard(project,id){const b=project.boards.find(x=>x.id===id);if(!b)throw Error('Unknown board '+id);return b;}
function getNode(board,id){const n=board.nodes.find(x=>x.id===id);if(!n)throw Error('Unknown node '+id);return n;}
export function applyPatch(project,patch){
  if(!isObject(patch)||patch.format!=='designforge.patch'||patch.version!==1||!Array.isArray(patch.ops)||patch.ops.length>100)throw Error('Invalid patch');
  if(typeof patch.baseHash!=='string'||!/^[0-9a-f]{8}$/.test(patch.baseHash))throw Error('Patch requires a valid baseHash; read the current project first');
  if(hashProject(project)!==patch.baseHash)throw Error('Patch conflict: baseHash does not match; re-read current project before editing');
  const next=clone(project);
  for(const op of patch.ops){
    if(!isObject(op))throw Error('Patch operation must be an object');
    if(op.kind==='set-node'){
      const n=getNode(getBoard(next,op.boardId),op.nodeId);
      if(!isObject(op.changes))throw Error('changes object required');
      for(const [key,value] of Object.entries(op.changes)){
        if(key==='style'){
          if(!isObject(value)||Object.keys(value).some(k=>!editStyleKeys.has(k)))throw Error('Unsafe style keys');
          n.style={...n.style,...clone(value)};
        }else if(editableKeys.has(key)) n[key]=clone(value);
        else throw Error('Property not editable: '+key);
      }
    } else if(op.kind==='add-node'){
      const b=getBoard(next,op.boardId);
      if(!isObject(op.node)||b.nodes.some(n=>n.id===op.node.id))throw Error('Invalid/duplicate node');
      b.nodes.push(clone(op.node));
    }else if(op.kind==='remove-node'){
      const b=getBoard(next,op.boardId);
      if(!b.nodes.some(n=>n.id===op.nodeId))throw Error('Unknown node');
      b.nodes=b.nodes.filter(n=>n.id!==op.nodeId);
      next.comments=next.comments.filter(c=>c.boardId!==b.id||c.nodeId!==op.nodeId);
    } else if(op.kind==='set-token'){
      if(!TOKEN_KEYS.includes(op.key) && !['radius','fontFamily'].includes(op.key))throw Error('Unsupported token');
      next.tokens[op.key]=op.value;
    }else if(op.kind==='rename-board'){
      getBoard(next,op.boardId).name=requireString(op.name,'name');
    }else throw Error('Unsupported patch kind '+op.kind);
  }
  next.updatedAt=new Date().toISOString();
  const issues=validateProject(next);
  if(issues.length)throw Error('Patch rejected by validation: '+issues.map(i=>i.path+': '+i.reason).join('; '));
  return next;
}
function colorStyle(node,tokens,board){
  const s=node.style||{};
  const parts=[`position:absolute`,`left:${px(node.x)}`,`top:${px(node.y)}`,`width:${px(node.w)}`,`height:${px(node.h)}`,'box-sizing:border-box',
    `opacity:${clamp(s.opacity??1,0,1,1)}`];
  const fill=s.fill ? cssColor(s.fill,tokens,'transparent') : 'transparent';
  if(fill!=='transparent')parts.push(`background:${fill}`);
  if(s.stroke&&s.stroke!=='none')parts.push(`border:${clamp(s.strokeWidth??1,0,20,1)}px solid ${cssColor(s.stroke,tokens,'#000000')}`);
  const radius=s.radius==='$radius'?tokens.radius:s.radius;
  if(Number.isFinite(radius))parts.push(`border-radius:${px(clamp(radius,0,200))}`);
  if(node.type==='circle')parts.push('border-radius:50%');
  if(['text','button','pill','input'].includes(node.type)){
    parts.push(`color:${cssColor(s.color,tokens,'#202238')}`,
      `font-size:${px(clamp(s.fontSize??16,8,180,16))}`,`font-weight:${clamp(s.fontWeight??500,100,900,500)}`,
      `letter-spacing:${px(clamp(s.letterSpacing??0,-3,20,0))}`,`text-align:${['left','center','right'].includes(s.align)?s.align:'left'}`);
    parts.push(`font-family:${tokens.fontFamily==='Georgia'?'Georgia,serif':tokens.fontFamily==='Verdana'?'Verdana,sans-serif':tokens.fontFamily==='Arial'?'Arial,sans-serif':'system-ui,-apple-system,BlinkMacSystemFont,sans-serif'}`);
    parts.push('white-space:pre-wrap','overflow-wrap:anywhere');
  }
  return parts.join(';');
}
export function renderNode(node,board,tokens){
  const st=escapeHtml(colorStyle(node,tokens,board));
  const content=escapeHtml(node.text||'');
  const wrap = `<div class="df-node df-${node.type}" data-node-id="${escapeHtml(node.id)}" style="${st}">${content}</div>`;
  if(node.type==='button')return `<button type="button" class="df-node df-button" data-node-id="${escapeHtml(node.id)}" style="${st}">${content}</button>`;
  if(node.type==='input')return `<input class="df-node df-input" aria-label="${content}" data-node-id="${escapeHtml(node.id)}" style="${st}" placeholder="${content}" readonly />`;
  if(node.type==='icon')return `<div class="df-node df-icon" data-node-id="${escapeHtml(node.id)}" style="${st}"><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="${cssColor(node.style?.color,tokens,'#202238')}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${Object.hasOwn(ICONS,node.icon)?ICONS[node.icon]:ICONS.grid}</svg></div>`;
  if(node.type==='line')return `<div class="df-node df-line" data-node-id="${escapeHtml(node.id)}" style="${st};border-top:${clamp(node.style?.strokeWidth??1,1,10,1)}px solid ${cssColor(node.style?.stroke,tokens,'#E4E7F0')}"></div>`;
  return wrap;
}
export const exportStyles=`*{box-sizing:border-box}body{margin:0}.df-board{position:relative;overflow:hidden;margin:0 auto}.df-node{margin:0;padding:0}.df-button,.df-pill{display:flex;align-items:center;justify-content:center;cursor:pointer;border:0}.df-input{padding:0 14px;outline:0}.df-icon{display:flex;align-items:center;justify-content:center}.df-icon svg{width:100%;height:100%}.df-text{line-height:1.35}.df-line{pointer-events:none}`;
export function renderBoard(board,tokens){
  return `<main class="df-board" data-board-id="${escapeHtml(board.id)}" style="width:${px(board.w)};height:${px(board.h)};background:${safeColor(board.bg)||'#FFFFFF'}">${board.nodes.map(n=>renderNode(n,board,tokens)).join('')}</main>`;
}
export function standaloneHtml(board,project){
  const title=escapeHtml(`${board.name} – ${project.title}`);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${exportStyles}body{background:#e8eaf0;overflow:auto}.df-board{box-shadow:0 18px 70px #1b21401a;margin:40px auto}</style></head><body>${renderBoard(board,project.tokens)}</body></html>`;
}
export function exportIndexHtml(project){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.title)}</title><style>body{font:16px system-ui;background:#f4f5f9;color:#232639;max-width:780px;margin:80px auto;padding:24px}a{display:block;padding:20px;background:white;border:1px solid #e4e6ec;border-radius:14px;margin:16px 0;color:#6958e8;text-decoration:none}</style></head><body><h1>${escapeHtml(project.title)}</h1><p>Static artboard exports • DesignForge Studio</p>${project.boards.map((b,i)=>`<a href="board-${i+1}.html">${escapeHtml(b.name)} (${b.w} × ${b.h}) →</a>`).join('')}</body></html>`}
/** Human-readable, deterministic node-level diff for reviewing agent edits. */
export function diffProjects(before,after){
 const changes=[];
 const oldTokens=before.tokens||{},newTokens=after.tokens||{};
 for(const k of [...TOKEN_KEYS,'radius','fontFamily'])if(JSON.stringify(oldTokens[k])!==JSON.stringify(newTokens[k]))changes.push({kind:'token',key:k,before:oldTokens[k],after:newTokens[k]});
 const oldBoards=new Map(before.boards.map(b=>[b.id,b]));
 const newBoards=new Map(after.boards.map(b=>[b.id,b]));
 for(const [id,board] of oldBoards)if(!newBoards.has(id))changes.push({kind:'board-removed',boardId:id,name:board.name});
 for(const [id,board] of newBoards){
  const previous=oldBoards.get(id);
  if(!previous){changes.push({kind:'board-added',boardId:id,name:board.name});continue}
  if(previous.name!==board.name)changes.push({kind:'board-renamed',boardId:id,before:previous.name,after:board.name});
  const olds=new Map(previous.nodes.map(n=>[n.id,n]));const news=new Map(board.nodes.map(n=>[n.id,n]));
  for(const [nodeId,n] of olds)if(!news.has(nodeId))changes.push({kind:'node-removed',boardId:id,nodeId,name:n.name});
  for(const [nodeId,n] of news){const old=olds.get(nodeId);if(!old){changes.push({kind:'node-added',boardId:id,nodeId,name:n.name});continue}
   const keys=['name','text','x','y','w','h','locked','icon','style'];for(const key of keys){if(JSON.stringify(old[key])!==JSON.stringify(n[key]))changes.push({kind:'node-changed',boardId:id,nodeId,name:n.name,field:key,before:old[key],after:n[key]})}
  }
 }
 return changes;
}
