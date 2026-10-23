(function(){
var CITIES={A:'臺北市',B:'臺中市',C:'基隆市',D:'臺南市',E:'高雄市',F:'新北市',G:'宜蘭縣',H:'桃園市',I:'嘉義市',J:'新竹縣',K:'苗栗縣',M:'南投縣',N:'彰化縣',O:'新竹市',P:'雲林縣',Q:'嘉義縣',T:'屏東縣',U:'花蓮縣',V:'臺東縣',W:'金門縣',X:'澎湖縣',Z:'連江縣'};
var norm=function(s){return String(s==null?'':s).replace(/台/g,'臺').replace(/\s/g,'');};
var CODE={};for(var k0 in CITIES)CODE[CITIES[k0]]=k0;
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
var townCache={},secCache={};
function getXML(u){return fetch(u).then(function(r){return r.text();}).then(function(t){return new DOMParser().parseFromString(t,'text/xml');});}
function txt(n,tag){var e=n.getElementsByTagName(tag)[0];return e?e.textContent.trim():'';}
function towns(c){if(!townCache[c])townCache[c]=getXML('https://api.nlsc.gov.tw/other/ListTown/'+c).then(function(x){var m={};[].forEach.call(x.getElementsByTagName('townItem'),function(i){m[norm(txt(i,'townname'))]=txt(i,'towncode');});return m;});return townCache[c];}
function sections(c,t){var k=c+t;if(!secCache[k])secCache[k]=getXML('https://api.nlsc.gov.tw/other/ListLandSection/'+c+'/'+t).then(function(x){var m={};[].forEach.call(x.getElementsByTagName('sectItem'),function(i){m[norm(txt(i,'sectstr')).replace(/段$/,'')]={office:txt(i,'office'),sect:txt(i,'sectcode')};});return m;});return secCache[k];}
function q(office,sect,landno){var u='https://landmaps.nlsc.gov.tw/S_Maps/qryTileMapIndex?type=2&flag=2&office='+office+'&sect='+sect+'&landno='+landno+'&alpah=0.5f';return fetch(u).then(function(r){return r.json();}).then(function(d){while(Array.isArray(d))d=d[0];return d&&d.cx?d:null;}).catch(function(){return null;});}
function parseLand(loc){loc=norm(loc).replace(/地號.*$/,'').replace(/[~～].*$/,'');var m=loc.match(/^(.*段)(\d+)(?:-(\d+))?$/)||loc.match(/^(.*?)(\d+)(?:-(\d+))?$/);if(!m)return null;return {sec:m[1].replace(/段$/,''),main:m[2],sub:m[3]||'0'};}
function pad(n){return ('0000'+n).slice(-4);}
function parseLL(s){var m=String(s||'').match(/(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)/);if(!m)return null;var a=+m[1],b=+m[2];return a<b?{cy:a,cx:b}:{cy:b,cx:a};}
var ROAD={mode:null,cache:{},bad:0,quick:false};
function mPerDeg(lat){return {x:111320*Math.cos(lat*Math.PI/180),y:110540};}
function toXY(lon,lat,o){var k=mPerDeg(o.lat);return {x:(lon-o.lon)*k.x,y:(lat-o.lat)*k.y};}
function segDist(p,a,b){var dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy,t=L?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0;t=Math.max(0,Math.min(1,t));var x=a.x+t*dx-p.x,y=a.y+t*dy-p.y;return Math.sqrt(x*x+y*y);}
function segIntersect(a,b,c,d){function o(p,q,r){return (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);}return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;}
function rectSegDist(R,a,b){var inside=function(p){return p.x>=R.x0&&p.x<=R.x1&&p.y>=R.y0&&p.y<=R.y1;};if(inside(a)||inside(b))return 0;var C=[{x:R.x0,y:R.y0},{x:R.x1,y:R.y0},{x:R.x1,y:R.y1},{x:R.x0,y:R.y1}],d=Infinity;for(var i=0;i<4;i++){var c=C[i],e=C[(i+1)%4];if(segIntersect(a,b,c,e))return 0;d=Math.min(d,segDist(c,a,b),segDist(e,a,b),segDist(a,c,e),segDist(b,c,e));}return d;}
function analyse(ways,P){var o={lon:P.cx,lat:P.cy},R;if(P.lx){var p0=toXY(+P.lx,+P.ly,o),p1=toXY(+P.rx,+P.ry,o);R={x0:Math.min(p0.x,p1.x),x1:Math.max(p0.x,p1.x),y0:Math.min(p0.y,p1.y),y1:Math.max(p0.y,p1.y)};}else R={x0:0,x1:0,y0:0,y1:0};
 var best={};ways.forEach(function(w){var pts=w.geom.map(function(g){return toXY(g[0],g[1],o);});if(best[w.name]){best[w.name].lines.push(pts);best[w.name].geoms.push(w.geom);}for(var i=1;i<pts.length;i++){var d=rectSegDist(R,pts[i-1],pts[i]);if(!best[w.name]||d<best[w.name].d){var a=Math.atan2(pts[i].y-pts[i-1].y,pts[i].x-pts[i-1].x)*180/Math.PI;var L=best[w.name]?best[w.name].lines:[pts],G=best[w.name]?best[w.name].geoms:[w.geom];best[w.name]={name:w.name,d:d,ang:(a+180)%180,a:pts[i-1],b:pts[i],lines:L,geoms:G};}}});
 return Object.keys(best).map(function(k){return best[k];}).sort(function(a,b){return a.d-b.d;});}
var ROAD_MAX=15;
function across(A,B){var dx=A.b.x-A.a.x,dy=A.b.y-A.a.y,len=Math.hypot(dx,dy);if(!len)return false;var side=function(p){return (dx*(p.y-A.a.y)-dy*(p.x-A.a.x))/len;};var s0=side({x:0,y:0});if(Math.abs(s0)<2)return false;var same=0,opp=0;
 B.lines.forEach(function(pts){for(var i=1;i<pts.length;i++){var p=pts[i-1],q=pts[i],n=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/2));for(var j=0;j<=n;j++){var x=p.x+(q.x-p.x)*j/n,y=p.y+(q.y-p.y)*j/n;if(Math.hypot(x,y)>60)continue;var s=side({x:x,y:y});if(Math.abs(s)<6)continue;if(s*s0>0)same++;else opp++;}}});
 return same===0&&opp>=2;}
function endNear(A,B){var E=null,bd=1e9,bl=null,bi=0;B.lines.forEach(function(pts){[0,pts.length-1].forEach(function(ix){var p=pts[ix],m=1e9;A.lines.forEach(function(la){for(var k=1;k<la.length;k++)m=Math.min(m,segDist(p,la[k-1],la[k]));});if(m<bd){bd=m;E=p;bl=pts;bi=ix;}});});if(!E||bd>20)return null;var acc=0,Q=E,step=bi===0?1:-1;for(var k=bi+step;k>=0&&k<bl.length;k+=step){acc+=Math.hypot(bl[k].x-bl[k-step].x,bl[k].y-bl[k-step].y);Q=bl[k];if(acc>=10)break;}var L=Math.hypot(E.x-Q.x,E.y-Q.y);if(L<1)return null;return {E:E,dx:(E.x-Q.x)/L,dy:(E.y-Q.y)/L};}
function contOf(B,C,A){var en=endNear(A,B);if(!en)return false;var d=Math.abs(B.ang-C.ang);d=Math.min(d,180-d);if(d>25)return false;var dx=C.b.x-C.a.x,dy=C.b.y-C.a.y,L=Math.hypot(dx,dy);if(!L)return false;return Math.abs(dx*(en.E.y-C.a.y)-dy*(en.E.x-C.a.x))/L<8;}
function hitsLand(A,B,hit){if(!hit)return true;var en=endNear(A,B);if(!en)return true;var nh=0;for(var o2=-2;o2<=2;o2+=2){for(var s2=0;s2<=60;s2+=1){var x=en.E.x+en.dx*s2-en.dy*o2,y=en.E.y+en.dy*s2+en.dx*o2;if(hit(x,y)){nh++;break;}}}return nh>=2;}
function plMeet(A,B,lim){var best=1e9,f=function(X,Y){X.lines.forEach(function(pts){for(var i=1;i<pts.length;i++){var a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));for(var t=0;t<=n;t++){var p={x:a.x+(b.x-a.x)*t/n,y:a.y+(b.y-a.y)*t/n};Y.lines.forEach(function(q){for(var j=1;j<q.length;j++){var dd=segDist(p,q[j-1],q[j]);if(dd<best)best=dd;}});}}});};f(A,B);return best<=lim;}
function label(list,hit){if(!list.length)return {text:'',n:0};var front=list.slice(),chong=[];
 for(var i=0;i<front.length;i++)for(var j=0;j<front.length;j++){if(i===j)continue;if(across(front[i],front[j])&&!front[j].flOK&&!front[j].cornerT){var B=front[j],A=front[i],isCont=front.some(function(C){return C!==A&&C!==B&&contOf(B,C,A);});if(!isCont&&hitsLand(A,B,hit))chong.push(B);front.splice(j,1);i=-1;break;}}
 for(var i2=0;i2<front.length;i2++){var B2=front[i2];if(front.some(function(A2){return A2!==B2&&front.some(function(C2){return C2!==A2&&C2!==B2&&C2.d<B2.d&&contOf(B2,C2,A2);});})){front.splice(i2,1);i2=-1;}}
 var n=front.map(function(r){return r.name;}),tags=[];
 if(n.length===2){var d=Math.abs(front[0].ang-front[1].ang);d=Math.min(d,180-d);tags.push(d>30&&plMeet(front[0],front[1],10)?'三角窗':'雙面臨路');}else if(n.length>2)tags.push((['','','','三','四','五','六'][n.length]||'多')+'面臨路');
 chong.forEach(function(r){tags.push(/[巷弄]$/.test(r.name)?r.name+'沖':r.name+'路沖');});
 return {text:n.join('、')+(tags.length?'（'+tags.join('，')+'）':''),n:n.length,names:n,tags:tags};}
