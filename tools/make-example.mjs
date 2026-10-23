import fs from 'node:fs';
import {newProject} from '../src/core.mjs';
const P=newProject('Orbit — Product Analytics');
P.id='orbit-demo';
P.updatedAt='2026-10-23T00:00:00.000Z';
P.boards=[];let count=0;
const id=()=>`el${++count}`;
let b;
const rect=(x,y,w,h,fill='#ffffff',radius=0,stroke='none',extra={})=>b.nodes.push({id:id(),name:'Shape',type:'rect',x,y,w,h,text:'',style:{fill,radius,stroke,...extra}});
const circle=(x,y,d,fill)=>b.nodes.push({id:id(),name:'Ellipse',type:'circle',x,y,w:d,h:d,text:'',style:{fill}});
const txt=(x,y,w,h,text,size=16,color='$ink',weight=500,extra={})=>b.nodes.push({id:id(),name:text.slice(0,36),type:'text',x,y,w,h,text,style:{fontSize:Math.max(12,size),color,fontWeight:weight,...extra}});
const btn=(x,y,w,h,text,fill='$primary',color='#ffffff',extra={})=>b.nodes.push({id:id(),name:text,type:'button',x,y,w,h,text,style:{fill,color,radius:12,fontSize:14,fontWeight:650,align:'center',...extra}});
const pill=(x,y,w,h,text,fill='$primarySoft',color='$primary',extra={})=>b.nodes.push({id:id(),name:text,type:'pill',x,y,w,h,text,style:{fill,color,radius:100,fontSize:12,fontWeight:650,align:'center',...extra,fontSize:Math.max(12,extra.fontSize||12)}});
const icon=(x,y,s,name,color='$ink')=>b.nodes.push({id:id(),name:'Icon '+name,type:'icon',x,y,w:s,h:s,icon:name,text:'',style:{color}});
const line=(x,y,w,color='$border')=>b.nodes.push({id:id(),name:'Divider',type:'line',x,y,w,h:1,text:'',style:{stroke:color,strokeWidth:1}});

