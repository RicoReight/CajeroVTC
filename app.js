"use strict";
const safeStorage={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},remove(k){try{localStorage.removeItem(k)}catch(e){}}};
const denominations=[
{c:10000,n:"100 €",short:"100€",type:"bill",class:"b-100"},{c:5000,n:"50 €",short:"50€",type:"bill",class:"b-50"},
{c:2000,n:"20 €",short:"20€",type:"bill",class:"b-20"},{c:1000,n:"10 €",short:"10€",type:"bill",class:"b-10"},
{c:500,n:"5 €",short:"5€",type:"bill",class:"b-5"},{c:200,n:"2 €",short:"2 €",type:"coin",class:"c-200"},
{c:100,n:"1 €",short:"1 €",type:"coin",class:"c-100"},{c:50,n:"0,50 €",short:"0.50",type:"coin",class:"c-gold"},
{c:20,n:"0,20 €",short:"0.20",type:"coin",class:"c-gold"},{c:10,n:"0,10 €",short:"0.10",type:"coin",class:"c-gold"},
{c:5,n:"0,05 €",short:"0.05",type:"coin",class:"c-copper"},{c:2,n:"0,02 €",short:"0.02",type:"coin",class:"c-copper"},
{c:1,n:"0,01 €",short:"0.01",type:"coin",class:"c-copper"}];
const RESERVA_DEFAULT={10000:0,5000:0,2000:1,1000:1,500:1,200:2,100:2,50:3,20:5,10:5,5:3,2:3,1:5};
const TOPES_DEFAULT={1:30,2:30,5:30,10:25,20:25,50:20,100:20,200:20,500:8,1000:8,2000:5,5000:3,10000:2};
const ARRANQUE={10000:0,5000:0,2000:2,1000:3,500:4,200:5,100:8,50:8,20:15,10:15,5:10,2:10,1:15};
// Margen de llenado: la reposición (auto y manual) nunca llena una denominación
// por encima del 70% de su tope, para dejar ~30% de hueco a las piezas que
// entran durante la jornada y evitar atascos.
// Ajustable: 0.6 = más conservador (más hueco, más viajes al banco),
//            0.8 = más agresivo (caja más llena, menos viajes).
const FACTOR_LLENADO=0.7;
let stock=loadStock(),totalTips=loadTips(),reservaMinima=loadReserva(),topesRecibir=loadTopes();
let diaReset=loadDiaReset(),ultimoResetPropinas=loadUltimoResetPropinas(),statsOps=loadStats();
let received=[],pendingTransaction=null,stockInputs=[],reservaInputs=[],summaryTimer=null,precioInterval=null,precioActual=0;
let cambioState={aEntregar:{},aRecibir:{},modo:null,orden:[],ordenRecibir:[],sinDatos:false};
let reponerState={viajes:20,colchon:3,marcados:{},modo:"auto",manualAdd:{},importeManual:0};