function addrText(addrs,sh,P,names){var kA=mPerDeg(P.cy),mg=2/kA.x,mgy=2/kA.y;var ok=addrs.filter(function(a){var fr=!!(names&&names.indexOf(String(a.st).trim())>=0);if(sh)return fr?sh.has(a.lon,a.lat):(sh.has(a.lon,a.lat,0)&&sh.dist(a.lon,a.lat)>=2);var e=fr?0:1;return P.lx&&a.lon>=Math.min(P.lx,P.rx)+e*mg&&a.lon<=Math.max(P.lx,P.rx)-e*mg&&a.lat>=Math.min(P.ly,P.ry)+e*mgy&&a.lat<=Math.max(P.ly,P.ry)-e*mgy;}),g={},ord=[],seen={};ok.forEach(function(a){var st=String(a.st).trim(),no=String(a.no).trim().replace(/^.*?(\d)/,'$1');if(!/號$/.test(no))no+='號';if(seen[st+no])return;seen[st+no]=1;if(!g[st]){g[st]=[];ord.push(st);}g[st].push(no);});if(!ord.length)return null;var L=[];ord.forEach(function(st){g[st].forEach(function(no){L.push({st:st,no:no});});});var ri=function(st){var i=names?names.indexOf(st):-1;return i<0?99:i;};L.sort(function(a,b){return ri(a.st)-ri(b.st)||(parseInt(a.no)||1e9)-(parseInt(b.no)||1e9)||(a.no<b.no?-1:a.no>b.no?1:0);});var f0=L[0];return {text:f0.st+f0.no+(L.length>1?'等'+L.length+'個':''),one:L.length===1&&names&&names.length===1&&f0.st===names[0]};}
var FEAT={fail:0,until:0};var OVS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
function ovFetch(q,ms,u){var c=new AbortController();setTimeout(function(){c.abort();},ms);return fetch(u||OVS[0],{method:'POST',signal:c.signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)}).then(function(r){if(!r.ok)throw new Error('o'+r.status);return r.json();});}
var RIVER_OK=/臺南運河|安平港|安平舊港|鹽水溪|竹溪|二仁溪|曾文溪|嘉南大圳|愛河|前鎮河|後勁溪|幸福川|高屏溪|鳳山溪|典寶溪/,DRAIN=/排水|大排|圳|溝|渠|涵/;
function fkind(t){t=t||{};var nm=String(t.name||'').replace(/台/g,'臺'),am=t.amenity,lu=t.landuse,le=t.leisure;var und=(t.tunnel&&t.tunnel!=='no')||t.covered==='yes'||(+t.layer||0)<0;
 if(am==='funeral_hall'||/殯儀館/.test(nm))return '殯儀館';if(am==='crematorium'||/火葬場/.test(nm))return '火葬場';if(/納骨塔|靈骨塔/.test(nm))return '納骨塔';if(lu==='cemetery'||am==='grave_yard')return '公墓';if(t.power==='substation'&&/變電所|變電站/.test(nm))return '變電所';if(lu==='landfill'||/掩埋場/.test(nm))return '掩埋場';if(am==='fuel')return '加油站';
 if(/國立|市立|縣立|^臺南市|^高雄市/.test(nm)){if(/美術館/.test(nm)&&(t.tourism==='museum'||t.tourism==='gallery'||am==='arts_centre'))return '美術館';if(t.tourism==='museum')return '博物館';if(am==='arts_centre')return '文化中心';}
 if(/^(school|university|college)$/.test(am)&&!/幼兒園|幼稚園|托嬰|補習|安親/.test(nm))return '學校';if(t.place==='square'||(t.highway==='pedestrian'&&t.area==='yes'))return '廣場';
 if((t.natural==='water'&&(!t.water||/river|canal|stream|ditch|oxbow|harbour|lagoon/.test(t.water)))||/^(river|canal|stream|riverbank)$/.test(t.waterway)){if(und)return '';var ok=RIVER_OK.test(nm)&&(/嘉南大圳/.test(nm)||!DRAIN.test(nm));if(ok)return '河川';if(DRAIN.test(nm)||t.waterway&&t.waterway!=='riverbank')return '';return '河川?';}
 if(/^(park|garden|playground|dog_park|common)$/.test(le)||/^(recreation_ground|village_green|grass|greenery)$/.test(lu)){if(/^(private|no|customers)$/.test(t.access)||/^(residential|private)$/.test(t['garden:type']||''))return '';if(!nm&&(le==='garden'||le==='common'||/^(grass|greenery|village_green)$/.test(lu)))return '';return '公園';}
 return '';}
function featParse(els){var F=[];els.forEach(function(e){var k=fkind(e.tags);if(!k)return;if(k==='河川?'){if(!e.geometry)return;var gm=gmeta([e.geometry.filter(function(g){return g;}).map(function(g){return [g.lon,g.lat];})]);if(gm.w<30)return;k='河川';}var rings=[],push=function(gs){var cur=[];(gs||[]).forEach(function(g){if(!g){if(cur.length>1)rings.push(cur);cur=[];return;}cur.push([g.lon,g.lat]);});if(cur.length>1)rings.push(cur);};if(e.geometry)push(e.geometry);if(e.members)e.members.forEach(function(m){if(m.role!=='inner')push(m.geometry);});if(rings.length)F.push({kind:k,rings:rings,line:!!(e.tags.waterway&&e.tags.waterway!=='riverbank'),meta:{n:e.tags.name||''}});});return F;}
function featQ(P){var A='(around:'+FEAT_R+','+P.cy+','+P.cx+')',k=mPerDeg(P.cy),b=(P.cy-160/k.y)+','+(P.cx-160/k.x)+','+(P.cy+160/k.y)+','+(P.cx+160/k.x);return '(way'+A+'[leisure~"^(park|garden|playground|dog_park|common)$"];rel'+A+'[leisure~"^(park|garden)$"];way'+A+'[landuse~"^(recreation_ground|village_green|grass|greenery)$"];way'+A+'[amenity~"^(school|university|college)$"];rel'+A+'[amenity~"^(school|university|college)$"];way'+A+'[place=square];way'+A+'[highway=pedestrian][area=yes];way'+A+'[natural=water];rel'+A+'[natural=water];way'+A+'[waterway~"^(river|canal|stream|riverbank)$"];);out geom('+b+');';}
var FEAT_R=100;
async function featsFor(P){if(ROAD.mode==='nom'||Date.now()<FEAT.until)return null;var pl=[[0,12000],[1,10000]];for(var t=0;t<pl.length;t++){try{var j=await ovFetch('[out:json][timeout:15];'+featQ(P),pl[t][1],OVS[pl[t][0]]);return featParse(j.elements);}catch(e){await sleep(1500);}}FEAT.until=Date.now()+120000;return null;}
function overpass(P,rad,u,ms){var A='(around:'+rad+','+P.cy+','+P.cx+')';var qq='[out:json][timeout:20];(way'+A+'[highway][name];way'+A+'[highway][ref];nwr'+A+'["addr:housenumber"];);out geom;'+featQ(P);
 return ovFetch(qq,ms||20000,u).then(function(j){var ws=j.elements.filter(function(e){return e.geometry&&e.tags&&e.tags.highway&&!(e.tags.highway==='pedestrian'&&e.tags.area==='yes');}).map(function(e){return {name:e.tags.name||e.tags.ref,geom:e.geometry.map(function(g){return [g.lon,g.lat];})};});ws.feats=featParse(j.elements);ws.addrs=[];j.elements.forEach(function(e){var t=e.tags||{};if(!t['addr:housenumber']||!(t['addr:street']||t['addr:place']))return;var lon=e.lon,lat=e.lat;if(lon==null&&e.geometry&&e.geometry.length){lon=0;lat=0;e.geometry.forEach(function(g){lon+=g.lon;lat+=g.lat;});lon/=e.geometry.length;lat/=e.geometry.length;}if(lon==null&&e.center){lon=e.center.lon;lat=e.center.lat;}if(lon!=null)ws.addrs.push({st:t['addr:street']||t['addr:place'],no:t['addr:housenumber'],lon:lon,lat:lat});});return ws;});}
