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
const FACTOR_LLENADO=0.7;
let stock=loadStock(),totalTips=loadTips(),reservaMinima=loadReserva(),topesRecibir=loadTopes();
let diaReset=loadDiaReset(),ultimoResetPropinas=loadUltimoResetPropinas(),statsOps=loadStats();
let modoEdicion = safeStorage.get("uberCambioModoEdicion") === "1";
let received=[],pendingTransaction=null,stockInputs=[],reservaInputs=[],summaryTimer=null,precioInterval=null,precioActual=0;
let propinasDelCambio = {};
let tipManual = 0;
let cambioState={aEntregar:{},aRecibir:{},modo:null,orden:[],ordenRecibir:[],sinDatos:false};
let reponerState={viajes:20,colchon:3,marcados:{},modo:"auto",manualAdd:{},importeManual:0};
let movimientoState={tipo:"entrada",motivo:"propina",piezas:{}};

function loadStock(){const s=safeStorage.get("uberCambioStock");if(s){try{const a=JSON.parse(s);if(Array.isArray(a)&&a.length===denominations.length)return a.map(x=>Math.max(0,parseInt(x)||0))}catch(e){}}return[0,0,2,3,4,10,10,20,40,10,10,10,10]}
function loadTips(){return parseInt(safeStorage.get("uberCambioTips"))||0}
function loadReserva(){const b=Object.assign({},RESERVA_DEFAULT);const s=safeStorage.get("uberCambioReserva");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object")denominations.forEach(d=>{if(typeof o[d.c]==="number")b[d.c]=Math.max(0,parseInt(o[d.c])||0)})}catch(e){}}return b}
function loadTopes(){const b=Object.assign({},TOPES_DEFAULT);const s=safeStorage.get("uberCambioTopes");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object")denominations.forEach(d=>{if(typeof o[d.c]==="number")b[d.c]=Math.max(0,parseInt(o[d.c])||0)})}catch(e){}}return b}
function loadDiaReset(){const n=parseInt(safeStorage.get("uberCambioDiaReset"));return(n>=1&&n<=31)?n:20}
function saveDiaReset(){safeStorage.set("uberCambioDiaReset",String(diaReset))}
function loadUltimoResetPropinas(){return safeStorage.get("uberCambioUltimoResetPropinas")||null}
function saveUltimoResetPropinas(){safeStorage.set("uberCambioUltimoResetPropinas",ultimoResetPropinas||"")}
function loadStats(){
  const s=safeStorage.get("uberCambioStats");
  if(s){
    try{
      const o=JSON.parse(s);
      if(o&&Array.isArray(o.received)&&Array.isArray(o.spent)){
        return{
          operations:parseInt(o.operations)||0,
          received:o.received.map(x=>parseInt(x)||0),
          spent:o.spent.map(x=>parseInt(x)||0),
          deposited:Array.isArray(o.deposited)?o.deposited.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          repuesto:Array.isArray(o.repuesto)?o.repuesto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          cambioNeto:Array.isArray(o.cambioNeto)?o.cambioNeto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          manualIn:Array.isArray(o.manualIn)?o.manualIn.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          manualOut:Array.isArray(o.manualOut)?o.manualOut.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0)
        }
      }
    }catch(e){}
  }
  return{
    operations:0,
    received:new Array(denominations.length).fill(0),
    spent:new Array(denominations.length).fill(0),
    deposited:new Array(denominations.length).fill(0),
    repuesto:new Array(denominations.length).fill(0),
    cambioNeto:new Array(denominations.length).fill(0),
    manualIn:new Array(denominations.length).fill(0),
    manualOut:new Array(denominations.length).fill(0)
  }
}
function saveStats(){safeStorage.set("uberCambioStats",JSON.stringify(statsOps))}
function resetStats(){
  statsOps={
    operations:0,
    received:new Array(denominations.length).fill(0),
    spent:new Array(denominations.length).fill(0),
    deposited:new Array(denominations.length).fill(0),
    repuesto:new Array(denominations.length).fill(0),
    cambioNeto:new Array(denominations.length).fill(0),
    manualIn:new Array(denominations.length).fill(0),
    manualOut:new Array(denominations.length).fill(0)
  };
  saveStats();
}
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
function setAllTip(){
  const rp=parseFloat(document.getElementById("price").value.replace(',','.'))||0;
  const p=Math.round(rp*100);
  const paid=received.reduce((a,b)=>a+b,0);
  if(paid>p&&p>0){
    propinasDelCambio = {};
    tipManual = paid - p;
    document.getElementById("tip").value = (tipManual/100).toFixed(2);
    calculate();
  }
}
function mostrarPrecio(){const inp=document.getElementById("price");if(!inp)return;const raw=parseFloat(inp.value.replace(',','.'))||0;if(raw<=0){alert("Escribe primero el precio del viaje.");return}precioActual=Math.round(raw*100);const el=document.getElementById("precioGrande");if(el)el.textContent=moneyText(precioActual);const p=document.getElementById("precioPantalla");if(p)p.style.display="flex";iniciarAlternanciaPrecio()}
function iniciarAlternanciaPrecio(){detenerAlternanciaPrecio();const t=document.getElementById("precioTitulo");if(!t)return;let en=false;t.textContent="A PAGAR";precioInterval=setInterval(()=>{en=!en;t.textContent=en?"TO PAY":"A PAGAR"},3000)}
function detenerAlternanciaPrecio(){if(precioInterval){clearInterval(precioInterval);precioInterval=null}}
function cerrarPrecio(){detenerAlternanciaPrecio();const p=document.getElementById("precioPantalla");if(p)p.style.display="none"}

function findSmartChange(target,avail){let best=null,minScore=Infinity;function bt(i,rest,used,score){if(rest===0){if(score<minScore){minScore=score;best=[...used]}return}if(i>=denominations.length||rest<0||score>=minScore)return;const v=denominations[i].c;const mx=Math.min(avail[i],Math.floor(rest/v));for(let n=mx;n>=0;n--){used[i]=n;const pen=(denominations[i].type==="coin"&&v<=200)?n*2:n;bt(i+1,rest-n*v,used,score+pen);used[i]=0}}bt(0,target,new Array(denominations.length).fill(0),0);return best}

function calculate(){
  const rp=parseFloat(document.getElementById("price").value.replace(',','.'))||0;
  const price=Math.round(rp*100);
  const paid=received.reduce((a,b)=>a+b,0);

  const inputTip = Math.round((parseFloat(document.getElementById("tip").value.replace(',','.'))||0)*100);
  tipManual = inputTip;

  const resultDiv=document.getElementById("changeResult");
  const changeTotal=document.getElementById("changeTotal");
  const changeGrid=document.getElementById("changeGrid");
  pendingTransaction=null;

  if(price<=0||paid===0){resultDiv.style.display="none";return}

  const totalCharge = price + tipManual;
  if(paid < totalCharge){
    changeTotal.textContent="FALTAN "+moneyText(totalCharge-paid);
    changeGrid.innerHTML="";
    resultDiv.style.display="block";
    return;
  }

  const incoming=new Array(denominations.length).fill(0);
  received.forEach(c=>{
    const i=denominations.findIndex(d=>d.c===c);
    if(i>=0)incoming[i]++;
  });
  const available=stock.map((n,i)=>n+incoming[i]);
  const targetChange=paid-totalCharge;

  const sumaPiezas = Object.keys(propinasDelCambio).reduce((s,k)=>s+parseInt(k)*propinasDelCambio[k],0);
  const propinaTotal = tipManual + sumaPiezas;

  if(targetChange===0){
    pendingTransaction={incoming,used:new Array(denominations.length).fill(0),tip:propinaTotal,tocaReserva:false};
    changeTotal.textContent = propinaTotal>0
      ? "PAGO EXACTO · 💶 Propina: "+moneyText(propinaTotal)
      : "PAGO EXACTO. SIN CAMBIO.";
    changeGrid.innerHTML="";
    resultDiv.style.display="block";
    return;
  }

  const disp=available.map((n,i)=>Math.max(0,n-(reservaMinima[denominations[i].c]||0)));
  let used=findSmartChange(targetChange,disp);
  let tocaReserva=false;
  if(!used){
    used=findSmartChange(targetChange,available);
    tocaReserva=!!used;
  }
  if(!used){
    changeTotal.textContent="SIN CAMBIO ÓPTIMO PARA DEVOLVER "+moneyText(targetChange);
    changeGrid.innerHTML="";
    resultDiv.style.display="block";
    return;
  }

  // usedFinal = cambio original menos las piezas marcadas
  const usedFinal = used.map((n,i)=>{
    const marc = propinasDelCambio[denominations[i].c] || 0;
    return Math.max(0, n - marc);
  });

  const devolverTotal = usedFinal.reduce((s,n,i)=>s+n*denominations[i].c,0);

  pendingTransaction={incoming,used:usedFinal,tip:propinaTotal,tocaReserva};

  let h="CAMBIO: "+moneyText(targetChange);
  if(tocaReserva)h+=" ⚠️ (toca reserva mínima)";
  if(propinaTotal>0) h+="  ·  💶 Propina: "+moneyText(propinaTotal);
  changeTotal.textContent=h;
  changeGrid.innerHTML="";

  // ===== ZONA 1: PIEZAS A DEVOLVER =====
  const tituloDevolver=document.createElement("div");
  tituloDevolver.style.cssText="grid-column:1/-1;font-size:11px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:6px;text-align:left";
  tituloDevolver.textContent="💵 DEVUELVES AL CLIENTE · "+moneyText(devolverTotal);
  changeGrid.appendChild(tituloDevolver);

  let anyDevolver = false;
  used.forEach((nTotal,i)=>{
    if(nTotal<=0) return;
    const d=denominations[i];
    const c=d.c;
    const marcadas = propinasDelCambio[c]||0;
    const devolver = nTotal - marcadas;
    if(devolver <= 0) return;
    anyDevolver = true;

    const it=document.createElement("div");
    it.className="cash-item";
    it.style.cssText="cursor:pointer;border:1px solid #334155";
    it.title="Toca para quedártela como propina";
    it.onclick=()=>subirMarca(c, nTotal);

    const bd=document.createElement("div");
    bd.className="badge";
    bd.textContent="x"+devolver;

    const gr=document.createElement("div");
    gr.className=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;
    gr.textContent=d.short;

    it.appendChild(bd);
    it.appendChild(gr);
    changeGrid.appendChild(it);
  });

  if(!anyDevolver){
    const vacio=document.createElement("div");
    vacio.style.cssText="grid-column:1/-1;text-align:center;color:#64748b;font-size:12px;font-style:italic;padding:8px 0";
    vacio.textContent="No devuelves nada en efectivo (todo va a propina)";
    changeGrid.appendChild(vacio);
  }

  // ===== ZONA 2: TE QUEDAS CON =====
  const propsKeys = Object.keys(propinasDelCambio).filter(k => propinasDelCambio[k] > 0);
  if(propsKeys.length > 0){
    const sep=document.createElement("div");
    sep.style.cssText="grid-column:1/-1;height:1px;background:#334155;margin:14px 0 6px";
    changeGrid.appendChild(sep);

    let totalProps = 0;
    propsKeys.forEach(k => { totalProps += parseInt(k) * propinasDelCambio[k]; });

    const tituloProp=document.createElement("div");
    tituloProp.style.cssText="grid-column:1/-1;font-size:11px;color:#fbbf24;font-weight:800;letter-spacing:0.5px;margin-bottom:6px;text-align:left";
    tituloProp.textContent="💶 TE QUEDAS CON · "+moneyText(totalProps);
    changeGrid.appendChild(tituloProp);

    propsKeys.sort((a,b)=>parseInt(b)-parseInt(a)).forEach(k=>{
      const c=parseInt(k);
      const n=propinasDelCambio[c];
      const d=denominations.find(x=>x.c===c);
      if(!d) return;

      const it=document.createElement("div");
      it.className="cash-item";
      it.style.cssText="cursor:pointer;background:#78350f;border:2px solid #f59e0b";
      it.title="Toca para devolverlo al cambio";
      it.onclick=()=>bajarMarca(c);

      const bd=document.createElement("div");
      bd.className="badge";
      bd.style.background="#f59e0b";
      bd.style.color="#000";
      bd.textContent="x"+n;

      const gr=document.createElement("div");
      gr.className=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;
      gr.textContent=d.short;

      it.appendChild(bd);
      it.appendChild(gr);
      changeGrid.appendChild(it);
    });
  }

  resultDiv.style.display="block";
}
function confirmTransaction(){
  if(!pendingTransaction){
    alert("Introduce un precio y el dinero recibido.");
    return;
  }
  for(let i=0;i<stock.length;i++)stock[i]+=pendingTransaction.incoming[i]-pendingTransaction.used[i];
  if(pendingTransaction.tip>0){totalTips+=pendingTransaction.tip;saveTips()}
  statsOps.operations++;
  for(let i=0;i<denominations.length;i++){
    statsOps.received[i]+=pendingTransaction.incoming[i]||0;
    statsOps.spent[i]+=pendingTransaction.used[i]||0;
  }
  saveStats();
  saveStock();
  renderStockList();
  received=[];
  pendingTransaction=null;
  propinasDelCambio = {};
  tipManual = 0;
  document.getElementById("price").value="";
  document.getElementById("tip").value="";
  document.getElementById("changeResult").style.display="none";
  updateReceived();
  alert("¡Operación guardada!");
}
function renderRecomendaciones(){const box=document.getElementById("recomendacionesBox");if(!box)return;if(statsOps.operations<10){box.innerHTML="";return}const ops=statsOps.operations;const falt=[],sob=[];denominations.forEach((d,i)=>{const aR=statsOps.received[i]/ops,aS=statsOps.spent[i]/ops;if(aS>0&&statsOps.spent[i]>statsOps.received[i]+2){const r=stock[i]/aS;if(r<30)falt.push({d,falta:Math.max(1,Math.ceil(aS*30)-stock[i])})}if(aR>aS*2&&statsOps.received[i]>8&&stock[i]>8)sob.push({d,exceso:statsOps.received[i]-statsOps.spent[i]})});if(!falt.length&&!sob.length){box.innerHTML="";return}let html="<div style='background:#0f172a;border:1px solid #475569;border-radius:10px;padding:12px;margin-top:14px'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>🤖 SUGERENCIAS · últimas "+ops+" operaciones</div>";if(falt.length){html+="<div style='font-size:11px;color:#fbbf24;font-weight:700;margin-bottom:4px'>⚠️ SE TE AGOTAN</div>";falt.forEach(x=>{html+="<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'><span>"+x.d.n+"</span><span style='color:#fbbf24;font-weight:700'>pedir +"+x.falta+"</span></div>"})}if(sob.length){html+="<div style='font-size:11px;color:#4ade80;font-weight:700;margin:10px 0 4px'>💚 ACUMULAS DE MÁS</div>";sob.forEach(x=>{html+="<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'><span>"+x.d.n+"</span><span style='color:#4ade80;font-weight:700'>+"+x.exceso+" de más</span></div>"})}html+="</div>";box.innerHTML=html}

function renderStockList(){
  const box=document.getElementById("stockList");
  if(!box)return;
  box.innerHTML="";
  stockInputs=[];
  const tipEl=document.getElementById("totalTipDisplay");
  if(tipEl)tipEl.textContent="💶 Propinas: "+moneyText(totalTips);
  denominations.forEach((d,i)=>{
    const row=document.createElement("div");
    row.className="stock-item";
    const t=document.createElement("span");
    t.textContent=d.n;
    t.style.fontWeight="700";
    const ctrl=document.createElement("div");
    ctrl.className="stock-ctrl";
    if(modoEdicion){
      const bm=document.createElement("button");
      bm.textContent="-";
      bm.onclick=()=>updateStockVal(i,stock[i]-1);
      const inp=document.createElement("input");
      inp.type="number";
      inp.min="0";
      inp.value=stock[i];
      inp.onchange=(e)=>updateStockVal(i,parseInt(e.target.value)||0);
      const bp=document.createElement("button");
      bp.textContent="+";
      bp.onclick=()=>updateStockVal(i,stock[i]+1);
      ctrl.appendChild(bm);
      ctrl.appendChild(inp);
      ctrl.appendChild(bp);
      stockInputs[i]=inp;
    } else {
      const span=document.createElement("span");
      span.textContent=stock[i];
      span.style.fontSize="18px";
      span.style.fontWeight="900";
      span.style.color="#38bdf8";
      span.style.padding="0 10px";
      span.style.minWidth="40px";
      span.style.textAlign="right";
      ctrl.appendChild(span);
    }
    row.appendChild(t);
    row.appendChild(ctrl);
    box.appendChild(row);
  });
  renderRecomendaciones();
  actualizarBotonModoEdicion();
}
function updateStockVal(i,v){stock[i]=Math.max(0,v);if(stockInputs[i])stockInputs[i].value=stock[i];saveStock()}

function toggleModoEdicion(){
  if(!modoEdicion){
    if(!confirm("⚠️ Activar modo edición\n\nLos cambios con + / − NO se registran en el aprendizaje.\n\nÚsalos solo para corregir errores o meter monedas encontradas.\n\nPara movimientos reales (propinas sin viaje, gastos) usa el botón 📝 MOVIMIENTO MANUAL.")) return;
    modoEdicion = true;
  } else {
    modoEdicion = false;
  }
  safeStorage.set("uberCambioModoEdicion", modoEdicion ? "1" : "0");
  renderStockList();
}

function actualizarBotonModoEdicion(){
  const btn=document.getElementById("toggleEdicionBtn");
  if(!btn)return;
  if(modoEdicion){
    btn.textContent="ON";
    btn.style.background="#7c3aed";
    btn.style.color="#fff";
  } else {
    btn.textContent="OFF";
    btn.style.background="#334155";
    btn.style.color="#94a3b8";
  }
}

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
function resetHistorialDepositos(){if(!confirm("¿Borrar el HISTORIAL de depósitos?\n\nEl aprendizaje (stats) NO se toca."))return;safeStorage.remove("uberCambioCierres");renderHistorialPanel();renderCierreHistorico();const hc=document.getElementById("cierreHistorico");if(hc){hc.innerHTML="";hc.style.display="none"}alert("✅ Historial de depósitos borrado.")}
function resetHistorialResets(){if(!confirm("¿Borrar el HISTORIAL de resets de propinas?\n\nLas propinas actuales NO se tocan."))return;safeStorage.remove("uberCambioHistoricoResets");renderHistorialPanel();renderResetPanel();alert("✅ Historial de resets borrado.")}
function resetHistorialCambios(){if(!confirm("¿Borrar el HISTORIAL de cambios de billete?\n\nEl aprendizaje (stats) NO se toca."))return;safeStorage.remove("uberCambioCambios");renderCambioHistorial();alert("✅ Historial de cambios borrado.")}
function resetEstadisticas(){if(!confirm("¿Borrar las estadísticas de aprendizaje?"))return;resetStats();renderStockList();alert("✅ Estadísticas reseteadas.")}
function resetTodo(){if(!confirm("⚠️ ¿RESETEAR TODO?\n\nSe borrará el inventario, propinas, historial y estadísticas."))return;stock=new Array(denominations.length).fill(0);totalTips=0;safeStorage.remove("uberCambioCierres");safeStorage.remove("uberCambioHistoricoResets");safeStorage.remove("uberCambioCambios");resetStats();saveStock();saveTips();renderStockList();renderResetPanel();if(received.length)calculate()}

function loadHistoricoResets(){const s=safeStorage.get("uberCambioHistoricoResets");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function saveHistoricoResets(h){safeStorage.set("uberCambioHistoricoResets",JSON.stringify(h))}
function loadCambios(){const s=safeStorage.get("uberCambioCambios");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function saveCambios(c){safeStorage.set("uberCambioCambios",JSON.stringify(c))}
function loadCierres(){const s=safeStorage.get("uberCambioCierres");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function saveCierres(c){safeStorage.set("uberCambioCierres",JSON.stringify(c))}

function checkAutoResetPropinas(){if(!ultimoResetPropinas){ultimoResetPropinas=new Date().toISOString();saveUltimoResetPropinas();return}const last=new Date(ultimoResetPropinas);const now=new Date();const cand=new Date(last.getFullYear(),last.getMonth(),diaReset,0,0,0);if(cand<=last)cand.setMonth(cand.getMonth()+1);if(now>=cand){const h=loadHistoricoResets();h.push({fecha:now.toISOString(),propinas:totalTips});saveHistoricoResets(h);totalTips=0;saveTips();ultimoResetPropinas=now.toISOString();saveUltimoResetPropinas();renderStockList();renderResetPanel()}}

function renderHistorialPanel(){
  const box=document.getElementById("historialPanel");
  if(!box)return;
  const cierres=loadCierres(),resets=loadHistoricoResets();
  let html="";
  if(cierres.length){
    html+="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px'>📜 ÚLTIMOS DEPÓSITOS</div>";
    const total = cierres.length;
    cierres.slice(-10).reverse().forEach((c,revIdx)=>{
      const idx = total - 1 - revIdx;
      const d=new Date(c.fecha);
      const f=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      const ic=c.manual?"📝 ":"";
      const tieneDetalle = Array.isArray(c.usados) && c.usados.length>0;
      const flecha = tieneDetalle ? "<span style='color:#38bdf8;font-weight:900;font-size:18px'>›</span>" : "";
      html+="<div onclick='verDetalleDeposito("+idx+")' style='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #334155;font-size:13px;cursor:pointer'><span style='color:#94a3b8'>"+ic+f+"</span><span style='display:flex;align-items:center;gap:8px'><span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span>"+flecha+"</span></div>";
    });
  }
  if(resets.length){
    html+="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:14px 0 6px'>🔄 ÚLTIMOS RESETS DE PROPINAS</div>";
    resets.slice(-10).reverse().forEach(r=>{
      const d=new Date(r.fecha);
      const f=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      html+="<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'><span style='color:#94a3b8'>"+f+"</span><span style='font-weight:800;color:#fbbf24'>"+moneyText(r.propinas)+"</span></div>";
    });
  }
  box.innerHTML=html;
}

function abrirCierrePantalla(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("cierrePantalla");if(p)p.style.display="block";const inp=document.getElementById("cierreInput");if(inp)inp.value="";const cont=document.getElementById("cierreResultado");if(cont){cont.style.display="none";cont.innerHTML=""}const btn=document.getElementById("btnConfirmarCierre");if(btn)btn.style.display="none";const mb=document.getElementById("depositoManualBox");if(mb)mb.style.display="none";renderCierreHistorico()}
function cerrarCierrePantalla(){const p=document.getElementById("cierrePantalla");if(p)p.style.display="none"}

function findBilletes(target,bs,br){const mu=Math.floor(target/500);if(mu<=0)return{total:0,usados:[0,0,0,0,0],tocoReserva:false};const den=[{u:20,idx:0},{u:10,idx:1},{u:4,idx:2},{u:2,idx:3},{u:1,idx:4}];const disp=bs.map((n,i)=>Math.max(0,n-(br[i]||0)));const r1=mejorEnRango(mu,disp,den);if(r1&&r1.totalUnits===mu)return{total:mu*500,usados:r1.usados,tocoReserva:false};const r2=mejorEnRango(mu,bs,den);if(r2&&r2.totalUnits===mu)return{total:mu*500,usados:r2.usados,tocoReserva:true};if(r1)return{total:r1.totalUnits*500,usados:r1.usados,tocoReserva:false};if(r2)return{total:r2.totalUnits*500,usados:r2.usados,tocoReserva:true};return{total:0,usados:[0,0,0,0,0],tocoReserva:false}}

function mejorEnRango(mu,cant,den){const n=den.length;const INF=999999;const totDisp=den.reduce((s,d)=>s+(cant[d.idx]|0)*d.u,0);const cap=Math.min(mu,totDisp);if(cap<=0)return null;const tbl=[];for(let i=0;i<=n;i++)tbl.push(new Array(cap+1).fill(INF));tbl[n][0]=0;for(let i=n-1;i>=0;i--){const d=den[i];const mN=cant[d.idx]|0;for(let v=0;v<=cap;v++){let best=INF;const tope=Math.min(mN,Math.floor(v/d.u));for(let c=0;c<=tope;c++){const sub=tbl[i+1][v-c*d.u];if(sub+c<best)best=sub+c}tbl[i][v]=best}}let bv=-1;for(let v=cap;v>=0;v--){if(tbl[0][v]<INF){bv=v;break}}if(bv<0)return null;const us=[0,0,0,0,0];let v=bv;for(let i=0;i<n;i++){const d=den[i];const mN=cant[d.idx]|0;for(let c=mN;c>=0;c--){const val=c*d.u;if(val>v)continue;if(tbl[i+1][v-val]+c===tbl[i][v]){us[d.idx]=c;v-=val;break}}}return{totalUnits:bv,usados:us}}

function calcularCierre(){
  const cont=document.getElementById("cierreResultado"),btn=document.getElementById("btnConfirmarCierre");
  const raw=parseFloat(document.getElementById("cierreInput").value.replace(',','.'))||0;
  const target=Math.round(raw*100);
  if(!cont||!btn)return;
  if(target<=0){cont.style.display="none";cont.innerHTML="";btn.style.display="none";return}
  const bs=stock.slice(0,5);
  const br=denominations.slice(0,5).map(d=>reservaMinima[d.c]||0);
  const res=findBilletes(target,bs,br);

  if(!res||res.total===0){
    const mx=stock.slice(0,5).reduce((s,n,i)=>s+n*denominations[i].c,0);
    let msg;
    if(mx===0)msg="⚠️ No tienes ningún billete en el inventario.<br>Añade billetes en Ajustes → Inventario.";
    else msg="⚠️ No puedes formar "+moneyText(target)+".<br>En billetes tienes como máximo "+moneyText(mx)+".";
    cont.innerHTML="<div style='color:#ef4444;font-weight:700;font-size:14px;text-align:center;line-height:1.6'>"+msg+"</div>";
    cont.style.display="block";
    btn.style.display="none";
    return;
  }

  const sd=stock.slice();
  for(let i=0;i<res.usados.length;i++)sd[i]=Math.max(0,sd[i]-res.usados[i]);

  const afectados={};
  for(let i=0;i<res.usados.length;i++){
    const n=res.usados[i]||0;
    if(n<=0) continue;
    const d=denominations[i];
    const res_i=reservaMinima[d.c]||0;
    const quedan=sd[i];
    if(res_i>0 && quedan < res_i){
      afectados[d.c]={queda:quedan, reserva:res_i};
    }
  }
  const tocaAlgo = Object.keys(afectados).length>0;

  let html="";

  if(tocaAlgo){
    html+="<div style='background:#7f1d1d;border:1px solid #ef4444;border-radius:8px;padding:8px 12px;margin-bottom:12px;text-align:center'>";
    html+="<div style='font-size:13px;color:#fecaca;font-weight:800'>⚠️ Este depósito toca tu reserva mínima</div>";
    html+="<div style='font-size:11px;color:#fca5a5;margin-top:3px'>Los billetes marcados en rojo se quedarán sin cambio</div>";
    html+="</div>";
  }

  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;text-align:center'>💵 ENTREGAR EN BILLETES</div>";
  html+="<div style='font-size:32px;font-weight:900;color:#4ade80;margin:6px 0 14px;text-align:center'>"+moneyText(res.total)+"</div>";

  html+="<div class='change-grid'>";
  res.usados.forEach((n,i)=>{
    if(n>0){
      const d=denominations[i];
      const af=afectados[d.c];
      if(af){
        html+="<div class='cash-item' style='position:relative;background:#7f1d1d!important;border:2px solid #ef4444!important;border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center'>";
        html+="<div class='badge' style='background:#ef4444;color:#fff;font-weight:900'>x"+n+"</div>";
        html+="<div class='bill-graphic "+d.class+"'>"+d.short+"</div>";
        html+="<div style='margin-top:8px;font-size:14px;font-weight:900;color:#fecaca;text-align:center;line-height:1'>Quedan <span style='color:#fff;font-size:18px'>"+af.queda+"</span></div>";
        html+="</div>";
      } else {
        html+="<div class='cash-item'>";
        html+="<div class='badge'>x"+n+"</div>";
        html+="<div class='bill-graphic "+d.class+"'>"+d.short+"</div>";
        html+="</div>";
      }
    }
  });
  html+="</div>";

  const checks=[["≤ 20 €",2000],["≤ 30 €",3000],["≤ 50 €",5000],["≤ 80 €",8000],["≤ 100 €",10000]];
  let tarjs="";
  let hay=false;
  checks.forEach(([lb,tg])=>{
    const est=estadoParaStock(tg,sd);
    let tx,bg,co,bo;
    if(est==="yes"){tx="SÍ";bg="rgba(22,163,74,0.15)";co="#4ade80";bo="#16a34a"}
    else if(est==="warn"){tx="MÍN";bg="rgba(234,179,8,0.15)";co="#facc15";bo="#eab308";hay=true}
    else{tx="NO";bg="rgba(220,38,38,0.15)";co="#f87171";bo="#dc2626";hay=true}
    tarjs+="<div style='flex:1;min-width:0;background:#283548;border:1px solid #475569;border-radius:10px;padding:8px 2px;display:flex;flex-direction:column;align-items:center;gap:6px'><div style='font-size:11px;font-weight:800;color:#f1f5f9;white-space:nowrap'>"+lb+"</div><div style='width:100%;padding:6px 0;border-radius:8px;background:"+bg+";border:1px solid "+bo+";color:"+co+";font-size:14px;font-weight:900;text-align:center;letter-spacing:0.5px'>"+tx+"</div></div>";
  });
  html+="<div style='margin-top:16px;padding-top:14px;border-top:1px solid #334155'>";
  html+=(hay?"<div style='font-size:12px;color:#fbbf24;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>⚠️ DESPUÉS DEL DEPÓSITO</div>":"<div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>✅ DESPUÉS DEL DEPÓSITO</div>");
  html+="<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px'>"+tarjs+"</div>";
  if(hay){
    html+="<div style='padding:12px;background:#78350f;border:1px solid #b45309;border-radius:10px;font-size:13px;color:#fbbf24;line-height:1.5;text-align:center'>⚠️ <b>Ojo</b>: después de este depósito te quedarás justo para dar cambio.<br>Puedes depositar menos o reponer caja.</div><button type='button' onclick='abrirReponerDesdeDeposito()' style='width:100%;margin-top:10px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer'>🏦 REPONER CAJA ANTES DE DEPOSITAR</button>";
  } else {
    html+="<div style='padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px;font-size:13px;color:#4ade80;line-height:1.5;text-align:center'>✅ Después de este depósito seguirás teniendo <b>cambio suficiente</b>.</div>";
  }
  html+="</div>";

  const sobr=target-res.total;
  const tot=stock.reduce((s,n,i)=>s+n*denominations[i].c,0);
  const queda=tot-res.total;
  html+="<div style='margin-top:16px;padding-top:16px;border-top:1px solid #334155;text-align:center'>";
  if(sobr>0){
    html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px'>SOBRANTE NO ENTREGABLE</div><div style='font-size:20px;font-weight:900;color:#eab308;margin-top:4px'>"+moneyText(sobr)+"</div><div style='font-size:11px;color:#64748b;margin-top:2px'>No se puede dar en billetes</div>";
  }
  html+="<div style='margin-top:14px;padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px'><div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px'>💼 TE QUEDA EN CAJA</div><div style='font-size:24px;font-weight:900;color:#4ade80;margin-top:4px'>"+moneyText(queda)+"</div><div style='font-size:11px;color:#94a3b8;margin-top:4px'>Después del depósito, en monedas y billetes restantes</div></div></div>";
  cont.innerHTML=html;
  cont.style.display="block";
  btn.style.display="block";
  btn.dataset.total=String(res.total);
  btn.dataset.usados=JSON.stringify(res.usados);

  if(tocaAlgo){
    btn.textContent="⚠️ CONFIRMAR DE TODAS FORMAS";
    btn.style.background="#b45309";
  } else {
    btn.textContent="✅ CONFIRMAR DEPÓSITO";
    btn.style.background="#059669";
  }
}

function confirmarCierre(){
  const btn=document.getElementById("btnConfirmarCierre");
  if(!btn)return;
  const total=parseInt(btn.dataset.total)||0;
  const usados=JSON.parse(btn.dataset.usados||"[]");
  if(total<=0)return;
  if(!confirm("¿Confirmar depósito? Se entregarán "+moneyText(total)+" en billetes.\n\nLas propinas NO se tocan."))return;
  for(let i=0;i<usados.length;i++)stock[i]=Math.max(0,stock[i]-usados[i]);
  for(let i=0;i<usados.length;i++){statsOps.deposited[i]+=usados[i]||0}
  saveStats();
  saveStock();
  renderStockList();
  updateCashSummary();
  const cierres=loadCierres();
  cierres.push({fecha:new Date().toISOString(),total,usados:usados.slice()});
  saveCierres(cierres);
  renderCierreHistorico();
  document.getElementById("cierreInput").value="";
  const cont=document.getElementById("cierreResultado");
  if(cont){cont.style.display="none";cont.innerHTML=""}
  btn.style.display="none";
  alert("✅ Depósito realizado.\nEntregados: "+moneyText(total));
}

function renderCierreHistorico(){
  const box=document.getElementById("cierreHistorico");
  if(!box)return;
  const cierres=loadCierres();
  if(!cierres.length){box.style.display="none";box.innerHTML="";return}
  let html="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px'>📜 ÚLTIMOS DEPÓSITOS</div>";
  const total = cierres.length;
  cierres.slice(-10).reverse().forEach((c,revIdx)=>{
    const idx = total - 1 - revIdx;
    const d=new Date(c.fecha);
    const f=d.toLocaleDateString("es-ES")+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    const ic=c.manual?"📝 ":"";
    const tieneDetalle = Array.isArray(c.usados) && c.usados.length>0;
    const flecha = tieneDetalle ? "<span style='color:#38bdf8;font-weight:900;font-size:18px'>›</span>" : "";
    html+="<div onclick='verDetalleDeposito("+idx+")' style='padding:10px 0;border-bottom:1px solid #334155;font-size:13px;cursor:pointer'>";
    html+="<div style='display:flex;justify-content:space-between;align-items:center;gap:8px'>";
    html+="<span style='color:#94a3b8'>"+ic+f+"</span>";
    html+="<span style='display:flex;align-items:center;gap:8px'><span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span>"+flecha+"</span>";
    html+="</div></div>";
  });
  box.innerHTML=html;
  box.style.display="block";
}

function toggleDepositoManual(){
  const box=document.getElementById("depositoManualBox");
  if(!box)return;
  if(box.style.display==="none"||!box.style.display){
    box.style.display="block";
    const hoy=new Date();
    const y=hoy.getFullYear(),m=String(hoy.getMonth()+1).padStart(2,'0'),d=String(hoy.getDate()).padStart(2,'0');
    const hh=String(hoy.getHours()).padStart(2,'0'),mi=String(hoy.getMinutes()).padStart(2,'0');
    const fD=document.getElementById("depManualFecha");
    const fT=document.getElementById("depManualFechaTxt");
    const hD=document.getElementById("depManualHora");
    const hT=document.getElementById("depManualHoraTxt");
    if(fD && !fD.value){ fD.value = y+"-"+m+"-"+d; }
    if(fT && !fT.value){ fT.value = fD && fD.value ? fD.value : (y+"-"+m+"-"+d); }
    if(hD && !hD.value){ hD.value = hh+":"+mi; }
    if(hT && !hT.value){ hT.value = hD && hD.value ? hD.value : (hh+":"+mi); }
    window.__depManualCounts = {};
    renderDepManualPiezas();
  } else {
    box.style.display="none";
  }
}

function renderDepManualPiezas(){
  const cont=document.getElementById("depManualPiezasLista");
  if(!cont)return;
  const bills = denominations.filter(d => d.type === "bill");
  if(!window.__depManualCounts) window.__depManualCounts = {};
  let html="";

  bills.forEach(d=>{
    const idx = denominations.findIndex(x => x.c === d.c);
    const n = window.__depManualCounts[d.c] || 0;
    const stockAct = stock[idx] || 0;
    const reserva = reservaMinima[d.c] || 0;
    const gc = "bill-graphic " + d.class;

    let infoLimite="", colorLimite="#94a3b8", bloquearMas=false;

    if(reserva > 0){
      const maxRemove = Math.max(0, stockAct - reserva);
      if(maxRemove === 0){
        infoLimite = "Tienes " + stockAct + " · <b style='color:#f87171'>reserva " + reserva + " ya alcanzada</b>";
        colorLimite = "#fca5a5";
        bloquearMas = true;
      } else if(n >= maxRemove){
        infoLimite = "Tienes " + stockAct + " · <b style='color:#f87171'>máx " + maxRemove + " (reserva " + reserva + ")</b>";
        colorLimite = "#fca5a5";
        bloquearMas = true;
      } else {
        infoLimite = "Tienes " + stockAct + " · puedes sacar <b style='color:#fca5a5'>" + maxRemove + "</b> (reserva " + reserva + ")";
      }
    } else {
      infoLimite = "Tienes " + stockAct + " · sin reserva";
    }

    html+="<div style='display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1e293b'>";
    html+="<div class='"+gc+"' style='flex-shrink:0;font-size:12px'>"+d.short+"</div>";
    html+="<div style='flex:1;min-width:0'>";
    html+="<div style='font-size:14px;color:#fff;font-weight:800'>"+d.n+"</div>";
    html+="<div style='font-size:13px;color:"+colorLimite+";margin-top:3px;line-height:1.4;font-weight:600'>"+infoLimite+"</div>";
    html+="</div>";
    html+="<div style='display:flex;align-items:center;gap:6px;flex-shrink:0'>";
    html+="<button type='button' onclick='ajustarDepManual("+d.c+",-1)' style='width:36px;height:36px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:pointer'>−</button>";
    const numColor = n>0 ? (bloquearMas ? "#f87171" : "#4ade80") : "#475569";
    html+="<div style='width:40px;text-align:center;font-size:18px;font-weight:900;color:"+numColor+"'>"+n+"</div>";
    const masStyle = bloquearMas
      ? "width:36px;height:36px;padding:0;background:#1e293b;color:#475569;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:not-allowed;opacity:0.4"
      : "width:36px;height:36px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:pointer";
    const masOnclick = bloquearMas ? "" : "onclick='ajustarDepManual("+d.c+",1)'";
    html+="<button type='button' "+masOnclick+" style='"+masStyle+"'>+</button>";
    html+="</div></div>";
  });
  cont.innerHTML=html;
  actualizarSumaDepManual();
}

function ajustarDepManual(c, delta){
  const idx = denominations.findIndex(x => x.c === c);
  const stockAct = stock[idx] || 0;
  const reserva = reservaMinima[c] || 0;
  if(!window.__depManualCounts) window.__depManualCounts = {};
  const n = window.__depManualCounts[c] || 0;

  if(delta > 0 && reserva > 0){
    const maxRemove = Math.max(0, stockAct - reserva);
    if(n >= maxRemove){
      mostrarToast("⚠️ Reserva mínima alcanzada (" + reserva + ")");
      return;
    }
  }

  window.__depManualCounts[c] = Math.max(0, n + delta);
  renderDepManualPiezas();
}

function actualizarSumaDepManual(){
  const counts = window.__depManualCounts || {};
  let suma = 0;
  Object.keys(counts).forEach(k => {
    suma += parseInt(k) * (counts[k] || 0);
  });
  const el = document.getElementById("depManualPiezasSuma");
  if(!el) return;
  const imp = Math.round((parseFloat(document.getElementById("depManualImporte")?.value.replace(',','.'))||0)*100);
  if(suma === 0){
    el.innerHTML = "<span style='color:#64748b;font-size:14px;font-weight:700'>Sin piezas · se guardará solo el importe en el historial</span>";
  } else if(imp > 0 && suma === imp){
    el.innerHTML = "<span style='color:#4ade80;font-size:14px;font-weight:800'>✅ Suma de piezas: "+moneyText(suma)+" (coincide con el importe)</span>";
  } else if(imp > 0){
    el.innerHTML = "<span style='color:#fbbf24;font-size:14px;font-weight:800'>⚠️ Suma de piezas: "+moneyText(suma)+" · Importe: "+moneyText(imp)+" (no coincide, se ignorará el aprendizaje)</span>";
  } else {
    el.innerHTML = "<span style='color:#38bdf8;font-size:14px;font-weight:800'>Suma de piezas: "+moneyText(suma)+"</span>";
  }
}

function añadirDepositoManual(){
  let fs = (document.getElementById("depManualFechaTxt")?.value || "").trim();
  if(!fs) fs = document.getElementById("depManualFecha")?.value || "";
  let hs = (document.getElementById("depManualHoraTxt")?.value || "").trim();
  if(!hs) hs = document.getElementById("depManualHora")?.value || "";

  if(!/^\d{4}-\d{2}-\d{2}$/.test(fs)){ alert("Fecha inválida. Usa formato AAAA-MM-DD (ej: 2026-10-02)."); return; }
  if(!/^\d{2}:\d{2}$/.test(hs)){ alert("Hora inválida. Usa formato HH:MM (ej: 14:30)."); return; }

  const is=document.getElementById("depManualImporte").value;
  const imp=Math.round((parseFloat(is.replace(',','.'))||0)*100);
  if(imp<=0){alert("Escribe un importe válido.");return}

  const [y,m,d]=fs.split("-").map(x=>parseInt(x));
  const [hh,mi]=hs.split(":").map(x=>parseInt(x));
  const fc=new Date(y,m-1,d,hh,mi,0);

  const counts = window.__depManualCounts || {};
  const piezas = [];
  let sumaPiezas = 0;
  Object.keys(counts).forEach(k => {
    const c = parseInt(k);
    const n = counts[k] || 0;
    piezas.push({c, n});
    sumaPiezas += c * n;
  });
  const tienePiezas = sumaPiezas>0 && sumaPiezas===imp;

  // Construir array usados (solo billetes, índices 0-4)
  const usados = [0,0,0,0,0];
  if(tienePiezas){
    piezas.forEach(p=>{
      const i = denominations.findIndex(x => x.c === p.c);
      if(i >= 0 && i < 5) usados[i] = p.n;
    });
  }

  const cierres=loadCierres();
  cierres.push({fecha:fc.toISOString(),total:imp,manual:true,usados:usados});
  saveCierres(cierres);
  renderCierreHistorico();

  if(tienePiezas){
    piezas.forEach(p=>{
      const idx=denominations.findIndex(d=>d.c===p.c);
      if(idx>=0 && p.n>0){
        statsOps.deposited[idx]+=p.n;
      }
    });
    saveStats();
  }

  document.getElementById("depManualImporte").value="";
  window.__depManualCounts = {};
  const box=document.getElementById("depositoManualBox");
  if(box)box.style.display="none";

  if(tienePiezas){
    alert("✅ Depósito manual añadido:\n"+moneyText(imp)+"\n\nY contado para el aprendizaje.");
  } else {
    alert("✅ Depósito manual añadido:\n"+moneyText(imp));
  }
}

/* ==================== MOVIMIENTO MANUAL ==================== */
function abrirMovimientoPantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active");
  if(o)o.classList.remove("active");
  const p=document.getElementById("movimientoPantalla");
  if(p)p.style.display="block";
  movimientoState={tipo:"entrada",motivo:"propina",piezas:{}};
  renderMovimientoPantalla();
}
function cerrarMovimientoPantalla(){
  const p=document.getElementById("movimientoPantalla");
  if(p)p.style.display="none";
}
function renderMovimientoPantalla(){
  const cont=document.getElementById("movimientoContenido");
  if(!cont)return;
  const st=movimientoState;
  let html="";

  // Tipo Entrada / Salida
  html+="<div class='card' style='margin:0 0 12px 0'>";
  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>TIPO DE MOVIMIENTO</div>";
  html+="<div style='display:flex;gap:8px'>";
  html+="<button type='button' onclick='setTipoMovimiento(\"entrada\")' style='flex:1;padding:16px;border-radius:10px;border:2px solid "+(st.tipo==="entrada"?"#22c55e":"#475569")+";background:"+(st.tipo==="entrada"?"linear-gradient(135deg,#14532d,#15803d)":"#1e293b")+";color:"+(st.tipo==="entrada"?"#4ade80":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:16px;letter-spacing:0.5px;box-shadow:"+(st.tipo==="entrada"?"0 0 0 3px rgba(34,197,94,0.25)":"none")+"'>📥 ENTRADA</button>";
  html+="<button type='button' onclick='setTipoMovimiento(\"salida\")' style='flex:1;padding:16px;border-radius:10px;border:2px solid "+(st.tipo==="salida"?"#ef4444":"#475569")+";background:"+(st.tipo==="salida"?"linear-gradient(135deg,#7f1d1d,#991b1b)":"#1e293b")+";color:"+(st.tipo==="salida"?"#fca5a5":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:16px;letter-spacing:0.5px;box-shadow:"+(st.tipo==="salida"?"0 0 0 3px rgba(239,68,68,0.25)":"none")+"'>📤 SALIDA</button>";
  html+="</div></div>";

  // Motivo
  html+="<div class='card' style='margin:0 0 12px 0'>";
  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>MOTIVO</div>";

  if(st.tipo==="entrada"){
    html+="<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px'>";
    const pAct = st.motivo==="propina";
    html+="<button type='button' onclick='setMotivoMovimiento(\"propina\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(pAct?"#22c55e":"#475569")+";background:"+(pAct?"linear-gradient(135deg,#14532d,#15803d)":"#1e293b")+";color:"+(pAct?"#4ade80":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(pAct?"0 0 0 3px rgba(34,197,94,0.25)":"none")+"'>💶 Propina</button>";
    const eAct = st.motivo==="encontrado";
    html+="<button type='button' onclick='setMotivoMovimiento(\"encontrado\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(eAct?"#8b5cf6":"#475569")+";background:"+(eAct?"linear-gradient(135deg,#4c1d95,#6d28d9)":"#1e293b")+";color:"+(eAct?"#c4b5fd":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(eAct?"0 0 0 3px rgba(139,92,246,0.25)":"none")+"'>🔍 Encontrado</button>";
    const oAct = st.motivo==="otroIngreso";
    html+="<button type='button' onclick='setMotivoMovimiento(\"otroIngreso\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(oAct?"#0ea5e9":"#475569")+";background:"+(oAct?"linear-gradient(135deg,#075985,#0369a1)":"#1e293b")+";color:"+(oAct?"#7dd3fc":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(oAct?"0 0 0 3px rgba(14,165,233,0.25)":"none")+"'>📥 Otro</button>";
    html+="</div>";
  } else {
    html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px'>";
    const gAct = st.motivo==="gasto";
    html+="<button type='button' onclick='setMotivoMovimiento(\"gasto\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(gAct?"#ef4444":"#475569")+";background:"+(gAct?"linear-gradient(135deg,#7f1d1d,#991b1b)":"#1e293b")+";color:"+(gAct?"#fca5a5":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(gAct?"0 0 0 3px rgba(239,68,68,0.25)":"none")+"'>🚗 Gasto</button>";
    const lAct = st.motivo==="limpieza";
    html+="<button type='button' onclick='setMotivoMovimiento(\"limpieza\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(lAct?"#0ea5e9":"#475569")+";background:"+(lAct?"linear-gradient(135deg,#075985,#0369a1)":"#1e293b")+";color:"+(lAct?"#7dd3fc":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(lAct?"0 0 0 3px rgba(14,165,233,0.25)":"none")+"'>🧽 Limpieza</button>";
    html+="</div>";
  }
  html+="</div>";

  // Explicación
  let expl="", colorExp="#94a3b8", bgExp="#1e293b", titulo="";
  if(st.motivo==="propina"){ titulo="💶 Propina"; expl="Sube stock y suma a propinas."; colorExp="#a7f3d0"; bgExp="#064e3b"; }
  else if(st.motivo==="encontrado"){ titulo="🔍 Encontrado"; expl="Sube stock. NO suma a propinas."; colorExp="#ddd6fe"; bgExp="#4c1d95"; }
  else if(st.motivo==="otroIngreso"){ titulo="📥 Otro ingreso"; expl="Sube stock. NO suma a propinas."; colorExp="#bae6fd"; bgExp="#075985"; }
  else if(st.motivo==="gasto"){ titulo="🚗 Gasto"; expl="Resta stock. NO afecta a propinas."; colorExp="#fecaca"; bgExp="#7f1d1d"; }
  else if(st.motivo==="limpieza"){ titulo="🧽 Limpieza"; expl="Gasto de limpieza del coche. Resta stock."; colorExp="#bae6fd"; bgExp="#075985"; }
  html+="<div style='font-size:14px;color:"+colorExp+";padding:12px 14px;background:"+bgExp+";border-radius:8px;margin-bottom:14px;line-height:1.4;font-weight:800;letter-spacing:0.3px'>"+titulo+"<div style='font-size:12px;font-weight:600;color:"+colorExp+";opacity:0.85;margin-top:4px;line-height:1.35'>"+expl+"</div></div>";

  // Piezas — tarjetas grandes
  html+="<div class='card' style='margin:0 0 12px 0'>";
  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>PIEZAS · TOCA PARA AÑADIR</div>";

  html+="<div style='display:grid;grid-template-columns:repeat(3,1fr);gap:8px'>";

  denominations.forEach(d=>{
    const idx = denominations.findIndex(x => x.c === d.c);
    const n = st.piezas[d.c]||0;
    const stockAct = stock[idx] || 0;
    const tope = topesRecibir[d.c] || 0;
    const reserva = reservaMinima[d.c] || 0;
    const gc = (d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;

    let bloquearMas = false;
    let limiteInfo = "";

    if(st.tipo === "entrada"){
      if(tope > 0){
        const maxAdd = Math.max(0, tope - stockAct);
        limiteInfo = "máx " + maxAdd;
        if(n >= maxAdd) bloquearMas = true;
      }
    } else {
      const maxRemove = Math.max(0, stockAct - reserva);
      limiteInfo = "máx " + maxRemove;
      if(n >= maxRemove) bloquearMas = true;
    }

    // Color de fondo
    let bgCard = "#283548";
    let borderCard = "#475569";
    if(n > 0){
      if(bloquearMas){
        bgCard = "#7f1d1d";
        borderCard = "#ef4444";
      } else {
        bgCard = "#4c1d95";
        borderCard = "#8b5cf6";
      }
    }

    const cardStyle = "position:relative;padding:14px 6px 10px 6px;border-radius:12px;border:2px solid "+borderCard+";background:"+bgCard+";cursor:"+(bloquearMas?"not-allowed":"pointer")+";opacity:"+(bloquearMas?"0.7":"1")+";text-align:center;min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px";

    const onclick = bloquearMas ? "" : "onclick='ajustarMovimiento("+d.c+",1)'";

    html+="<div "+onclick+" style='"+cardStyle+"'>";

    // Fila superior: badge cantidad y botón −
    if(n > 0){
      html+="<div style='width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;padding:0 2px'>";
      html+="<div style='min-width:26px;height:26px;padding:0 8px;border-radius:13px;background:#a78bfa;color:#0f172a;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #0f172a'>"+n+"</div>";
      html+="<button type='button' onclick='event.stopPropagation();ajustarMovimiento("+d.c+",-1)' style='width:30px;height:30px;padding:0;border-radius:50%;background:#ef4444;color:#fff;border:2px solid #0f172a;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center'>−</button>";
      html+="</div>";
    } else {
      html+="<div style='height:4px'></div>";
    }

    // Icono
    html+="<div class='"+gc+"' style='font-size:13px;flex-shrink:0'>"+d.short+"</div>";
    // Nombre
    html+="<div style='font-size:14px;font-weight:900;color:#fff;letter-spacing:0.3px'>"+d.n+"</div>";
    // Info
    html+="<div style='font-size:10px;color:#94a3b8;font-weight:700;line-height:1.2'>tienes "+stockAct+(limiteInfo?" · "+limiteInfo:"")+"</div>";

    html+="</div>";
  });

  html+="</div></div>";

  // Total
  let total=0;
  denominations.forEach(d=>{ total += (st.piezas[d.c]||0) * d.c; });
  html+="<div class='card' style='margin:0 0 12px 0;text-align:center;background:#1e293b;border:1px solid #475569'>";
  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>TOTAL DEL MOVIMIENTO</div>";
  html+="<div style='font-size:32px;font-weight:900;color:#a78bfa'>"+moneyText(total)+"</div>";
  html+="</div>";

  html+="<button type='button' onclick='confirmarMovimiento()' style='width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:16px;font-weight:800;font-size:16px;cursor:pointer;margin-bottom:8px'>✅ GUARDAR MOVIMIENTO</button>";
  html+="<button type='button' onclick='cerrarMovimientoPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:15px;cursor:pointer'>✖ Cancelar</button>";

  cont.innerHTML=html;
}
function setTipoMovimiento(t){
  movimientoState.tipo = t;
  movimientoState.motivo = (t === "entrada") ? "propina" : "gasto";
  renderMovimientoPantalla();
}
function setMotivoMovimiento(m){
  movimientoState.motivo=m;
  renderMovimientoPantalla();
}
function ajustarMovimiento(c,delta){
  const idx = denominations.findIndex(x => x.c === c);
  const st = movimientoState;
  const stockAct = stock[idx] || 0;
  const tope = topesRecibir[c] || 0;
  const reserva = reservaMinima[c] || 0;
  const n = st.piezas[c] || 0;

  if(delta > 0){
    if(st.tipo === "entrada"){
      if(tope > 0){
        const maxAdd = Math.max(0, tope - stockAct);
        if(n >= maxAdd){
          mostrarToast("⚠️ Máximo alcanzado (tope " + tope + ")");
          return;
        }
      }
    } else {
      const maxRemove = Math.max(0, stockAct - reserva);
      if(n >= maxRemove){
        mostrarToast("⚠️ Máximo alcanzado (solo tienes " + stockAct + ")");
        return;
      }
    }
  }

  st.piezas[c] = Math.max(0, n + delta);
  renderMovimientoPantalla();
}
function confirmarMovimiento(){
  const st=movimientoState;
  let total=0;
  const piezas=[];
  denominations.forEach(d=>{
    const n=st.piezas[d.c]||0;
    if(n>0) piezas.push({n:n, idx:denominations.findIndex(x=>x.c===d.c)});
    total += n*d.c;
  });
  if(!piezas.length){alert("No has añadido ninguna pieza.");return}

  const tipo=st.tipo;
  const motivo=st.motivo;

  let msgConfirm="";
  if(motivo==="propina") msgConfirm="¿Registrar PROPINA de "+moneyText(total)+"?\n\nSe sumará a las propinas acumuladas.";
  else if(motivo==="encontrado") msgConfirm="¿Registrar dinero ENCONTRADO por "+moneyText(total)+"?\n\nNO se sumará a propinas.";
  else if(motivo==="otroIngreso") msgConfirm="¿Registrar OTRO INGRESO por "+moneyText(total)+"?\n\nNO se sumará a propinas.";
  else if(motivo==="gasto") msgConfirm="¿Registrar GASTO de "+moneyText(total)+"?";
  else if(motivo==="limpieza") msgConfirm="¿Registrar GASTO de LIMPIEZA por "+moneyText(total)+"?";
  if(!confirm(msgConfirm)) return;

  piezas.forEach(p=>{
    if(tipo==="entrada") stock[p.idx]+=p.n;
    else stock[p.idx]=Math.max(0,stock[p.idx]-p.n);
  });

  piezas.forEach(p=>{
    if(tipo==="entrada") statsOps.manualIn[p.idx]+=p.n;
    else statsOps.manualOut[p.idx]+=p.n;
  });
  saveStats();

  // Solo la propina real sube el acumulador de propinas
  if(motivo==="propina"){
    totalTips += total;
    saveTips();
  }

  saveStock();
  renderStockList();
  updateCashSummary();

  let msgOk = "✅ Movimiento registrado.";
  if(motivo==="propina") msgOk = "✅ Propina registrada.";
  else if(motivo==="encontrado") msgOk = "✅ Dinero encontrado registrado.";
  else if(motivo==="otroIngreso") msgOk = "✅ Ingreso registrado.";
  else if(motivo==="gasto") msgOk = "✅ Gasto registrado.";
  else if(motivo==="limpieza") msgOk = "✅ Gasto de limpieza registrado.";
  alert(msgOk);
  cerrarMovimientoPantalla();
}
/* ==================== FIN MOVIMIENTO MANUAL ==================== */

function abrirDiagnostico(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("diagnosticoPantalla");if(p)p.style.display="block";renderDiagnostico()}
function cerrarDiagnostico(){const p=document.getElementById("diagnosticoPantalla");if(p)p.style.display="none"}

function renderDiagnostico(){
  const cont=document.getElementById("diagnosticoContenido");
  if(!cont)return;
  const ops=statsOps.operations;
  let html="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ESTADO DEL APRENDIZAJE</div>";
  if(ops<10){
    const fal=10-ops;
    html+="<div style='background:#1e3a8a;border:1px solid #3b82f6;border-radius:10px;padding:14px;text-align:center'><div style='font-size:14px;color:#93c5fd;font-weight:700;line-height:1.5'>🧠 Aún aprendiendo<br><br><span style='font-size:13px;color:#bfdbfe'>Llevo registradas <b>"+ops+"</b> operaciones.<br>Necesito al menos 10 para sugerencias fiables.<br><br>Faltan <b>"+fal+"</b> operaciones más.</span></div></div>";
  } else {
    html+="<div style='background:#064e3b;border:1px solid #059669;border-radius:10px;padding:12px;text-align:center'><div style='font-size:13px;color:#4ade80;font-weight:700;line-height:1.5'>✅ Aprendizaje activo<br><span style='font-size:12px;color:#a7f3d0'>Basado en <b>"+ops+"</b> operaciones registradas</span></div></div>";
  }
  html+="</div>";

  if(ops>0){
    html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>📊 DATOS POR DENOMINACIÓN</div>";
    html+="<div style='display:grid;grid-template-columns:1.1fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.75fr;gap:3px;font-size:9px;color:#64748b;font-weight:700;padding-bottom:6px;border-bottom:1px solid #334155;text-align:right'><span style='text-align:left'>DENOM.</span><span>STOCK</span><span>RECV</span><span>GAST</span><span>DEP.</span><span>REP.</span><span>CAMB.</span><span>ESTIM.</span></div>";
    denominations.forEach((d,i)=>{
      const sn=stock[i];
      const rn=statsOps.received[i]||0;
      const gn=statsOps.spent[i]||0;
      const dp=statsOps.deposited[i]||0;
      const rp=statsOps.repuesto[i]||0;
      const cb=statsOps.cambioNeto[i]||0;
      const rit=gn/ops;
      let est="—",co="#64748b";
      if(rit>0){
        const res=Math.floor(sn/rit);
        est="~"+res;
        if(res<5)co="#ef4444";
        else if(res<15)co="#fbbf24";
        else co="#4ade80";
      }
      const cbColor = cb>0?"#4ade80":(cb<0?"#f87171":"#64748b");
      const cbTxt = cb>0?("+"+cb):String(cb);
      html+="<div style='display:grid;grid-template-columns:1.1fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.75fr;gap:3px;font-size:11px;color:#fff;padding:6px 0;border-bottom:1px solid #1e293b;text-align:right'><span style='text-align:left;font-weight:700'>"+d.n+"</span><span>"+sn+"</span><span style='color:#4ade80'>"+rn+"</span><span style='color:#fbbf24'>"+gn+"</span><span style='color:#f87171'>"+dp+"</span><span style='color:#38bdf8'>"+rp+"</span><span style='color:"+cbColor+"'>"+cbTxt+"</span><span style='color:"+co+";font-weight:800'>"+est+"</span></div>";
    });
    html+="</div>";
  }

  // Movimientos manuales
  let totalIn=0, totalOut=0;
  denominations.forEach((d,i)=>{
    totalIn += (statsOps.manualIn[i]||0) * d.c;
    totalOut += (statsOps.manualOut[i]||0) * d.c;
  });
  if(totalIn>0 || totalOut>0){
    html+="<div class='card' style='margin:0 0 12px 0'>";
    html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>📝 MOVIMIENTOS MANUALES</div>";
    html+="<div style='display:flex;justify-content:space-between;padding:6px 0;font-size:13px'><span style='color:#94a3b8'>📥 Entradas (propinas/correcciones)</span><span style='color:#4ade80;font-weight:800'>+"+moneyText(totalIn)+"</span></div>";
    html+="<div style='display:flex;justify-content:space-between;padding:6px 0;font-size:13px'><span style='color:#94a3b8'>📤 Salidas (gastos)</span><span style='color:#f87171;font-weight:800'>−"+moneyText(totalOut)+"</span></div>";
    html+="</div>";
  }

  html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>💡 CÓMO LEO ESTOS DATOS</div><div style='font-size:12px;color:#94a3b8;line-height:1.7'><b style='color:#4ade80'>RECV</b> → piezas recibidas del cliente.<br><b style='color:#fbbf24'>GAST</b> → piezas devueltas como cambio.<br><b style='color:#f87171'>DEP.</b> → piezas depositadas a la empresa.<br><b style='color:#38bdf8'>REP.</b> → piezas repuestas del banco.<br><b style='color:#4ade80'>CAMB.</b> → neto por cambio de billete (+recibes / −entregas).<br><b style='color:#38bdf8'>ESTIM.</b> → operaciones que aguantas.<br><br><span style='color:#64748b'>Las sugerencias se calculan con todos estos datos.</span></div></div>";
  cont.innerHTML=html;
}

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

function confirmarCambio(total){let s=0;denominations.forEach(d=>{s+=d.c*(cambioState.aRecibir[d.c]||0)});if(s!==total){alert("La suma no cuadra.");return}if(!confirm("¿Confirmar el cambio?"))return;Object.keys(cambioState.aEntregar).forEach(k=>{const c=parseInt(k);const n=cambioState.aEntregar[c];const i=denominations.findIndex(d=>d.c===c);if(i>=0&&n>0){stock[i]=Math.max(0,stock[i]-n);statsOps.cambioNeto[i]-=n}});denominations.forEach(d=>{const n=cambioState.aRecibir[d.c]||0;if(n>0){const i=denominations.findIndex(x=>x.c===d.c);if(i>=0){stock[i]=Math.max(0,stock[i]+n);statsOps.cambioNeto[i]+=n}}});saveStats();const cm=loadCambios();cm.push({fecha:new Date().toISOString(),aEntregar:Object.assign({},cambioState.aEntregar),aRecibir:Object.assign({},cambioState.aRecibir),total});saveCambios(cm);saveStock();renderStockList();updateCashSummary();alert("✅ Cambio confirmado.");cerrarCambioPantalla()}

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

  const grupos = [
    { titulo: "💵 BILLETES", tipo: "bill", color: "#4ade80" },
    { titulo: "🪙 MONEDAS", tipo: "coin", color: "#facc15" }
  ];

  let html = "";

  grupos.forEach(g => {
    const items = denominations.filter(d => d.type === g.tipo);
    if(!items.length) return;

    html += "<div style='font-size:12px;color:"+g.color+";font-weight:900;letter-spacing:0.5px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #334155'>"+g.titulo+"</div>";

    items.forEach(d => {
      const i = denominations.findIndex(x => x.c === d.c);
      const act = stock[i] || 0;
      const add = reponerState.manualAdd[d.c] || 0;
      const qu = act + add;
      const tope = topesRecibir[d.c] || 0;
      const objetivo = Math.floor(tope * FACTOR_LLENADO);
      const gc = (d.type === "bill" ? "bill-graphic " : "coin-graphic ") + d.class;
      const subtotal = add * d.c;

      let numColor = "#a78bfa";
      let alerta = "";
      if(add > 0){
        if(tope > 0 && qu > tope){ numColor = "#ef4444"; alerta = " ⚠"; }
        else if(objetivo > 0 && qu > objetivo){ numColor = "#fbbf24"; }
        else { numColor = "#4ade80"; }
      } else {
        numColor = "#475569";
      }

      const subtotalColor = subtotal > 0 ? "#4ade80" : "#475569";

      html += "<div style='display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1e293b'>";

      // Icono grande
      html += "<div class='"+gc+"' style='flex-shrink:0;font-size:14px'>"+d.short+"</div>";

      // Nombre
      html += "<div style='flex:1;min-width:0;font-size:15px;color:#fff;font-weight:800'>"+d.n+alerta+"</div>";

      // Controles
      html += "<div style='display:flex;align-items:center;gap:6px;flex-shrink:0'>";
      html += "<button type='button' onclick='ajustarManualReponer("+d.c+",-1)' style='width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:pointer'>−</button>";
      html += "<div style='width:44px;text-align:center;font-size:22px;font-weight:900;color:"+numColor+"'>"+add+"</div>";
      html += "<button type='button' onclick='ajustarManualReponer("+d.c+",1)' style='width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:pointer'>+</button>";
      html += "</div>";

      // Subtotal
      html += "<div style='width:76px;text-align:right;font-size:14px;font-weight:900;color:"+subtotalColor+";flex-shrink:0'>"+moneyText(subtotal)+"</div>";

      html += "</div>";
    });
  });

  cont.innerHTML = html;

  let tot = 0;
  denominations.forEach(d => { tot += (reponerState.manualAdd[d.c] || 0) * d.c; });
  const elT = document.getElementById("reponerManualTotal");
  if(elT) elT.textContent = moneyText(tot);

  const elE = document.getElementById("reponerManualEstado");
  if(elE && reponerState.importeManual > 0){
    const dif = tot - reponerState.importeManual;
    if(dif === 0) elE.innerHTML = "<span style='color:#4ade80;font-weight:800;font-size:14px'>✅ Coincide</span>";
    else if(dif < 0) elE.innerHTML = "<span style='color:#fbbf24;font-weight:800;font-size:14px'>⚠️ Faltan "+moneyText(-dif)+"</span>";
    else elE.innerHTML = "<span style='color:#f87171;font-weight:800;font-size:14px'>⚠️ Te pasas "+moneyText(dif)+"</span>";
  } else if(elE) elE.innerHTML = "";
}

function onCambioImporteManual(){const inp=document.getElementById("reponerImporteManual");if(!inp)return;const raw=parseFloat(inp.value.replace(',','.'))||0;const cents=Math.max(0,Math.round(raw*100));reponerState.importeManual=cents;if(cents>0){const rep=simularRepartoManual(cents);denominations.forEach((d,i)=>{reponerState.manualAdd[d.c]=rep[i]})}else denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});actualizarReponerManual()}

function simularRepartoManual(target){
  const objetivo  = denominations.map((d,i) => Math.floor((topesRecibir[d.c]||0) * FACTOR_LLENADO));
  const hueco     = denominations.map((d,i) => Math.max(0, objetivo[i] - (stock[i]||0)));
  const añadidos  = denominations.map(() => 0);
  let restante    = target;
  const maxPieza = Math.max(denominations[denominations.length-1].c, Math.floor(target / 3));
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
  if(restante > 0){
    let seguir = true;
    let seguridad = 5000;
    while(restante > 0 && seguir && seguridad-- > 0){
      seguir = false;
      for(let i = denominations.length - 1; i >= 0; i--){
        if(restante <= 0) break;
        const d = denominations[i];
        if(d.c > maxPieza) continue;
        if(añadidos[i] >= hueco[i]) continue;
        if(d.c <= restante){
          añadidos[i]++;
          restante -= d.c;
          seguir = true;
        }
      }
    }
  }
  if(restante > 0){
    for(let i = 0; i < denominations.length; i++){
      if(restante <= 0) break;
      const d = denominations[i];
      const libre = Math.max(0, hueco[i] - añadidos[i]);
      if(libre <= 0) continue;
      const n = Math.min(libre, Math.floor(restante / d.c));
      if(n > 0){ añadidos[i] += n; restante -= n * d.c; }
    }
  }
  if(restante > 0){
    for(let i = 0; i < denominations.length; i++){
      if(restante <= 0) break;
      const d = denominations[i];
      const n = Math.floor(restante / d.c);
      if(n > 0){ añadidos[i] += n; restante -= n * d.c; }
    }
  }
  return añadidos;
}

function ajustarManualReponer(cents,delta){
  const d = denominations.find(x => x.c === cents);
  if(!d) return;
  const i = denominations.findIndex(x => x.c === cents);
  const act = stock[i] || 0;
  const tope = topesRecibir[cents] || 0;
  const add = reponerState.manualAdd[cents] || 0;

  if(delta > 0 && tope > 0){
    const maxAdd = Math.max(0, tope - act);
    if(add >= maxAdd){
      mostrarToast("⚠️ Máximo alcanzado (tope " + tope + ")");
      return;
    }
  }

  reponerState.manualAdd[cents] = Math.max(0, add + delta);
  actualizarReponerManual();
}function resetManualReponer(){denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});reponerState.importeManual=0;const inp=document.getElementById("reponerImporteManual");if(inp)inp.value="";actualizarReponerManual()}

function confirmarReponer(){
  let añadir=[];
  let total=0;
  if(reponerState.modo==="manual"){
    denominations.forEach((d,i)=>{const n=reponerState.manualAdd[d.c]||0;if(n>0){añadir.push({index:i,cantidad:n});total+=n*d.c}});
    if(!añadir.length){alert("No has añadido ninguna pieza.");return}
  } else {
    const rec=configuracionRecomendada();
    const {faltantes}=calcularFaltantes(rec.viajes,rec.colchon);
    faltantes.forEach(x=>{if(reponerState.marcados[x.d.c]!==false){añadir.push({index:x.index,cantidad:x.falta});total+=x.falta*x.d.c}});
    if(!añadir.length){alert("No has marcado ninguna pieza.");return}
  }
  if(!confirm("¿Confirmar que has sacado "+moneyText(total)+" del banco y los has metido en la caja?"))return;
  añadir.forEach(x=>{stock[x.index]+=x.cantidad;statsOps.repuesto[x.index]+=x.cantidad});
  saveStats();saveStock();renderStockList();updateCashSummary();
  alert("✅ Añadido a la caja: "+moneyText(total));
  cerrarReponerPantalla()
}

function setupBackupUI(){const p=document.getElementById("panelInventario");if(!p)return;if(document.getElementById("backupBox"))return;const box=document.createElement("div");box.id="backupBox";box.style.cssText="margin-top:16px;border-top:1px solid #334155;padding-top:14px";const tt=document.createElement("div");tt.textContent="COPIA DE SEGURIDAD";tt.style.cssText="font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px";const be=document.createElement("button");be.type="button";be.textContent="💾 Guardar copia";be.style.cssText="width:100%;background:#334155;color:#fff;padding:12px;border-radius:10px;margin-bottom:8px;font-weight:700;font-size:15px;border:none;cursor:pointer";be.onclick=exportInventory;const bi=document.createElement("button");bi.type="button";bi.textContent="📂 Cargar copia";bi.style.cssText=be.style.cssText;bi.onclick=()=>fi.click();const fi=document.createElement("input");fi.type="file";fi.accept="application/json,.json";fi.style.display="none";fi.onchange=e=>{const f=e.target.files[0];if(f)importInventory(f);fi.value=""};box.appendChild(tt);box.appendChild(be);box.appendChild(bi);box.appendChild(fi);p.appendChild(box)}

async function exportInventory(){
  const data={app:"uberCambioVTC",version:11,exportedAt:new Date().toISOString(),stock,totalTips,reservaMinima,topesRecibir,diaReset,ultimoResetPropinas,stats:statsOps,cierres:loadCierres(),historicoResets:loadHistoricoResets(),cambios:loadCambios()};
  const js=JSON.stringify(data,null,2);
  const st=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  const fn="cambio-vtc-"+st+".json";
  let dl=false;
  try{
    const b=new Blob([js],{type:"application/json"});
    const u=URL.createObjectURL(b);
    const a=document.createElement("a");
    a.href=u;a.download=fn;a.rel="noopener";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(u),1000);
    dl=true;
  }catch(e){console.warn("Descarga directa falló:",e);}
  if(!dl) setTimeout(()=>showCopyFallback(js,false),100);
}

