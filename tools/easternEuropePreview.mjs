import fs from 'node:fs';
import {createCanvas} from 'canvas';
const s=JSON.parse(fs.readFileSync('public/assets/maps/eastern-europe.json','utf8'));
const radius=6, pad=30, root=Math.sqrt(3), width=Math.ceil((s.map.width+s.map.height/2)*root*radius+2*pad),height=s.map.height*radius*1.5+2*pad;
const canvas=createCanvas(width,height),c=canvas.getContext('2d');
const owners=new Map(s.cities.flatMap(city=>city.ownedTileCoords.map(p=>[`${p.q},${p.r}`,city.nationId])));
const colors={ocean:'#26465e',coast:'#477d96',meadow:'#a4b777',plains:'#b7b587',forest:'#547758',mountain:'#8e8980'};
const nationColors=Object.fromEntries(s.nations.map(n=>[n.id,n.color]));
const xy=(q,r)=>[pad+(q+r/2)*root*radius,pad+r*radius*1.5];
function hex(q,r){const [x,y]=xy(q,r);c.beginPath();for(let i=0;i<6;i++){const a=(i*60-30)*Math.PI/180;c.lineTo(x+radius*Math.cos(a),y+radius*Math.sin(a));}c.closePath();}
c.fillStyle='#162c3b';c.fillRect(0,0,width,height);
for(const t of s.map.tiles){hex(t.q,t.r);c.fillStyle=colors[t.type]??'#fff';c.fill();c.strokeStyle='#00000012';c.lineWidth=.3;c.stroke();const owner=owners.get(`${t.q},${t.r}`);if(owner){c.globalAlpha=.26;c.fillStyle=nationColors[owner];c.fill();c.globalAlpha=1;}}
const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
for(const t of s.map.tiles){const [x,y]=xy(t.q,t.r),owner=owners.get(`${t.q},${t.r}`);if(t.riverConnections)for(let i=0;i<6;i++)if(t.riverConnections&(1<<i)){const [nx,ny]=xy(t.q+dirs[i][0],t.r+dirs[i][1]);c.beginPath();c.moveTo(x,y);c.lineTo((x+nx)/2,(y+ny)/2);c.strokeStyle='#91cbdf';c.lineWidth=1.5;c.stroke();}if(owner)for(let i=0;i<6;i++){if(owners.get(`${t.q+dirs[i][0]},${t.r+dirs[i][1]}`)===owner)continue;const a=(i*60-30)*Math.PI/180,b=(i*60+30)*Math.PI/180;c.beginPath();c.moveTo(x+radius*Math.cos(a),y+radius*Math.sin(a));c.lineTo(x+radius*Math.cos(b),y+radius*Math.sin(b));c.strokeStyle=nationColors[owner];c.lineWidth=1.8;c.stroke();}}
c.font='bold 14px sans-serif';c.textAlign='center';
for(const city of s.cities){const [x,y]=xy(city.q,city.r);c.fillStyle='white';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();c.lineWidth=3;c.strokeStyle='#14212a';c.strokeText(city.name,x,y-9);c.fillText(city.name,x,y-9);}
const path=process.argv[2]??'/tmp/eastern-europe-preview.png';fs.writeFileSync(path,canvas.toBuffer('image/png'));console.log(path);