function loadStock(){const s=safeStorage.get("uberCambioStock");if(s){try{const a=JSON.parse(s);if(Array.isArray(a)&&a.length===denominations.length)return a.map(x=>Math.max(0,parseInt(x)||0))}catch(e){}}return[0,0,2,3,4,10,10,20,40,10,10,10,10]}
function loadTips(){return parseInt(safeStorage.get("uberCambioTips"))||0}
function loadReserva(){const b=Object.assign({},RESERVA_DEFAULT);const s=safeStorage.get("uberCambioReserva");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object")denominations.forEach(d=>{if(typeof o[d.c]==="number")b[d.c]=Math.max(0,parseInt(o[d.c])||0)})}catch(e){}}return b}
function loadTopes(){const b=Object.assign({},TOPES_DEFAULT);const s=safeStorage.get("uberCambioTopes");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object")denominations.forEach(d=>{if(typeof o[d.c]==="number")b[d.c]=Math.max(0,parseInt(o[d.c])||0)})}catch(e){}}return b}
function loadDiaReset(){const n=parseInt(safeStorage.get("uberCambioDiaReset"));return(n>=1&&n<=31)?n:20}
function saveDiaReset(){safeStorage.set("uberCambioDiaReset",String(diaReset))}
function loadUltimoResetPropinas(){return safeStorage.get("uberCambioUltimoResetPropinas")||null}
function saveUltimoResetPropinas(){safeStorage.set("uberCambioUltimoResetPropinas",ultimoResetPropinas||"")}
function loadStats(){const s=safeStorage.get("uberCambioStats");if(s){try{const o=JSON.parse(s);if(o&&Array.isArray(o.received)&&Array.isArray(o.spent))return{operations:parseInt(o.operations)||0,received:o.received.map(x=>parseInt(x)||0),spent:o.spent.map(x=>parseInt(x)||0)}}catch(e){}}return{operations:0,received:new Array(denominations.length).fill(0),spent:new Array(denominations.length).fill(0)}}
function saveStats(){safeStorage.set("uberCambioStats",JSON.stringify(statsOps))}
function resetStats(){statsOps={operations:0,received:new Array(denominations.length).fill(0),spent:new Array(denominations.length).fill(0)};saveStats()}
function saveStock(){safeStorage.set("uberCambioStock",JSON.stringify(stock));scheduleCashSummary()}
function saveTips(){safeStorage.set("uberCambioTips",String(totalTips))}
function saveReserva(){safeStorage.set("uberCambioReserva",JSON.stringify(reservaMinima));scheduleCashSummary();if(received.length)calculate()}
function saveTopes(){safeStorage.set("uberCambioTopes",JSON.stringify(topesRecibir))}
function moneyText(c){return(c/100).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}

function scheduleCashSummary(){if(summaryTimer)clearTimeout(summaryTimer);summaryTimer=setTimeout(()=>{summaryTimer=null;updateCashSummary()},120)}
function updateCashSummary(){let t=0;denominations.forEach((d,i)=>{t+=d.c*stock[i]});const el=document.getElementById("totalCashDisplay");if(el)el.textContent=moneyText(t);const checks=[["status20",2000],["status30",3000],["status50",5000],["status80",8000],["status100",10000]];const disp=stockDisponible();const cache={};checks.forEach(([id,tg])=>{if(!(tg in cache))cache[tg]=estadoPara(tg,disp);setStatusBadge(id,cache[tg])})}
function estadoPara(target,disp){if(canMakeAmount(target,disp))return"yes";if(canMakeAmount(target,stock))return"warn";return"no"}
function estadoParaStock(target,arr){const disp=arr.map((n,i)=>Math.max(0,n-(reservaMinima[denominations[i].c]||0)));if(canMakeAmount(target,disp))return"yes";if(canMakeAmount(target,arr))return"warn";return"no"}
function stockDisponible(){return stock.map((n,i)=>Math.max(0,n-(reservaMinima[denominations[i].c]||0)))}
function canMakeAmount(target,avail){if(target<=0)return true;const r=new Uint8Array(target+1);r[0]=1;for(let i=0;i<denominations.length;i++){const v=denominations[i].c,m=avail[i];if(m<=0||v>target)continue;const u=new Int32Array(target+1).fill(-1);for(let t=0;t<=target;t++)if(r[t])u[t]=0;for(let t=0;t+v<=target;t++){if(u[t]<0)continue;if(u[t]<m&&u[t+v]<0){r[t+v]=1;u[t+v]=u[t]+1}}}return r[target]===1}
function setStatusBadge(id,estado){const el=document.getElementById(id);if(!el)return;el.style.background="";el.style.color="";if(estado==="yes"){el.textContent="SÍ";el.className="status-badge yes"}else if(estado==="warn"){el.textContent="MÍN";el.className="status-badge warn";el.style.background="#eab308";el.style.color="#000"}else{el.textContent="NO";el.className="status-badge no"}}
function toggleMenu(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(!d||!o)return;d.classList.toggle("active");o.classList.toggle("active")}
function switchDrawerTab(tab){const panels={inventario:document.getElementById("panelInventario"),reset:document.getElementById("panelReset")};const tabs={inventario:document.getElementById("tabInventario"),reset:document.getElementById("tabReset")};const A="flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#334155;color:#fff;font-weight:700;cursor:pointer;font-size:12px";const I="flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#94a3b8;font-weight:700;cursor:pointer;font-size:12px";Object.keys(panels).forEach(k=>{if(panels[k])panels[k].style.display=(k===tab)?"block":"none";if(tabs[k])tabs[k].style.cssText=(k===tab)?A:I});if(tab==="inventario")renderStockList();if(tab==="reset")renderResetPanel()}
function renderButtons(){const box=document.getElementById("moneyButtons");if(!box)return;box.innerHTML="";const bt=document.createElement("div");bt.className="section";bt.textContent="Billetes";box.appendChild(bt);denominations.slice(0,5).forEach(d=>{const b=document.createElement("button");b.type="button";b.className="money";b.textContent=d.n;b.addEventListener("click",()=>addMoney(d.c));box.appendChild(b)});const ct=document.createElement("div");ct.className="section";ct.textContent="Monedas";box.appendChild(ct);denominations.slice(5).forEach(d=>{const b=document.createElement("button");b.type="button";b.className="money";b.textContent=d.n;b.addEventListener("click",()=>addMoney(d.c));box.appendChild(b)})}
function addMoney(c){received.push(c);updateReceived();calculate()}
function undoMoney(){received.pop();updateReceived();calculate()}
function updateReceived(){const t=received.reduce((a,b)=>a+b,0);const el=document.getElementById("paidDisplay");if(el)el.textContent=moneyText(t)}
function setAllTip(){const rp=parseFloat(document.getElementById("price").value.replace(',','.'))||0;const p=Math.round(rp*100);const paid=received.reduce((a,b)=>a+b,0);if(paid>p&&p>0){document.getElementById("tip").value=((paid-p)/100).toFixed(2);calculate()}}
function mostrarPrecio(){const inp=document.getElementById("price");if(!inp)return;const raw=parseFloat(inp.value.replace(',','.'))||0;if(raw<=0){alert("Escribe primero el precio del viaje.");return}precioActual=Math.round(raw*100);const el=document.getElementById("precioGrande");if(el)el.textContent=moneyText(precioActual);const p=document.getElementById("precioPantalla");if(p)p.style.display="flex";iniciarAlternanciaPrecio()}
function iniciarAlternanciaPrecio(){detenerAlternanciaPrecio();const t=document.getElementById("precioTitulo");if(!t)return;let en=false;t.textContent="A PAGAR";precioInterval=setInterval(()=>{en=!en;t.textContent=en?"TO PAY":"A PAGAR"},3000)}
function detenerAlternanciaPrecio(){if(precioInterval){clearInterval(precioInterval);precioInterval=null}}
function cerrarPrecio(){detenerAlternanciaPrecio();const p=document.getElementById("precioPantalla");if(p)p.style.display="none"}

function findSmartChange(target,avail){let best=null,minScore=Infinity;function bt(i,rest,used,score){if(rest===0){if(score<minScore){minScore=score;best=[...used]}return}if(i>=denominations.length||rest<0||score>=minScore)return;const v=denominations[i].c;const mx=Math.min(avail[i],Math.floor(rest/v));for(let n=mx;n>=0;n--){used[i]=n;const pen=(denominations[i].type==="coin"&&v<=200)?n*2:n;bt(i+1,rest-n*v,used,score+pen);used[i]=0}}bt(0,target,new Array(denominations.length).fill(0),0);return best}

function calculate(){const rp=parseFloat(document.getElementById("price").value.replace(',','.'))||0;const price=Math.round(rp*100);const paid=received.reduce((a,b)=>a+b,0);const rt=parseFloat(document.getElementById("tip").value.replace(',','.'))||0;const tip=Math.round(rt*100);const resultDiv=document.getElementById("changeResult");const changeTotal=document.getElementById("changeTotal");const changeGrid=document.getElementById("changeGrid");pendingTransaction=null;if(price<=0||paid===0){resultDiv.style.display="none";return}const totalCharge=price+tip;if(paid<totalCharge){changeTotal.textContent="FALTAN "+moneyText(totalCharge-paid);changeGrid.innerHTML="";resultDiv.style.display="block";return}const incoming=new Array(denominations.length).fill(0);received.forEach(c=>{const i=denominations.findIndex(d=>d.c===c);if(i>=0)incoming[i]++});const available=stock.map((n,i)=>n+incoming[i]);const targetChange=paid-totalCharge;if(targetChange===0){pendingTransaction={incoming,used:new Array(denominations.length).fill(0),tip,tocaReserva:false};changeTotal.textContent=tip>0?"PAGO EXACTO (Propina: "+moneyText(tip)+")":"PAGO EXACTO. SIN CAMBIO.";changeGrid.innerHTML="";resultDiv.style.display="block";return}const disp=available.map((n,i)=>Math.max(0,n-(reservaMinima[denominations[i].c]||0)));let used=findSmartChange(targetChange,disp);let tocaReserva=false;if(!used){used=findSmartChange(targetChange,available);tocaReserva=!!used}if(!used){changeTotal.textContent="SIN CAMBIO ÓPTIMO PARA DEVOLVER "+moneyText(targetChange);changeGrid.innerHTML="";resultDiv.style.display="block";return}pendingTransaction={incoming,used,tip,tocaReserva};let h="DEVOLVER: "+moneyText(targetChange);if(tocaReserva)h+=" ⚠️ (toca reserva mínima)";changeTotal.textContent=h;changeGrid.innerHTML="";used.forEach((n,i)=>{if(n>0){const d=denominations[i];const it=document.createElement("div");it.className="cash-item";const bd=document.createElement("div");bd.className="badge";bd.textContent="x"+n;const gr=document.createElement("div");gr.className=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;gr.textContent=d.short;it.appendChild(bd);it.appendChild(gr);changeGrid.appendChild(it)}});resultDiv.style.display="block"}

function confirmTransaction(){if(!pendingTransaction){alert("Introduce un precio y el dinero recibido.");return}for(let i=0;i<stock.length;i++)stock[i]+=pendingTransaction.incoming[i]-pendingTransaction.used[i];if(pendingTransaction.tip>0){totalTips+=pendingTransaction.tip;saveTips()}statsOps.operations++;for(let i=0;i<denominations.length;i++){statsOps.received[i]+=pendingTransaction.incoming[i]||0;statsOps.spent[i]+=pendingTransaction.used[i]||0}saveStats();saveStock();renderStockList();received=[];pendingTransaction=null;document.getElementById("price").value="";document.getElementById("tip").value="";document.getElementById("changeResult").style.display="none";updateReceived();alert("¡Operación guardada!")}

function renderRecomendaciones(){const box=document.getElementById("recomendacionesBox");if(!box)return;if(statsOps.operations<10){box.innerHTML="";return}const ops=statsOps.operations;const falt=[],sob=[];denominations.forEach((d,i)=>{const aR=statsOps.received[i]/ops,aS=statsOps.spent[i]/ops;if(aS>0&&statsOps.spent[i]>statsOps.received[i]+2){const r=stock[i]/aS;if(r<30)falt.push({d,falta:Math.max(1,Math.ceil(aS*30)-stock[i])})}if(aR>aS*2&&statsOps.received[i]>8&&stock[i]>8)sob.push({d,exceso:statsOps.received[i]-statsOps.spent[i]})});if(!falt.length&&!sob.length){box.innerHTML="";return}let html="<div style='background:#0f172a;border:1px solid #475569;border-radius:10px;padding:12px;margin-top:14px'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>🤖 SUGERENCIAS · últimas "+ops+" operaciones</div>";if(falt.length){html+="<div style='font-size:11px;color:#fbbf24;font-weight:700;margin-bottom:4px'>⚠️ SE TE AGOTAN</div>";falt.forEach(x=>{html+="<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'><span>"+x.d.n+"</span><span style='color:#fbbf24;font-weight:700'>pedir +"+x.falta+"</span></div>"})}if(sob.length){html+="<div style='font-size:11px;color:#4ade80;font-weight:700;margin:10px 0 4px'>💚 ACUMULAS DE MÁS</div>";sob.forEach(x=>{html+="<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'><span>"+x.d.n+"</span><span style='color:#4ade80;font-weight:700'>+"+x.exceso+" de más</span></div>"})}html+="</div>";box.innerHTML=html}

function renderStockList(){const box=document.getElementById("stockList");if(!box)return;box.innerHTML="";stockInputs=[];const tipEl=document.getElementById("totalTipDisplay");if(tipEl)tipEl.textContent="💶 Propinas: "+moneyText(totalTips);denominations.forEach((d,i)=>{const row=document.createElement("div");row.className="stock-item";const t=document.createElement("span");t.textContent=d.n;t.style.fontWeight="700";const ctrl=document.createElement("div");ctrl.className="stock-ctrl";const bm=document.createElement("button");bm.textContent="-";bm.onclick=()=>updateStockVal(i,stock[i]-1);const inp=document.createElement("input");inp.type="number";inp.min="0";inp.value=stock[i];inp.onchange=(e)=>updateStockVal(i,parseInt(e.target.value)||0);const bp=document.createElement("button");bp.textContent="+";bp.onclick=()=>updateStockVal(i,stock[i]+1);ctrl.appendChild(bm);ctrl.appendChild(inp);ctrl.appendChild(bp);row.appendChild(t);row.appendChild(ctrl);box.appendChild(row);stockInputs[i]=inp});renderRecomendaciones()}
function updateStockVal(i,v){stock[i]=Math.max(0,v);if(stockInputs[i])stockInputs[i].value=stock[i];saveStock()}

function renderReservaList(){const box=document.getElementById("reservaList");if(!box)return;box.innerHTML="";reservaInputs=[];denominations.forEach((d,i)=>{const row=document.createElement("div");row.className="stock-item";const t=document.createElement("span");t.textContent=d.n;t.style.fontWeight="700";const ctrl=document.createElement("div");ctrl.className="stock-ctrl";const bm=document.createElement("button");bm.textContent="-";bm.onclick=()=>updateReservaVal(i,(reservaMinima[d.c]||0)-1);const inp=document.createElement("input");inp.type="number";inp.min="0";inp.value=reservaMinima[d.c]||0;inp.onchange=(e)=>updateReservaVal(i,parseInt(e.target.value)||0);const bp=document.createElement("button");bp.textContent="+";bp.onclick=()=>updateReservaVal(i,(reservaMinima[d.c]||0)+1);ctrl.appendChild(bm);ctrl.appendChild(inp);ctrl.appendChild(bp);row.appendChild(t);row.appendChild(ctrl);box.appendChild(row);reservaInputs[i]=inp})}
function updateReservaVal(i,v){const d=denominations[i];reservaMinima[d.c]=Math.max(0,v);if(reservaInputs[i])reservaInputs[i].value=reservaMinima[d.c];saveReserva()}
function resetReserva(){if(!confirm("¿Restaurar la reserva mínima a los valores por defecto?"))return;reservaMinima=Object.assign({},RESERVA_DEFAULT);saveReserva();renderReservaList()}

function renderTopesList(){const box=document.getElementById("topesList");if(!box)return;box.innerHTML="";denominations.forEach(d=>{const row=document.createElement("div");row.className="stock-item";const t=document.createElement("span");t.textContent=d.n;t.style.fontWeight="700";const ctrl=document.createElement("div");ctrl.className="stock-ctrl";const bm=document.createElement("button");bm.textContent="-";bm.onclick=()=>updateTopeVal(d.c,(topesRecibir[d.c]||0)-1);const inp=document.createElement("input");inp.type="number";inp.min="0";inp.value=topesRecibir[d.c]||0;inp.onchange=(e)=>updateTopeVal(d.c,parseInt(e.target.value)||0);const bp=document.createElement("button");bp.textContent="+";bp.onclick=()=>updateTopeVal(d.c,(topesRecibir[d.c]||0)+1);ctrl.appendChild(bm);ctrl.appendChild(inp);ctrl.appendChild(bp);row.appendChild(t);row.appendChild(ctrl);box.appendChild(row)})}
function updateTopeVal(c,v){topesRecibir[c]=Math.max(0,v);saveTopes();renderTopesList()}
function resetTopes(){if(!confirm("¿Restaurar los topes máximos a los valores por defecto?"))return;topesRecibir=Object.assign({},TOPES_DEFAULT);saveTopes();renderTopesList()}

function renderResetPanel(){const inp=document.getElementById("resetDia");if(inp)inp.value=diaReset;const el=document.getElementById("resetUltimaVez");if(el){if(ultimoResetPropinas){const d=new Date(ultimoResetPropinas);el.textContent="Última vez: "+d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}else el.textContent="Última vez: —"}renderHistorialPanel()}
function guardarDiaReset(){const el=document.getElementById("resetDia");if(!el)return;const n=parseInt(el.value)||20;diaReset=Math.max(1,Math.min(31,n));saveDiaReset();el.value=diaReset}
function resetCuenta(){if(!confirm("¿Poner el INVENTARIO (caja) a CERO?\nLas propinas NO se tocan."))return;stock=new Array(denominations.length).fill(0);saveStock();renderStockList();if(received.length)calculate()}
function resetPropinas(){if(!confirm("¿Poner las PROPINAS a CERO?\nEl inventario NO se toca."))return;totalTips=0;saveTips();renderStockList();renderResetPanel()}
function resetHistorial(){if(!confirm("¿Borrar el HISTORIAL de depósitos, resets y cambios de billetes?"))return;safeStorage.remove("uberCambioCierres");safeStorage.remove("uberCambioHistoricoResets");safeStorage.remove("uberCambioCambios");renderHistorialPanel();renderCambioHistorial();const hc=document.getElementById("cierreHistorico");if(hc){hc.innerHTML="";hc.style.display="none"}}
function resetEstadisticas(){if(!confirm("¿Borrar las estadísticas de aprendizaje?"))return;resetStats();renderStockList();alert("✅ Estadísticas reseteadas.")}
function resetTodo(){if(!confirm("⚠️ ¿RESETEAR TODO?\n\nSe borrará el inventario, propinas, historial y estadísticas."))return;stock=new Array(denominations.length).fill(0);totalTips=0;safeStorage.remove("uberCambioCierres");safeStorage.remove("uberCambioHistoricoResets");safeStorage.remove("uberCambioCambios");resetStats();saveStock();saveTips();renderStockList();renderResetPanel();if(received.length)calculate()}

function loadHistoricoResets(){const s=safeStorage.get("uberCambioHistoricoResets");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function saveHistoricoResets(h){safeStorage.set("uberCambioHistoricoResets",JSON.stringify(h))}
function loadCambios(){const s=safeStorage.get("uberCambioCambios");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function saveCambios(c){safeStorage.set("uberCambioCambios",JSON.stringify(c))}
function loadCierres(){const s=safeStorage.get("uberCambioCierres");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function saveCierres(c){safeStorage.set("uberCambioCierres",JSON.stringify(c))}

function checkAutoResetPropinas(){if(!ultimoResetPropinas){ultimoResetPropinas=new Date().toISOString();saveUltimoResetPropinas();return}const last=new Date(ultimoResetPropinas);const now=new Date();const cand=new Date(last.getFullYear(),last.getMonth(),diaReset,0,0,0);if(cand<=last)cand.setMonth(cand.getMonth()+1);if(now>=cand){const h=loadHistoricoResets();h.push({fecha:now.toISOString(),propinas:totalTips});saveHistoricoResets(h);totalTips=0;saveTips();ultimoResetPropinas=now.toISOString();saveUltimoResetPropinas();renderStockList();renderResetPanel()}}

function renderHistorialPanel(){const box=document.getElementById("historialPanel");if(!box)return;const cierres=loadCierres(),resets=loadHistoricoResets();let html="";if(cierres.length){html+="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px'>📜 ÚLTIMOS DEPÓSITOS</div>";cierres.slice(-10).reverse().forEach(c=>{const d=new Date(c.fecha);const f=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});const ic=c.manual?"📝 ":"";html+="<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'><span style='color:#94a3b8'>"+ic+f+"</span><span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span></div>"})}if(resets.length){html+="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:14px 0 6px'>🔄 ÚLTIMOS RESETS DE PROPINAS</div>";resets.slice(-10).reverse().forEach(r=>{const d=new Date(r.fecha);const f=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});html+="<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'><span style='color:#94a3b8'>"+f+"</span><span style='font-weight:800;color:#fbbf24'>"+moneyText(r.propinas)+"</span></div>"})}box.innerHTML=html}

function abrirCierrePantalla(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("cierrePantalla");if(p)p.style.display="block";const inp=document.getElementById("cierreInput");if(inp)inp.value="";const cont=document.getElementById("cierreResultado");if(cont){cont.style.display="none";cont.innerHTML=""}const btn=document.getElementById("btnConfirmarCierre");if(btn)btn.style.display="none";const mb=document.getElementById("depositoManualBox");if(mb)mb.style.display="none";renderCierreHistorico()}
function cerrarCierrePantalla(){const p=document.getElementById("cierrePantalla");if(p)p.style.display="none"}

function findBilletes(target,bs,br){const mu=Math.floor(target/500);if(mu<=0)return{total:0,usados:[0,0,0,0,0],tocoReserva:false};const den=[{u:20,idx:0},{u:10,idx:1},{u:4,idx:2},{u:2,idx:3},{u:1,idx:4}];const disp=bs.map((n,i)=>Math.max(0,n-(br[i]||0)));const r1=mejorEnRango(mu,disp,den);if(r1&&r1.totalUnits===mu)return{total:mu*500,usados:r1.usados,tocoReserva:false};const r2=mejorEnRango(mu,bs,den);if(r2&&r2.totalUnits===mu)return{total:mu*500,usados:r2.usados,tocoReserva:true};if(r1)return{total:r1.totalUnits*500,usados:r1.usados,tocoReserva:false};if(r2)return{total:r2.totalUnits*500,usados:r2.usados,tocoReserva:true};return{total:0,usados:[0,0,0,0,0],tocoReserva:false}}

function mejorEnRango(mu,cant,den){const n=den.length;const INF=999999;const totDisp=den.reduce((s,d)=>s+(cant[d.idx]|0)*d.u,0);const cap=Math.min(mu,totDisp);if(cap<=0)return null;const tbl=[];for(let i=0;i<=n;i++)tbl.push(new Array(cap+1).fill(INF));tbl[n][0]=0;for(let i=n-1;i>=0;i--){const d=den[i];const mN=cant[d.idx]|0;for(let v=0;v<=cap;v++){let best=INF;const tope=Math.min(mN,Math.floor(v/d.u));for(let c=0;c<=tope;c++){const sub=tbl[i+1][v-c*d.u];if(sub+c<best)best=sub+c}tbl[i][v]=best}}let bv=-1;for(let v=cap;v>=0;v--){if(tbl[0][v]<INF){bv=v;break}}if(bv<0)return null;const us=[0,0,0,0,0];let v=bv;for(let i=0;i<n;i++){const d=den[i];const mN=cant[d.idx]|0;for(let c=mN;c>=0;c--){const val=c*d.u;if(val>v)continue;if(tbl[i+1][v-val]+c===tbl[i][v]){us[d.idx]=c;v-=val;break}}}return{totalUnits:bv,usados:us}}

function calcularCierre(){const cont=document.getElementById("cierreResultado"),btn=document.getElementById("btnConfirmarCierre");const raw=parseFloat(document.getElementById("cierreInput").value.replace(',','.'))||0;const target=Math.round(raw*100);if(!cont||!btn)return;if(target<=0){cont.style.display="none";cont.innerHTML="";btn.style.display="none";return}const bs=stock.slice(0,5);const br=denominations.slice(0,5).map(d=>reservaMinima[d.c]||0);const res=findBilletes(target,bs,br);if(!res||res.total===0){const mx=stock.slice(0,5).reduce((s,n,i)=>s+n*denominations[i].c,0);let msg;if(mx===0)msg="⚠️ No tienes ningún billete en el inventario.<br>Añade billetes en Ajustes → Inventario.";else msg="⚠️ No puedes formar "+moneyText(target)+".<br>En billetes tienes como máximo "+moneyText(mx)+".";cont.innerHTML="<div style='color:#ef4444;font-weight:700;font-size:14px;text-align:center;line-height:1.6'>"+msg+"</div>";cont.style.display="block";btn.style.display="none";return}let html="";html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;text-align:center'>💵 ENTREGAR EN BILLETES</div><div style='font-size:32px;font-weight:900;color:#4ade80;margin:6px 0 14px;text-align:center'>"+moneyText(res.total)+"</div><div class='change-grid'>";res.usados.forEach((n,i)=>{if(n>0){const d=denominations[i];html+="<div class='cash-item'><div class='badge'>x"+n+"</div><div class='bill-graphic "+d.class+"'>"+d.short+"</div></div>"}});html+="</div>";if(res.tocoReserva){html+="<div style='margin-top:14px;padding:12px;background:#78350f;border:1px solid #b45309;border-radius:10px;font-size:12px;color:#fbbf24;line-height:1.5;text-align:center'>⚠️ He tenido que <b>usar tu reserva mínima</b> para formar este importe.<br>Si quieres evitarlo, deposita menos.</div>"}const sd=stock.slice();for(let i=0;i<res.usados.length;i++)sd[i]=Math.max(0,sd[i]-res.usados[i]);const checks=[["≤ 20 €",2000],["≤ 30 €",3000],["≤ 50 €",5000],["≤ 80 €",8000],["≤ 100 €",10000]];let tarjs="";let hay=false;checks.forEach(([lb,tg])=>{const est=estadoParaStock(tg,sd);let tx,bg,co,bo;if(est==="yes"){tx="SÍ";bg="rgba(22,163,74,0.15)";co="#4ade80";bo="#16a34a"}else if(est==="warn"){tx="MÍN";bg="rgba(234,179,8,0.15)";co="#facc15";bo="#eab308";hay=true}else{tx="NO";bg="rgba(220,38,38,0.15)";co="#f87171";bo="#dc2626";hay=true}tarjs+="<div style='flex:1;min-width:0;background:#283548;border:1px solid #475569;border-radius:10px;padding:8px 2px;display:flex;flex-direction:column;align-items:center;gap:6px'><div style='font-size:11px;font-weight:800;color:#f1f5f9;white-space:nowrap'>"+lb+"</div><div style='width:100%;padding:6px 0;border-radius:8px;background:"+bg+";border:1px solid "+bo+";color:"+co+";font-size:14px;font-weight:900;text-align:center;letter-spacing:0.5px'>"+tx+"</div></div>"});html+="<div style='margin-top:16px;padding-top:14px;border-top:1px solid #334155'>";html+=(hay?"<div style='font-size:12px;color:#fbbf24;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>⚠️ DESPUÉS DEL DEPÓSITO</div>":"<div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>✅ DESPUÉS DEL DEPÓSITO</div>");html+="<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px'>"+tarjs+"</div>";if(hay){html+="<div style='padding:12px;background:#78350f;border:1px solid #b45309;border-radius:10px;font-size:13px;color:#fbbf24;line-height:1.5;text-align:center'>⚠️ <b>Ojo</b>: después de este depósito te quedarás justo para dar cambio.<br>Puedes depositar menos o reponer caja.</div><button type='button' onclick='abrirReponerDesdeDeposito()' style='width:100%;margin-top:10px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer'>🏦 REPONER CAJA ANTES DE DEPOSITAR</button>"}else{html+="<div style='padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px;font-size:13px;color:#4ade80;line-height:1.5;text-align:center'>✅ Después de este depósito seguirás teniendo <b>cambio suficiente</b>.</div>"}html+="</div>";const sobr=target-res.total;const tot=stock.reduce((s,n,i)=>s+n*denominations[i].c,0);const queda=tot-res.total;html+="<div style='margin-top:16px;padding-top:16px;border-top:1px solid #334155;text-align:center'>";if(sobr>0){html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px'>SOBRANTE NO ENTREGABLE</div><div style='font-size:20px;font-weight:900;color:#eab308;margin-top:4px'>"+moneyText(sobr)+"</div><div style='font-size:11px;color:#64748b;margin-top:2px'>No se puede dar en billetes</div>"}html+="<div style='margin-top:14px;padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px'><div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px'>💼 TE QUEDA EN CAJA</div><div style='font-size:24px;font-weight:900;color:#4ade80;margin-top:4px'>"+moneyText(queda)+"</div><div style='font-size:11px;color:#94a3b8;margin-top:4px'>Después del depósito, en monedas y billetes restantes</div></div></div>";cont.innerHTML=html;cont.style.display="block";btn.style.display="block";btn.dataset.total=String(res.total);btn.dataset.usados=JSON.stringify(res.usados)}

function confirmarCierre(){const btn=document.getElementById("btnConfirmarCierre");if(!btn)return;const total=parseInt(btn.dataset.total)||0;const usados=JSON.parse(btn.dataset.usados||"[]");if(total<=0)return;if(!confirm("¿Confirmar depósito? Se entregarán "+moneyText(total)+" en billetes.\n\nLas propinas NO se tocan."))return;for(let i=0;i<usados.length;i++)stock[i]=Math.max(0,stock[i]-usados[i]);saveStock();renderStockList();updateCashSummary();const cierres=loadCierres();cierres.push({fecha:new Date().toISOString(),total});saveCierres(cierres);renderCierreHistorico();document.getElementById("cierreInput").value="";const cont=document.getElementById("cierreResultado");if(cont){cont.style.display="none";cont.innerHTML=""}btn.style.display="none";alert("✅ Depósito realizado.\nEntregados: "+moneyText(total))}

function renderCierreHistorico(){const box=document.getElementById("cierreHistorico");if(!box)return;const cierres=loadCierres();if(!cierres.length){box.style.display="none";box.innerHTML="";return}let html="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px'>📜 ÚLTIMOS DEPÓSITOS</div>";cierres.slice(-10).reverse().forEach(c=>{const d=new Date(c.fecha);const f=d.toLocaleDateString("es-ES")+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});const ic=c.manual?"📝 ":"";html+="<div style='padding:8px 0;border-bottom:1px solid #334155;font-size:13px'><div style='display:flex;justify-content:space-between'><span style='color:#94a3b8'>"+ic+f+"</span><span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span></div></div>"});box.innerHTML=html;box.style.display="block"}