// Desktop artboard. Pixel coordinates deliberately stable for patch-based editing.
b={id:'desktop',name:'Analytics / Desktop',x:0,y:80,w:1280,h:800,bg:'#F6F7FB',nodes:[]};P.boards.push(b);
rect(0,0,234,800,'#FFFFFF');line(233,0,1);
rect(25,28,40,40,'$primary',14);icon(35,38,20,'sparkle','#FFFFFF');txt(76,29,136,34,'orbit.',25,'$ink',750);
txt(29,110,160,22,'WORKSPACE',11,'$muted',750,{letterSpacing:1.5});
const nav=[['grid','Overview'],['chart','Analytics'],['layers','Projects'],['wallet','Billing'],['calendar','Schedule']];
nav.forEach(([ic,label],i)=>{let y=151+i*51;if(i===0)rect(16,y,204,43,'$primarySoft',12);icon(32,y+12,20,ic,i===0?'$primary':'$muted');txt(65,y+10,130,24,label,14,i===0?'$primary':'$muted',i===0?700:560);});
line(24,478,184);txt(28,502,170,20,'PREFERENCES',11,'$muted',750,{letterSpacing:1.5});icon(31,542,20,'settings','$muted');txt(65,541,140,23,'Settings',14,'$muted',560);
rect(18,687,200,92,'$surfaceAlt',14);circle(34,704,34,'$primarySoft');icon(43,712,16,'user','$primary');txt(80,705,129,21,'Alex Morgan',13,'$ink',690);txt(80,727,122,19,'Pro workspace',11,'$muted',550);pill(33,753,164,20,'PRO ACCOUNT','$primarySoft','$primary',{fontSize:10});
rect(234,0,1046,78,'#FFFFFF');line(234,77,1046);icon(270,28,19,'search','$muted');txt(303,25,420,26,'Search across your workspace...',14,'$muted');
icon(1080,28,20,'calendar','$muted');icon(1137,28,20,'bell','$muted');circle(1190,19,39,'$primarySoft');txt(1197,26,31,24,'AM',12,'$primary',750);
txt(274,119,470,48,'Good morning, Alex ✳',29,'$ink',760);txt(274,169,480,22,'Here’s what’s happening with your products.',14,'$muted',450);
btn(1068,124,166,44,'+ New report');
const metrics=[
 ['TOTAL REVENUE','$84,254','+ 12.8%','$primarySoft','$primary','sparkle'],
 ['ACTIVE USERS','24,892','+ 8.2%','#EAF8F1','$success','user'],
 ['CONVERSION RATE','3.68%','+ 2.4%','#FFF6E3','#B68623','chart'],
 ['AVG. SESSION','8m 42s','+ 6.1%','#EAF3FF','#4A81DC','bolt']
];
metrics.forEach((m,i)=>{let x=274+i*245;rect(x,226,226,151,'#FFFFFF',18,'$border');rect(x+18,245,37,37,m[3],11);icon(x+28,254,18,m[5],m[4]);txt(x+19,298,192,20,m[0],11,'$muted',710,{letterSpacing:.5});txt(x+19,319,192,37,m[1],27,'$ink',760);pill(x+140,345,66,23,m[2],'#EAF8F1','$success',{fontSize:10});});
// Line/bar chart visualization.
rect(274,405,608,315,'#FFFFFF',18,'$border');txt(298,426,310,27,'Revenue over time',18,'$ink',720);txt(298,456,370,20,'Your earnings across the last 7 days',12,'$muted',490);
pill(773,425,85,31,'This week','$surfaceAlt','$ink');
[520,564,608,652].forEach(y=>line(329,y,520,'#EDEFF5'));
['$0','$5k','$10k','$15k'].forEach((q,i)=>txt(298,643-i*44,42,20,q,11,'$muted',500));
const bars=[45,74,60,111,88,133,115];bars.forEach((h,i)=>{let x=355+i*67;rect(x,663-h,35,h,i===5?'$primary':'#CFCBF9',7);txt(x+4,678,42,19,['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],10,'$muted',570);});
// Activity cards
rect(902,405,332,315,'#FFFFFF',18,'$border');txt(924,427,280,28,'Recent activity',18,'$ink',720);txt(924,459,250,18,'Latest updates from your team',12,'$muted');
const updates=[['sparkle','New dashboard created','Today · 09:42 AM','$primarySoft','$primary'],['user','New team member invited','Today · 08:16 AM','#EAF8F1','$success'],['chart','Weekly report is ready','Yesterday · 05:30 PM','#EAF3FF','#4A81DC']];
updates.forEach((u,i)=>{const y=503+i*65;circle(924,y,37,u[3]);icon(934,y+9,18,u[0],u[4]);txt(976,y-1,227,23,u[1],13,'$ink',650);txt(976,y+20,210,20,u[2],11,'$muted');if(i<2)line(976,y+51,220);});
// Bottom strip
rect(274,742,960,38,'#FFFFFF',10);txt(290,750,680,21,'✦  Your workspace is growing. Keep exploring what works.',12,'$muted',540);txt(1132,750,88,20,'View all  →',12,'$primary',680);

// Companion mobile artboard.
b={id:'mobile',name:'Analytics / Mobile',x:1370,y:80,w:390,h:844,bg:'#F7F8FC',nodes:[]};P.boards.push(b);
rect(0,0,390,94,'#FFFFFF');txt(24,29,220,33,'orbit.',27,'$ink',760);circle(323,25,43,'$primarySoft');txt(335,34,26,22,'AM',12,'$primary',750);
txt(24,118,335,32,'Today’s overview',24,'$ink',750);txt(24,154,300,21,'Wednesday, October 23',13,'$muted',500);
rect(21,197,348,182,'#5147D6',24);circle(256,204,118,'#6158DB');circle(313,263,51,'#736AE5');
txt(45,224,270,20,'TOTAL REVENUE',11,'#D5D0FC',750,{letterSpacing:1.6});txt(43,254,297,49,'$84,254',39,'#FFFFFF',750);pill(43,323,109,29,'↗ 12.8%','#FFFFFF','#5147D6',{fontSize:13});txt(164,329,168,20,'vs. last period',12,'#E3DFFD');
txt(24,410,255,30,'Key metrics',18,'$ink',730);txt(321,412,55,20,'See all',12,'$primary',670);
rect(20,450,167,132,'#FFFFFF',18,'$border');rect(204,450,166,132,'#FFFFFF',18,'$border');icon(40,471,22,'user','$primary');icon(222,471,22,'chart','$success');
txt(40,508,137,34,'24.8k',25,'$ink',750);txt(221,508,136,34,'3.68%',25,'$ink',750);txt(40,548,141,20,'Active users',12,'$muted');txt(221,548,137,20,'Conversion rate',12,'$muted');
txt(24,612,225,30,'Quick actions',18,'$ink',730);
rect(20,650,350,76,'#FFFFFF',16,'$border');rect(36,664,48,48,'$primarySoft',13);icon(50,678,20,'send','$primary');txt(101,663,229,24,'Share a report',14,'$ink',690);txt(101,687,228,21,'Keep your team in the loop',12,'$muted');icon(339,680,17,'chevron','$muted');
rect(0,764,390,80,'#FFFFFF');line(0,764,390);icon(43,782,23,'grid','$primary');txt(27,813,58,17,'Home',11,'$primary',700);icon(142,782,23,'chart','$muted');txt(130,813,63,17,'Reports',11,'$muted');icon(244,782,23,'layers','$muted');txt(231,813,66,17,'Projects',11,'$muted');icon(340,782,23,'user','$muted');txt(329,813,60,17,'Profile',11,'$muted');

// Component playground sample.
b={id:'components',name:'Elements / Design System',x:1850,y:80,w:640,h:660,bg:'#FFFFFF',nodes:[]};P.boards.push(b);
txt(42,40,555,45,'A system that stays consistent.',29,'$ink',760);txt(42,90,520,23,'Color, type, buttons and surface tokens.',14,'$muted');
line(42,137,556);txt(42,160,520,28,'Colors',18,'$ink',700);
const palettes=[['Primary','$primary'],['Soft','$primarySoft'],['Surface','$surfaceAlt'],['Success','$success'],['Warning','$warning']];
palettes.forEach((a,i)=>{let x=42+i*111;rect(x,203,92,84,a[1],16,'$border');txt(x,295,100,20,a[0],12,'$muted',600)});
txt(42,351,520,28,'Typography',18,'$ink',700);txt(42,393,530,42,'The quick brown fox',29,'$ink',750);txt(42,443,500,25,'Body regular — clear, functional, accessible.',15,'$muted',450);
line(42,490,556);txt(42,507,520,27,'Components',18,'$ink',700);btn(42,551,169,47,'Primary action');btn(222,551,171,47,'Secondary','#FFFFFF','$primary',{stroke:'$border',strokeWidth:1});pill(413,555,173,36,'Success state','#EAF8F1','$success',{fontSize:13});

// Example annotation demonstrates anchored, user-editable review feedback.
P.comments=[{id:'comment1',boardId:'desktop',nodeId:P.boards[0].nodes.find(n=>n.text==='Revenue over time')?.id,text:'Consider a monthly comparison toggle for power users.',resolved:false,createdAt:'2026-10-23T00:00:00.000Z'}];
fs.writeFileSync(new URL('../examples/Orbit.project.json',import.meta.url),JSON.stringify(P,null,2)+'\n');
console.log('Wrote example:',P.boards.length,'boards',count,'nodes');