async function nominatim(P){var k=mPerDeg(P.cy),pts=[[P.cx,P.cy]];var hw=P.lx?Math.abs(P.rx-P.lx)/2:0,hh=P.lx?Math.abs(P.ry-P.ly)/2:0,ox=hw+10/k.x,oy=hh+10/k.y;pts.push([P.cx,P.cy+oy],[P.cx,P.cy-oy],[P.cx+ox,P.cy],[P.cx-ox,P.cy]);
 var ways=[],seen={},okN=0;for(var i=0;i<pts.length;i++){if(i)await sleep(1100);try{var j=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&polygon_geojson=1&accept-language=zh-TW&lat='+pts[i][1]+'&lon='+pts[i][0]).then(function(r){return r.json();});
  if(j&&!j.error)okN++;if(j&&j.category==='highway'&&j.name&&j.geojson&&!seen[j.osm_id]){seen[j.osm_id]=1;var g=j.geojson.type==='LineString'?j.geojson.coordinates:j.geojson.type==='MultiLineString'?[].concat.apply([],j.geojson.coordinates):null;if(g)ways.push({name:j.name,geom:g});}}catch(e){}}
ways.failed=okN===0; try{await sleep(1100);var h=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=zh-TW&lat='+P.cy+'&lon='+P.cx).then(function(r){return r.json();});ways.addrs=[];if(h&&h.address&&h.address.house_number&&h.address.road)ways.addrs.push({st:h.address.road,no:h.address.house_number,lon:+h.lon,lat:+h.lat});}catch(e){}
 return ways;}
function lonlat2px(lon,lat,z){var n=Math.pow(2,z)*256;return {x:(lon+180)/360*n,y:(1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n};}
function loadTile(z,ty,tx){return fetch('https://landmaps.nlsc.gov.tw/S_Maps/wmts/DMAPS/default/EPSG:3857/'+z+'/'+ty+'/'+tx).then(function(r){if(!r.ok)throw new Error('tile '+r.status);return r.blob();}).then(function(b){return createImageBitmap(b);});}
async function parcelShape(P){
 var k=mPerDeg(P.cy),wm=Math.abs(P.rx-P.lx)*k.x,hm=Math.abs(P.ry-P.ly)*k.y,span=Math.max(wm,hm)+80;
 var z=20;while(z>16&&span/(156543.03*Math.cos(P.cy*Math.PI/180)/Math.pow(2,z))>900)z--;
 var mpp=156543.03*Math.cos(P.cy*Math.PI/180)/Math.pow(2,z);if(span/mpp>1100)return null;
 var c=lonlat2px(P.cx,P.cy,z),half=span/2/mpp;
 var x0=Math.floor((c.x-half)/256),x1=Math.floor((c.x+half)/256),y0=Math.floor((c.y-half)/256),y1=Math.floor((c.y+half)/256);
 var W=(x1-x0+1)*256,H=(y1-y0+1)*256,cv=document.createElement('canvas');cv.width=W;cv.height=H;var g=cv.getContext('2d');
 var jobs=[];for(var tx=x0;tx<=x1;tx++)for(var ty=y0;ty<=y1;ty++)(function(tx,ty){jobs.push(loadTile(z,ty,tx).then(function(bm){g.drawImage(bm,(tx-x0)*256,(ty-y0)*256);}));})(tx,ty);
 var cvL=document.createElement('canvas');cvL.width=W;cvL.height=H;var gL=cvL.getContext('2d');gL.imageSmoothingEnabled=false;var zz=Math.min(z,19),sc=Math.pow(2,z-zz),luiOK=0;for(var tx=Math.floor(x0/sc);tx<=Math.floor(x1/sc);tx++)for(var ty=Math.floor(y0/sc);ty<=Math.floor(y1/sc);ty++)(function(tx,ty){jobs.push(fetch('https://wmts.nlsc.gov.tw/wmts/LUIMAP/default/GoogleMapsCompatible/'+zz+'/'+ty+'/'+tx).then(function(r){if(!r.ok)throw 0;return r.blob();}).then(function(b){return createImageBitmap(b);}).then(function(b){gL.drawImage(b,(tx*sc-x0)*256,(ty*sc-y0)*256,256*sc,256*sc);luiOK++;}).catch(function(){}));})(tx,ty);
 await Promise.all(jobs);
 var rdM=null,pm=null,rdX=null,wtM=null,cmM=null;if(luiOK){var LD=gL.getImageData(0,0,W,H).data;rdM=new Uint8Array(W*H);pm=new Uint8Array(W*H);rdX=new Uint8Array(W*H);wtM=new Uint8Array(W*H);cmM=new Uint8Array(W*H);for(var iL=0;iL<W*H;iL++){if(LD[iL*4+3]<=200)continue;var lr=LD[iL*4],lg=LD[iL*4+1],lb=LD[iL*4+2];if((Math.abs(lr-231)<14&&Math.abs(lg-148)<14&&Math.abs(lb-163)<14)||(Math.abs(lr-255)<10&&Math.abs(lg-120)<14&&Math.abs(lb-120)<14)){rdM[iL]=1;rdX[iL]=1;}else if((Math.abs(lr-228)<14&&Math.abs(lg-62)<14&&Math.abs(lb-106)<14)||(Math.abs(lr-95)<14&&Math.abs(lg-76)<14&&Math.abs(lb-119)<14))rdX[iL]=1;else if(Math.abs(lr-147)<14&&lg>232&&Math.abs(lb-47)<16)pm[iL]=1;else if(Math.abs(lr-164)<12&&Math.abs(lg-215)<12&&Math.abs(lb-245)<12)wtM[iL]=1;else if(Math.abs(lr-130)<5&&Math.abs(lg-130)<5&&Math.abs(lb-130)<5)cmM[iL]=1;}}
 var d=g.getImageData(0,0,W,H).data,wall=new Uint8Array(W*H),i;for(i=0;i<W*H;i++)wall[i]=d[i*4+3]>40?1:0;
 var lab=new Int32Array(W*H),maxSpan=Math.max(8,Math.round(5/mpp)),id=0;
 for(var s0=0;s0<W*H;s0++){if(!wall[s0]||lab[s0])continue;id++;var st=[s0],comp=[s0];lab[s0]=id;var mnx=1e9,mxx=-1,mny=1e9,mxy=-1;
  while(st.length){var p=st.pop();var X=p%W,Y=(p-X)/W;if(X<mnx)mnx=X;if(X>mxx)mxx=X;if(Y<mny)mny=Y;if(Y>mxy)mxy=Y;
   for(var oy=-1;oy<=1;oy++)for(var ox=-1;ox<=1;ox++){var XX=X+ox,YY=Y+oy;if(XX<0||YY<0||XX>=W||YY>=H)continue;var t=YY*W+XX;if(wall[t]&&!lab[t]){lab[t]=id;st.push(t);comp.push(t);}}}
  if(mxx-mnx<maxSpan&&mxy-mny<maxSpan)for(var cI=0;cI<comp.length;cI++)wall[comp[cI]]=0;}
 var sx=Math.round(c.x-x0*256),sy=Math.round(c.y-y0*256),seed=-1;
 for(var r=0;r<30&&seed<0;r++)for(var dy=-r;dy<=r&&seed<0;dy++)for(var dx=-r;dx<=r&&seed<0;dx++){var X2=sx+dx,Y2=sy+dy;if(X2>=0&&Y2>=0&&X2<W&&Y2<H&&!wall[Y2*W+X2])seed=Y2*W+X2;}
 if(seed<0)return null;
 var bx0=lonlat2px(Math.min(P.lx,P.rx),Math.max(P.ly,P.ry),z),bx1=lonlat2px(Math.max(P.lx,P.rx),Math.min(P.ly,P.ry),z);
 var lim=Math.max(400,Math.max(1,(bx1.x-bx0.x)*(bx1.y-bx0.y))*1.3);
 var fill=new Uint8Array(W*H),stk=[seed],cnt=0,bad0=false;fill[seed]=1;
 while(stk.length){var p4=stk.pop();cnt++;if(cnt>lim){bad0=true;break;}var X4=p4%W,Y4=(p4-X4)/W;if(X4<=0||Y4<=0||X4>=W-1||Y4>=H-1){bad0=true;break;}
  var nb=[p4-1,p4+1,p4-W,p4+W];for(var q=0;q<4;q++){var t2=nb[q];if(!fill[t2]&&!wall[t2]){fill[t2]=1;stk.push(t2);}}}
 var boxPx=Math.max(1,(bx1.x-bx0.x)*(bx1.y-bx0.y));if(bad0||(cnt*mpp*mpp<5&&cnt<boxPx*0.25)||cnt<boxPx*0.08){fill=new Uint8Array(W*H);cnt=0;var seen=new Uint8Array(W*H),ux0=1e9,ux1=-1,uy0=1e9,uy1=-1,MG=6,X0=Math.floor(bx0.x-x0*256)-MG,X1=Math.ceil(bx1.x-x0*256)+MG,Y0=Math.floor(bx0.y-y0*256)-MG,Y1=Math.ceil(bx1.y-y0*256)+MG;for(var yy=Math.max(1,Y0+MG);yy<=Math.min(H-2,Y1-MG);yy++)for(var xx=Math.max(1,X0+MG);xx<=Math.min(W-2,X1-MG);xx++){var s1=yy*W+xx;if(wall[s1]||seen[s1])continue;var reg=[s1],st2=[s1],ok2=true;seen[s1]=1;while(st2.length){var p5=st2.pop(),X9=p5%W,Y9=(p5-X9)/W;if(X9<X0||X9>X1||Y9<Y0||Y9>Y1||X9<=0||Y9<=0||X9>=W-1||Y9>=H-1){ok2=false;if(X9<=0||Y9<=0||X9>=W-1||Y9>=H-1)continue;}var nb5=[p5-1,p5+1,p5-W,p5+W];for(var q5=0;q5<4;q5++){var t5=nb5[q5];if(!seen[t5]&&!wall[t5]){seen[t5]=1;st2.push(t5);if(ok2)reg.push(t5);}}}if(ok2)for(var r5=0;r5<reg.length;r5++){var X6b=reg[r5]%W,Y6b=(reg[r5]-X6b)/W;if(X6b<ux0)ux0=X6b;if(X6b>ux1)ux1=X6b;if(Y6b<uy0)uy0=Y6b;if(Y6b>uy1)uy1=Y6b;fill[reg[r5]]=1;cnt++;}}var bw=X1-X0-2*MG,bh=Y1-Y0-2*MG;if(cnt<boxPx*0.03||ux1-ux0<0.7*bw||uy1-uy0<0.7*bh)return null;}var core=fill.slice();
 for(var it=0;it<4;it++){var add=[];for(var p2=W;p2<W*H-W;p2++)if(!fill[p2]&&wall[p2]&&(fill[p2-1]||fill[p2+1]||fill[p2-W]||fill[p2+W]))add.push(p2);for(var aI=0;aI<add.length;aI++)fill[add[aI]]=1;}
 var comp=new Int32Array(W*H),cid=0,cst=[0];for(var q0=0;q0<W*H;q0++){if(wall[q0]||comp[q0])continue;cid++;var cs=[q0];comp[q0]=cid;var sn=0,sx0=1e9,sx1=-1,sy0=1e9,sy1=-1;while(cs.length){var qq=cs.pop(),qx=qq%W,qy=(qq-qx)/W;sn++;if(qx<sx0)sx0=qx;if(qx>sx1)sx1=qx;if(qy<sy0)sy0=qy;if(qy>sy1)sy1=qy;if(qx>0&&!wall[qq-1]&&!comp[qq-1]){comp[qq-1]=cid;cs.push(qq-1);}if(qx<W-1&&!wall[qq+1]&&!comp[qq+1]){comp[qq+1]=cid;cs.push(qq+1);}if(qq>=W&&!wall[qq-W]&&!comp[qq-W]){comp[qq-W]=cid;cs.push(qq-W);}if(qq<W*H-W&&!wall[qq+W]&&!comp[qq+W]){comp[qq+W]=cid;cs.push(qq+W);}}cst[cid]=(Math.pow(sx1-sx0+1,2)+Math.pow(sy1-sy0+1,2))/sn;}
 var edge=[];for(var p3=W;p3<W*H-W;p3++)if(fill[p3]&&(!fill[p3-1]||!fill[p3+1]||!fill[p3-W]||!fill[p3+W]))edge.push(p3);
 var toPix=function(lon,lat){var q2=lonlat2px(lon,lat,z);return {x:q2.x-x0*256,y:q2.y-y0*256};};
 var wallNear=function(x,y){var R5=Math.round(1.2/mpp),X=Math.round(x),Y=Math.round(y);for(var oy=-R5;oy<=R5;oy++)for(var ox=-R5;ox<=R5;ox++){if(ox*ox+oy*oy>R5*R5)continue;var xx=X+ox,yy=Y+oy;if(xx>=0&&yy>=0&&xx<W&&yy<H&&wall[yy*W+xx]&&!fill[yy*W+xx])return true;}return false;};
 var dP=function(pp,a,b){var dx2=b.x-a.x,dy2=b.y-a.y,L=dx2*dx2+dy2*dy2,tt=L?((pp.x-a.x)*dx2+(pp.y-a.y)*dy2)/L:0;tt=Math.max(0,Math.min(1,tt));return {d:Math.hypot(a.x+tt*dx2-pp.x,a.y+tt*dy2-pp.y),x:a.x+tt*dx2,y:a.y+tt*dy2};};
 var sliver=function(ex,ey,tx,ty){var L=Math.hypot(tx-ex,ty-ey);if(!L)return 0;var ux=(tx-ex)/L,uy=(ty-ey)/L,Lm=Math.max(L,3/mpp),pre=0,sw=false;for(var s=1;s<=Lm;s++){var X=Math.round(ex+ux*s),Y=Math.round(ey+uy*s);if(X<0||Y<0||X>=W||Y>=H)return 0;var ii=Y*W+X;if(fill[ii]&&pre===0)continue;if(wall[ii]){if(pre>0){sw=true;break;}continue;}pre++;}return sw&&pre*mpp>=0.4&&pre*mpp<=6?pre*mpp:0;};
 var check=function(geom){var pts=geom.map(function(g2){return toPix(g2[0],g2[1]);}),best=Infinity,cand=[];
  for(var e=0;e<edge.length;e++){var ex=edge[e]%W,ey=(edge[e]-ex)/W,m=null;for(var j=1;j<pts.length;j++){var rr=dP({x:ex,y:ey},pts[j-1],pts[j]);if(!m||rr.d<m.d)m=rr;}if(m){cand.push([ex,ey,m]);if(m.d<best)best=m.d;}}
  var minCross=99,ext=false;cand.forEach(function(cc){if(cc[2].d>best+2/mpp)return;var ex=cc[0],ey=cc[1],tx=cc[2].x,ty=cc[2].y,L=Math.hypot(tx-ex,ty-ey),n=Math.ceil(Math.max(0,L-2.5/mpp)),inW=false,cr=0,lastC=0,firstC=0,runF=0,runRd=0,oc=0,rc=0,rx=0;
   for(var s=1;s<=n;s++){var X5=Math.round(ex+(tx-ex)*s/L),Y5=Math.round(ey+(ty-ey)*s/L);if(X5<0||Y5<0||X5>=W||Y5>=H)break;var idx=Y5*W+X5;if(fill[idx]){inW=false;continue;}oc++;if(rdM&&rdM[idx])rc++;if(rdX&&rdX[idx])rx++;if(wall[idx]){if(!inW){cr++;inW=true;}}else{inW=false;lastC=comp[idx];if(cr===0){if(!firstC)firstC=lastC;if(lastC===firstC){runF++;if(rdM&&(rdM[idx]||rdX[idx]))runRd++;}}}}
   if(cr===1&&firstC&&lastC!==firstC&&runF*mpp<=4.5&&cst[firstC]>=4)cr=0;
   if(cr===0&&lastC){var TX=Math.round(tx),TY=Math.round(ty),okC=false,R3=Math.max(3,Math.round(1/mpp));for(var oy2=-R3;oy2<=R3&&!okC;oy2++)for(var ox2=-R3;ox2<=R3&&!okC;ox2++){var XX2=TX+ox2,YY2=TY+oy2;if(XX2>=0&&YY2>=0&&XX2<W&&YY2<H&&comp[YY2*W+XX2]===lastC)okC=true;}if(!okC&&cst[lastC]<6)cr=1;}
   if(cr>0&&rdM&&oc>=Math.max(3,1/mpp)&&rc>=0.85*oc)cr=0;
   if(cr===0&&rdM&&oc*mpp>2&&rx<0.5*oc&&wallNear(tx,ty))cr=1;
   if(cr===0&&pts.length>1&&((rdM&&oc>=3&&rc>=0.85*oc)||(lastC&&cst[lastC]>=6&&(lastC===firstC||runF*mpp<=4.5)))){var e0=pts[0],e1=pts[pts.length-1],isA=Math.hypot(tx-e0.x,ty-e0.y)<1.5/mpp,isB=Math.hypot(tx-e1.x,ty-e1.y)<1.5/mpp;if(isA||isB){var sa=isA?pts[1]:pts[pts.length-2],sb=isA?e0:e1,sx2=sb.x-sa.x,sy2=sb.y-sa.y,sl=Math.hypot(sx2,sy2),rl=Math.hypot(tx-ex,ty-ey);if(sl&&rl&&(sx2*(ex-tx)+sy2*(ey-ty))/(sl*rl)>=0.7)ext=true;}}
   if(cr<minCross)minCross=cr;});
  return {d:best*mpp,cross:minCross,ext:ext};};
 var inside=function(geom){var pts=geom.map(function(g2){return toPix(g2[0],g2[1]);}),len=0;for(var j=1;j<pts.length;j++){var a=pts[j-1],b=pts[j],L=Math.hypot(b.x-a.x,b.y-a.y),n=Math.ceil(L);for(var s=0;s<n;s++){var X6=Math.round(a.x+(b.x-a.x)*s/n),Y6=Math.round(a.y+(b.y-a.y)*s/n);if(X6>=0&&Y6>=0&&X6<W&&Y6<H&&core[Y6*W+X6])len+=L/n;}}return len*mpp;};
 var perim=0;for(var p7=W;p7<W*H-W;p7++)if(core[p7]&&(!core[p7-1]||!core[p7+1]||!core[p7-W]||!core[p7+W]))perim++;
 var front=function(geom,dmin){var pts=geom.map(function(g2){return toPix(g2[0],g2[1]);}),lim2=dmin/mpp+3/mpp,last=pts.length-1,binF={},cum=[0];if(last<1)return 0;for(var j0=1;j0<pts.length;j0++)cum.push(cum[j0-1]+Math.hypot(pts[j0].x-pts[j0-1].x,pts[j0].y-pts[j0-1].y));for(var e2=0;e2<edge.length;e2++){var ex=edge[e2]%W,ey=(edge[e2]-ex)/W,bd=Infinity,bi=-1,bt=0;for(var j=1;j<pts.length;j++){var a=pts[j-1],b=pts[j],dx3=b.x-a.x,dy3=b.y-a.y,L2=dx3*dx3+dy3*dy3,tt=L2?((ex-a.x)*dx3+(ey-a.y)*dy3)/L2:0;tt=Math.max(0,Math.min(1,tt));var dd=Math.hypot(a.x+tt*dx3-ex,a.y+tt*dy3-ey);if(dd<bd){bd=dd;bi=j;bt=tt;}}if(bd>lim2)continue;if((bi===1&&bt<=0)||(bi===last&&bt>=1))continue;binF[Math.round(cum[bi-1]+bt*(cum[bi]-cum[bi-1]))]=1;}return Object.keys(binF).length*mpp;};
 var frontOK=function(geom,dmin,wantW){var pts=geom.map(function(g2){return toPix(g2[0],g2[1]);}),lim2=dmin/mpp+3/mpp,last=pts.length-1,binF={},binS={},slW=[],cum=[0];if(last<1)return 0;for(var j0=1;j0<pts.length;j0++)cum.push(cum[j0-1]+Math.hypot(pts[j0].x-pts[j0-1].x,pts[j0].y-pts[j0-1].y));
  for(var e2=0;e2<edge.length;e2++){var ex=edge[e2]%W,ey=(edge[e2]-ex)/W,bd=Infinity,bi=-1,bt=0,mx=0,my=0;for(var j=1;j<pts.length;j++){var a=pts[j-1],b=pts[j],dx3=b.x-a.x,dy3=b.y-a.y,L2=dx3*dx3+dy3*dy3,tt=L2?((ex-a.x)*dx3+(ey-a.y)*dy3)/L2:0;tt=Math.max(0,Math.min(1,tt));var px=a.x+tt*dx3,py=a.y+tt*dy3,dd=Math.hypot(px-ex,py-ey);if(dd<bd){bd=dd;bi=j;bt=tt;mx=px;my=py;}}if(bd>lim2)continue;if((bi===1&&bt<=0)||(bi===last&&bt>=1))continue;
   var L=bd,n=Math.ceil(Math.max(0,L-2.5/mpp)),inW=false,cr=0,lastC=0,firstC=0,runF=0,runRd=0,oc=0,rc=0,rx=0;for(var s=1;s<=n;s++){var X5=Math.round(ex+(mx-ex)*s/L),Y5=Math.round(ey+(my-ey)*s/L);if(X5<0||Y5<0||X5>=W||Y5>=H)break;var idx=Y5*W+X5;if(fill[idx]){inW=false;continue;}oc++;if(rdM&&rdM[idx])rc++;if(rdX&&rdX[idx])rx++;if(wall[idx]){if(!inW){cr++;inW=true;}}else{inW=false;lastC=comp[idx];if(cr===0){if(!firstC)firstC=lastC;if(lastC===firstC){runF++;if(rdM&&(rdM[idx]||rdX[idx]))runRd++;}}}}
   if(cr===1&&firstC&&lastC!==firstC&&runF*mpp<=4.5&&cst[firstC]>=4)cr=0;if(cr>0&&rdM&&oc>=Math.max(3,1/mpp)&&rc>=0.85*oc)cr=0;if(cr===0&&rdM&&oc*mpp>2&&rx<0.5*oc&&wallNear(mx,my))cr=1;if(cr!==0)continue;var bk0=Math.round(cum[bi-1]+bt*(cum[bi]-cum[bi-1])),sw0=sliver(ex,ey,mx,my);if(sw0){binS[bk0]=1;slW.push([bk0*mpp,sw0]);}
   binF[Math.round(cum[bi-1]+bt*(cum[bi]-cum[bi-1]))]=1;}var nF=Object.keys(binF).length,nSb=Object.keys(binS).length;if(slW.length>=20&&slW.filter(function(q){return q[1]>=0.6;}).length>=0.5*slW.length){var n=slW.length,mx0=0,my0=0;slW.forEach(function(q){mx0+=q[0];my0+=q[1];});mx0/=n;my0/=n;var sxy=0,sxx=0,syy=0,pmin=1e9,pmax=-1e9,wmin=1e9,wmax=-1e9;slW.forEach(function(q){sxy+=(q[0]-mx0)*(q[1]-my0);sxx+=(q[0]-mx0)*(q[0]-mx0);syy+=(q[1]-my0)*(q[1]-my0);pmin=Math.min(pmin,q[0]);pmax=Math.max(pmax,q[0]);wmin=Math.min(wmin,q[1]);wmax=Math.max(wmax,q[1]);});var rr=sxx&&syy?sxy/Math.sqrt(sxx*syy):0;if(Math.abs(rr)>=0.8&&wmax-wmin>=2&&pmax-pmin>=20)return wantW?-1:0;}return nF*mpp;};
 var has=function(lon,lat,R){var q3=toPix(lon,lat),R4=R===undefined?Math.round(1/mpp):Math.round(R/mpp),X7=Math.round(q3.x),Y7=Math.round(q3.y);for(var oy3=-R4;oy3<=R4;oy3++)for(var ox3=-R4;ox3<=R4;ox3++){var XX3=X7+ox3,YY3=Y7+oy3;if(XX3>=0&&YY3>=0&&XX3<W&&YY3<H&&core[YY3*W+XX3])return true;}return false;};
 var cP=toPix(P.cx,P.cy),pip=function(p,rg){var In=false;for(var i=0,j=rg.length-1;i<rg.length;j=i++){var a=rg[i],b=rg[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)In=!In;}return In;};
 var pxPoly=function(rg){return rg.map(function(g){return toPix(g[0],g[1]);});};
 var ptRing=function(g){var kk=mPerDeg(g[1]),dx=4/kk.x,dy=4/kk.y;return [[g[0]-dx,g[1]-dy],[g[0]+dx,g[1]-dy],[g[0]+dx,g[1]+dy],[g[0]-dx,g[1]+dy],[g[0]-dx,g[1]-dy]];};
 var roadish=function(rings){if(!rdM)return false;var p=pxPoly(rings[0]);if(p.length<4)return false;var bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;p.forEach(function(q){bx0=Math.min(bx0,q.x);bx1=Math.max(bx1,q.x);by0=Math.min(by0,q.y);by1=Math.max(by1,q.y);});var st=Math.max(1,Math.round(1.5/mpp)),n=0,r=0;for(var yy=Math.ceil(by0);yy<=by1;yy+=st)for(var xx=Math.ceil(bx0);xx<=bx1;xx+=st){if(xx<0||yy<0||xx>=W||yy>=H||!pip({x:xx,y:yy},p))continue;n++;var ii=yy*W+xx;if(rdM[ii]||rdX[ii])r++;}return n>=5&&r>=0.5*n;};
 var openPx=function(ii){if(rdM[ii]||rdX[ii]||pm[ii]||wtM[ii])return true;if(typeof LD!=='undefined'&&LD){var r=LD[ii*4],g=LD[ii*4+1],b=LD[ii*4+2];return g>r+15&&g>=b;}return false;};
 var direct=function(ex,ey,mx,my,river){var L=Math.hypot(mx-ex,my-ey),cr=0,inW=false,len=0,rd=0,op=0,bad=false,nRun=0,mn=Math.round(2/mpp);for(var s=1;s<L;s++){var X=Math.round(ex+(mx-ex)*s/L),Y=Math.round(ey+(my-ey)*s/L);if(X<0||Y<0||X>=W||Y>=H)return !!river&&!bad;var ii=Y*W+X;if(fill[ii]){inW=false;continue;}if(wall[ii]){if(!inW){cr++;inW=true;if(len>0)nRun++;if(len>=mn&&(river?op<0.4*len:nRun>1?rd<0.5*len:rd<0.2*len))bad=true;len=0;rd=0;op=0;}}else{inW=false;len++;if(rdM&&(rdM[ii]||rdX[ii]))rd++;if(rdM&&openPx(ii))op++;}}return rdM?!bad:cr<=1;};
 var pmFrac=function(rings){if(!pm)return false;var p=pxPoly(rings[0]);if(p.length<4)return false;var bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;p.forEach(function(q){bx0=Math.min(bx0,q.x);bx1=Math.max(bx1,q.x);by0=Math.min(by0,q.y);by1=Math.max(by1,q.y);});var st=Math.max(1,Math.round(1.5/mpp)),n=0,r=0;for(var yy=Math.ceil(by0);yy<=by1;yy+=st)for(var xx=Math.ceil(bx0);xx<=bx1;xx+=st){if(xx<0||yy<0||xx>=W||yy>=H||!pip({x:xx,y:yy},p))continue;n++;if(pm[yy*W+xx])r++;}return n>=5&&r>=0.5*n;};
 var lotOf=function(f){if(!/^(古蹟|博物館|美術館|文化中心|殯儀館|火葬場|納骨塔|變電所|焚化廠|加油站)$/.test(f.kind))return null;var cx=0,cy=0,n=0;(f.pt?[f.rings[0]]:[f.rings[0]]).forEach(function(rg){rg.forEach(function(g){cx+=g[0];cy+=g[1];n++;});});if(!n)return null;var q=toPix(cx/n,cy/n),X=Math.round(q.x),Y=Math.round(q.y);if(X<1||Y<1||X>=W-1||Y>=H-1)return null;var c0=0;for(var r=0;r<6&&!c0;r++)for(var dy=-r;dy<=r&&!c0;dy++)for(var dx=-r;dx<=r&&!c0;dx++){var ii=(Y+dy)*W+X+dx;if(!wall[ii]&&comp[ii])c0=comp[ii];}if(!c0||cst[c0]>=6)return null;var out=[],cnt=0;for(var i=W;i<W*H-W;i++){if(comp[i]!==c0)continue;if(++cnt>200000)return null;if(fill[i])return null;if(wall[i-1]||wall[i+1]||wall[i-W]||wall[i+W]){if(i%2===0){var xx=i%W,yy=(i-xx)/W;out.push([{x:xx,y:yy},{x:xx+0.5,y:yy}]);}}}return out.length?out:null;};
 var faces=function(feats,roads){var R=[];roads.forEach(function(r){r.geoms.forEach(function(gm){var p=gm.map(function(g){return toPix(g[0],g[1]);});for(var j=1;j<p.length;j++)R.push({a:p[j-1],b:p[j],d:r.d});});});if(!R.length)return [];var out={},need=Math.min(8,0.4*Math.max(wm,hm));
  feats.forEach(function(f){if(f.kind==='綠地'){if(f.line||f.pt||!pmFrac(f.rings))return;var k5=parkClass({kind:'公園',rings:f.rings,meta:f.meta});if(!k5)return;f={kind:k5,rings:f.rings,line:false,pt:false,meta:f.meta};}if(out[f.kind])return;var rings=f.pt?[ptRing(f.rings[0][0])]:f.rings,strict=f.kind!=='河川',segs=[],inside0=false,lotSegs=lotOf(f);if(!f.line&&!f.pt&&/^(公園|綠帶|廣場)$/.test(f.kind)&&roadish(rings))return;rings.forEach(function(rg){var p=pxPoly(rg);if(!f.line&&p.length>3&&Math.hypot(p[0].x-p[p.length-1].x,p[0].y-p[p.length-1].y)<1&&pip(cP,p))inside0=true;for(var j=1;j<p.length;j++)segs.push([p[j-1],p[j]]);});if(inside0||!segs.length)return;var tries=[[segs,0.26]];if(lotSegs)tries.push([lotSegs,0.5]);tries.some(function(TR){segs=TR[0];var csMax=TR[1];
   var n2=0,bins={};for(var e=0;e<edge.length;e++){var ex=edge[e]%W,ey=(edge[e]-ex)/W,m=null;for(var k2=0;k2<segs.length;k2++){var rr=dP({x:ex,y:ey},segs[k2][0],segs[k2][1]);if(!m||rr.d<m.d)m=rr;}var D=m.d*mpp;if(D>45||D<1)continue;var bad=false;for(var s2=1;s2<=4&&!bad;s2++){var X8=Math.round(ex+(m.x-ex)*s2/5),Y8=Math.round(ey+(m.y-ey)*s2/5);if(X8>=0&&Y8>=0&&X8<W&&Y8<H&&core[Y8*W+X8])bad=true;}if(bad)continue;if(!direct(ex,ey,m.x,m.y,!strict))continue;
    for(var q4=0;q4<R.length;q4++)if((!strict||D<=2*R[q4].d+8)&&segIntersect({x:ex,y:ey},m,R[q4].a,R[q4].b)){var vx=m.x-ex,vy=m.y-ey,sx4=R[q4].b.x-R[q4].a.x,sy4=R[q4].b.y-R[q4].a.y,cs=Math.abs(vx*sx4+vy*sy4)/((Math.hypot(vx,vy)*Math.hypot(sx4,sy4))||1);if(cs<=csMax){var L4=Math.hypot(sx4,sy4)||1,t4=((ex-R[q4].a.x)*sx4+(ey-R[q4].a.y)*sy4)/L4;var bk=q4+':'+Math.round(t4);if(!bins[bk]){bins[bk]=1;n2++;}break;}}}
   if(n2*mpp>=need){out[f.kind]=1;return true;}return false;});});
  return FACE_K.filter(function(k){return out[k];});};
 var nearD=function(f){var best=1e9,kk=mPerDeg(P.cy),pts=[];(f.pt?[f.rings[0]]:f.rings).forEach(function(rg){for(var j=0;j<rg.length;j++){pts.push(rg[j]);if(j){var a=rg[j-1],b=rg[j],L=Math.hypot((b[0]-a[0])*kk.x,(b[1]-a[1])*kk.y),n=Math.floor(L/4);for(var t=1;t<n;t++)pts.push([a[0]+(b[0]-a[0])*t/n,a[1]+(b[1]-a[1])*t/n]);}}});if(!f.pt&&!f.line&&f.rings[0].length>3){var p=pxPoly(f.rings[0]);if(pip(cP,p))return 0;}pts.forEach(function(g){var d=dist(g[0],g[1]);if(d<best)best=d;});return best;};
 var inParks=function(X,Y,PP){for(var i=0;i<PP.length;i++)if(pip({x:X,y:Y},PP[i]))return true;return false;};
 var parkPx=function(feats){var PP=[];(feats||[]).forEach(function(f){if(f.kind==='公園'&&!f.line&&!f.pt)f.rings.forEach(function(rg){if(rg.length>3)PP.push(pxPoly(rg));});});return PP;};
 var parkFace=async function(roads,feats,useCm){var PP=useCm?null:parkFx(feats);var MK=useCm?cmM:pm;if(!MK)return false;var pmS=pm;pm=MK;try{return parkFace0(roads,PP);}finally{pm=pmS;}};
 var parkFx=parkPx;
 var parkFace0=function(roads,PP){if(!pm)return false;var any=0,inP=0,cc=0;for(var i5=0;i5<W*H;i5++){if(pm[i5])any++;if(core[i5]){cc++;if(pm[i5])inP++;}}if(!any||inP>0.5*cc)return false;
  var R=[];roads.forEach(function(r){r.geoms.forEach(function(gm){var p=gm.map(function(g){return toPix(g[0],g[1]);});for(var j=1;j<p.length;j++)R.push({a:p[j-1],b:p[j],d:r.d});});});if(!R.length)return false;
  var n2=0,nS=0,need=Math.min(4,0.4*Math.max(wm,hm));for(var e=0;e<edge.length;e++){var ex=edge[e]%W,ey=(edge[e]-ex)/W,m=null,rd=0;for(var q=0;q<R.length;q++){var rr=dP({x:ex,y:ey},R[q].a,R[q].b);if(!m||rr.d<m.d){m=rr;rd=R[q].d;}}if(!m||m.d<0.5||m.d*mpp>FRONT_MAX)continue;var ux=(m.x-ex)/m.d,uy=(m.y-ey)/m.d,mx=(2*rd+8)/mpp,hitP=false,hitS=false,seenR=false,aft=0,gp=Math.round(3/mpp);for(var s5=1;s5<=mx&&!hitP;s5++){var X5=Math.round(ex+ux*s5),Y5=Math.round(ey+uy*s5);if(X5<0||Y5<0||X5>=W||Y5>=H)break;var i6=Y5*W+X5;if(core[i6])break;if(rdM&&(rdM[i6]||rdX[i6])){seenR=true;aft=0;continue;}if(pm[i6]){if(seenR&&(!PP||(PP.length&&inParks(X5,Y5,PP))))hitP=true;else if(seenR){var run=0,s6=s5,endR=false;for(;s6<=s5+Math.round(25/mpp);s6++){var X6=Math.round(ex+ux*s6),Y6=Math.round(ey+uy*s6);if(X6<0||Y6<0||X6>=W||Y6>=H){run=1e9;break;}var i7=Y6*W+X6;if(pm[i7])run++;else{endR=!!(rdM[i7]||rdX[i7]);break;}}var nearW=false;for(var s8=s6;s8<=s6+Math.round(30/mpp)&&!nearW;s8++){var X8b=Math.round(ex+ux*s8),Y8b=Math.round(ey+uy*s8);if(X8b<0||Y8b<0||X8b>=W||Y8b>=H)break;if(wtM[Y8b*W+X8b])nearW=true;}if(window.__ydStrip&&run*mpp>=2&&run*mpp<30&&!(endR&&run*mpp<10)&&!nearW)hitS=true;}break;}if(seenR&&++aft>gp)break;}if(hitP)n2++;if(hitS)nS++;}
  return n2*mpp>=need?true:(nS*mpp>=need?'綠帶':false);};
 var dist=function(lon,lat){var q6=toPix(lon,lat),m=1e9;for(var e6=0;e6<edge.length;e6++){var ex=edge[e6]%W,ey=(edge[e6]-ex)/W,dd=Math.hypot(ex-q6.x,ey-q6.y);if(dd<m)m=dd;}return m*mpp;};
 var roadAdj=function(feats){var PP=parkPx(feats);var out={len:0,park:false,parkLen:0};if(!rdM)return out;var R=Math.round(3/mpp),hits=[],sx=0,sy=0;for(var e=0;e<edge.length;e++){var ex=edge[e]%W,ey=(edge[e]-ex)/W,bd=1e9,bx=0,by=0;for(var oy=-R;oy<=R;oy++)for(var ox=-R;ox<=R;ox++){var dd=ox*ox+oy*oy;if(dd>R*R||dd>=bd)continue;var xx=ex+ox,yy=ey+oy;if(xx<0||yy<0||xx>=W||yy>=H)continue;var ii=yy*W+xx;if(rdM[ii]&&!core[ii]){bd=dd;bx=xx;by=yy;}}if(bd>=1e9)continue;var L=Math.sqrt(bd),okR=true,inW=0;for(var s=1;s<L;s++){var X=Math.round(ex+(bx-ex)*s/L),Y=Math.round(ey+(by-ey)*s/L),i2=Y*W+X;if(core[i2]){okR=false;break;}if(wall[i2]&&!fill[i2])inW++;}if(!okR||inW>2)continue;hits.push([ex,ey]);if(L>0){sx+=(bx-ex)/L;sy+=(by-ey)/L;}}
  out.len=hits.length*mpp;var sl=Math.hypot(sx,sy);if(!pm||!sl||!PP.length)return out;var ux=sx/sl,uy=sy/sl,mx=Math.round(45/mpp),gap=Math.round(3/mpp),parkE=0;
  hits.forEach(function(h){var seenR=false,after=0,hp=false;for(var s3=1;s3<=mx;s3++){var X3=Math.round(h[0]+ux*s3),Y3=Math.round(h[1]+uy*s3);if(X3<0||Y3<0||X3>=W||Y3>=H)break;var i3=Y3*W+X3;if(core[i3])break;if(rdM[i3]||(rdX&&rdX[i3])){seenR=true;after=0;continue;}if(pm[i3]){hp=seenR&&inParks(X3,Y3,PP);break;}if(seenR){if(++after>gap)break;}}if(hp)parkE++;});
  out.parkLen=parkE*mpp;out.park=out.parkLen>=Math.min(4,0.4*Math.max(wm,hm));return out;};
 var rfN=0,rfR=0,rfW=0;if(rdM)for(var iR=0;iR<W*H;iR++)if(core[iR]){rfN++;if(rdM[iR])rfR++;if(wtM[iR])rfW++;}
 return {dbg:window.__ydDBG&&{direct:direct,toPix:toPix,edge:edge,W:W,H:H,mpp:mpp,wall:wall,fill:fill,rdM:rdM,rdX:rdX,comp:comp,pm:pm,LD:typeof LD!=='undefined'?LD:null,lotOf:lotOf,cst:cst,faces:faces},roadAdj:roadAdj,nearD:nearD,waterFrac:rdM&&rfN?rfW/rfN:0,roadFrac:rdM&&rfN?rfR/rfN:null,check:check,inside:inside,front:front,frontOK:frontOK,has:has,faces:faces,parkFace:parkFace,dist:dist,area:cnt*mpp*mpp,dim:Math.max(wm,hm),meanW:perim?2*cnt/perim*mpp:99};}
var FRONT_MAX=20;
function clipGeoms(geoms,acc,P){var o={lon:P.cx,lat:P.cy},k=mPerDeg(P.cy),A=[];acc.forEach(function(a){a.lines.forEach(function(pts){A.push({pts:pts,r:Math.max(a.d+1,6)});});});
 var near=function(p){for(var i=0;i<A.length;i++){var pts=A[i].pts;for(var j=1;j<pts.length;j++)if(segDist(p,pts[j-1],pts[j])<A[i].r)return true;}return false;};
 var out=[];geoms.forEach(function(g){var cur=[];for(var i=1;i<g.length;i++){var a=g[i-1],b=g[i],pa=toXY(a[0],a[1],o),pb=toXY(b[0],b[1],o),n=Math.max(1,Math.ceil(Math.hypot(pb.x-pa.x,pb.y-pa.y)));for(var s=(i===1?0:1);s<=n;s++){var x=pa.x+(pb.x-pa.x)*s/n,y=pa.y+(pb.y-pa.y)*s/n;if(near({x:x,y:y})){if(cur.length>1)out.push(cur);cur=[];}else cur.push([o.lon+x/k.x,o.lat+y/k.y]);}}if(cur.length>1)out.push(cur);});return out;}
var FACE_K=['公園','綠帶','廣場','學校','古蹟','博物館','美術館','文化中心','河川','殯儀館','火葬場','公墓','納骨塔','變電所','焚化廠','掩埋場','加油站'];
var NUIS_K=['殯儀館','火葬場','公墓','納骨塔','變電所','焚化廠','掩埋場','加油站'];
function gmeta(rings){var A=0,Pm=0;rings.forEach(function(r){if(r.length<3)return;var k=mPerDeg(r[0][1]),a=0;for(var i=0;i<r.length;i++){var p=r[i===0?r.length-1:i-1],q=r[i],x1=p[0]*k.x,y1=p[1]*k.y,x2=q[0]*k.x,y2=q[1]*k.y;a+=x1*y2-x2*y1;Pm+=Math.hypot(x2-x1,y2-y1);}A+=Math.abs(a)/2;});var h=Pm/2,d=h*h-4*A;return {a:A,w:d>0?(h-Math.sqrt(d))/2:h/2};}
function parkClass(f){if(f.kind!=='公園'||f.line||f.pt)return f.kind;var m=f.meta&&f.meta.a!=null?f.meta:gmeta(f.rings),nm=(f.meta&&f.meta.n)||'';if(m.a>=2000&&m.w>=20)return '公園';if(/公園/.test(nm)&&m.a>=1000)return '公園';if(m.w<20&&m.a>=1000)return '綠帶';return '';}
function reclassFeats(F){var pipLL=function(p,rg){var In=false;for(var i=0,j=rg.length-1;i<rg.length;j=i++){var a=rg[i],b=rg[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])In=!In;}return In;};
 F=F.map(function(f){if(f.kind!=='公園')return f;var k=parkClass(f);return {kind:k,rings:f.rings,line:f.line,pt:f.pt,meta:f.meta};}).filter(function(f){return f.kind;});
 var box=F.filter(function(f){return /^(學校|古蹟|博物館|美術館|文化中心)$/.test(f.kind)&&!f.line&&!f.pt;}),hp=F.filter(function(f){return f.kind==='古蹟'&&f.pt;});if(!box.length&&!hp.length)return F;
 return F.map(function(f){if(!/^(公園|綠帶|廣場|綠地)$/.test(f.kind)||f.line||f.pt)return f;var r=f.rings[0],cx=0,cy=0;r.forEach(function(p){cx+=p[0];cy+=p[1];});cx/=r.length;cy/=r.length;var hit=null;box.some(function(s){if(s.rings.some(function(rg){return rg.length>3&&pipLL([cx,cy],rg);})){hit=s.kind;return true;}return false;});if(!hit&&hp.some(function(h){return f.rings.some(function(rg){return rg.length>3&&pipLL(h.rings[0][0],rg);});}))hit='古蹟';if(!hit&&box.some(function(b){if(b.kind!=='古蹟')return false;var r2=b.rings[0],bx=0,by=0;r2.forEach(function(p){bx+=p[0];by+=p[1];});bx/=r2.length;by/=r2.length;return f.rings.some(function(rg){return rg.length>3&&pipLL([bx,by],rg);});}))hit='古蹟';return hit?{kind:hit,rings:f.rings,line:f.line,pt:f.pt,meta:f.meta}:f;});}
var LOC={base:'https://yiding-realty.github.io/osm-tw/',cache:{},ok:null,fail:0,cb:{}};
function osmLoad(key,ms){return new Promise(function(res){var done=false,s=document.createElement('script');if(!window.__OSMT)window.__OSMT=function(k,d){var f=LOC.cb[k];if(f){delete LOC.cb[k];f(d);}};var fin=function(v){if(done)return;done=true;delete LOC.cb[key];try{s.remove();}catch(e){}res(v);};LOC.cb[key]=function(d){fin(d);};s.onerror=function(){fin(undefined);};s.src=LOC.base+(key==='meta'?'meta.js':'t/'+key+'.js');document.head.appendChild(s);setTimeout(function(){fin(null);},ms);});}
async function localData(P,rad){if(LOC.ok===false)return null;if(LOC.ok===null){var m=await osmLoad('meta',8000);LOC.ok=!!m;if(!LOC.ok)return null;}
 var key=Math.floor(P.cx/0.01)+'_'+Math.floor(P.cy/0.01),d=LOC.cache[key];
 if(d===undefined){var r=await osmLoad(key,10000);if(r===null){if(++LOC.fail>=3)LOC.ok=false;return null;}d=r||{w:[],f:[],a:[]};LOC.fail=0;LOC.cache[key]=d;}
 if(!d._rc){d.F=reclassFeats(d.f.map(function(x){return {kind:x[0],rings:x[2],line:x[1]===1||x[1]===2,pt:x[1]===3,meta:x[3]||{}};}));d._rc=1;}
 var o={lon:P.cx,lat:P.cy},near=function(pts,R){var prev=null;for(var k=0;k<pts.length;k++){var q=toXY(pts[k][0],pts[k][1],o);if(prev?segDist({x:0,y:0},prev,q)<=R:Math.hypot(q.x,q.y)<=R)return true;prev=q;}return false;};
 var ws=[];d.w.forEach(function(x){if(near(x[1],rad))ws.push({name:x[0],geom:x[1]});});
 ws.feats=[];ws.nuis=[];d.F.forEach(function(x){if(x.rings.some(function(rg){return near(rg,FEAT_R);}))ws.feats.push(x);if(NUIS_K.indexOf(x.kind)>=0&&x.rings.some(function(rg){return near(rg,rad+100);}))ws.nuis.push(x);});
 ws.addrs=[];d.a.forEach(function(x){var q=toXY(x[2],x[3],o);if(Math.hypot(q.x,q.y)<=rad)ws.addrs.push({st:x[0],no:x[1],lon:x[2],lat:x[3]});});
 if(!d._names){d._names={};d.w.forEach(function(x){d._names[x[0]]=1;});}ws.allNames=d._names;
 ws.local=true;return ws;}
async function roadsFor(P){P={cx:+P.cx,cy:+P.cy,lx:P.lx?+P.lx:0,ly:+P.ly,rx:+P.rx,ry:+P.ry};var key=P.cx.toFixed(6)+','+P.cy.toFixed(6);if(ROAD.cache[key])return ROAD.cache[key];var rad=Math.round(Math.max(30,(P.lx?Math.hypot((P.rx-P.lx)*mPerDeg(P.cy).x,(P.ry-P.ly)*mPerDeg(P.cy).y)/2:0)+ROAD_MAX+10));var ways=await localData(P,rad);
 if(!ways&&ROAD.mode==='nom'&&Date.now()-(ROAD.nomAt||0)>90000){ROAD.nomAt=Date.now();try{ways=await overpass(P,rad,OVS[0],8000);ROAD.mode='osm';ROAD.bad=0;}catch(e){}}
 if(ROAD.mode!=='nom'&&!ways){var plan=ROAD.quick?[[0,8000]]:[[0,15000],[1,10000]];for(var t=0;t<plan.length&&!ways;t++){try{ways=await overpass(P,rad,OVS[plan[t][0]],plan[t][1]);ROAD.mode='osm';ROAD.bad=0;}catch(e){if(t<plan.length-1)await sleep(1500);}}if(!ways&&!ROAD.quick&&++ROAD.bad>=2){ROAD.mode='nom';ROAD.nomAt=Date.now();}}
 var viaOv=!!ways;if(!ways)ways=await nominatim(P);
 if(ways.failed)return {text:'',n:0,near:null,shape:false,fail:true};
 var all=analyse(ways,P),sh=null;if(P.lx){try{sh=await parcelShape(P);}catch(e){sh=null;}}
 var list,onRoad=[],onRiver=false;if(sh){all.forEach(function(r){r.inLen=0;r.geoms.forEach(function(gm){r.inLen+=sh.inside(gm);});});onRiver=sh.waterFrac>=0.5;var inR0=all.filter(function(r){return r.inLen>=3;}),shapeRd=sh.meanW<=8&&inR0.length>=2&&inR0.reduce(function(s,r){return s+r.inLen;},0)>=0.5*sh.dim;var luOK=sh.roadFrac===null||sh.roadFrac>=0.3||shapeRd;if(sh.waterFrac>=0.3)onRoad=all.filter(function(r){return r.inLen>=10;}).sort(function(a,b){return b.inLen-a.inLen;});if(!onRoad.length)onRoad=all.filter(function(r){return luOK&&r.inLen>=Math.max(4,0.5*sh.dim)&&sh.area/r.inLen<=15;}).sort(function(a,b){return b.inLen-a.inLen;});
  if(!onRoad.length&&luOK&&sh.meanW<=12){var inR=all.filter(function(r){return r.inLen>=3;}),sumIn=inR.reduce(function(s,r){return s+r.inLen;},0);if(sumIn>=Math.max(8,0.4*sh.dim))onRoad=inR.sort(function(a,b){return b.inLen-a.inLen;});}}
 if(onRoad.length){var on={text:onRoad[0].name+'（土地位於道路上'+(onRiver?'，土地位於河川上':'')+'）',n:onRoad.length,near:null,shape:true,onroad:'土地本身為道路（約'+Math.round(onRoad.reduce(function(s,r){return s+r.inLen;},0))+'公尺長、平均寬約'+Math.max(1,Math.round(Math.min(sh.meanW,sh.area/onRoad.reduce(function(s,r){return s+r.inLen;},0))))+'公尺）'};ROAD.cache[key]=on;return on;}
 if(sh){var best1=function(gs){var b=null;gs.forEach(function(gm){if(gm.length<2)return;var c2=sh.check(gm);if(!b||c2.d<b.d||(Math.abs(c2.d-b.d)<0.5&&c2.cross<b.cross))b=c2;});return b;};
  all.forEach(function(r){var b=best1(r.geoms);r.d=b.d;r.cross=b.cross;r.ext=b.ext;});var okD=function(b){return b.d<=FRONT_MAX||(b.ext&&b.d<=35);};all.sort(function(a,b){return a.d-b.d;});
  var cands=all.filter(function(r){return r.cross===0&&okD(r);}),acc=[],rej=[],kk=mPerDeg(P.cy);
  var rawFL=function(r){if(r._rawFL==null)r._rawFL=r.geoms.reduce(function(t,gm){return t+(gm.length>1?sh.frontOK(gm,r.d):0);},0);return r._rawFL;};
  var sameSide=function(A,r,X){var sg=null,bd=1e9;A.lines.forEach(function(la){for(var q=1;q<la.length;q++){var dd=segDist(X,la[q-1],la[q]);if(dd<bd){bd=dd;sg=[la[q-1],la[q]];}}});if(!sg)return false;var cr=function(p){return (sg[1].x-sg[0].x)*(p.y-sg[0].y)-(sg[1].y-sg[0].y)*(p.x-sg[0].x);},sP=cr({x:0,y:0}),same=0,opp=0;r.lines.forEach(function(pts){for(var i=1;i<pts.length;i++){var a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));for(var t=0;t<=n;t++){var p={x:a.x+(b.x-a.x)*t/n,y:a.y+(b.y-a.y)*t/n},dX=Math.hypot(p.x-X.x,p.y-X.y);if(dX<1.5||dX>15)continue;var c=cr(p);if(Math.abs(c)<1e-6)continue;if((c>0)===(sP>0))same++;else opp++;}}});return same>=2&&opp===0;};
  var endOn=function(A,B){var X=null;A.lines.forEach(function(pts){[pts[0],pts[pts.length-1]].forEach(function(p){if(X)return;var m=1e9;B.lines.forEach(function(la){for(var q=1;q<la.length;q++)m=Math.min(m,segDist(p,la[q-1],la[q]));});if(m<=2)X=p;});});return X;};
  var cornerOK=function(r,onlyT){if(r.wedge)return false;return cands.some(function(A){if(A===r||r.d<A.d)return false;var tj=false,X=null;if(across(A,r)){X=endOn(A,r);tj=true;if(X&&r.lines.some(function(pts){return [pts[0],pts[pts.length-1]].some(function(p){return Math.hypot(p.x-X.x,p.y-X.y)<=3;});}))X=null;}else{X=endOn(r,A);if(onlyT&&!(X&&sameSide(A,r,X)))return false;}if(!X)return false;var ok=sh.dist(P.cx+X.x/kk.x,P.cy+X.y/kk.y)<=Math.hypot(A.d,r.d)+3;if(ok&&tj)r.cornerT=true;return ok;});};
  cands.forEach(function(r){if(r.geoms.some(function(gm){return gm.length>1&&sh.frontOK(gm,r.d,true)<0;})){r.wedge=true;rej.push(r);return;}var oth=cands.filter(function(x){return x!==r;});if(!oth.length){acc.push(r);return;}var gs=clipGeoms(r.geoms,oth,P),b=best1(gs),fl=0;if(b&&b.cross===0&&okD(b))gs.forEach(function(gm){if(gm.length>1)fl+=sh.frontOK(gm,b.d);});r.flOK=!!(b&&b.cross===0&&okD(b)&&fl>=Math.min(3,0.4*sh.dim));if(r.flOK)acc.push(r);else if(b&&b.cross===0&&b.d<=r.d+4&&cornerOK(r)&&rawFL(r)>=Math.min(2,0.3*sh.dim))acc.push(r);else if(r.cross===0&&r.d<=8&&cornerOK(r,true)&&rawFL(r)>=Math.min(3,0.4*sh.dim))acc.push(r);else rej.push(r);});
  if(!acc.length&&cands.length){acc.push(cands[0]);rej=cands.slice(1);}
  list=acc.concat(rej.filter(function(r){return acc.some(function(a){return across(a,r);});}));}
 else list=all.filter(function(r){return r.d<=ROAD_MAX;});
 if(sh&&onRiver){var rv=all.filter(function(r){return r.d!=null&&r.d<=12;}).sort(function(a,b){return a.d-b.d;});if(rv.length){var rvr={text:rv[0].name+'（土地位於道路上，土地位於河川上）',n:1,near:null,shape:true,onroad:'土地位於河川上'};ROAD.cache[key]=rvr;return rvr;}}if(window.__ydDBG)window.__ydDBG={all:all,list:list,acc:typeof acc!=='undefined'?acc:null,rej:typeof rej!=='undefined'?rej:null,sh:sh,onRoad:onRoad};var kh=mPerDeg(P.cy),hit=sh?function(x,y){return sh.has(P.cx+x/kh.x,P.cy+y/kh.y);}:(P.lx?function(x,y){var lo=P.cx+x/kh.x,la=P.cy+y/kh.y;return lo>=Math.min(P.lx,P.rx)&&lo<=Math.max(P.lx,P.rx)&&la>=Math.min(P.ly,P.ry)&&la<=Math.max(P.ly,P.ry);}:null),lb=label(list,hit),ad=ways.addrs&&ways.addrs.length?addrText(ways.addrs,sh,P,lb.names):null,fc=[],faceNA=false;if(sh&&list.length){var fts=ways.feats||(viaOv?await featsFor(P):null);var fF=fts?reclassFeats(fts):[];if(fts)fc=sh.faces(fF,list);else faceNA=true;var pk=false;try{pk=await sh.parkFace(list,fF);}catch(e){}if(pk===true&&fc.indexOf('公園')<0)fc.unshift('公園');else if(pk==='綠帶'&&fc.indexOf('公園')<0&&fc.indexOf('綠帶')<0)fc.push('綠帶');var cmF=false;try{cmF=await sh.parkFace(list,null,true);}catch(e){}if(cmF===true&&fc.indexOf('公墓')<0)fc.push('公墓');}var una=null;if(sh&&!lb.n){var ra=sh.roadAdj(ways.feats?reclassFeats(ways.feats):[]);if(ra.len>=Math.min(3,0.4*sh.dim)){var have=ways.allNames||{};all.forEach(function(r){have[r.name]=1;});var bestA=null;(ways.addrs||[]).forEach(function(a){var st=String(a.st).trim();if(have[st]||!/[路街巷弄道]$/.test(st))return;var dd=sh.dist(a.lon,a.lat);if(dd<=40&&(!bestA||dd<bestA.d))bestA={st:st,d:dd};});var nm=bestA?bestA.st:'未命名道路';lb={text:nm,n:1,names:[nm],tags:[]};if(ra.park&&fc.indexOf('公園')<0)fc.unshift('公園');una={guess:!!bestA};ad=ways.addrs&&ways.addrs.length?addrText(ways.addrs,sh,P,lb.names):null;}}if(fc.indexOf('河川')>=0)fc=fc.filter(function(k){return k!=='綠帶';});var nr=[];if(sh&&ways.nuis)reclassFeats(ways.nuis).forEach(function(f){if(fc.indexOf(f.kind)>=0||nr.indexOf(f.kind)>=0)return;if(sh.nearD(f)<=100)nr.push(f.kind);});var tg=(onRiver?['土地位於河川上']:[]).concat(lb.tags||[]).concat(fc.map(function(k){return '面'+k;})).concat(nr.map(function(k){return '近'+k;})),tagS=tg.length?'（'+tg.join('，')+'）':'',base=(lb.names||[]).join('、')+tagS,txt0=base;if(ad)txt0=ad.one?ad.text+tagS:(base?base+'／'+ad.text:ad.text);var res={text:txt0,n:lb.n,near:all[0]||null,shape:!!sh,addr:ad?ad.text:'',faceNA:faceNA,una:una};ROAD.cache[key]=res;return res;}