function toggleDepositoManual(){const box=document.getElementById("depositoManualBox");if(!box)return;if(box.style.display==="none"||!box.style.display){box.style.display="block";const hoy=new Date();const iF=document.getElementById("depManualFecha");if(iF&&!iF.value){const y=hoy.getFullYear(),m=String(hoy.getMonth()+1).padStart(2,'0'),d=String(hoy.getDate()).padStart(2,'0');iF.value=y+"-"+m+"-"+d}const iH=document.getElementById("depManualHora");if(iH&&!iH.value){const hh=String(hoy.getHours()).padStart(2,'0'),mi=String(hoy.getMinutes()).padStart(2,'0');iH.value=hh+":"+mi}}else box.style.display="none"}
function añadirDepositoManual(){const fs=document.getElementById("depManualFecha").value;const hs=document.getElementById("depManualHora").value;const is=document.getElementById("depManualImporte").value;const imp=Math.round((parseFloat(is.replace(',','.'))||0)*100);if(imp<=0){alert("Escribe un importe válido.");return}if(!fs){alert("Elige una fecha.");return}if(!hs){alert("Elige una hora.");return}const [y,m,d]=fs.split("-").map(x=>parseInt(x));const [hh,mi]=hs.split(":").map(x=>parseInt(x));const fc=new Date(y,m-1,d,hh,mi,0);const cierres=loadCierres();cierres.push({fecha:fc.toISOString(),total:imp,manual:true});saveCierres(cierres);renderCierreHistorico();document.getElementById("depManualImporte").value="";const box=document.getElementById("depositoManualBox");if(box)box.style.display="none";alert("✅ Depósito manual añadido:\n"+moneyText(imp))}