function showCopyFallback(js,after){const prev=document.getElementById("copyBackupModal");if(prev)prev.remove();const m=document.createElement("div");m.id="copyBackupModal";m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";const b=document.createElement("div");b.style.cssText="background:#1e293b;color:#f8fafc;border-radius:14px;padding:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto";const t=document.createElement("h3");t.textContent="Copia de seguridad";t.style.cssText="margin:0 0 8px;font-size:16px";const i=document.createElement("p");i.textContent=after?"Si no se ha descargado, copia este texto y guárdalo como .json.":"Copia este texto y guárdalo como .json.";i.style.cssText="font-size:13px;color:#94a3b8;margin:0 0 10px";const ta=document.createElement("textarea");ta.value=js;ta.readOnly=true;ta.style.cssText="width:100%;height:180px;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:10px;font-family:monospace;font-size:12px";const r=document.createElement("div");r.style.cssText="display:flex;gap:8px;margin-top:12px";const bc=document.createElement("button");bc.type="button";bc.textContent="📋 Copiar";bc.style.cssText="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;cursor:pointer";bc.onclick=async()=>{ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(js);else document.execCommand("copy");bc.textContent="✅ Copiado";setTimeout(()=>{bc.textContent="📋 Copiar"},1500)}catch(e){try{document.execCommand("copy");bc.textContent="✅ Copiado"}catch(_){bc.textContent="Selecciona y copia"}setTimeout(()=>{bc.textContent="📋 Copiar"},1500)}};const bx=document.createElement("button");bx.type="button";bx.textContent="Cerrar";bx.style.cssText="flex:1;background:#0f172a;color:#f8fafc;border:1px solid #475569;padding:12px;border-radius:10px;font-weight:700;cursor:pointer";bx.onclick=()=>m.remove();m.addEventListener("click",e=>{if(e.target===m)m.remove()});r.appendChild(bc);r.appendChild(bx);b.appendChild(t);b.appendChild(i);b.appendChild(ta);b.appendChild(r);m.appendChild(b);document.body.appendChild(m);setTimeout(()=>{ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length)},50)}

function importInventory(file){
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const data=JSON.parse(rd.result);
      if(!data||!Array.isArray(data.stock)||data.stock.length!==denominations.length){alert("El archivo no es una copia válida.");return;}
      if(!confirm("¿Reemplazar el inventario, propinas, reserva, topes, estadísticas e historial actuales?"))return;
      stock=data.stock.map(x=>Math.max(0,parseInt(x)||0));
      if(typeof data.totalTips==="number")totalTips=Math.max(0,data.totalTips);
      if(data.reservaMinima&&typeof data.reservaMinima==="object"){reservaMinima=Object.assign({},RESERVA_DEFAULT);denominations.forEach(d=>{if(typeof data.reservaMinima[d.c]==="number")reservaMinima[d.c]=Math.max(0,parseInt(data.reservaMinima[d.c])||0)});safeStorage.set("uberCambioReserva",JSON.stringify(reservaMinima))}
      if(data.topesRecibir&&typeof data.topesRecibir==="object"){topesRecibir=Object.assign({},TOPES_DEFAULT);denominations.forEach(d=>{if(typeof data.topesRecibir[d.c]==="number")topesRecibir[d.c]=Math.max(0,parseInt(data.topesRecibir[d.c])||0)});saveTopes()}
      if(typeof data.diaReset==="number"){diaReset=Math.max(1,Math.min(31,parseInt(data.diaReset)||20));saveDiaReset()}
      if(typeof data.ultimoResetPropinas==="string"){ultimoResetPropinas=data.ultimoResetPropinas;saveUltimoResetPropinas()}
      if(data.stats&&typeof data.stats==="object"){
        statsOps={
          operations:parseInt(data.stats.operations)||0,
          received:Array.isArray(data.stats.received)?data.stats.received.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          spent:Array.isArray(data.stats.spent)?data.stats.spent.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          deposited:Array.isArray(data.stats.deposited)?data.stats.deposited.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          repuesto:Array.isArray(data.stats.repuesto)?data.stats.repuesto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          cambioNeto:Array.isArray(data.stats.cambioNeto)?data.stats.cambioNeto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          manualIn:Array.isArray(data.stats.manualIn)?data.stats.manualIn.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),
          manualOut:Array.isArray(data.stats.manualOut)?data.stats.manualOut.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0)
        };
        saveStats();
      }
      if(Array.isArray(data.cierres))saveCierres(data.cierres);
      if(Array.isArray(data.historicoResets))saveHistoricoResets(data.historicoResets);
      if(Array.isArray(data.cambios))saveCambios(data.cambios);
      saveStock();saveTips();renderStockList();renderReservaList();renderTopesList();updateCashSummary();renderCierreHistorico();renderResetPanel();
      alert("✅ Copia restaurada.");
    }catch(e){alert("No se pudo leer el archivo.")}
  };
  rd.readAsText(file);
}

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
    const worker = await Tesseract.createWorker("spa+eng");
    await worker.terminate();
    console.log("✅ OCR precargado en segundo plano");
  } catch(e){
    console.warn("⚠️ Precalentado OCR falló:", e && e.message);
  }
}