function distM(a,b){var k=mPerDeg(a.cy);return Math.hypot((a.cx-b.cx)*k.x,(a.cy-b.cy)*k.y);}
window.runCases=async function(list){window.T=[];for(const c of list){try{const P=await getP(c[4]||'D',c[0],c[1],c[2]);ROAD.cache={};ROAD.mode=null;FEAT.until=0;const r=await roadsFor(P);T.push(c[3]+' 【'+r.text+'】'+(r.shape?'':' NOSHAPE')+(r.faceNA?' faceNA':'')+(r.una?' una':''));}catch(e){T.push(c[3]+' ERR '+e);}}T.push('DONE');};
window.roadsFor=roadsFor;window.parcelShape=parcelShape;window.localData=localData;window.LOC=LOC;window.ROAD=ROAD;window.FEAT=FEAT;window.analyse=analyse;window.label=label;window.reclassFeats=reclassFeats;window.across=across;window.segDist=segDist;

})();
window.CASES_OLD=[
['安平區','海興','00270027','海興27-27','D','世平三街、世平一街72巷（三角窗）'],
['安平區','海興','00280000','海興28','D','世平三街、世平一街58巷（三角窗）'],
['安平區','海興','00290001','海興29-1','D','世平三街、世平一街58巷（三角窗）'],
['安平區','海興','00060004','海興6-4','D','洲安一街、漁濱一街（三角窗）'],
['仁德區','中洲西','11410000','中洲西1141','D','中洲七街（中洲九街路沖）'],
['安南區','草湖寮','00670000','草湖寮67','D','安晴三路、安晴路（三角窗）'],
['北區','北安','14690005','北安1469-5','D','北安路一段341巷、育成路（三角窗，面公園）'],
['安南區','海東','13040031','海東1304-31','D','海佃路二段'],
['歸仁區','媽祖廟段三小','02430003','媽祖廟243-3','D','保大路二段118巷31號'],
['佳里區','佳南','02600000','佳南260','D','鎮山街131巷5弄'],
['歸仁區','武東','03580000','武東358','D','高鐵十路、高鐵十二路、高鐵大道（三面臨路）'],
['安平區','海興','00020000','海興2','D','州平二街、州平路（三角窗，面公園）'],
['北區','北元','02980001','北元298-1','D','北成路（面公園）'],
['北區','北安','14690000','北安1469','D','育成路308號'],
['西港區','南海','05320000','南海532','D','南慶街（土地位於道路上）'],
['中西區','新美','04140000','新美414','D','新美街119號'],
['大內區','頭社','03110000','頭社311','D','南182'],
['新營區','王公','04850000','王公485','D','民族路106巷（土地位於道路上）'],
['左營區','福山','02540005','福山254-5','E','重仁路'],
['麻豆區','麻工','03320000','麻工332','D','麻學路一段'],
['麻豆區','麻工','00500000','麻工50','D','麻苓路、麻柚三路（三角窗，麻佳路一段232巷沖）'],
['麻豆區','麻工','00510000','麻工51','D','麻苓路'],
['麻豆區','麻工','00600000','麻工60','D','麻苓路'],
['南區','大山','00630000','大山63','D','萬年七街'],
['永康區','市政','00040000','市政4','D','永善三街'],
['仁武區','新後港西','00020000','新後港西2','E','霞海東二街'],
['仁武區','新後港西','00330000','新後港西33','E','高楠一街227巷、高楠一街（三角窗）'],
['仁武區','新後港西','00220000','新後港西22','E','高楠一街227巷、霞海東二街（雙面臨路）'],
['仁武區','後港東','00720000','後港東72','E','九湖一街81巷、九湖二街（三角窗）'],
['楠梓區','芎蕉','00050000','芎蕉5','E','卓越路、卓越路51巷（三角窗）'],
['楠梓區','芎蕉','00040000','芎蕉4','E','卓越路'],
['楠梓區','芎蕉','00760000','芎蕉76','E','芎林二街（面公園）'],
['楠梓區','芎蕉','00390000','芎蕉39','E','芎林一街'],
['楠梓區','芎蕉','00550000','芎蕉55','E','芎林一街'],
['楠梓區','芎蕉','00860000','芎蕉86','E','芎林一街'],
['楠梓區','芎蕉','00470000','芎蕉47','E','卓越路（面學校）'],
['楠梓區','芎蕉','00490000','芎蕉49','E','卓越路（面學校）'],
['楠梓區','芎蕉','00500000','芎蕉50','E','卓越路、芎林路（三角窗，面學校）'],
['楠梓區','芎蕉','00420000','芎蕉42','E','卓越路、芎蕉一街（三角窗，面學校）'],
['楠梓區','芎蕉','00460000','芎蕉46','E','芎蕉一街、卓越路（三角窗，面學校）'],
['安南區','福國','07990000','福國799','D','安和路四段'],
['安南區','福國','07490000','福國749','D','未命名道路（面公園）'],
['安南區','福國','07530000','福國753','D','未命名道路（面公園）'],
['安南區','福國','03190000','福國319','D','大聖一街50巷']];
window.CASES_NEW=[
['中西區','老古石','12880000','老古石1288','D','!河川!公園'],
['中西區','老古石','01260000','老古石126','D','!河川!公園'],
['中西區','老古石','00900000','老古石90','D','!河川!公園'],
['中西區','新臨安','12490000','新臨安1249','D','!河川'],
['中西區','新臨安','17990000','新臨安1799','D','!河川'],
['中西區','三民','03170000','三民317','D','!河川'],
['中西區','三民','03180000','三民318','D','!河川'],
['中西區','三民','04450000','三民445','D','!河川'],
['中西區','玉宇','01410000','玉宇141','D','!河川'],
['中西區','玉宇','01450000','玉宇145','D','!河川'],
['中西區','星鑽','03850000','星鑽385','D','!河川!公園'],
['中西區','府前','04550000','府前455','D','!公園!廣場'],
['中西區','武聖','23180000','武聖2318','D','!公園'],
['中西區','白金','04740000','白金474','D','面古蹟!公園'],
['中西區','赤崁','04430000','赤崁443','D','面古蹟!公園'],
['安南區','安西','02830000','安西283','D','!公園!山海圳'],
['安南區','安西','21650002','安西2165-2','D','!山海圳'],
['安南區','國安','00030001','國安3-1','D','國安街156巷、郡安路六段（三角窗，面河川）'],
['安南區','國安','15470001','國安1547-1','D','面河川!公園'],
['安南區','安西','17780000','安西1778','D','面河川!公園'],
['安南區','國安','13480000','國安1348','D','府安路六段（土地位於道路上，土地位於河川上）'],
['安南區','安西','15230000','安西1523','D','面河川!公園!山海圳'],
['安南區','國安','07910100','國安791-100','D','國安街210巷（土地位於道路上）'],
['安南區','國安','07920000','國安792','D','國安街210巷（土地位於道路上）'],
['安南區','怡北','02950001','怡北295-1','D','北安路三段396巷50弄、北安路三段396巷16弄（雙面臨路）'],
['安南區','安西','08680000','安西868','D','安通一街192巷'],
['東區','竹篙厝','22620000','竹篙厝2262','D','面文化中心!公園'],
['南區','鹽埕','20590000','鹽埕2059','D','金華路一段、金華路一段100巷（三角窗）'],
['南區','日新','07840000','日新784','D','面學校!公園'],
['南區','喜北','05820000','喜北582','D','面公墓!公園'],
['南區','省躬','05390000','省躬539','D','面綠帶!公園'],
['南區','華南','06550000','華南655','D','!公園'],
['南區','華南','06540000','華南654','D','!公園'],
['南區','中和','00650000','中和65','D','!公園'],
['南區','新興','03870000','新興387','D','!公園']];
window.check=function(t,exp){if(exp[0]==='!'||/^面/.test(exp)){var ok=true;exp.split('!').forEach(function(p,i){if(!p)return;if(i===0){if(t.indexOf(p)<0)ok=false;}else if(t.indexOf(p)>=0)ok=false;});return ok;}var a=t.split('／')[0];return a===exp||t===exp;};
window.runSet=async function(list){window.T=[];window.TF=[];for(const c of list){let t='';try{const P=await getP(c[4]||'D',c[0],c[1],c[2]);ROAD.cache={};ROAD.mode=null;FEAT.until=0;const r=await roadsFor(P);t=r.text+(r.shape?'':' NOSHAPE')+(r.una?' una':'');}catch(e){t='ERR '+e;}T.push(c[3]+'【'+t+'】');t=t.replace(' una','');if(!check(t,c[5]))TF.push(c[3]+'【'+t+'】 期望 '+c[5]);}T.push('DONE');};
window.getP=async function(city,tn,s,ln){const t=await fetch('https://api.nlsc.gov.tw/other/ListTown/'+city).then(r=>r.text());const tc=t.match(new RegExp('<towncode>('+city+'\\d+)</towncode>\\s*<townname>'+tn))[1];const sx=await fetch('https://api.nlsc.gov.tw/other/ListLandSection/'+city+'/'+tc).then(r=>r.text());const m=sx.match(new RegExp('<office>(\\w+)</office>\\s*<officestr>[^<]*</officestr>\\s*<sectcode>(\\d+)</sectcode>\\s*<sectstr>'+s+'段</sectstr>'));let P=await fetch('https://landmaps.nlsc.gov.tw/S_Maps/qryTileMapIndex?type=2&flag=2&office='+m[1]+'&sect='+m[2]+'&landno='+ln+'&alpah=0.5f').then(r=>r.json());while(Array.isArray(P))P=P[0];return P;};
window.dbgCase=async function(c){window.__ydDBG={};const P=await getP(c[0],c[1],c[2],c[3]);ROAD.cache={};const r=await roadsFor(P);const D=window.__ydDBG;return c[2]+c[3]+' => '+r.text+'\n'+(D.all||[]).slice(0,7).map(x=>x.name+' d'+(x.d==null?'-':x.d.toFixed(1))+' cr'+x.cross+' fl'+(x.flOK?1:0)+(x.cornerT?' T':'')+(D.acc&&D.acc.indexOf(x)>=0?' ACC':'')+(D.rej&&D.rej.indexOf(x)>=0?' REJ':'')+(D.list&&D.list.indexOf(x)>=0?' L':'')).join('\n');};
window.ALL=window.CASES_OLD.concat(window.CASES_NEW);