function abrirDiagnostico(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("diagnosticoPantalla");if(p)p.style.display="block";renderDiagnostico()}
function cerrarDiagnostico(){const p=document.getElementById("diagnosticoPantalla");if(p)p.style.display="none"}
function renderDiagnostico(){const cont=document.getElementById("diagnosticoContenido");if(!cont)return;const ops=statsOps.operations;let html="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ESTADO DEL APRENDIZAJE</div>";if(ops<10){const fal=10-ops;html+="<div style='background:#1e3a8a;border:1px solid #3b82f6;border-radius:10px;padding:14px;text-align:center'><div style='font-size:14px;color:#93c5fd;font-weight:700;line-height:1.5'>🧠 Aún aprendiendo<br><br><span style='font-size:13px;color:#bfdbfe'>Llevo registradas <b>"+ops+"</b> operaciones.<br>Necesito al menos 10 para sugerencias fiables.<br><br>Faltan <b>"+fal+"</b> operaciones más.</span></div></div>"}else{html+="<div style='background:#064e3b;border:1px solid #059669;border-radius:10px;padding:12px;text-align:center'><div style='font-size:13px;color:#4ade80;font-weight:700;line-height:1.5'>✅ Aprendizaje activo<br><span style='font-size:12px;color:#a7f3d0'>Basado en <b>"+ops+"</b> operaciones registradas</span></div></div>"}html+="</div>";if(ops>0){html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>📊 DATOS POR DENOMINACIÓN</div><div style='display:grid;grid-template-columns:1.4fr 0.7fr 0.7fr 0.7fr 1fr;gap:6px;font-size:10px;color:#64748b;font-weight:700;padding-bottom:6px;border-bottom:1px solid #334155;text-align:right'><span style='text-align:left'>DENOM.</span><span>STOCK</span><span>RECV</span><span>GAST</span><span>ESTIM.</span></div>";denominations.forEach((d,i)=>{const sn=stock[i],rn=statsOps.received[i],gn=statsOps.spent[i];const rit=gn/ops;let est="—",co="#64748b";if(rit>0){const res=Math.floor(sn/rit);est="~"+res+" ops";if(res<5)co="#ef4444";else if(res<15)co="#fbbf24";else co="#4ade80"}html+="<div style='display:grid;grid-template-columns:1.4fr 0.7fr 0.7fr 0.7fr 1fr;gap:6px;font-size:13px;color:#fff;padding:6px 0;border-bottom:1px solid #1e293b;text-align:right'><span style='text-align:left;font-weight:700'>"+d.n+"</span><span>"+sn+"</span><span style='color:#4ade80'>"+rn+"</span><span style='color:#fbbf24'>"+gn+"</span><span style='color:"+co+";font-weight:800'>"+est+"</span></div>"});html+="</div>"}html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>💡 CÓMO LEO ESTOS DATOS</div><div style='font-size:12px;color:#94a3b8;line-height:1.7'><b style='color:#4ade80'>RECV</b> → piezas recibidas.<br><b style='color:#fbbf24'>GAST</b> → piezas devueltas como cambio.<br><b style='color:#38bdf8'>ESTIM.</b> → operaciones que aguantas.<br><br><span style='color:#64748b'>Las sugerencias se calculan con estos datos.</span></div></div>";cont.innerHTML=html}

function abrirLimitePantalla(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("limitePantalla");if(p)p.style.display="block";renderReservaList();renderTopesList()}
function cerrarLimitePantalla(){const p=document.getElementById("limitePantalla");if(p)p.style.display="none"}

function abrirCambioPantalla(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("cambioPantalla");if(p)p.style.display="block";cambioState={aEntregar:{},aRecibir:{},modo:null,orden:[],ordenRecibir:[],sinDatos:false};renderCambioInicio()}
function cerrarCambioPantalla(){const p=document.getElementById("cambioPantalla");if(p)p.style.display="none"}

function renderCambioInicio(){const cont=document.getElementById("cambioContenido");if(!cont)return;let html="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>¿QUÉ VAS A CAMBIAR?</div><div style='font-size:12px;color:#64748b;margin-bottom:10px'>Pulsa los billetes que entregarás. Debajo verás cuántos tienes.</div><div id='cambioBotones' style='display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px'></div><div style='display:flex;justify-content:space-between;align-items:center;padding:10px;background:#1e293b;border-radius:8px;margin-bottom:12px'><span style='font-size:13px;color:#94a3b8;font-weight:700'>Total a cambiar:</span><span id='cambioTotal' style='font-size:18px;font-weight:900;color:#38bdf8'>0,00 €</span></div><button type='button' onclick='calcularCambio()' style='width:100%;background:#1e40af;color:#fff;border:1px solid #3b82f6;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>🔀 Continuar</button><div style='display:flex;gap:8px;margin-bottom:8px'><button type='button' onclick='deshacerCambioEntregar()' style='flex:1;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>↩ Deshacer</button><button type='button' onclick='resetCambioEntregar()' style='flex:1;background:#7f1d1d;color:#fff;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>🗑️ Limpiar</button></div><button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button></div><div id='cambioHistorial'></div>";cont.innerHTML=html;const bot=document.getElementById("cambioBotones");[10000,5000,2000,1000,500].forEach(c=>{const idx=denominations.findIndex(x=>x.c===c);const sa=stock[idx]||0;const wrap=document.createElement("div");wrap.style.cssText="position:relative";const b=document.createElement("button");b.type="button";b.innerHTML="<div style='font-size:14px;font-weight:800'>"+(c/100)+" €</div><div style='font-size:10px;color:#94a3b8;font-weight:600;margin-top:2px'>tienes "+sa+"</div>";b.style.cssText="width:100%;background:#283548;border:1px solid #475569;color:#fff;padding:10px 4px;border-radius:10px;cursor:pointer";b.onclick=()=>{cambioState.aEntregar[c]=(cambioState.aEntregar[c]||0)+1;cambioState.orden.push(c);actualizarCambioInicio()};const bd=document.createElement("div");bd.id="cambioBadge"+c;bd.style.cssText="position:absolute;top:-6px;right:-6px;background:#38bdf8;color:#0f172a;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px;display:none";wrap.appendChild(b);wrap.appendChild(bd);bot.appendChild(wrap)});actualizarCambioInicio();renderCambioHistorial()}

function actualizarCambioInicio(){let tot=0;[10000,5000,2000,1000,500].forEach(c=>{const n=cambioState.aEntregar[c]||0;tot+=c*n;const bd=document.getElementById("cambioBadge"+c);if(bd){if(n>0){bd.textContent="x"+n;bd.style.display="block"}else bd.style.display="none"}});const el=document.getElementById("cambioTotal");if(el)el.textContent=moneyText(tot)}
function deshacerCambioEntregar(){if(!cambioState.orden)cambioState.orden=[];const last=cambioState.orden.pop();if(last==null)return;if(cambioState.aEntregar[last]>0){cambioState.aEntregar[last]--;if(cambioState.aEntregar[last]<=0)delete cambioState.aEntregar[last]}actualizarCambioInicio()}
function resetCambioEntregar(){cambioState.aEntregar={};cambioState.orden=[];actualizarCambioInicio()}

function calcularCambio(){let tot=0;Object.keys(cambioState.aEntregar).forEach(c=>{tot+=parseInt(c)*cambioState.aEntregar[c]});if(tot<=0){alert("Selecciona algún billete.");return}let err=false;Object.keys(cambioState.aEntregar).forEach(k=>{const c=parseInt(k);const i=denominations.findIndex(d=>d.c===c);if(i>=0&&stock[i]<cambioState.aEntregar[c])err=true});if(err){alert("No tienes tantos billetes de ese tipo.");return}const minE=Math.min(...Object.keys(cambioState.aEntregar).map(x=>parseInt(x)));if(statsOps.operations<10){cambioState.modo="manual";cambioState.sinDatos=true;cambioState.aRecibir={};cambioState.ordenRecibir=[];renderCambioManual(tot,minE);return}cambioState.modo="auto";cambioState.sinDatos=false;cambioState.aRecibir=calcularCambioAutomatico(tot,minE);renderCambioResultado(tot)}

function renderCambioManual(total,minEnt){const cont=document.getElementById("cambioContenido");if(!cont)return;const minE=minEnt!=null?minEnt:Math.min(...Object.keys(cambioState.aEntregar).map(x=>parseInt(x)));const opc=denominations.filter(d=>d.c<minE);let html="";if(cambioState.sinDatos){html+="<div class='card' style='margin:0 0 12px 0;background:#1e3a8a;border:1px solid #3b82f6'><div style='font-size:13px;color:#bfdbfe;font-weight:800;margin-bottom:6px'>🧠 Aún no tengo datos suficientes</div><div style='font-size:12px;color:#93c5fd;line-height:1.5'>Necesito al menos <b>10 operaciones</b> para sugerirte. De momento elige a mano.<br><br>Llevas <b>"+statsOps.operations+"</b> operaciones.</div></div>"}html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>✍️ ELIGE A MANO</div><div style='font-size:12px;color:#64748b;margin-bottom:10px'>Marca las piezas que quieres recibir. La suma debe ser "+moneyText(total)+".</div><div id='cambioManBotones' style='display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px'></div></div><div class='card' style='margin:0 0 12px 0'><div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px'><span style='font-size:13px;color:#94a3b8'>Suma actual:</span><span id='cambioManSuma' style='font-size:18px;font-weight:900;color:#38bdf8'>0,00 €</span></div><div style='display:flex;justify-content:space-between;align-items:center'><span style='font-size:13px;color:#94a3b8'>Objetivo:</span><span style='font-size:18px;font-weight:900;color:#4ade80'>"+moneyText(total)+"</span></div><div id='cambioManEstado' style='text-align:center;font-size:13px;font-weight:700;margin-top:10px'></div></div><button type='button' onclick='confirmarCambio("+total+")' id='cambioManBtn' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✅ Confirmar cambio</button><div style='display:flex;gap:8px;margin-bottom:8px'><button type='button' onclick='deshacerCambioRecibir("+total+")' style='flex:1;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>↩ Deshacer</button><button type='button' onclick='resetCambioManual("+total+")' style='flex:1;background:#7f1d1d;color:#fff;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>🗑️ Limpiar</button></div><button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";cont.innerHTML=html;const bot=document.getElementById("cambioManBotones");opc.forEach(d=>{const idx=denominations.findIndex(x=>x.c===d.c);const sa=stock[idx]||0;const wrap=document.createElement("div");wrap.style.cssText="position:relative";const b=document.createElement("button");b.type="button";b.innerHTML="<div style='font-size:13px;font-weight:800'>"+d.n+"</div><div style='font-size:10px;color:#94a3b8;font-weight:600;margin-top:2px'>tienes "+sa+"</div>";b.style.cssText="width:100%;background:#283548;border:1px solid #475569;color:#fff;padding:8px 4px;border-radius:10px;cursor:pointer";b.onclick=()=>{cambioState.aRecibir[d.c]=(cambioState.aRecibir[d.c]||0)+1;if(!cambioState.ordenRecibir)cambioState.ordenRecibir=[];cambioState.ordenRecibir.push(d.c);actualizarCambioManual(total)};const bd=document.createElement("div");bd.id="cambioManBadge"+d.c;bd.style.cssText="position:absolute;top:-6px;right:-6px;background:#38bdf8;color:#0f172a;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px;display:none";wrap.appendChild(b);wrap.appendChild(bd);bot.appendChild(wrap)});actualizarCambioManual(total)}
function resetCambioManual(total){cambioState.aRecibir={};cambioState.ordenRecibir=[];renderCambioManual(total)}
function deshacerCambioRecibir(total){if(!cambioState.ordenRecibir)cambioState.ordenRecibir=[];const last=cambioState.ordenRecibir.pop();if(last==null)return;if(cambioState.aRecibir[last]>0){cambioState.aRecibir[last]--;if(cambioState.aRecibir[last]<=0)delete cambioState.aRecibir[last]}actualizarCambioManual(total)}
function actualizarCambioManual(total){let s=0;denominations.forEach(d=>{const n=cambioState.aRecibir[d.c]||0;s+=d.c*n;const bd=document.getElementById("cambioManBadge"+d.c);if(bd){if(n>0){bd.textContent="x"+n;bd.style.display="block"}else bd.style.display="none"}});const el=document.getElementById("cambioManSuma");if(el)el.textContent=moneyText(s);const est=document.getElementById("cambioManEstado");const btn=document.getElementById("cambioManBtn");if(est&&btn){if(s===total){est.innerHTML="<span style='color:#4ade80'>✅ Cuadra perfectamente</span>";btn.style.opacity="1";btn.style.pointerEvents="auto"}else if(s<total){est.innerHTML="<span style='color:#fbbf24'>⚠️ Te faltan "+moneyText(total-s)+"</span>";btn.style.opacity="0.5";btn.style.pointerEvents="none"}else{est.innerHTML="<span style='color:#ef4444'>⚠️ Te pasas por "+moneyText(s-total)+"</span>";btn.style.opacity="0.5";btn.style.pointerEvents="none"}}}

function confirmarCambio(total){let s=0;denominations.forEach(d=>{s+=d.c*(cambioState.aRecibir[d.c]||0)});if(s!==total){alert("La suma no cuadra.");return}if(!confirm("¿Confirmar el cambio?"))return;Object.keys(cambioState.aEntregar).forEach(k=>{const c=parseInt(k);const n=cambioState.aEntregar[c];const i=denominations.findIndex(d=>d.c===c);if(i>=0&&n>0)stock[i]=Math.max(0,stock[i]-n)});denominations.forEach(d=>{const n=cambioState.aRecibir[d.c]||0;if(n>0){const i=denominations.findIndex(x=>x.c===d.c);if(i>=0)stock[i]=Math.max(0,stock[i]+n)}});const cm=loadCambios();cm.push({fecha:new Date().toISOString(),aEntregar:Object.assign({},cambioState.aEntregar),aRecibir:Object.assign({},cambioState.aRecibir),total});saveCambios(cm);saveStock();renderStockList();updateCashSummary();alert("✅ Cambio confirmado.");cerrarCambioPantalla()}

function calcularCambioAutomatico(total,bmp){const cand=denominations.filter(d=>d.c<bmp);const tope={};denominations.forEach((d,i)=>{const sa=stock[i]||0;let t=(topesRecibir[d.c]!=null)?topesRecibir[d.c]:5;if(sa>=30)t=0;else if(sa>=20)t=Math.min(t,1);else if(sa>=10)t=Math.min(t,2);else if(sa<=3)t=Math.min(t+3,12);else if(sa<=6)t=Math.min(t+1,10);tope[d.c]=t});let r=total;const prop={};const grupos=[cand.filter(d=>d.c>=1000).sort((a,b)=>b.c-a.c),cand.filter(d=>d.c>=100&&d.c<1000).sort((a,b)=>b.c-a.c),cand.filter(d=>d.c>=10&&d.c<100).sort((a,b)=>b.c-a.c),cand.filter(d=>d.c<10).sort((a,b)=>b.c-a.c)];grupos.forEach(g=>{g.forEach(d=>{if(r<=0)return;const t=tope[d.c]||0;if(t<=0)return;const c=Math.min(Math.floor(r/d.c),t);if(c>0){prop[d.c]=(prop[d.c]||0)+c;r-=c*d.c}})});if(r>0){const desc=cand.slice().sort((a,b)=>b.c-a.c);for(const d of desc){if(r<=0)break;const i=denominations.findIndex(x=>x.c===d.c);if(stock[i]>40)continue;const c=Math.floor(r/d.c);if(c>0){prop[d.c]=(prop[d.c]||0)+c;r-=c*d.c}}}return prop}

function renderCambioResultado(total){const cont=document.getElementById("cambioContenido");if(!cont)return;let html="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:12px'>🤖 PROPUESTA BASADA EN TUS HÁBITOS</div><div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ENTREGAS AL BANCO</div><div class='change-grid'>";Object.keys(cambioState.aEntregar).forEach(k=>{const c=parseInt(k);const n=cambioState.aEntregar[c];if(n>0){const d=denominations.find(x=>x.c===c);if(d)html+="<div class='cash-item'><div class='badge'>x"+n+"</div><div class='bill-graphic "+d.class+"'>"+d.short+"</div></div>"}});html+="</div><div style='font-size:12px;color:#38bdf8;font-weight:800;letter-spacing:0.5px;margin:16px 0 8px;padding-top:14px;border-top:1px solid #334155'>PIDE QUE TE DEVUELVAN</div><div class='change-grid'>";const ord=Object.keys(cambioState.aRecibir).map(k=>parseInt(k)).filter(c=>cambioState.aRecibir[c]>0).sort((a,b)=>b-a);ord.forEach(c=>{const n=cambioState.aRecibir[c];const d=denominations.find(x=>x.c===c);if(d){const cl=d.type==="bill"?"bill-graphic ":"coin-graphic ";html+="<div class='cash-item'><div class='badge'>x"+n+"</div><div class='"+cl+d.class+"'>"+d.short+"</div></div>"}});html+="</div><div style='display:flex;justify-content:space-between;padding:14px 0 0;margin-top:14px;border-top:1px solid #334155;font-size:16px;color:#fff'><span style='font-weight:800'>Total:</span><span style='font-weight:900;color:#4ade80'>"+moneyText(total)+"</span></div></div><button type='button' onclick='confirmarCambio("+total+")' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✅ Confirmar cambio</button><button type='button' onclick='pasarAModoManual("+total+")' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✍️ Ajustar a mano</button><button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#1e293b;color:#94a3b8;border:1px solid #475569;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";cont.innerHTML=html}

function pasarAModoManual(total){cambioState.modo="manual";cambioState.sinDatos=false;cambioState.aRecibir={};cambioState.ordenRecibir=[];renderCambioManual(total)}

function renderCambioHistorial(){const box=document.getElementById("cambioHistorial");if(!box)return;const cm=loadCambios();if(!cm.length){box.innerHTML="";return}let html="<div class='card' style='margin:0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>📜 HISTORIAL DE CAMBIOS</div>";cm.slice(-15).reverse().forEach(c=>{const d=new Date(c.fecha);const f=d.toLocaleDateString("es-ES")+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});const ent=Object.keys(c.aEntregar).map(k=>{const ce=parseInt(k),n=c.aEntregar[k];const p=denominations.find(x=>x.c===ce);const nom=p?p.short:(ce/100)+"€";return n+"×"+nom}).join(" + ");const rec=Object.keys(c.aRecibir).map(k=>{const ce=parseInt(k),n=c.aRecibir[k];const p=denominations.find(x=>x.c===ce);const nom=p?p.short:(ce/100)+"€";return n+"×"+nom}).join(" + ");html+="<div style='padding:10px 0;border-bottom:1px solid #334155'><div style='font-size:12px;color:#94a3b8;margin-bottom:4px'>📝 "+f+"</div><div style='font-size:13px;color:#fff'><b>Cambio de "+moneyText(c.total)+"</b></div><div style='font-size:12px;color:#4ade80;margin-top:2px'>→ "+ent+"</div><div style='font-size:12px;color:#38bdf8;margin-top:2px'>← "+rec+"</div></div>"});html+="</div>";box.innerHTML=html}

function configuracionRecomendada(){const ops=statsOps.operations;let v=20;if(ops>=5)v=Math.min(30,Math.max(15,Math.round(ops*0.8)));let c=ops>=30?4:3;return{viajes:v,colchon:c}}

function calcularFaltantes(v,c){const ops=statsOps.operations;const fal=[],obj={};denominations.forEach((d,i)=>{const sa=stock[i]||0;const t=(topesRecibir[d.c]||0);const limSup=Math.max(1,Math.floor(t*FACTOR_LLENADO));let o;if(ops>=5){const gm=statsOps.spent[i]/ops;o=Math.ceil(gm*v)+c}else{const ba=ARRANQUE[d.c]||0;o=Math.ceil(ba*(v/20))+c}o=Math.min(o,limSup);obj[d.c]=o;const falta=Math.max(0,o-sa);if(falta>0)fal.push({d,index:i,falta})});const total=fal.reduce((s,x)=>s+x.falta*x.d.c,0);return{faltantes:fal,total}}

function abrirReponerPantalla(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("reponerPantalla");if(p)p.style.display="block";reponerState.manualInicializado=false;reponerState.manualAdd={};reponerState.importeManual=0;renderReponerInicio()}
function cerrarReponerPantalla(){const p=document.getElementById("reponerPantalla");if(p)p.style.display="none"}
function abrirReponerDesdeDeposito(){cerrarCierrePantalla();abrirReponerPantalla()}

function renderReponerInicio(){const cont=document.getElementById("reponerContenido");if(!cont)return;let html="";const modoAuto=reponerState.modo!=="manual";html+="<div style='display:flex;gap:6px;margin-bottom:12px'><button type='button' onclick='cambiarModoReponer(\"auto\")' style='flex:1;padding:10px;border-radius:10px;border:1px solid "+(modoAuto?"#3b82f6":"#475569")+";background:"+(modoAuto?"#1e40af":"#1e293b")+";color:"+(modoAuto?"#fff":"#94a3b8")+";font-weight:700;cursor:pointer;font-size:13px'>🤖 Automático</button><button type='button' onclick='cambiarModoReponer(\"manual\")' style='flex:1;padding:10px;border-radius:10px;border:1px solid "+(!modoAuto?"#3b82f6":"#475569")+";background:"+(!modoAuto?"#1e40af":"#1e293b")+";color:"+(!modoAuto?"#fff":"#94a3b8")+";font-weight:700;cursor:pointer;font-size:13px'>✍️ Manual</button></div>";if(modoAuto){const rec=configuracionRecomendada();html+="<div class='card' style='margin:0 0 12px 0;background:#1e3a8a;border:1px solid #3b82f6'><div style='font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🧠 RECOMENDACIÓN DEL SISTEMA</div>";if(statsOps.operations>=5){html+="<div style='font-size:13px;color:#93c5fd;line-height:1.5'>Basado en tus <b>"+statsOps.operations+" operaciones</b>, cubre <b>"+rec.viajes+" viajes</b> con colchón de <b>"+rec.colchon+"</b> piezas.<br><br>El objetivo nunca supera el <b>"+Math.round(FACTOR_LLENADO*100)+"% del tope</b>, para dejar hueco al cambio que entra.</div>"}else{html+="<div style='font-size:13px;color:#93c5fd;line-height:1.5'>🧠 Aún sin datos suficientes. Caja de arranque: cubrir <b>"+rec.viajes+" viajes</b> con colchón de <b>"+rec.colchon+"</b>.<br><br>El objetivo nunca supera el <b>"+Math.round(FACTOR_LLENADO*100)+"% del tope</b>, para dejar hueco al cambio que entra.<br><br>A partir de 5 operaciones se ajusta solo.</div>"}html+="</div><div id='reponerDinamico'></div><button type='button' onclick='confirmarReponer()' id='reponerBtnConfirmar' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:16px;cursor:pointer;margin-bottom:8px;margin-top:8px'>✅ AÑADIR A LA CAJA</button><button type='button' onclick='cerrarReponerPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";cont.innerHTML=html;actualizarReponerPropuesta()}else{html+="<div class='card' style='margin:0 0 12px 0'><label style='font-size:13px;color:#94a3b8;font-weight:800;display:block;text-align:center'>💰 ¿CUÁNTO QUIERES SACAR DEL BANCO?</label><input type='number' id='reponerImporteManual' min='0' step='0.01' inputmode='decimal' value='"+(reponerState.importeManual>0?(reponerState.importeManual/100).toFixed(2):"")+"' oninput='onCambioImporteManual()' placeholder='Ej. 130.00' style='width:100%;font-size:32px;font-weight:900;padding:14px;border-radius:12px;border:1px solid #3b82f6;background:#0f172a;color:#38bdf8;text-align:center;margin-top:8px;outline:none'><div style='font-size:11px;color:#64748b;margin-top:8px;line-height:1.4;text-align:center'>Escribe el importe y la app reparte las piezas variadas. Ajusta con + / −.</div></div><div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>✍️ AJUSTA LAS PIEZAS</div><div id='reponerManualLista'></div></div><div class='card' style='margin:0 0 12px 0;text-align:center;background:"+(reponerState.importeManual>0?"#1e3a8a":"#0f172a")+";border:1px solid "+(reponerState.importeManual>0?"#3b82f6":"#334155")+"'><div style='font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🏦 SACA DEL BANCO</div><div id='reponerManualTotal' style='font-size:38px;font-weight:900;color:#fff'>0,00 €</div><div id='reponerManualEstado' style='font-size:12px;color:#bfdbfe;margin-top:6px'></div></div><button type='button' onclick='confirmarReponer()' id='reponerBtnConfirmar' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:16px;cursor:pointer;margin-bottom:8px'>✅ AÑADIR A LA CAJA</button><button type='button' onclick='resetManualReponer()' style='width:100%;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px'>🗑️ Limpiar todo</button><button type='button' onclick='cerrarReponerPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";cont.innerHTML=html;if(Object.keys(reponerState.manualAdd).length===0)denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});actualizarReponerManual()}}