async function leerPrecioDeImagen(){
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
    console.warn("Portapapeles no disponible:", e && e.name);
  }
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
    if(inp){ inp.value = importe.toFixed(2); calculate(); }
    cerrarOCRModal();
    mostrarToast("✅ Precio leído: " + importe.toFixed(2) + " €");
  } catch(e){
    console.error(e);
    mostrarOCRModal("❌ Error al procesar la imagen:<br><span style='font-size:11px;color:#94a3b8'>" + (e && e.message ? e.message : "desconocido") + "</span>", true);
  }
}

function extraerImporte(texto){
  if(!texto) return null;
  window.__ultimoOCR = texto;
  console.log("📄 Texto OCR completo:", texto);

  let t = texto.replace(/[Oo]/g, "0").replace(/[lI]/g, "1").replace(/S/g, "5").replace(/B/g, "8");

  const candidatos = [];

  const reDec = /(\d{1,3}(?:[.,]\s?\d{3})*[.,]\s?\d{1,2})/g;
  let m;
  while((m = reDec.exec(t)) !== null){
    const clean = m[1].replace(/\s/g, "");
    const partes = clean.match(/^(.*)[.,](\d{1,2})$/);
    if(partes){
      const entero = partes[1].replace(/[.,]/g, "");
      let dec = partes[2];
      if(dec.length === 1) dec += "0";
      const n = parseFloat(entero + "." + dec);
      if(!isNaN(n) && n >= 0.5 && n <= 500) candidatos.push(n);
    }
  }

  const reEur = /(\d{3,5})\s*€/g;
  while((m = reEur.exec(t)) !== null){
    const digits = m[1];
    if(digits.length === 3){
      const n = parseFloat(digits[0] + "." + digits.slice(1));
      if(!isNaN(n) && n >= 0.5 && n <= 300) candidatos.push(n);
    }
    if(digits.length === 4){
      const n = parseFloat(digits[0] + "." + digits.slice(2));
      if(!isNaN(n) && n >= 0.5 && n <= 300) candidatos.push(n);
      const n2 = parseFloat(digits.slice(0, 2) + "." + digits.slice(-2));
      if(!isNaN(n2) && n2 >= 0.5 && n2 <= 300) candidatos.push(n2);
    }
    if(digits.length === 5){
      const n = parseFloat(digits.slice(0, 2) + "." + digits.slice(3));
      if(!isNaN(n) && n >= 0.5 && n <= 300) candidatos.push(n);
      const n2 = parseFloat(digits.slice(0, 3) + "." + digits.slice(-2));
      if(!isNaN(n2) && n2 >= 0.5 && n2 <= 300) candidatos.push(n2);
    }
  }

  if(candidatos.length === 0){
    const sinHoras = t.replace(/\d{1,2}:\d{2}/g, " ");
    (sinHoras.match(/\b\d{2,3}\b/g) || [])
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n) && n >= 2 && n <= 300)
      .forEach(n => candidatos.push(n));
  }

  if(!candidatos.length) return null;
  const enRango = candidatos.filter(n => n >= 3 && n <= 100);
  if(enRango.length) return Math.min.apply(null, enRango);
  return Math.max.apply(null, candidatos);
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

  setTimeout(() => {
    const fD = document.getElementById("depManualFecha");
    const fT = document.getElementById("depManualFechaTxt");
    if(fD && fT){
      fD.addEventListener("change", () => { fT.value = fD.value || ""; });
      fT.addEventListener("input", () => {
        const v = fT.value.trim();
        if(/^\d{4}-\d{2}-\d{2}$/.test(v)) fD.value = v;
      });
    }
    const hD = document.getElementById("depManualHora");
    const hT = document.getElementById("depManualHoraTxt");
    if(hD && hT){
      hD.addEventListener("change", () => { hT.value = hD.value || ""; });
      hT.addEventListener("input", () => {
        const v = hT.value.trim();
        if(/^\d{2}:\d{2}$/.test(v)) hD.value = v;
      });
    }
  }, 100);

  setTimeout(() => { precalentarOCR(); }, 800);

  const s=document.getElementById("splash");
  if(s){
    setTimeout(()=>{
      s.classList.add("oculto");
      document.body.classList.remove("splash-active");
      setTimeout(()=>{if(s.parentNode)s.parentNode.removeChild(s)},500)
    },2500)
  }
}