function cambiarModoReponer(modo){reponerState.modo=modo;if(modo==="manual"){if(Object.keys(reponerState.manualAdd).length===0)denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});if(reponerState.importeManual>0)setTimeout(()=>onCambioImporteManual(),0)}renderReponerInicio()}

function actualizarReponerPropuesta(){const zona=document.getElementById("reponerDinamico"),btn=document.getElementById("reponerBtnConfirmar");if(!zona)return;const rec=configuracionRecomendada();const {faltantes,total}=calcularFaltantes(rec.viajes,rec.colchon);if(!faltantes.length){zona.innerHTML="<div class='card' style='margin:0 0 12px 0;text-align:center'><div style='font-size:48px;margin-bottom:12px'>✅</div><div style='font-size:16px;color:#4ade80;font-weight:800;margin-bottom:8px'>Caja suficiente</div><div style='font-size:13px;color:#94a3b8;line-height:1.6'>Con tu gasto actual tienes cambio suficiente. No necesitas ir al banco.</div></div>";if(btn)btn.style.display="none";return}if(btn)btn.style.display="block";let html="<div class='card' style='margin:0 0 12px 0;text-align:center;background:#1e3a8a;border:1px solid #3b82f6'><div style='font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🏦 SACA DEL BANCO</div><div id='reponerTotal' style='font-size:38px;font-weight:900;color:#fff'>"+moneyText(total)+"</div><div style='font-size:12px;color:#bfdbfe;margin-top:6px'>Pulsa cada pieza para marcarla/desmarcarla</div></div><div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>📋 DESGLOSE A PEDIR</div>";const b=faltantes.filter(x=>x.d.type==="bill").sort((a,b)=>b.d.c-a.d.c);const m=faltantes.filter(x=>x.d.type==="coin").sort((a,b)=>b.d.c-a.d.c);const rowF=x=>{const d=x.d,c=d.c;const marc=reponerState.marcados[c]!==false;const imp=x.falta*c;const gc=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;return"<label style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #334155;cursor:pointer'><input type='checkbox' data-c='"+c+"' "+(marc?"checked":"")+" onchange='toggleMarcadoReponer(this)' style='width:22px;height:22px;cursor:pointer;flex-shrink:0'><div class='"+gc+"' style='flex-shrink:0'>"+d.short+"</div><div style='flex:1;min-width:0'><div class='reponerFila' style='font-size:15px;font-weight:800;color:"+(marc?"#fff":"#475569")+"'>"+x.falta+" × "+d.n+"</div><div style='font-size:12px;color:#94a3b8'>"+moneyText(imp)+"</div></div></label>"};if(b.length){html+="<div style='font-size:11px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin:6px 0 4px'>💵 BILLETES</div>";b.forEach(x=>{html+=rowF(x)})}if(m.length){html+="<div style='font-size:11px;color:#facc15;font-weight:800;letter-spacing:0.5px;margin:12px 0 4px'>🪙 MONEDAS</div>";m.forEach(x=>{html+=rowF(x)})}html+="</div>";zona.innerHTML=html}

function toggleMarcadoReponer(cb){const c=parseInt(cb.dataset.c);reponerState.marcados[c]=cb.checked;const rec=configuracionRecomendada();const {faltantes}=calcularFaltantes(rec.viajes,rec.colchon);let nt=0;faltantes.forEach(x=>{if(reponerState.marcados[x.d.c]!==false)nt+=x.falta*x.d.c});const el=document.getElementById("reponerTotal");if(el)el.textContent=moneyText(nt);const div=cb.parentElement.querySelector(".reponerFila");if(div)div.style.color=cb.checked?"#fff":"#475569"}

function actualizarReponerManual(){
  const cont=document.getElementById("reponerManualLista");
  if(!cont)return;
  let html="";
  denominations.forEach((d,i)=>{
    const act=stock[i]||0;
    const add=reponerState.manualAdd[d.c]||0;
    const qu=act+add;
    const tope=(topesRecibir[d.c]!=null)?topesRecibir[d.c]:0;
    const objetivo=Math.floor(tope*FACTOR_LLENADO);
    // Color dinámico según lo cerca que esté del objetivo del 70% o del tope
    let colorQu="#38bdf8";
    let aviso="";
    if(add>0){
      if(tope>0&&qu>tope){colorQu="#ef4444";aviso=" ⚠ supera tope ("+tope+")";}
      else if(objetivo>0&&qu>objetivo){colorQu="#fbbf24";aviso=" · por encima del 70% ("+objetivo+")";}
    }
    const gc=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;
    html+="<div style='display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #334155'><div class='"+gc+"' style='flex-shrink:0'>"+d.short+"</div><div style='flex:1;min-width:0'><div style='font-size:14px;font-weight:700;color:#fff'>"+d.n+"</div><div style='font-size:11px;color:#94a3b8'>Tienes "+act+" → quedarían <b style='color:"+colorQu+"'>"+qu+"</b>"+aviso+"</div></div><div style='display:flex;align-items:center;gap:6px;flex-shrink:0'><button type='button' onclick='ajustarManualReponer("+d.c+",-1)' style='width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:800;cursor:pointer'>−</button><div style='width:40px;text-align:center;font-size:18px;font-weight:900;color:"+(add>0?"#4ade80":"#475569")+"'>"+add+"</div><button type='button' onclick='ajustarManualReponer("+d.c+",1)' style='width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:800;cursor:pointer'>+</button></div></div>"
  });
  cont.innerHTML=html;
  let tot=0;
  denominations.forEach(d=>{tot+=(reponerState.manualAdd[d.c]||0)*d.c});
  const elT=document.getElementById("reponerManualTotal");
  if(elT)elT.textContent=moneyText(tot);
  const elE=document.getElementById("reponerManualEstado");
  if(elE&&reponerState.importeManual>0){
    const dif=tot-reponerState.importeManual;
    if(dif===0)elE.innerHTML="<span style='color:#4ade80'>✅ Coincide con lo que quieres sacar</span>";
    else if(dif<0)elE.innerHTML="<span style='color:#fbbf24'>⚠️ Te faltan "+moneyText(-dif)+"</span>";
    else elE.innerHTML="<span style='color:#f87171'>⚠️ Te pasas por "+moneyText(dif)+"</span>"
  } else if(elE)elE.innerHTML=""
}