function verDetalleDeposito(idx){
  const cierres = loadCierres();
  const c = cierres[idx];
  if(!c){ mostrarToast("No se encontró el depósito."); return; }

  const d = new Date(c.fecha);
  const fecha = d.toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
  const hora = d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});

  const prev = document.getElementById("modalDetalleDeposito");
  if(prev) prev.remove();
  const m = document.createElement("div");
  m.id = "modalDetalleDeposito";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";

  let html = "<div style='background:#1e293b;color:#f8fafc;border-radius:14px;padding:18px;max-width:400px;width:100%;border:1px solid #334155;max-height:85vh;overflow-y:auto'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;text-align:center'>DETALLE DEL DEPÓSITO</div>";
  html += "<div style='font-size:14px;color:#fff;font-weight:800;text-align:center;margin-top:6px'>"+(c.manual?"📝 Manual · ":"")+fecha+"</div>";
  html += "<div style='font-size:12px;color:#94a3b8;text-align:center'>"+hora+"</div>";
  html += "<div style='font-size:32px;font-weight:900;color:#4ade80;text-align:center;margin:12px 0 16px'>"+moneyText(c.total)+"</div>";

  if(Array.isArray(c.usados) && c.usados.length > 0){
    const totalPiezas = c.usados.reduce((s,n)=>s+n,0);
    if(totalPiezas > 0){
      html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>💵 BILLETES ENTREGADOS</div>";
      const bills = denominations.slice(0,5);
      let anyBill = false;
      bills.forEach((dd,i)=>{
        const n = c.usados[i] || 0;
        if(n > 0){
          anyBill = true;
          const gc = "bill-graphic " + dd.class;
          html += "<div style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #334155'>";
          html += "<div class='"+gc+"' style='flex-shrink:0;font-size:12px'>"+dd.short+"</div>";
          html += "<div style='flex:1;font-size:14px;color:#fff;font-weight:700'>"+dd.n+"</div>";
          html += "<div style='font-size:16px;font-weight:900;color:#4ade80'>×"+n+"</div>";
          html += "</div>";
        }
      });
      if(!anyBill){
        html += "<div style='font-size:13px;color:#64748b;text-align:center;padding:10px 0;font-style:italic'>No hay detalle de billetes.</div>";
      }
    } else {
      html += "<div style='font-size:13px;color:#64748b;text-align:center;padding:14px 0;font-style:italic;line-height:1.5'>Este depósito se registró sin detalle de piezas.<br>Los próximos ya tendrán detalle automático.</div>";
    }
  } else {
    html += "<div style='font-size:13px;color:#64748b;text-align:center;padding:14px 0;font-style:italic;line-height:1.5'>Este depósito se registró sin detalle de piezas.<br>Los próximos ya tendrán detalle automático.</div>";
  }

  html += "<button type='button' id='modalDetalleOk' style='width:100%;margin-top:18px;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer'>Cerrar</button>";
  html += "</div>";

  m.innerHTML = html;
  document.body.appendChild(m);

  document.getElementById("modalDetalleOk").onclick = () => m.remove();
  m.addEventListener("click", e => { if(e.target === m) m.remove(); });
}

function subirMarca(c, maxTotal){
  const actual = propinasDelCambio[c]||0;
  if(actual >= maxTotal) return;
  propinasDelCambio[c] = actual + 1;
  calculate();
}

function bajarMarca(c){
  const actual = propinasDelCambio[c]||0;
  if(actual <= 0) return;
  propinasDelCambio[c] = actual - 1;
  if(propinasDelCambio[c] <= 0) delete propinasDelCambio[c];
  calculate();
}

function resetMarcas(){
  propinasDelCambio = {};
  calculate();
}

function sincronizarTipInput(){
  const sumaPiezas = Object.keys(propinasDelCambio).reduce((s,k)=>s+parseInt(k)*propinasDelCambio[k],0);
  const total = tipManual + sumaPiezas;
  document.getElementById("tip").value = (total/100).toFixed(2);
}

init();