function onCambioImporteManual(){const inp=document.getElementById("reponerImporteManual");if(!inp)return;const raw=parseFloat(inp.value.replace(',','.'))||0;const cents=Math.max(0,Math.round(raw*100));reponerState.importeManual=cents;if(cents>0){const rep=simularRepartoManual(cents);denominations.forEach((d,i)=>{reponerState.manualAdd[d.c]=rep[i]})}else denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});actualizarReponerManual()}

/* ---------- Reparto manual VARIADO (respeta hueco del 70% y tope) ---------- */
function simularRepartoManual(target){
  const objetivo  = denominations.map((d,i) => Math.floor((topesRecibir[d.c]||0) * FACTOR_LLENADO));
  const hueco     = denominations.map((d,i) => Math.max(0, objetivo[i] - (stock[i]||0)));
  const añadidos  = denominations.map(() => 0);
  let restante    = target;

  // Ninguna pieza puede superar 1/3 del importe a repartir (salvo la más pequeña)
  const maxPieza = Math.max(denominations[denominations.length-1].c, Math.floor(target / 3));

  // Ronda 1: reparto proporcional al hueco real disponible
  const huecoFil = denominations.map((d,i) => d.c <= maxPieza ? hueco[i] : 0);
  const costeFil = denominations.reduce((s,d,i) => s + huecoFil[i] * d.c, 0);

  if(costeFil > 0){
    const f = Math.min(1, target / costeFil);
    denominations.forEach((d,i) => {
      const n = Math.floor(huecoFil[i] * f);
      añadidos[i] = n;
      restante -= n * d.c;
    });
  }

  // Ronda 2: reparte el resto sin pasarse del hueco de cada pieza
  if(restante > 0){
    let seguir = true;
    let seguridad = 5000; // evita bucles infinitos
    while(restante > 0 && seguir && seguridad-- > 0){
      seguir = false;
      for(let i = denominations.length - 1; i >= 0; i--){
        if(restante <= 0) break;
        const d = denominations[i];
        if(d.c > maxPieza) continue;
        if(añadidos[i] >= hueco[i]) continue;   // ← respeta el 70%
        if(d.c <= restante){
          añadidos[i]++;
          restante -= d.c;
          seguir = true;
        }
      }
    }
  }

  // Ronda 3: último recurso, solo piezas con hueco libre
  if(restante > 0){
    for(let i = 0; i < denominations.length; i++){
      if(restante <= 0) break;
      const d = denominations[i];
      const libre = Math.max(0, hueco[i] - añadidos[i]);
      if(libre <= 0) continue;
      const n = Math.min(libre, Math.floor(restante / d.c));
      if(n > 0){
        añadidos[i] += n;
        restante -= n * d.c;
      }
    }
  }

  // Ronda 4: emergencia real (solo si no hubiera hueco por debajo del 70%)
  if(restante > 0){
    for(let i = 0; i < denominations.length; i++){
      if(restante <= 0) break;
      const d = denominations[i];
      const n = Math.floor(restante / d.c);
      if(n > 0){
        añadidos[i] += n;
        restante -= n * d.c;
      }
    }
  }

  return añadidos;
}

function ajustarManualReponer(cents,delta){reponerState.manualAdd[cents]=Math.max(0,(reponerState.manualAdd[cents]||0)+delta);actualizarReponerManual()}
function resetManualReponer(){denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});reponerState.importeManual=0;const inp=document.getElementById("reponerImporteManual");if(inp)inp.value="";actualizarReponerManual()}

function confirmarReponer(){let añadir=[];let total=0;if(reponerState.modo==="manual"){denominations.forEach((d,i)=>{const n=reponerState.manualAdd[d.c]||0;if(n>0){añadir.push({index:i,cantidad:n});total+=n*d.c}});if(!añadir.length){alert("No has añadido ninguna pieza.");return}}else{const rec=configuracionRecomendada();const {faltantes}=calcularFaltantes(rec.viajes,rec.colchon);faltantes.forEach(x=>{if(reponerState.marcados[x.d.c]!==false){añadir.push({index:x.index,cantidad:x.falta});total+=x.falta*x.d.c}});if(!añadir.length){alert("No has marcado ninguna pieza.");return}}if(!confirm("¿Confirmar que has sacado "+moneyText(total)+" del banco y los has metido en la caja?"))return;añadir.forEach(x=>{stock[x.index]+=x.cantidad});saveStock();renderStockList();updateCashSummary();alert("✅ Añadido a la caja: "+moneyText(total));cerrarReponerPantalla()}

function setupBackupUI(){const p=document.getElementById("panelInventario");if(!p)return;if(document.getElementById("backupBox"))return;const box=document.createElement("div");box.id="backupBox";box.style.cssText="margin-top:16px;border-top:1px solid #334155;padding-top:14px";const tt=document.createElement("div");tt.textContent="COPIA DE SEGURIDAD";tt.style.cssText="font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px";const be=document.createElement("button");be.type="button";be.textContent="💾 Guardar copia";be.style.cssText="width:100%;background:#334155;color:#fff;padding:12px;border-radius:10px;margin-bottom:8px;font-weight:700;font-size:15px;border:none;cursor:pointer";be.onclick=exportInventory;const bi=document.createElement("button");bi.type="button";bi.textContent="📂 Cargar copia";bi.style.cssText=be.style.cssText;bi.onclick=()=>fi.click();const fi=document.createElement("input");fi.type="file";fi.accept="application/json,.json";fi.style.display="none";fi.onchange=e=>{const f=e.target.files[0];if(f)importInventory(f);fi.value=""};box.appendChild(tt);box.appendChild(be);box.appendChild(bi);box.appendChild(fi);p.appendChild(box)}

async function exportInventory(){const data={app:"uberCambioVTC",version:10,exportedAt:new Date().toISOString(),stock,totalTips,reservaMinima,topesRecibir,diaReset,ultimoResetPropinas,stats:statsOps,cierres:loadCierres(),historicoResets:loadHistoricoResets(),cambios:loadCambios()};const js=JSON.stringify(data,null,2);const st=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");const fn="cambio-vtc-"+st+".json";try{if(typeof navigator.canShare==="function"&&typeof File!=="undefined"){const f=new File([js],fn,{type:"application/json"});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:"Copia de seguridad VTC"});return}}}catch(e){if(e&&e.name==="AbortError")return}let dl=false;try{const b=new Blob([js],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=fn;a.rel="noopener";document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(u),1000);dl=true}catch(e){}setTimeout(()=>showCopyFallback(js,dl),dl?400:0)}

function showCopyFallback(js,after){const prev=document.getElementById("copyBackupModal");if(prev)prev.remove();const m=document.createElement("div");m.id="copyBackupModal";m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";const b=document.createElement("div");b.style.cssText="background:#1e293b;color:#f8fafc;border-radius:14px;padding:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto";const t=document.createElement("h3");t.textContent="Copia de seguridad";t.style.cssText="margin:0 0 8px;font-size:16px";const i=document.createElement("p");i.textContent=after?"Si no se ha descargado, copia este texto y guárdalo como .json.":"Copia este texto y guárdalo como .json.";i.style.cssText="font-size:13px;color:#94a3b8;margin:0 0 10px";const ta=document.createElement("textarea");ta.value=js;ta.readOnly=true;ta.style.cssText="width:100%;height:180px;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:10px;font-family:monospace;font-size:12px";const r=document.createElement("div");r.style.cssText="display:flex;gap:8px;margin-top:12px";const bc=document.createElement("button");bc.type="button";bc.textContent="📋 Copiar";bc.style.cssText="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;cursor:pointer";bc.onclick=async()=>{ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(js);else document.execCommand("copy");bc.textContent="✅ Copiado";setTimeout(()=>{bc.textContent="📋 Copiar"},1500)}catch(e){try{document.execCommand("copy");bc.textContent="✅ Copiado"}catch(_){bc.textContent="Selecciona y copia"}setTimeout(()=>{bc.textContent="📋 Copiar"},1500)}};const bx=document.createElement("button");bx.type="button";bx.textContent="Cerrar";bx.style.cssText="flex:1;background:#0f172a;color:#f8fafc;border:1px solid #475569;padding:12px;border-radius:10px;font-weight:700;cursor:pointer";bx.onclick=()=>m.remove();m.addEventListener("click",e=>{if(e.target===m)m.remove()});r.appendChild(bc);r.appendChild(bx);b.appendChild(t);b.appendChild(i);b.appendChild(ta);b.appendChild(r);m.appendChild(b);document.body.appendChild(m);setTimeout(()=>{ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length)},50)}

function importInventory(file){const rd=new FileReader();rd.onload=()=>{try{const data=JSON.parse(rd.result);if(!data||!Array.isArray(data.stock)||data.stock.length!==denominations.length){alert("El archivo no es una copia válida.");return}if(!confirm("¿Reemplazar el inventario, propinas, reserva, topes, estadísticas e historial actuales?"))return;stock=data.stock.map(x=>Math.max(0,parseInt(x)||0));if(typeof data.totalTips==="number")totalTips=Math.max(0,data.totalTips);if(data.reservaMinima&&typeof data.reservaMinima==="object"){reservaMinima=Object.assign({},RESERVA_DEFAULT);denominations.forEach(d=>{if(typeof data.reservaMinima[d.c]==="number")reservaMinima[d.c]=Math.max(0,parseInt(data.reservaMinima[d.c])||0)});safeStorage.set("uberCambioReserva",JSON.stringify(reservaMinima))}if(data.topesRecibir&&typeof data.topesRecibir==="object"){topesRecibir=Object.assign({},TOPES_DEFAULT);denominations.forEach(d=>{if(typeof data.topesRecibir[d.c]==="number")topesRecibir[d.c]=Math.max(0,parseInt(data.topesRecibir[d.c])||0)});saveTopes()}if(typeof data.diaReset==="number"){diaReset=Math.max(1,Math.min(31,parseInt(data.diaReset)||20));saveDiaReset()}if(typeof data.ultimoResetPropinas==="string"){ultimoResetPropinas=data.ultimoResetPropinas;saveUltimoResetPropinas()}if(data.stats&&typeof data.stats==="object"){statsOps={operations:parseInt(data.stats.operations)||0,received:Array.isArray(data.stats.received)?data.stats.received.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),spent:Array.isArray(data.stats.spent)?data.stats.spent.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0)};saveStats()}if(Array.isArray(data.cierres))saveCierres(data.cierres);if(Array.isArray(data.historicoResets))saveHistoricoResets(data.historicoResets);if(Array.isArray(data.cambios))saveCambios(data.cambios);saveStock();saveTips();renderStockList();renderReservaList();renderTopesList();updateCashSummary();renderCierreHistorico();renderResetPanel();alert("✅ Copia restaurada.")}catch(e){alert("No se pudo leer el archivo.")}};rd.readAsText(file)}

/* ==================== LECTURA DE PRECIO POR OCR ==================== */
let tesseractLoaded = false;
let tesseractLoading = null;

async function cargarTesseract(){
  if(tesseractLoaded) return window.Tesseract;
  if(tesseractLoading) return tesseractLoading;
  tesseractLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => { tesseractLoaded = true; resolve(window.Tesseract); };
    s.onerror = () => reject(new Error("No se pudo cargar el OCR"));
    document.head.appendChild(s);
  });
  return tesseractLoading;
}

async function precalentarOCR(){
  try {
    const Tesseract = await cargarTesseract();
    // Creamos el worker con los dos idiomas para que descargue
    // el WASM + los traineddata en segundo plano. Lo cerramos al instante
    // porque solo lo queremos para forzar el cacheo.
    const worker = await Tesseract.createWorker("spa+eng");
    await worker.terminate();
    console.log("✅ OCR precargado en segundo plano");
  } catch(e){
    // Si falla no rompemos nada: la primera vez que pulses 📷 lo cargará.
    console.warn("⚠️ Precalentado OCR falló:", e && e.message);
  }
}

async function leerPrecioDeImagen(){
  // 1) Intentar leer del portapapeles
  try {
    if(navigator.clipboard && navigator.clipboard.read){
      const items = await navigator.clipboard.read();
      for(const item of items){
        const tipos = item.types.filter(t => t.startsWith("image/"));
        if(tipos.length){
          const blob = await item.getType(tipos[0]);
          return procesarImagenPrecio(blob);
        }
      }
    }
  } catch(e){
    // Sin permiso o sin imagen → caemos a galería
    console.warn("Portapapeles no disponible:", e && e.name);
  }
  // 2) Fallback: abrir la galería
  const inp = document.getElementById("precioImagenInput");
  if(inp) inp.click();
}

function onImagenPrecioSeleccionada(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if(!file) return;
  procesarImagenPrecio(file);
}

async function procesarImagenPrecio(blob){
  mostrarOCRModal("🔎 Leyendo la imagen…<br><span style='font-size:12px;color:#94a3b8'>La primera vez puede tardar unos segundos</span>", false);
  try {
    const Tesseract = await cargarTesseract();
    const resultado = await Tesseract.recognize(blob, "spa+eng", {
      logger: m => {
        if(m.status === "recognizing text"){
          mostrarOCRModal("🔎 Leyendo… " + Math.round(m.progress * 100) + "%", false);
        }
      }
    });
    const texto = (resultado && resultado.data && resultado.data.text) || "";
    const importe = extraerImporte(texto);
    if(importe == null){
      const preview = (texto || "").replace(/\s+/g, " ").trim().slice(0, 200);
      mostrarOCRModal(
        "❌ No he podido leer el precio." +
        "<div style='font-size:11px;color:#94a3b8;margin-top:10px;padding:8px;background:#0f172a;border-radius:6px;text-align:left;word-break:break-word;max-height:120px;overflow:auto'>" +
        "<b style='color:#38bdf8'>Texto detectado:</b><br>" + (preview || "(vacío)") +
        "</div>" +
        "<div style='font-size:12px;color:#94a3b8;margin-top:10px'>Prueba con otra captura o escríbelo a mano.</div>",
        true
      );
      return;
    }
    const inp = document.getElementById("price");
    if(inp){
      inp.value = importe.toFixed(2);
      calculate();
    }
    cerrarOCRModal();
    mostrarToast("✅ Precio leído: " + importe.toFixed(2) + " €");
  } catch(e){
    console.error(e);
    mostrarOCRModal("❌ Error al procesar la imagen:<br><span style='font-size:11px;color:#94a3b8'>" + (e && e.message ? e.message : "desconocido") + "</span>", true);
  }
}

function extraerImporte(texto){
  if(!texto) return null;
  // Guardamos el texto para debug
  window.__ultimoOCR = texto;
  console.log("📄 Texto OCR completo:", texto);

  // Normalizar confusiones típicas del OCR: O→0, l/I→1, S→5, B→8
  let t = texto
    .replace(/[Oo]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");

  // Patrón 1: número con 1 o 2 decimales (7,10 / 7.10 / 17,5 / 1.234,56)
  const re1 = /\d{1,3}(?:[.,]\s?\d{3})*[.,]\s?\d{1,2}/g;
  const matches = t.match(re1) || [];
  const nums = matches.map(s => {
    const clean = s.replace(/\s/g, "");
    const m = clean.match(/^(.*)[.,](\d{1,2})$/);
    if(!m) return NaN;
    const entero = m[1].replace(/[.,]/g, "");
    let dec = m[2];
    if(dec.length === 1) dec = dec + "0";
    return parseFloat(entero + "." + dec);
  }).filter(n => !isNaN(n) && n >= 0.5 && n <= 999);

  if(nums.length) return Math.max.apply(null, nums);

  // Patrón 2 (fallback): número más grande de 2-3 dígitos enteros
  // Excluimos las horas del tipo "13:35"
  const sinHoras = t.replace(/\d{1,2}:\d{2}/g, " ");
  const matches2 = sinHoras.match(/\b\d{2,3}\b/g) || [];
  const nums2 = matches2
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n) && n >= 5 && n <= 300);

  if(nums2.length) return Math.max.apply(null, nums2);

  return null;
}

function mostrarOCRModal(msg, esError){
  let m = document.getElementById("ocrModal");
  if(!m){
    m = document.createElement("div");
    m.id = "ocrModal";
    m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px";
    m.innerHTML = "<div style='background:#1e293b;color:#f8fafc;border-radius:14px;padding:20px;max-width:340px;width:100%;text-align:center'><div id='ocrModalMsg' style='font-size:14px;line-height:1.5;margin-bottom:14px'></div><button type='button' id='ocrModalBtn' onclick='cerrarOCRModal()' style='background:#334155;color:#fff;border:none;padding:10px 18px;border-radius:10px;font-weight:700;cursor:pointer'>Cerrar</button></div>";
    document.body.appendChild(m);
  }
  document.getElementById("ocrModalMsg").innerHTML = msg;
  const btn = document.getElementById("ocrModalBtn");
  btn.style.display = esError ? "block" : "none";
  m.style.display = "flex";
}

function cerrarOCRModal(){
  const m = document.getElementById("ocrModal");
  if(m) m.style.display = "none";
}

function mostrarToast(msg){
  let t = document.getElementById("toastPrecio");
  if(!t){
    t = document.createElement("div");
    t.id = "toastPrecio";
    t.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;opacity:0;pointer-events:none";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => { t.style.opacity = "0"; }, 2200);
}
/* ==================== FIN OCR ==================== */

function init(){
  try{renderButtons()}catch(e){console.error("renderButtons",e)}
  try{renderStockList()}catch(e){console.error("renderStockList",e)}
  try{updateCashSummary()}catch(e){console.error("updateCashSummary",e)}
  try{setupBackupUI()}catch(e){console.error("setupBackupUI",e)}
  try{renderCierreHistorico()}catch(e){console.error("renderCierreHistorico",e)}
  try{checkAutoResetPropinas()}catch(e){console.error("checkAutoResetPropinas",e)}

  // Precarga el OCR mientras se muestra el splash.
  // No lo esperamos: corre en segundo plano y no bloquea la UI.
  setTimeout(() => { precalentarOCR(); }, 300);

  const s=document.getElementById("splash");
  if(s){
    setTimeout(()=>{
      s.classList.add("oculto");
      document.body.classList.remove("splash-active");
      setTimeout(()=>{if(s.parentNode)s.parentNode.removeChild(s)},500)
    },2500)
  }
}

init();