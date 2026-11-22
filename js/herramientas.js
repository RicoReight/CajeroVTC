/* ==================== VARIABLES DE ESTADO (HERRAMIENTAS) ==================== */
const PINES_DEFAULT = [
  { mat:"1204NDM", pin:"9611", combustible:true, pinturaBarca:false }, { mat:"2921NDH", pin:"1801", combustible:true, pinturaBarca:false },
  { mat:"7205NDM", pin:"7128", combustible:true, pinturaBarca:false }, { mat:"9429NDF", pin:"1622", combustible:true, pinturaBarca:false },
  { mat:"9433NDF", pin:"0081", combustible:true, pinturaBarca:false }, { mat:"9434NDF", pin:"5337", combustible:true, pinturaBarca:false },
  { mat:"9436NDF", pin:"8387", combustible:true, pinturaBarca:false }, { mat:"9437NDF", pin:"3562", combustible:true, pinturaBarca:false },
  { mat:"9441NDF", pin:"5414", combustible:true, pinturaBarca:false }, { mat:"9443NDF", pin:"5415", combustible:true, pinturaBarca:false },
  { mat:"9444NDF", pin:"0587", combustible:true, pinturaBarca:false }, { mat:"9447NDF", pin:"7698", combustible:true, pinturaBarca:false },
  { mat:"9448NDF", pin:"5486", combustible:true, pinturaBarca:false }, { mat:"9449NDF", pin:"7200", combustible:true, pinturaBarca:false },
  { mat:"9451NDF", pin:"9547", combustible:true, pinturaBarca:false }, { mat:"9452NDF", pin:"7563", combustible:true, pinturaBarca:false },
  { mat:"9454NDF", pin:"8060", combustible:true, pinturaBarca:false }, { mat:"9456NDF", pin:"2983", combustible:true, pinturaBarca:false },
  { mat:"9457NDF", pin:"3323", combustible:true, pinturaBarca:false }, { mat:"9459NDF", pin:"3051", combustible:true, pinturaBarca:false },
  { mat:"9461NDF", pin:"1179", combustible:true, pinturaBarca:false }, { mat:"9462NDF", pin:"6052", combustible:true, pinturaBarca:false },
  { mat:"9463NDF", pin:"3390", combustible:true, pinturaBarca:false }, { mat:"9464NDF", pin:"8406", combustible:true, pinturaBarca:false },
  { mat:"9465NDF", pin:"0402", combustible:true, pinturaBarca:false }, { mat:"9466NDF", pin:"0669", combustible:true, pinturaBarca:false },
  { mat:"9467NDF", pin:"2358", combustible:true, pinturaBarca:false }, { mat:"9471NDF", pin:"2510", combustible:true, pinturaBarca:false }
];

let cocheActual = safeStorage.get("uberCambioCocheActual") || "";
let horaFinJornada = safeStorage.get("uberCambioHoraFinJornada") || "18:00";
let timestampSeleccionCoche = parseInt(safeStorage.get("uberCambioTimestampCoche")) || 0;
let diaRecordatorio = parseInt(safeStorage.get("uberCambioDiaRecordatorio")) || 2;
let horaRecordatorio = safeStorage.get("uberCambioHoraRecordatorio") || "9:00";
let pinesLista = loadPines();

/* ==================== DEPÓSITOS Y CIERRES ==================== */
function abrirCierrePantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("cierrePantalla");
  if(p)p.style.display="block";
  const inp=document.getElementById("cierreInput"); if(inp)inp.value="";
  const cont=document.getElementById("cierreResultado"); if(cont){cont.style.display="none";cont.innerHTML=""}
  const btn=document.getElementById("btnConfirmarCierre"); if(btn)btn.style.display="none";
  const mb=document.getElementById("depositoManualBox"); if(mb)mb.style.display="none";
  renderChuletaDeposito();
  renderCierreHistorico();
}
function cerrarCierrePantalla(){ const p=document.getElementById("cierrePantalla"); if(p)p.style.display="none"; }

function findBilletes(target,bs,br){
  const mu=Math.floor(target/500);
  if(mu<=0)return{total:0,usados:[0,0,0,0,0],tocoReserva:false};
  const den=[{u:20,idx:0},{u:10,idx:1},{u:4,idx:2},{u:2,idx:3},{u:1,idx:4}];
  const disp=bs.map((n,i)=>Math.max(0,n-(br[i]||0)));
  const r1=mejorEnRango(mu,disp,den); if(r1&&r1.totalUnits===mu)return{total:mu*500,usados:r1.usados,tocoReserva:false};
  const r2=mejorEnRango(mu,bs,den); if(r2&&r2.totalUnits===mu)return{total:mu*500,usados:r2.usados,tocoReserva:true};
  if(r1)return{total:r1.totalUnits*500,usados:r1.usados,tocoReserva:false};
  if(r2)return{total:r2.totalUnits*500,usados:r2.usados,tocoReserva:true};
  return{total:0,usados:[0,0,0,0,0],tocoReserva:false};
}

function mejorEnRango(mu,cant,den){
  const n=den.length, INF=999999;
  const totDisp=den.reduce((s,d)=>s+(cant[d.idx]|0)*d.u,0);
  const cap=Math.min(mu,totDisp); if(cap<=0)return null;
  const tbl=[]; for(let i=0;i<=n;i++)tbl.push(new Array(cap+1).fill(INF)); tbl[n][0]=0;
  for(let i=n-1;i>=0;i--){
    const d=den[i], mN=cant[d.idx]|0;
    for(let v=0;v<=cap;v++){
      let best=INF, tope=Math.min(mN,Math.floor(v/d.u));
      for(let c=0;c<=tope;c++){ const sub=tbl[i+1][v-c*d.u]; if(sub+c<best)best=sub+c }
      tbl[i][v]=best;
    }
  }
  let bv=-1; for(let v=cap;v>=0;v--){ if(tbl[0][v]<INF){bv=v;break} }
  if(bv<0)return null;
  const us=[0,0,0,0,0]; let v=bv;
  for(let i=0;i<n;i++){
    const d=den[i], mN=cant[d.idx]|0;
    for(let c=mN;c>=0;c--){
      const val=c*d.u; if(val>v)continue;
      if(tbl[i+1][v-val]+c===tbl[i][v]){ us[d.idx]=c; v-=val; break; }
    }
  }
  return{totalUnits:bv,usados:us};
}

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
    let msg = mx===0 ? "⚠️ No tienes ningún billete en el inventario." : "⚠️ No puedes formar "+moneyText(target)+".<br>En billetes tienes como máximo "+moneyText(mx)+".";
    cont.innerHTML="<div style='color:#ef4444;font-weight:700;font-size:14px;text-align:center;line-height:1.6'>"+msg+"</div>";
    cont.style.display="block"; btn.style.display="none"; return;
  }

  const sd=stock.slice();
  for(let i=0;i<res.usados.length;i++)sd[i]=Math.max(0,sd[i]-res.usados[i]);

  const afectados={};
  for(let i=0;i<res.usados.length;i++){
    const n=res.usados[i]||0; if(n<=0) continue;
    const d=denominations[i], res_i=reservaMinima[d.c]||0;
    if(res_i>0 && sd[i] < res_i) afectados[d.c]={queda:sd[i], reserva:res_i};
  }
  const tocaAlgo = Object.keys(afectados).length>0;

  let html="";
  if(tocaAlgo){
    html+="<div style='background:#7f1d1d;border:1px solid #ef4444;border-radius:8px;padding:8px 12px;margin-bottom:12px;text-align:center'>";
    html+="<div style='font-size:13px;color:#fecaca;font-weight:800'>⚠️ Este depósito toca tu reserva mínima</div>";
    html+="<div style='font-size:11px;color:#fca5a5;margin-top:3px'>Los billetes marcados en rojo se quedarán sin cambio</div></div>";
  }

  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;text-align:center'>💵 ENTREGAR EN BILLETES</div>";
  html+="<div style='font-size:32px;font-weight:900;color:#4ade80;margin:6px 0 14px;text-align:center'>"+moneyText(res.total)+"</div>";
  html+="<div class='change-grid'>";
  
  res.usados.forEach((n,i)=>{
    if(n>0){
      const d=denominations[i], af=afectados[d.c];
      if(af){
        html+="<div class='cash-item' style='position:relative;background:#7f1d1d!important;border:2px solid #ef4444!important;border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center'>";
        html+="<div class='badge' style='background:#ef4444;color:#fff;font-weight:900'>x"+n+"</div>";
        html+="<div class='bill-graphic "+d.class+"'>"+d.short+"</div>";
        html+="<div style='margin-top:8px;font-size:14px;font-weight:900;color:#fecaca;text-align:center;line-height:1'>Quedan <span style='color:#fff;font-size:18px'>"+af.queda+"</span></div></div>";
      } else {
        html+="<div class='cash-item'><div class='badge'>x"+n+"</div><div class='bill-graphic "+d.class+"'>"+d.short+"</div></div>";
      }
    }
  });
  html+="</div>";

  const checks=[["≤ 20 €",2000],["≤ 30 €",3000],["≤ 50 €",5000],["≤ 80 €",8000],["≤ 100 €",10000]];
  let tarjs="", hay=false;
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

  const sobr=target-res.total, tot=stock.reduce((s,n,i)=>s+n*denominations[i].c,0), queda=tot-res.total;
  html+="<div style='margin-top:16px;padding-top:16px;border-top:1px solid #334155;text-align:center'>";
  if(sobr>0) html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px'>SOBRANTE NO ENTREGABLE</div><div style='font-size:20px;font-weight:900;color:#eab308;margin-top:4px'>"+moneyText(sobr)+"</div><div style='font-size:11px;color:#64748b;margin-top:2px'>No se puede dar en billetes</div>";
  html+="<div style='margin-top:14px;padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px'><div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px'>💼 TE QUEDA EN CAJA</div><div style='font-size:24px;font-weight:900;color:#4ade80;margin-top:4px'>"+moneyText(queda)+"</div><div style='font-size:11px;color:#94a3b8;margin-top:4px'>Después del depósito, en monedas y billetes restantes</div></div></div>";
  
  cont.innerHTML=html; cont.style.display="block"; btn.style.display="block";
  btn.dataset.total=String(res.total); btn.dataset.usados=JSON.stringify(res.usados);

  if(tocaAlgo){ btn.textContent="⚠️ CONFIRMAR DE TODAS FORMAS"; btn.style.background="#b45309"; }
  else { btn.textContent="✅ CONFIRMAR DEPÓSITO"; btn.style.background="#059669"; }
}

function confirmarCierre(){
  const btn=document.getElementById("btnConfirmarCierre");
  if(!btn)return;
  const total=parseInt(btn.dataset.total)||0;
  const usados=JSON.parse(btn.dataset.usados||"[]");
  if(total<=0)return;
  if(!confirm("¿Confirmar depósito? Se entregarán "+moneyText(total)+" en billetes.\n\nLas propinas NO se tocan."))return;
  
  for(let i=0;i<usados.length;i++)stock[i]=Math.max(0,stock[i]-usados[i]);
  for(let i=0;i<usados.length;i++)statsOps.deposited[i]+=usados[i]||0;
  
  saveStats(); saveStock(); renderStockList(); updateCashSummary();
  
  const cierres=loadCierres();
  cierres.push({fecha:new Date().toISOString(),total,usados:usados.slice()});
  saveCierres(cierres); renderCierreHistorico();
  
  document.getElementById("cierreInput").value="";
  const cont=document.getElementById("cierreResultado"); if(cont){cont.style.display="none";cont.innerHTML=""}
  btn.style.display="none"; alert("✅ Depósito realizado.\nEntregados: "+moneyText(total));
  
  try{ programarAvisosDeposito(); }catch(e){}
  
  // 👇 Estas dos líneas son las nuevas y están perfectas 👇
  if(typeof saveHistorialOps === "function") saveHistorialOps([]); 
  renderChuletaDeposito(); 

  alert("✅ Depósito realizado.\nEntregados: "+moneyText(total));
  programarAvisosDeposito();
  reponerState = { viajes:20, colchon:3, marcados:{}, modo:"auto", manualAdd:{}, importeManual:0 };
  const pc = document.getElementById("cambioPantalla");
  if(pc && pc.style.display === "block") renderCambioInicio();
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
  box.innerHTML=html; box.style.display="block";
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
      bills.forEach((dd,i)=>{
        const n = c.usados[i] || 0;
        if(n > 0){
          html += "<div style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #334155'>";
          html += "<div class='bill-graphic "+dd.class+"' style='flex-shrink:0;font-size:12px'>"+dd.short+"</div>";
          html += "<div style='flex:1;font-size:14px;color:#fff;font-weight:700'>"+dd.n+"</div>";
          html += "<div style='font-size:16px;font-weight:900;color:#4ade80'>×"+n+"</div></div>";
        }
      });
    } else { html += "<div style='font-size:13px;color:#64748b;text-align:center;padding:14px 0;font-style:italic;line-height:1.5'>Este depósito se registró sin detalle de piezas.</div>"; }
  } else { html += "<div style='font-size:13px;color:#64748b;text-align:center;padding:14px 0;font-style:italic;line-height:1.5'>Este depósito se registró sin detalle de piezas.</div>"; }
  html += "<button type='button' id='modalDetalleOk' style='width:100%;margin-top:18px;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer'>Cerrar</button></div>";
  m.innerHTML = html; document.body.appendChild(m);
  document.getElementById("modalDetalleOk").onclick = () => m.remove();
  m.addEventListener("click", e => { if(e.target === m) m.remove(); });
}

/* ==================== PINs TARJETAS / COCHES ==================== */
function loadPines(){
  const s = safeStorage.get("uberCambioPines");
  if(s){
    try{
      const arr = JSON.parse(s);
      if(Array.isArray(arr)) return arr.map(x => ({ mat: x.mat, pin: x.pin, combustible: x.combustible !== false, pinturaBarca: !!x.pinturaBarca, sinPeaje: !!x.sinPeaje }));
    }catch(e){}
  }
  return PINES_DEFAULT.map(x => ({ sinPeaje: false, ...x }));
}
function savePines(){ safeStorage.set("uberCambioPines", JSON.stringify(pinesLista)); }
function saveCocheActual(){ safeStorage.set("uberCambioCocheActual", cocheActual); safeStorage.set("uberCambioTimestampCoche", String(timestampSeleccionCoche)); }
function saveHoraFinJornada(){ safeStorage.set("uberCambioHoraFinJornada", horaFinJornada); }

function abrirPinesPantalla(){
  const p = document.getElementById("pinesPantalla");
  if(p) p.style.display = "block";
  const inp = document.getElementById("pinesBuscador");
  if(inp){ inp.value = ""; setTimeout(() => inp.focus(), 150); }
  renderPinesResultados();
}
function cerrarPinesPantalla(){ const p = document.getElementById("pinesPantalla"); if(p) p.style.display = "none"; }

function renderPinesResultados(){
  const cont = document.getElementById("pinesResultados"); if(!cont) return;
  const inp = document.getElementById("pinesBuscador");
  const q = (inp ? inp.value : "").trim().toUpperCase();

  let lista = [...pinesLista];
  if(q){ lista = lista.filter(x => x.mat.toUpperCase().includes(q) || String(x.pin).includes(q)); }
  lista.sort((a,b) => a.mat.localeCompare(b.mat));

  const cocheData = cocheActual ? pinesLista.find(x => x.mat === cocheActual) : null;

  const svgCombustible = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M3 13h10"/><path d="M13 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 4 0V9l-3-3"/></svg>`;
  const svgBarca = `<svg viewBox="0 0 20 13" width="18" height="12" style="display:inline-block;vertical-align:middle;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,0.35)"><rect width="20" height="13" fill="#004d98"/><rect x="4" width="4" height="13" fill="#a50044"/><rect x="12" width="4" height="13" fill="#a50044"/></svg>`;
  const svgSinPeaje = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M2 20 V10 L6 6 L10 10 V20"/><rect x="4.5" y="12" width="3" height="3"/><path d="M14 20 V9"/><path d="M14 9 L22 5"/><path d="M1 20 H23"/></svg>`;

  const styleDefault = "background:#1e293b;border:2px solid #475569;color:#fff";
  const styleRojo    = "background:#7f1d1d;border:2px solid #ef4444;color:#fff";
  const styleVerde   = "background:#14532d;border:2px solid #22c55e;color:#fff";
  const styleComb  = cb => cb ? styleDefault : styleRojo;
  const styleBarca = pb => pb ? styleVerde   : styleDefault;
  const styleSinPeaje = sp => sp ? styleRojo : styleDefault;

  let html = `
    <div style="background:${cocheData ? 'linear-gradient(135deg,#064e3b,#065f46)' : '#1e293b'};border:2px solid ${cocheData ? '#10b981' : '#475569'};border-radius:16px;padding:16px;margin-bottom:14px">
      <div style="font-size:13px;color:${cocheData ? '#a7f3d0' : '#94a3b8'};font-weight:900;letter-spacing:1px;margin-bottom:${cocheData ? '12px' : '4px'}">🚗 ${cocheData ? 'MI COCHE AHORA' : 'SIN COCHE ASIGNADO'}</div>
      ${cocheData ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">
          <div style="flex:1;min-width:0"><div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:2px;line-height:1">${cocheData.mat}</div><div style="font-size:44px;font-weight:900;color:#4ade80;letter-spacing:6px;margin-top:6px;line-height:1">${cocheData.pin}</div></div>
          <button type="button" onclick="copiarPin('${cocheData.pin}')" style="background:#10b981;color:#0f172a;border:none;border-radius:10px;padding:12px 14px;font-weight:900;font-size:14px;cursor:pointer;white-space:nowrap">📋 PIN</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <button type="button" onclick="togglePinCombustible('${cocheData.mat}')" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;${styleComb(cocheData.combustible)};font-weight:900;font-size:12px;cursor:pointer">${svgCombustible} <span>${cocheData.combustible?'Sí':'NO'}</span></button>
          <button type="button" onclick="togglePinBarca('${cocheData.mat}')" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;${styleBarca(cocheData.pinturaBarca)};font-weight:900;font-size:12px;cursor:pointer">${svgBarca} <span>${cocheData.pinturaBarca?'Sí':'No'} Barça</span></button>
          <button type="button" onclick="togglePinSinPeaje('${cocheData.mat}')" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;${styleSinPeaje(cocheData.sinPeaje)};font-weight:900;font-size:12px;cursor:pointer">${svgSinPeaje} <span>${cocheData.sinPeaje?'Sí':'No'} sin peaje</span></button>
        </div>
        <button type="button" onclick="liberarCoche()" style="width:100%;background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:800;font-size:13px;cursor:pointer">🔓 LIBERAR COCHE</button>
      ` : `<div style="font-size:12px;color:#64748b;line-height:1.4;text-align:center;padding:8px 0">Pulsa <b style="color:#4ade80">USAR</b> en una matrícula de la lista de abajo</div>`}
    </div>`;

  if(lista.length === 0){
    html += `<div style="text-align:center;color:#64748b;padding:30px;font-size:14px">Sin resultados para "${q}"</div>`;
    cont.innerHTML = html; return;
  }

  html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:6px 12px">`;
  lista.forEach(x => {
    const cb = x.combustible, pb = x.pinturaBarca, sp = x.sinPeaje, esActual = x.mat === cocheActual;
    html += `
      <div style="display:flex;align-items:center;gap:6px;padding:10px 0;border-bottom:1px solid #1e293b;${esActual ? 'background:rgba(16,185,129,0.08);margin:0 -12px;padding-left:12px;padding-right:12px;border-radius:6px' : ''}">
        <div style="flex:1;min-width:0"><div style="font-size:15px;color:#fff;font-weight:800;letter-spacing:1px">${x.mat}</div><div style="font-size:16px;font-weight:900;color:#38bdf8;letter-spacing:3px">${x.pin}</div></div>
        <button type="button" onclick="togglePinCombustible('${x.mat}')" title="Combustible: ${cb?'SÍ':'NO'}" style="width:34px;height:34px;padding:0;border-radius:8px;${styleComb(cb)};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">${svgCombustible}</button>
        <button type="button" onclick="togglePinBarca('${x.mat}')" title="Pintura Barça: ${pb?'SÍ':'NO'}" style="width:34px;height:34px;padding:0;border-radius:8px;${styleBarca(pb)};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">${svgBarca}</button>
        <button type="button" onclick="togglePinSinPeaje('${x.mat}')" title="Sin tarjeta de peajes: ${sp?'SÍ':'NO'}" style="width:34px;height:34px;padding:0;border-radius:8px;${styleSinPeaje(sp)};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">${svgSinPeaje}</button>
        ${esActual ? `<div style="background:#10b981;color:#0f172a;font-size:10px;font-weight:900;padding:4px 8px;border-radius:6px;letter-spacing:0.5px;flex-shrink:0">ACTUAL</div>` : `<button type="button" onclick="seleccionarCoche('${x.mat}')" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:900;cursor:pointer;flex-shrink:0">USAR</button>`}
        <button type="button" onclick="editarPin('${x.mat}')" style="background:#334155;color:#94a3b8;border:none;border-radius:8px;padding:6px 8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0">✏️</button>
      </div>`;
  });
  html += `</div>`;
  html += `<div style="text-align:center;margin-top:16px"><button type="button" onclick="abrirHistorialCoches()" style="background:#1e293b;color:#38bdf8;border:1px solid #475569;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">📅 Historial de coches</button></div>`;
  cont.innerHTML = html;
}

function togglePinCombustible(mat){ const item = pinesLista.find(x => x.mat === mat); if(!item) return; item.combustible = !item.combustible; savePines(); renderPinesResultados(); actualizarBotonCochePrincipal(); }
function togglePinBarca(mat){ const item = pinesLista.find(x => x.mat === mat); if(!item) return; item.pinturaBarca = !item.pinturaBarca; savePines(); renderPinesResultados(); actualizarBotonCochePrincipal(); }
function togglePinSinPeaje(mat){ const item = pinesLista.find(x => x.mat === mat); if(!item) return; item.sinPeaje = !item.sinPeaje; savePines(); renderPinesResultados(); actualizarBotonCochePrincipal(); }

function copiarPin(pin){ try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(pin).then(() => { mostrarToast("✅ PIN copiado: " + pin); }).catch(() => { mostrarToast("PIN: " + pin); }); } else { mostrarToast("PIN: " + pin); } } catch(e){ mostrarToast("PIN: " + pin); } }
function editarPin(mat){ const item = pinesLista.find(x => x.mat === mat); if(!item) return; abrirModalPin(item); }
function abrirModalPinNuevo(){ abrirModalPin(null); }

function abrirModalPin(existente){
  const prev = document.getElementById("modalPinEditar"); if(prev) prev.remove();
  const esNuevo = !existente, cb = existente ? (existente.combustible !== false) : true, pb = existente ? !!existente.pinturaBarca : false, sp = existente ? !!existente.sinPeaje : false;
  
  const m = document.createElement("div");
  m.id = "modalPinEditar";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  
  const svgCombustible = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M3 13h10"/><path d="M13 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 4 0V9l-3-3"/></svg>`;
  const svgBarca = `<svg viewBox="0 0 20 13" width="26" height="17" style="display:inline-block;vertical-align:middle;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,0.35)"><rect width="20" height="13" fill="#004d98"/><rect x="4" width="4" height="13" fill="#a50044"/><rect x="12" width="4" height="13" fill="#a50044"/></svg>`;
  const svgSinPeaje = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M2 20 V10 L6 6 L10 10 V20"/><rect x="4.5" y="12" width="3" height="3"/><path d="M14 20 V9"/><path d="M14 9 L22 5"/><path d="M1 20 H23"/></svg>`;

  const styleDefault = "background:#1e293b;border:2px solid #475569;color:#fff", styleRojo = "background:#7f1d1d;border:2px solid #ef4444;color:#fff", styleVerde = "background:#14532d;border:2px solid #22c55e;color:#fff";
  const styleComb = cb ? styleDefault : styleRojo, styleBarca = pb ? styleVerde : styleDefault, styleSinPeaje = sp ? styleRojo : styleDefault;

  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155">
      <div style="font-size:16px;font-weight:900;color:#38bdf8;text-align:center;margin-bottom:16px">${esNuevo ? "🔑 Nueva tarjeta" : "🔑 Editar tarjeta"}</div>
      <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">MATRÍCULA</div>
      <input type="text" id="pinEditMat" value="${existente ? existente.mat : ""}" placeholder="Ej: 9433NDF" maxlength="12" style="width:100%;font-size:18px;font-weight:800;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;margin-bottom:14px;outline:none;box-sizing:border-box;text-transform:uppercase;letter-spacing:2px">
      <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">PIN (4 dígitos)</div>
      <input type="text" id="pinEditPin" value="${existente ? existente.pin : ""}" placeholder="Ej: 8387" maxlength="4" inputmode="numeric" style="width:100%;font-size:28px;font-weight:900;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#4ade80;margin-bottom:16px;outline:none;box-sizing:border-box;text-align:center;letter-spacing:8px">
      <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:8px">EXTRAS · pulsa para cambiar</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:16px">
        <button type="button" id="pinCombBtn" onclick="toggleModalCheck('comb')" style="padding:14px 4px;border-radius:10px;${styleComb};font-weight:900;cursor:pointer;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:6px">${svgCombustible}<span>Comb.</span></button>
        <button type="button" id="pinBarcaBtn" onclick="toggleModalCheck('barca')" style="padding:14px 4px;border-radius:10px;${styleBarca};font-weight:900;cursor:pointer;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:6px">${svgBarca}<span>Barça</span></button>
        <button type="button" id="pinSinPeajeBtn" onclick="toggleModalCheck('sinPeaje')" style="padding:14px 4px;border-radius:10px;${styleSinPeaje};font-weight:900;cursor:pointer;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:6px">${svgSinPeaje}<span>Sin peaje</span></button>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" onclick="cerrarModalPin()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button>
        <button type="button" onclick="guardarPin(${existente ? `'${existente.mat}'` : "null"})" style="flex:1;background:#0891b2;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) cerrarModalPin(); });
  window.__pinModalState = { comb: cb, barca: pb, sinPeaje: sp };
  setTimeout(() => { const inp = document.getElementById("pinEditMat"); if(inp) inp.focus(); }, 150);
}

function toggleModalCheck(kind){
  if(!window.__pinModalState) window.__pinModalState = { comb:false, barca:false, sinPeaje:false };
  window.__pinModalState[kind] = !window.__pinModalState[kind];
  const st = window.__pinModalState;
  const styleDefault = { bg:'#1e293b', border:'#475569' }, styleRojo = { bg:'#7f1d1d', border:'#ef4444' }, styleVerde = { bg:'#14532d', border:'#22c55e' };
  const comb = document.getElementById("pinCombBtn"), barca = document.getElementById("pinBarcaBtn"), sinPeaje = document.getElementById("pinSinPeajeBtn");
  if(comb){ const s = st.comb ? styleDefault : styleRojo; comb.style.background = s.bg; comb.style.border = `2px solid ${s.border}`; comb.style.color = '#fff'; }
  if(barca){ const s = st.barca ? styleVerde : styleDefault; barca.style.background = s.bg; barca.style.border = `2px solid ${s.border}`; barca.style.color = '#fff'; }
  if(sinPeaje){ const s = st.sinPeaje ? styleRojo : styleDefault; sinPeaje.style.background = s.bg; sinPeaje.style.border = `2px solid ${s.border}`; sinPeaje.style.color = '#fff'; }
}

function cerrarModalPin(){ const m = document.getElementById("modalPinEditar"); if(m) m.remove(); }

function guardarPin(matOriginal){
  const matInp = document.getElementById("pinEditMat"), pinInp = document.getElementById("pinEditPin");
  if(!matInp || !pinInp) return;
  const mat = (matInp.value || "").trim().toUpperCase(), pin = (pinInp.value || "").trim();
  const st = window.__pinModalState || { comb:false, barca:false, sinPeaje:false };
  if(!mat){ alert("Escribe una matrícula."); return; }
  if(!/^\d{4}$/.test(pin)){ alert("El PIN debe ser de 4 dígitos."); return; }
  const dup = pinesLista.find(x => x.mat === mat && x.mat !== matOriginal);
  if(dup){ alert("⚠️ Ya existe una tarjeta con esa matrícula."); return; }

  if(matOriginal){
    const idx = pinesLista.findIndex(x => x.mat === matOriginal);
    if(idx >= 0) pinesLista[idx] = { mat, pin, combustible: !!st.comb, pinturaBarca: !!st.barca, sinPeaje: !!st.sinPeaje };
  } else { pinesLista.push({ mat, pin, combustible: !!st.comb, pinturaBarca: !!st.barca, sinPeaje: !!st.sinPeaje }); }
  pinesLista.sort((a,b) => a.mat.localeCompare(b.mat));
  savePines(); window.__pinModalState = null; cerrarModalPin(); renderPinesResultados();
  mostrarToast(matOriginal ? "✅ Tarjeta actualizada" : "✅ Tarjeta añadida");
}

function seleccionarCoche(mat){
  const item = pinesLista.find(x => x.mat === mat);
  if(!item) return;
  cocheActual = mat; timestampSeleccionCoche = Date.now(); saveCocheActual();
  registrarCocheDia(mat); renderPinesResultados(); actualizarBotonCochePrincipal(); mostrarToast("✅ Coche actual: " + mat);
}
function liberarCoche(){
  if(!cocheActual) return;
  if(!confirm("¿Liberar el coche actual?\n\nTendrás que volver a seleccionarlo la próxima vez.")) return;
  cocheActual = ""; timestampSeleccionCoche = 0; saveCocheActual(); renderPinesResultados(); actualizarBotonCochePrincipal(); mostrarToast("🔓 Coche liberado");
}

function checkResetCoche(){
  if(!cocheActual) return;
  if(!timestampSeleccionCoche) { timestampSeleccionCoche = Date.now(); saveCocheActual(); return; }
  const ahora = new Date(), [hh, mm] = horaFinJornada.split(":").map(Number);
  let ultimoReset = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm, 0);
  if(ahora < ultimoReset) ultimoReset.setDate(ultimoReset.getDate() - 1);
  if(timestampSeleccionCoche < ultimoReset.getTime()){
    cocheActual = ""; timestampSeleccionCoche = 0; saveCocheActual();
    if(document.getElementById("pinesResultados")) renderPinesResultados();
    actualizarBotonCochePrincipal(); mostrarToast("🔓 Coche liberado (fin de jornada " + horaFinJornada + ")");
  }
}

function actualizarBotonCochePrincipal(){
  let elTexto = null;
  const allEls = Array.from(document.querySelectorAll('div, span, h1, h2, h3, p'));
  for (let el of allEls) { if (el.textContent.trim().toUpperCase().includes('CAMBIO EN CAJA') && el.children.length <= 1) { elTexto = el; break; } }
  let target = null;
  if (elTexto) {
    target = elTexto;
    for (let i = 0; i < 5; i++) {
      if (!target.parentElement || target.parentElement === document.body) break;
      target = target.parentElement;
      const style = window.getComputedStyle(target);
      if (style.border.includes('rgb(59, 130, 246)') || style.border.includes('3b82f6') || target.className.includes('card')) break;
    }
  } else { target = document.querySelector('.container') || document.querySelector('main') || document.querySelector('.content'); }
  if(!target) return false;

  let widget = document.getElementById("widgetCochePrincipal");
  if(!widget){
    widget = document.createElement("div"); widget.id = "widgetCochePrincipal";
    widget.style.cssText = "margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%;";
    target.parentNode.insertBefore(widget, target);
  }

  let carHtml = "";
  if(cocheActual){
    const cocheData = pinesLista.find(x => x.mat === cocheActual);
    const cb = cocheData ? cocheData.combustible : false, pb = cocheData ? cocheData.pinturaBarca : false, sp = cocheData ? cocheData.sinPeaje : false;
    const svgCombustible = !cb ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M3 13h10"/><path d="M13 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 4 0V9l-3-3"/></svg>` : "";
    const svgBarca = pb ? `<svg viewBox="0 0 20 13" width="14" height="10" style="vertical-align:middle; border-radius:2px; box-shadow:0 0 0 1px rgba(255,255,255,0.35);"><rect width="20" height="13" fill="#004d98"/><rect x="4" width="4" height="13" fill="#a50044"/><rect x="12" width="4" height="13" fill="#a50044"/></svg>` : "";
    const svgSinPeaje = sp ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M2 20 V10 L6 6 L10 10 V20"/><path d="M14 20 V9"/><path d="M14 9 L22 5"/><path d="M1 20 H23"/></svg>` : "";
    let iconosHtml = "";
    if(!cb || pb || sp) iconosHtml = `<div style="display: flex; gap: 6px; align-items: center; border-left: 1px solid rgba(255,255,255,0.2); padding-left: 8px; margin-left: 2px;">${svgCombustible}${svgBarca}${svgSinPeaje}</div>`;
    carHtml = `
      <div onclick="if(typeof abrirPinesPantalla==='function')abrirPinesPantalla()" style="background: linear-gradient(135deg, #064e3b, #065f46); border: 1px solid #10b981; border-radius: 20px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(16,185,129,0.2); cursor: pointer;">
        <span style="font-size: 14px;">🚗</span>
        <span style="font-size: 14px; font-weight: 900; color: #fff; letter-spacing: 1px;">${cocheActual}</span>
        ${iconosHtml}
        <span style="font-size: 14px; color: #4ade80; font-weight: 900; margin-left: ${iconosHtml ? '2px' : '6px'};">›</span>
      </div>`;
  } else {
    carHtml = `
      <div onclick="if(typeof abrirPinesPantalla==='function')abrirPinesPantalla()" style="background: #1e293b; border: 1px dashed #475569; border-radius: 20px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
        <span style="font-size: 14px;">🚗</span>
        <span style="font-size: 13px; font-weight: 700; color: #94a3b8;">Asignar coche</span>
        <span style="font-size: 14px; color: #94a3b8; font-weight: 900; margin-left: 4px;">›</span>
      </div>`;
  }

  const avisos = obtenerAvisos();
  let alertHtml = "";
  if(avisos.length > 0){
    const urgente = avisos.some(a => a.tipo === "urgente");
    const colorBg = urgente ? "linear-gradient(135deg,#7f1d1d,#991b1b)" : "linear-gradient(135deg,#7c2d12,#9a3412)";
    const colorBorder = urgente ? "#ef4444" : "#ea580c", colorIcon = urgente ? "#fca5a5" : "#fed7aa", shadow = urgente ? "rgba(239,68,68,0.45)" : "rgba(234,88,12,0.35)";
    alertHtml = `<div onclick="abrirModalAvisos()" title="${avisos.length} aviso${avisos.length !== 1 ? 's' : ''}" style="background:${colorBg}; border:1px solid ${colorBorder}; border-radius:20px; padding:6px 12px; display:inline-flex; align-items:center; gap:8px; cursor:pointer; box-shadow:0 2px 8px ${shadow};"><span style="font-size:16px;">🔔</span><span style="font-size:14px; font-weight:900; color:${colorIcon}; letter-spacing:0.5px;">${avisos.length}</span></div>`;
  }
  widget.innerHTML = carHtml + alertHtml;
  return true;
}

function registrarCocheDia(mat) {
  const hoy = fechaLocalStr();
  const h = loadHistorialCoches ? loadHistorialCoches() : [];
  if (h.length > 0 && h[h.length - 1].fecha === hoy && h[h.length - 1].mat === mat) return;
  h.push({ fecha: hoy, mat: mat, hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) });
  if (h.length > 300) h.shift();
  safeStorage.set("uberCambioHistorialCoches", JSON.stringify(h));
}

function loadHistorialCoches() {
  const s = safeStorage.get("uberCambioHistorialCoches");
  if (s) { try { return JSON.parse(s) || []; } catch(e) { return []; } }
  return [];
}

function abrirHistorialCoches() {
  const h = loadHistorialCoches();
  const prev = document.getElementById("modalHistorialCoches");
  if(prev) prev.remove();
  let htmlItems = "";
  if (h.length === 0) htmlItems = "<div style='text-align:center;color:#64748b;font-size:14px;padding:20px'>Aún no tienes registros.</div>";
  else {
    [...h].reverse().forEach(item => {
      const d = new Date(item.fecha + "T12:00:00");
      const fechaBonita = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
      htmlItems += `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #334155;"><div style="font-size:13px;color:#94a3b8;text-transform:capitalize;">${fechaBonita}</div><div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">${item.mat}</div><div style="font-size:11px;color:#64748b;font-weight:700;">${item.hora || ""}</div></div>`;
    });
  }
  const m = document.createElement("div");
  m.id = "modalHistorialCoches";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:400px;width:100%;border:1px solid #334155;max-height:85vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><div style="font-size:16px;font-weight:900;color:#38bdf8;">📅 Historial de Coches</div><button type="button" onclick="document.getElementById('modalHistorialCoches').remove()" style="background:#334155;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px">✕</button></div>
      <div style="overflow-y:auto;flex:1;padding-right:4px;">${htmlItems}</div>
      <button type="button" onclick="document.getElementById('modalHistorialCoches').remove()" style="width:100%;margin-top:16px;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cerrar</button>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", (e) => { if(e.target === m) m.remove(); });
}

/* ==================== HUCHA ==================== */
function abrirHuchaPantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("huchaPantalla"); if(p)p.style.display="block"; renderHucha();
}
function cerrarHuchaPantalla(){ const p=document.getElementById("huchaPantalla"); if(p)p.style.display="none"; }

function renderHucha(){
  const cont = document.getElementById("huchaContenido"); if(!cont) return;
  let html = `<div class="card" style="margin:0 0 12px 0;background:#1e3a8a;border:1px solid #3b82f6"><div style="font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px">🏦 TU HUCHA EN CASA</div><div style="font-size:12px;color:#93c5fd;line-height:1.5">Apunta aquí las monedas que guardas en casa. Usa el botón <b>⊞</b> para sumar filas y columnas (ej: 5x8).</div></div>`;
  html += `<div class="card" style="margin:0 0 12px 0">`;
  html += `<div style="font-size:11px;color:#f87171;font-weight:800;letter-spacing:0.5px;margin-bottom:8px">💵 BILLETES</div>`;
  denominations.slice(0,5).forEach((d, i) => {
    const n = hucha[i] || 0, gc = "bill-graphic " + d.class;
    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1e293b"><div class="${gc}" style="flex-shrink:0;font-size:12px">${d.short}</div><div style="flex:1;font-size:14px;color:#fff;font-weight:700">${d.n}</div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><button type="button" onclick="huchaStep(${i}, -1)" style="width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:22px;font-weight:800;cursor:pointer">−</button><input type="number" min="0" value="${n}" onchange="actualizarHucha(${i}, this.value)" style="width:56px;font-size:16px;font-weight:900;padding:8px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#4ade80;text-align:center;outline:none"><button type="button" onclick="huchaStep(${i}, 1)" style="width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:22px;font-weight:800;cursor:pointer">+</button><button type="button" onclick="abrirHuchaGrid(${i})" style="width:34px;height:34px;padding:0;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:800;cursor:pointer" title="Multiplicar filas x columnas">⊞</button></div></div>`;
  });
  html += `<div style="font-size:11px;color:#facc15;font-weight:800;letter-spacing:0.5px;margin:16px 0 8px">🪙 MONEDAS</div>`;
  denominations.slice(5).forEach((d, idx) => {
    const i = idx + 5, n = hucha[i] || 0, gc = "coin-graphic " + d.class;
    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1e293b"><div class="${gc}" style="flex-shrink:0;font-size:12px">${d.short}</div><div style="flex:1;font-size:14px;color:#fff;font-weight:700">${d.n}</div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><button type="button" onclick="huchaStep(${i}, -1)" style="width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:22px;font-weight:800;cursor:pointer">−</button><input type="number" min="0" value="${n}" onchange="actualizarHucha(${i}, this.value)" style="width:56px;font-size:16px;font-weight:900;padding:8px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#4ade80;text-align:center;outline:none"><button type="button" onclick="huchaStep(${i}, 1)" style="width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:22px;font-weight:800;cursor:pointer">+</button><button type="button" onclick="abrirHuchaGrid(${i})" style="width:34px;height:34px;padding:0;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:800;cursor:pointer" title="Multiplicar filas x columnas">⊞</button></div></div>`;
  });
  html += `</div>`;
  let total = 0; denominations.forEach((d,i) => { total += d.c * (hucha[i] || 0); });
  html += `<div class="card" style="margin:0 0 12px 0;text-align:center;background:#0f172a;border:1px solid #334155"><div style="font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:6px">TOTAL AHORRADO EN CASA</div><div style="font-size:32px;font-weight:900;color:#38bdf8">${moneyText(total)}</div></div>`;
  html += `<button type="button" onclick="cerrarHuchaPantalla()" style="width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:15px;cursor:pointer">✖ Volver</button>`;
  cont.innerHTML = html;
}

function huchaStep(idx, delta){ hucha[idx] = Math.max(0, (hucha[idx] || 0) + delta); saveHucha(); renderHucha(); }
function actualizarHucha(idx, val){ const n = parseInt(val) || 0; hucha[idx] = Math.max(0, n); saveHucha(); renderHucha(); }

function abrirHuchaGrid(idx){
  const d = denominations[idx], prev = document.getElementById("modalHuchaGrid");
  if(prev) prev.remove();
  const m = document.createElement("div");
  m.id = "modalHuchaGrid";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:340px;width:100%;border:1px solid #334155;text-align:center"><div style="font-size:16px;font-weight:900;color:#a78bfa;margin-bottom:4px">⊞ Sumar por cuadrícula</div><div style="font-size:12px;color:#94a3b8;margin-bottom:16px">${d.n}</div><input type="text" id="huchaGridInput" placeholder="Ej: 5x8 o 5*8" style="width:100%;font-size:24px;font-weight:900;padding:12px;border-radius:10px;border:2px solid #7c3aed;background:#0f172a;color:#fff;text-align:center;outline:none;margin-bottom:16px;box-sizing:border-box"><div style="font-size:11px;color:#64748b;margin-bottom:16px">Escribe las filas y las columnas separadas por una X</div><div style="display:flex;gap:8px"><button type="button" onclick="document.getElementById('modalHuchaGrid')?.remove()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer">Cancelar</button><button type="button" onclick="guardarHuchaGrid(${idx})" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer">✅ Sumar</button></div></div>`;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) m.remove(); });
  setTimeout(() => { const inp = document.getElementById("huchaGridInput"); if(inp) inp.focus(); }, 150);
}

function guardarHuchaGrid(idx){
  const inp = document.getElementById("huchaGridInput"); if(!inp) return;
  const txt = (inp.value || "").toLowerCase().replace(/\s+/g, ""); let totalASumar = 0;
  if(txt.includes("x")){ const p = txt.split("x"); totalASumar = (parseInt(p[0]) || 0) * (parseInt(p[1]) || 0); }
  else if(txt.includes("*")){ const p = txt.split("*"); totalASumar = (parseInt(p[0]) || 0) * (parseInt(p[1]) || 0); }
  else { totalASumar = parseInt(txt) || 0; }
  if(totalASumar <= 0){ mostrarToast("⚠️ Escribe algo como 5x8"); return; }
  hucha[idx] = (hucha[idx] || 0) + totalASumar; saveHucha();
  const modal = document.getElementById("modalHuchaGrid"); if(modal) modal.remove();
  renderHucha(); mostrarToast("✅ Sumadas " + totalASumar + " piezas");
}

function moverAHucha(idx, cantidad){
  const d = denominations[idx]; cantidad = Math.max(0, Math.min(parseInt(cantidad) || 0, stock[idx] || 0));
  if(cantidad <= 0 || !d) return 0;
  stock[idx] -= cantidad; hucha[idx] = (hucha[idx] || 0) + cantidad;
  saveStock(); saveHucha();
  try { renderStockList(); } catch(e){} try { updateCashSummary(); } catch(e){}
  try { if(document.getElementById("huchaContenido")) renderHucha(); } catch(e){}
  try { if(document.getElementById("cambioContenido")) renderCambioInicio(); } catch(e){}
  const pc = document.getElementById("cambioPantalla");
  if(pc && pc.style.display === "block") renderCambioInicio();
  return cantidad;
}
function sacarDeHucha(idx, cantidad){
  const d = denominations[idx]; cantidad = Math.max(0, Math.min(parseInt(cantidad) || 0, hucha[idx] || 0));
  if(cantidad <= 0 || !d) return 0;
  hucha[idx] -= cantidad; stock[idx] += cantidad;
  saveStock(); saveHucha();
  try { renderStockList(); } catch(e){} try { updateCashSummary(); } catch(e){}
  return cantidad;
}

function abrirModalMoverHucha(idx, sugerido){
  if(idx < 0 || idx >= denominations.length) return;
  const d = denominations[idx]; if(!d) return;
  const max = stock[idx] || 0; if(max <= 0){ mostrarToast("⚠️ No tienes piezas de " + d.n); return; }
  const inicial = Math.max(1, Math.min(parseInt(sugerido) || max, max));
  const prev = document.getElementById("modalMoverHucha"); if(prev) prev.remove();
  const m = document.createElement("div");
  m.id = "modalMoverHucha";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  const render = (n) => {
    const total = n * d.c;
    m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:360px;width:100%;border:1px solid #7c3aed"><div style="font-size:16px;font-weight:900;color:#c4b5fd;text-align:center;margin-bottom:4px">🐷 Mover a la Hucha</div><div style="font-size:13px;color:#94a3b8;text-align:center;margin-bottom:16px">${d.n} · tienes ${max} en el coche</div><div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:14px"><button type="button" data-act="-" style="width:48px;height:48px;border-radius:12px;border:none;background:#334155;color:#fff;font-size:24px;font-weight:900;cursor:pointer">−</button><div style="min-width:80px;text-align:center;font-size:36px;font-weight:900;color:#4ade80;line-height:1">${n}</div><button type="button" data-act="+" style="width:48px;height:48px;border-radius:12px;border:none;background:#334155;color:#fff;font-size:24px;font-weight:900;cursor:pointer">+</button></div><div style="text-align:center;font-size:15px;font-weight:800;color:#38bdf8;margin-bottom:16px">${moneyText(total)}</div><div style="display:flex;gap:8px"><button type="button" data-act="cancel" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button><button type="button" data-act="ok" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Mover</button></div></div>`;
    m.querySelectorAll("[data-act]").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation(); const a = b.dataset.act;
        if(a === "-") render(Math.max(1, n - 1)); else if(a === "+") render(Math.min(max, n + 1)); else if(a === "cancel") m.remove();
        else if(a === "ok"){ const movido = moverAHucha(idx, n); if(movido > 0){ m.remove(); mostrarToast("🐷 Movidas " + movido + " × " + d.n + " a la Hucha"); } }
      };
    });
  };
  render(inicial); document.body.appendChild(m); m.addEventListener("click", e => { if(e.target === m) m.remove(); });
}

/* ==================== CAMBIO DE BILLETES ==================== */
function abrirCambioPantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("cambioPantalla"); if(p)p.style.display="block";
  cambioState={aEntregar:{},aRecibir:{},modo:null,orden:[],ordenRecibir:[],sinDatos:false};
  if(typeof loadStock === "function") loadStock();
  renderCambioInicio();
}
function cerrarCambioPantalla(){ const p=document.getElementById("cambioPantalla"); if(p)p.style.display="none"; }

function renderRecomendacionCambio(){
  const rec = calcularIntercambiosRecomendados();
  let sobran = rec.sobran || [];
  let monedasSobran = rec.monedasSobran || [];

  // Recortar siempre al stock real
  sobran = sobran.map(x => {
    const i = denominations.findIndex(d => d.c === x.d.c);
    const sa = i >= 0 ? (stock[i] || 0) : 0;
    return { d: x.d, index: i, cantidad: Math.min(x.cantidad, sa) };
  }).filter(x => x.index >= 0 && x.cantidad > 0);

  monedasSobran = monedasSobran.map(x => {
    const i = denominations.findIndex(d => d.c === x.d.c);
    const sa = i >= 0 ? (stock[i] || 0) : 0;
    return { d: x.d, index: i, cantidad: Math.min(x.cantidad, sa) };
  }).filter(x => x.index >= 0 && x.cantidad > 0);

  const totalSobra = sobran.reduce((s, x) => s + x.cantidad * x.d.c, 0);
  const totalMonedasSobra = monedasSobran.reduce((s, x) => s + x.cantidad * x.d.c, 0);

  if(!sobran.length && !monedasSobran.length) return "";

  let html = "";

  if(sobran.length){
    let restante = totalSobra;
    const pedir = {};
    const cands = denominations.slice().sort((a, b) => b.c - a.c);

    cands.forEach(d => {
      if (restante < d.c) return;
      const tope = topesRecibir[d.c] || 0;
      if(tope === 0) return;
      const i = denominations.findIndex(x => x.c === d.c);
      const sa = i >= 0 ? (stock[i] || 0) : 0;
      const espacio = Math.max(0, tope - sa);
      if(espacio <= 0) return;
      const n = Math.floor(restante / d.c);
      let limite = Math.min(n, espacio);
      if(d.c < 10 && restante > 50) limite = Math.min(limite, 4);
      if (limite > 0) {
        pedir[d.c] = (pedir[d.c] || 0) + limite;
        restante -= limite * d.c;
      }
    });

    const entregar = {};
    sobran.forEach(x => { entregar[x.d.c] = (entregar[x.d.c] || 0) + x.cantidad; });

    Object.keys(pedir).forEach(cStr => {
      const c = parseInt(cStr);
      if (entregar[c]) {
        const restar = Math.min(entregar[c], pedir[c]);
        entregar[c] -= restar;
        pedir[c] -= restar;
        if (entregar[c] <= 0) delete entregar[c];
        if (pedir[c] <= 0) delete pedir[c];
      }
    });

    let tE = 0, tR = 0;
    Object.keys(entregar).forEach(c => tE += parseInt(c) * entregar[c]);
    Object.keys(pedir).forEach(c => tR += parseInt(c) * pedir[c]);

    let guard = 0;
    while (tR > tE && guard++ < 200) {
      const keys = Object.keys(pedir).map(k => parseInt(k)).filter(c => pedir[c] > 0).sort((a, b) => a - b);
      let ok = false;
      for (const c of keys) {
        if (pedir[c] > 0 && tR - c >= tE) {
          pedir[c]--;
          if (pedir[c] <= 0) delete pedir[c];
          tR -= c;
          ok = true;
          break;
        }
      }
      if (!ok) break;
    }
    guard = 0;
    while (tE > tR && guard++ < 200) {
      const keys = Object.keys(entregar).map(k => parseInt(k)).filter(c => entregar[c] > 0).sort((a, b) => a - b);
      let ok = false;
      for (const c of keys) {
        if (entregar[c] > 0 && tE - c >= tR) {
          entregar[c]--;
          if (entregar[c] <= 0) delete entregar[c];
          tE -= c;
          ok = true;
          break;
        }
      }
      if (!ok) break;
    }

    __recomendacionCambio = { entregar, pedir };

    const entregarKeys = Object.keys(entregar).map(k => parseInt(k)).filter(c => entregar[c] > 0).sort((a, b) => b - a);
    const pedirKeys = Object.keys(pedir).map(k => parseInt(k)).filter(c => pedir[c] > 0).sort((a, b) => b - a);

    html += `<div class="card" style="margin:0 0 12px 0;background:#1e293b;border:2px solid #3b82f6">`;
    html += `<div style="font-size:12px;color:#93c5fd;font-weight:900;letter-spacing:1px;margin-bottom:8px">💵 BILLETES · CAMBIO EN BANCO</div>`;
    html += `<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;line-height:1.4">Tienes <b style="color:#93c5fd">${moneyText(totalSobra)}</b> en billetes que acumulas. Cámbialos en el banco por piezas más útiles.</div>`;

    if(entregarKeys.length){
      html += `<div style="font-size:11px;color:#f87171;font-weight:800;margin-bottom:4px">📤 ENTREGAS AL BANCO</div>`;
      entregarKeys.forEach(c => {
        const d = denominations.find(x => x.c === c);
        if(d) html += `<div style="display:flex;justify-content:space-between;font-size:13px;color:#fff;padding:2px 0"><span>${entregar[c]} × ${d.n}</span><span style="color:#f87171;font-weight:700">${moneyText(entregar[c] * c)}</span></div>`;
      });
    }
    if(pedirKeys.length){
      html += `<div style="font-size:11px;color:#4ade80;font-weight:800;margin:8px 0 4px">📥 PIDES AL BANCO</div>`;
      pedirKeys.forEach(c => {
        const d = denominations.find(x => x.c === c);
        if(d) html += `<div style="display:flex;justify-content:space-between;font-size:13px;color:#fff;padding:2px 0"><span>${pedir[c]} × ${d.n}</span><span style="color:#4ade80;font-weight:700">${moneyText(pedir[c] * c)}</span></div>`;
      });
    }
    if(tE > 0 && tR > 0 && tE === tR){
      html += `<button type="button" onclick="aplicarRecomendacionCambio(${tE})" style="width:100%;margin-top:10px;background:#1e40af;color:#fff;border:1px solid #3b82f6;border-radius:10px;padding:10px;font-weight:800;font-size:13px;cursor:pointer">✅ USAR ESTA RECOMENDACIÓN</button>`;
    }
    html += `</div>`;
  }

  if(monedasSobran.length){
    html += `<div class="card" style="margin:0 0 12px 0;background:#2e1065;border:2px solid #7c3aed">`;
    html += `<div style="font-size:12px;color:#c4b5fd;font-weight:900;letter-spacing:1px;margin-bottom:8px">🐷 MONEDAS · MOVER A HUCHA</div>`;
    html += `<div style="font-size:11px;color:#e9d5ff;margin-bottom:10px;line-height:1.4">Las monedas <b>no se pueden llevar al banco</b>. Llévalas a casa y apúntalas en la Hucha. Total: <b style="color:#c4b5fd">${moneyText(totalMonedasSobra)}</b></div>`;
    monedasSobran.forEach(x => {
      html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #3b0764"><span style="font-size:13px;color:#fff;font-weight:700">${x.cantidad} × ${x.d.n}</span><button type="button" onclick="abrirModalMoverHucha(${x.index}, ${x.cantidad})" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;font-size:12px;cursor:pointer">🐷 Mover</button></div>`;
    });
    html += `<button type="button" onclick="moverTodasMonedasAHucha()" style="width:100%;margin-top:10px;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:800;font-size:13px;cursor:pointer">🐷 Mover TODAS a la Hucha</button></div>`;
  }

  return html;
}

function moverTodasMonedasAHucha(){
  const { monedasSobran } = calcularIntercambiosRecomendados(); if(!monedasSobran.length) return;
  if(!confirm(`¿Mover ${monedasSobran.length} denominación(es) de monedas sobrantes a la Hucha?`)) return;
  let movidas = 0; monedasSobran.forEach(x => { movidas += moverAHucha(x.index, x.cantidad); });
  mostrarToast("🐷 Movidas " + movidas + " piezas a la Hucha"); if(typeof renderCambioInicio === "function") renderCambioInicio();
}

function aplicarRecomendacionCambio(total){
  const { entregar, pedir } = __recomendacionCambio;
  cambioState.aEntregar = {}; cambioState.aRecibir = {}; cambioState.orden = []; cambioState.ordenRecibir = [];
  Object.keys(entregar).forEach(k => { const c = parseInt(k); cambioState.aEntregar[c] = entregar[k]; for(let i = 0; i < entregar[k]; i++) cambioState.orden.push(c); });
  Object.keys(pedir).forEach(k => { const c = parseInt(k); cambioState.aRecibir[c] = pedir[k]; for(let i = 0; i < pedir[k]; i++) cambioState.ordenRecibir.push(c); });
  let tE = 0, tR = 0; Object.keys(cambioState.aEntregar).forEach(c => tE += parseInt(c) * cambioState.aEntregar[c]); Object.keys(cambioState.aRecibir).forEach(c => tR += parseInt(c) * cambioState.aRecibir[c]);
  if(tE !== tR){ alert("⚠️ Los totales no cuadran (" + moneyText(tE) + " vs " + moneyText(tR) + ").\nAjusta a mano."); return; }
  renderCambioResultado(total);
}

function renderCambioInicio(){
  const cont=document.getElementById("cambioContenido"); if(!cont)return;
  let html = renderRecomendacionCambio();
  html += "<div class='card' style='margin:0 0 12px 0'>";
  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>¿QUÉ VAS A CAMBIAR?</div>";
  html+="<div style='font-size:12px;color:#64748b;margin-bottom:10px'>Pulsa las piezas que entregarás. Debajo verás cuántas tienes.</div>";
  html+="<div style='font-size:11px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>💵 BILLETES</div>";
  html+="<div id='cambioBotonesBilletes' style='display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px'></div>";
  html+="<div style='font-size:11px;color:#facc15;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🪙 MONEDAS</div>";
  html+="<div id='cambioBotonesMonedas' style='display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px'></div>";
  html+="<div style='display:flex;justify-content:space-between;align-items:center;padding:10px;background:#1e293b;border-radius:8px;margin-bottom:12px'><span style='font-size:13px;color:#94a3b8;font-weight:700'>Total a cambiar:</span><span id='cambioTotal' style='font-size:18px;font-weight:900;color:#38bdf8'>0,00 €</span></div>";
  html+="<button type='button' onclick='calcularCambio()' style='width:100%;background:#1e40af;color:#fff;border:1px solid #3b82f6;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>🔀 Continuar</button>";
  html+="<div style='display:flex;gap:8px;margin-bottom:8px'><button type='button' onclick='deshacerCambioEntregar()' style='flex:1;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>↩ Deshacer</button><button type='button' onclick='resetCambioEntregar()' style='flex:1;background:#7f1d1d;color:#fff;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>🗑️ Limpiar</button></div>";
  html+="<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button></div>";
  html+="<div id='cambioHistorial'></div>";
  cont.innerHTML=html;
  renderCambioBotones('cambioBotonesBilletes', [10000,5000,2000,1000,500]);
  renderCambioBotones('cambioBotonesMonedas', [200,100,50,20,10,5,2,1]);
  actualizarCambioInicio(); renderCambioHistorial();
}

function renderCambioBotones(containerId, valores){
  const bot = document.getElementById(containerId);
  if(!bot) return;
  bot.innerHTML = "";

  valores.forEach(c => {
    const idx = denominations.findIndex(x => x.c === c);
    if(idx < 0) return;

    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative";

    const b = document.createElement("button");
    b.type = "button";
    b.id = "cambioBtn" + c;
    b.onclick = () => {
      const i = denominations.findIndex(x => x.c === c);
      const sa = stock[i] || 0;
      const sel = cambioState.aEntregar[c] || 0;
      if(sel >= sa){
        mostrarToast("⚠️ No tienes más piezas de " + denominations[i].n);
        return;
      }
      cambioState.aEntregar[c] = sel + 1;
      cambioState.orden.push(c);
      actualizarCambioInicio();
    };

    const bd = document.createElement("div");
    bd.id = "cambioBadge" + c;
    bd.style.cssText = "position:absolute;top:-6px;right:-6px;background:#38bdf8;color:#0f172a;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px;display:none";

    wrap.appendChild(b);
    wrap.appendChild(bd);
    bot.appendChild(wrap);

    actualizarBotonCambio(c);
  });
}

function actualizarBotonCambio(c){
  const b = document.getElementById("cambioBtn" + c);
  if(!b) return;

  const i = denominations.findIndex(x => x.c === c);
  if(i < 0) return;

  const d = denominations[i];
  const sa = stock[i] || 0;
  const sel = cambioState.aEntregar[c] || 0;
  const rest = Math.max(0, sa - sel);

  b.innerHTML =
    "<div style='font-size:14px;font-weight:800'>" + (c / 100) + " €</div>" +
    "<div style='font-size:10px;color:#94a3b8;font-weight:600;margin-top:2px'>" +
      "tienes " + sa + (sel > 0 ? " · quedan " + rest : "") +
    "</div>";

  b.style.cssText =
    "width:100%;background:#283548;border:1px solid #475569;color:#fff;" +
    "padding:10px 4px;border-radius:10px;" +
    "cursor:" + (rest <= 0 ? "not-allowed" : "pointer") + ";" +
    "opacity:" + (rest <= 0 ? "0.45" : "1");

  b.disabled = rest <= 0;
}

function actualizarCambioInicio(){
  let tot=0;
  denominations.forEach(d=>{
    const n=cambioState.aEntregar[d.c]||0; tot+=d.c*n;
    const bd=document.getElementById("cambioBadge"+d.c);
    if(bd){ if(n>0){bd.textContent="x"+n;bd.style.display="block"} else bd.style.display="none"; }
  });
  const el=document.getElementById("cambioTotal"); if(el)el.textContent=moneyText(tot);
  denominations.forEach(d => actualizarBotonCambio(d.c));
}

function deshacerCambioEntregar(){if(!cambioState.orden)cambioState.orden=[];const last=cambioState.orden.pop();if(last==null)return;if(cambioState.aEntregar[last]>0){cambioState.aEntregar[last]--;if(cambioState.aEntregar[last]<=0)delete cambioState.aEntregar[last]}actualizarCambioInicio()}
function resetCambioEntregar(){cambioState.aEntregar={};cambioState.orden=[];actualizarCambioInicio()}

function calcularCambio(){
  let tot=0; Object.keys(cambioState.aEntregar).forEach(c=>{tot+=parseInt(c)*cambioState.aEntregar[c]});
  if(tot<=0){alert("Selecciona alguna pieza.");return}
  let err=false; Object.keys(cambioState.aEntregar).forEach(k=>{ const c=parseInt(k), i=denominations.findIndex(d=>d.c===c); if(i>=0 && stock[i] < cambioState.aEntregar[c]) err=true; });
  if(err){alert("No tienes tantas piezas de ese tipo.");return}

  const piezasEntregadas = Object.keys(cambioState.aEntregar).map(k=>parseInt(k)).filter(c=>cambioState.aEntregar[c]>0);
  const soloMonedas = piezasEntregadas.every(c => c <= 200);
  const minE = piezasEntregadas.length ? Math.min(...piezasEntregadas) : 99999;

  if(statsOps.operations<10){ cambioState.modo="manual"; cambioState.sinDatos=true; cambioState.aRecibir={}; cambioState.ordenRecibir=[]; renderCambioManual(tot, minE, soloMonedas); return; }
  cambioState.modo="auto"; cambioState.sinDatos=false;
  cambioState.aRecibir=calcularCambioAutomatico(tot, soloMonedas, minE);
  renderCambioResultado(tot);
}

function renderCambioManual(total,minEnt,soloMonedas){
  const cont=document.getElementById("cambioContenido"); if(!cont)return;
  const minE=minEnt!=null?minEnt:Math.min(...Object.keys(cambioState.aEntregar).map(x=>parseInt(x)));
  const piezasEntregadas = Object.keys(cambioState.aEntregar).map(k=>parseInt(k)).filter(c=>cambioState.aEntregar[c]>0);
  if(typeof soloMonedas !== "boolean"){ soloMonedas = piezasEntregadas.length > 0 && piezasEntregadas.every(c => c <= 200); }
  const opc = soloMonedas ? denominations.slice() : denominations.filter(d => d.c < minE);

  let html="";
  if(cambioState.sinDatos){ html+="<div class='card' style='margin:0 0 12px 0;background:#1e3a8a;border:1px solid #3b82f6'><div style='font-size:13px;color:#bfdbfe;font-weight:800;margin-bottom:6px'>🧠 Aún no tengo datos suficientes</div><div style='font-size:12px;color:#93c5fd;line-height:1.5'>Necesito al menos <b>10 operaciones</b> para sugerirte. De momento elige a mano.<br><br>Llevas <b>"+statsOps.operations+"</b> operaciones.</div></div>"; }
  html+="<div class='card' style='margin:0 0 12px 0'>";
  html+="<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>✍️ ELIGE A MANO</div>";
  html+="<div style='font-size:12px;color:#64748b;margin-bottom:10px'>Marca las piezas que quieres recibir. La suma debe ser "+moneyText(total)+".</div>";
  if(soloMonedas){ html+="<div style='font-size:11px;color:#fbbf24;font-weight:700;margin-bottom:10px;padding:6px 10px;background:#78350f;border-radius:8px'>💡 Entregas monedas: puedes pedir cualquier pieza, incluso un billete más grande.</div>"; }
  html+="<div id='cambioManBotones' style='display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px'></div></div>";
  html+="<div class='card' style='margin:0 0 12px 0'><div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px'><span style='font-size:13px;color:#94a3b8'>Suma actual:</span><span id='cambioManSuma' style='font-size:18px;font-weight:900;color:#38bdf8'>0,00 €</span></div><div style='display:flex;justify-content:space-between;align-items:center'><span style='font-size:13px;color:#94a3b8'>Objetivo:</span><span style='font-size:18px;font-weight:900;color:#4ade80'>"+moneyText(total)+"</span></div><div id='cambioManEstado' style='text-align:center;font-size:13px;font-weight:700;margin-top:10px'></div></div>";
  html+="<button type='button' onclick='confirmarCambio("+total+")' id='cambioManBtn' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✅ Confirmar cambio</button>";
  html+="<div style='display:flex;gap:8px;margin-bottom:8px'><button type='button' onclick='deshacerCambioRecibir("+total+")' style='flex:1;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>↩ Deshacer</button><button type='button' onclick='resetCambioManual("+total+")' style='flex:1;background:#7f1d1d;color:#fff;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>🗑️ Limpiar</button></div>";
  html+="<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";
  cont.innerHTML=html;
  const bot=document.getElementById("cambioManBotones");
  opc.forEach(d=>{
    const idx=denominations.findIndex(x=>x.c===d.c), sa=stock[idx]||0;
    const wrap=document.createElement("div"); wrap.style.cssText="position:relative";
    const b=document.createElement("button"); b.type="button";
    b.innerHTML="<div style='font-size:13px;font-weight:800'>"+d.n+"</div><div style='font-size:10px;color:#94a3b8;font-weight:600;margin-top:2px'>tienes "+sa+"</div>";
    b.style.cssText="width:100%;background:#283548;border:1px solid #475569;color:#fff;padding:8px 4px;border-radius:10px;cursor:pointer";
    b.onclick=()=>{ cambioState.aRecibir[d.c]=(cambioState.aRecibir[d.c]||0)+1; if(!cambioState.ordenRecibir)cambioState.ordenRecibir=[]; cambioState.ordenRecibir.push(d.c); actualizarCambioManual(total); };
    const bd=document.createElement("div"); bd.id="cambioManBadge"+d.c;
    bd.style.cssText="position:absolute;top:-6px;right:-6px;background:#38bdf8;color:#0f172a;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px;display:none";
    wrap.appendChild(b); wrap.appendChild(bd); bot.appendChild(wrap);
  });
  actualizarCambioManual(total);
}
function resetCambioManual(total){cambioState.aRecibir={};cambioState.ordenRecibir=[];renderCambioManual(total)}
function deshacerCambioRecibir(total){if(!cambioState.ordenRecibir)cambioState.ordenRecibir=[];const last=cambioState.ordenRecibir.pop();if(last==null)return;if(cambioState.aRecibir[last]>0){cambioState.aRecibir[last]--;if(cambioState.aRecibir[last]<=0)delete cambioState.aRecibir[last]}actualizarCambioManual(total)}
function actualizarCambioManual(total){let s=0;denominations.forEach(d=>{const n=cambioState.aRecibir[d.c]||0;s+=d.c*n;const bd=document.getElementById("cambioManBadge"+d.c);if(bd){if(n>0){bd.textContent="x"+n;bd.style.display="block"}else bd.style.display="none"}});const el=document.getElementById("cambioManSuma");if(el)el.textContent=moneyText(s);const est=document.getElementById("cambioManEstado");const btn=document.getElementById("cambioManBtn");if(est&&btn){if(s===total){est.innerHTML="<span style='color:#4ade80'>✅ Cuadra perfectamente</span>";btn.style.opacity="1";btn.style.pointerEvents="auto"}else if(s<total){est.innerHTML="<span style='color:#fbbf24'>⚠️ Te faltan "+moneyText(total-s)+"</span>";btn.style.opacity="0.5";btn.style.pointerEvents="none"}else{est.innerHTML="<span style='color:#ef4444'>⚠️ Te pasas por "+moneyText(s-total)+"</span>";btn.style.opacity="0.5";btn.style.pointerEvents="none"}}}

function confirmarCambio(total){
  let s = 0; denominations.forEach(d => { s += d.c * (cambioState.aRecibir[d.c] || 0); });
  if(s !== total){ alert("La suma no cuadra."); return; }
  if(!confirm("¿Confirmar el cambio?")) return;
  try {
    Object.keys(cambioState.aEntregar).forEach(k => {
      const c = parseInt(k), n = cambioState.aEntregar[c], i = denominations.findIndex(d => d.c === c);
      if(i >= 0 && n > 0){ stock[i] = Math.max(0, stock[i] - n); statsOps.cambioNeto[i] -= n; }
    });
    denominations.forEach(d => {
      const n = cambioState.aRecibir[d.c] || 0;
      if(n > 0){ const i = denominations.findIndex(x => x.c === d.c); if(i >= 0){ stock[i] = Math.max(0, stock[i] + n); statsOps.cambioNeto[i] += n; } }
    });
    saveStats();
    const cm = loadCambios();
    cm.push({ fecha: new Date().toISOString(), aEntregar: Object.assign({}, cambioState.aEntregar), aRecibir: Object.assign({}, cambioState.aRecibir), total });
    saveCambios(cm); saveStock(); renderStockList(); updateCashSummary();
    alert("✅ Cambio confirmado."); cerrarCambioPantalla();
  } catch(e){ console.error("Error confirmando cambio:", e); alert("❌ Error al confirmar. Revisa el inventario."); }
}

function calcularCambioAutomatico(total, juntar, minE){
  const entregando = {}; Object.keys(cambioState.aEntregar).forEach(k=>{ if(cambioState.aEntregar[k]>0) entregando[parseInt(k)] = true; });
  const stockTotal = stock.map((n, i) => n + (hucha[i] || 0));
  let cand;
  if(juntar){ cand = denominations.filter(d => !entregando[d.c]).sort((a,b)=>b.c-a.c); }
  else { cand = denominations.filter(d => d.c < minE).sort((a,b)=>b.c-a.c); }

  if(juntar){
    for(const d of cand){
      if(d.c === total){
        const i = denominations.findIndex(x=>x.c===d.c), sa = stockTotal[i] || 0, tope = topesRecibir[d.c] || 0;
        const espacio = tope > 0 ? Math.max(0, tope - sa) : sa;
        if(espacio >= 1) return { [d.c]: 1 };
      }
    }
  }

  let r = total; const prop = {};
  cand.forEach(d=>{
    if(r <= 0) return;
    const i = denominations.findIndex(x=>x.c===d.c), sa = stockTotal[i] || 0, tope = topesRecibir[d.c] || 0;
    const espacio = tope > 0 ? Math.max(0, tope - sa) : sa;
    let t;
    if(juntar){ t = espacio; }
    else {
      let tt = (tope > 0) ? tope : 5;
      if(sa>=30) tt=0; else if(sa>=20) tt=Math.min(tt,1); else if(sa>=10) tt=Math.min(tt,2); else if(sa<=3) tt=Math.min(tt+3,12); else if(sa<=6) tt=Math.min(tt+1,10);
      t = Math.min(tt, espacio);
    }
    if(t <= 0) return;
    const c = Math.min(Math.floor(r/d.c), t);
    if(c > 0){ prop[d.c] = (prop[d.c]||0) + c; r -= c*d.c; }
  });

  if(r > 0 && !juntar){
    const desc = cand.slice();
    for(const d of desc){
      if(r <= 0) break;
      const i = denominations.findIndex(x=>x.c===d.c), sa = stockTotal[i] || 0, tope = topesRecibir[d.c] || 0;
      const espacio = tope > 0 ? Math.max(0, tope - sa) : sa;
      if(espacio <= 0) continue;
      const c = Math.min(Math.floor(r/d.c), espacio);
      if(c > 0){ prop[d.c] = (prop[d.c]||0) + c; r -= c*d.c; }
    }
  }
  return prop;
}

function renderCambioResultado(total){
  const cont=document.getElementById("cambioContenido"); if(!cont)return;
  const ord = Object.keys(cambioState.aRecibir).map(k=>parseInt(k)).filter(c=>cambioState.aRecibir[c]>0).sort((a,b)=>b-a);

  if(ord.length === 0){
    const esJuntar = (total <= 200) || Object.keys(cambioState.aEntregar).every(k=>parseInt(k)<=200);
    let msg = esJuntar ? "🤔 No hay ninguna pieza mayor que <b>"+moneyText(total)+"</b> que puedas pedir.<br><br><span style='color:#94a3b8;font-size:13px'>Puedes juntar más monedas para conseguir un billete o una pieza más grande.</span>" : "🤔 No hay piezas disponibles para dar cambio de <b>"+moneyText(total)+"</b>.<br><br><span style='color:#94a3b8;font-size:13px'>Revisa el inventario o repón caja.</span>";
    let html = "<div class='card' style='margin:0 0 12px 0;text-align:center'><div style='font-size:44px;margin-bottom:10px'>🤔</div><div style='font-size:14px;color:#fbbf24;line-height:1.6;font-weight:700'>"+msg+"</div></div><button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer'>✖ Cerrar</button>";
    cont.innerHTML = html; return;
  }

  let html="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:12px'>🤖 PROPUESTA BASADA EN TUS HÁBITOS</div><div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ENTREGAS AL BANCO</div><div class='change-grid'>";
  Object.keys(cambioState.aEntregar).forEach(k=>{
    const c=parseInt(k), n=cambioState.aEntregar[c];
    if(n>0){ const d=denominations.find(x=>x.c===c); if(d){ const cl = d.type==="bill" ? "bill-graphic " : "coin-graphic "; html+="<div class='cash-item'><div class='badge'>x"+n+"</div><div class='"+cl+d.class+"'>"+d.short+"</div></div>"; } }
  });
  html+="</div><div style='font-size:12px;color:#38bdf8;font-weight:800;letter-spacing:0.5px;margin:16px 0 8px;padding-top:14px;border-top:1px solid #334155'>PIDE QUE TE DEVUELVAN</div><div class='change-grid'>";
  ord.forEach(c=>{ const n=cambioState.aRecibir[c], d=denominations.find(x=>x.c===c); if(d){ const cl=d.type==="bill"?"bill-graphic ":"coin-graphic "; html+="<div class='cash-item'><div class='badge'>x"+n+"</div><div class='"+cl+d.class+"'>"+d.short+"</div></div>"; } });
  html+="</div><div style='display:flex;justify-content:space-between;padding:14px 0 0;margin-top:14px;border-top:1px solid #334155;font-size:16px;color:#fff'><span style='font-weight:800'>Total:</span><span style='font-weight:900;color:#4ade80'>"+moneyText(total)+"</span></div></div>";
  html+="<button type='button' onclick='confirmarCambio("+total+")' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✅ Confirmar cambio</button>";
  html+="<button type='button' onclick='pasarAModoManual("+total+")' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✍️ Ajustar a mano</button>";
  html+="<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#1e293b;color:#94a3b8;border:1px solid #475569;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";
  cont.innerHTML=html;
}
function pasarAModoManual(total){cambioState.modo="manual";cambioState.sinDatos=false;cambioState.aRecibir={};cambioState.ordenRecibir=[];renderCambioManual(total)}

function renderCambioHistorial(){
  const box=document.getElementById("cambioHistorial"); if(!box)return;
  const cm=loadCambios(); if(!cm.length){box.innerHTML="";return}
  let html="<div class='card' style='margin:0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>📜 HISTORIAL DE CAMBIOS</div>";
  cm.slice(-15).reverse().forEach(c=>{
    const d=new Date(c.fecha), f=d.toLocaleDateString("es-ES")+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    const ent=Object.keys(c.aEntregar).map(k=>{const ce=parseInt(k),n=c.aEntregar[k],p=denominations.find(x=>x.c===ce);return n+"×"+(p?p.short:(ce/100)+"€")}).join(" + ");
    const rec=Object.keys(c.aRecibir).map(k=>{const ce=parseInt(k),n=c.aRecibir[k],p=denominations.find(x=>x.c===ce);return n+"×"+(p?p.short:(ce/100)+"€")}).join(" + ");
    html+="<div style='padding:10px 0;border-bottom:1px solid #334155'><div style='font-size:12px;color:#94a3b8;margin-bottom:4px'>📝 "+f+"</div><div style='font-size:13px;color:#fff'><b>Cambio de "+moneyText(c.total)+"</b></div><div style='font-size:12px;color:#4ade80;margin-top:2px'>→ "+ent+"</div><div style='font-size:12px;color:#38bdf8;margin-top:2px'>← "+rec+"</div></div>";
  });
  box.innerHTML=html;
}

/* ==================== REPONER CAJA ==================== */
function abrirReponerPantalla(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("reponerPantalla");if(p)p.style.display="block";reponerState.manualInicializado=false;reponerState.manualAdd={};reponerState.importeManual=0;renderReponerInicio()}
function cerrarReponerPantalla(){const p=document.getElementById("reponerPantalla");if(p)p.style.display="none"}
function abrirReponerDesdeDeposito(){cerrarCierrePantalla();abrirReponerPantalla()}

function renderReponerInicio(){
  const cont=document.getElementById("reponerContenido"); if(!cont)return;
  let html=""; const modoAuto=reponerState.modo!=="manual";
  html+="<div style='display:flex;gap:6px;margin-bottom:12px'><button type='button' onclick='cambiarModoReponer(\"auto\")' style='flex:1;padding:10px;border-radius:10px;border:1px solid "+(modoAuto?"#3b82f6":"#475569")+";background:"+(modoAuto?"#1e40af":"#1e293b")+";color:"+(modoAuto?"#fff":"#94a3b8")+";font-weight:700;cursor:pointer;font-size:13px'>🤖 Automático</button><button type='button' onclick='cambiarModoReponer(\"manual\")' style='flex:1;padding:10px;border-radius:10px;border:1px solid "+(!modoAuto?"#3b82f6":"#475569")+";background:"+(!modoAuto?"#1e40af":"#1e293b")+";color:"+(!modoAuto?"#fff":"#94a3b8")+";font-weight:700;cursor:pointer;font-size:13px'>✍️ Manual</button></div>";
  
  if(modoAuto){
    const rec=configuracionRecomendada();
    html+="<div class='card' style='margin:0 0 12px 0;background:#1e3a8a;border:1px solid #3b82f6'><div style='font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🧠 RECOMENDACIÓN DEL SISTEMA</div>";
    if(statsOps.operations>=5) html+="<div style='font-size:13px;color:#93c5fd;line-height:1.5'>Basado en tus <b>"+statsOps.operations+" operaciones</b>, cubre <b>"+rec.viajes+" viajes</b> con colchón de <b>"+rec.colchon+"</b> piezas.<br><br>El objetivo nunca supera el <b>"+Math.round(FACTOR_LLENADO*100)+"% del tope</b>, para dejar hueco al cambio que entra.</div>";
    else html+="<div style='font-size:13px;color:#93c5fd;line-height:1.5'>🧠 Aún sin datos suficientes. Caja de arranque: cubrir <b>"+rec.viajes+" viajes</b> con colchón de <b>"+rec.colchon+"</b>.<br><br>El objetivo nunca supera el <b>"+Math.round(FACTOR_LLENADO*100)+"% del tope</b>, para dejar hueco al cambio que entra.<br><br>A partir de 5 operaciones se ajusta solo.</div>";
    html+="</div><div id='reponerDinamico'></div><button type='button' onclick='confirmarReponer()' id='reponerBtnConfirmar' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:16px;cursor:pointer;margin-bottom:8px;margin-top:8px'>✅ AÑADIR A LA CAJA</button><button type='button' onclick='cerrarReponerPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";
    cont.innerHTML=html; actualizarReponerPropuesta();
  } else {
    html+="<div class='card' style='margin:0 0 12px 0'><label style='font-size:13px;color:#94a3b8;font-weight:800;display:block;text-align:center'>💰 ¿CUÁNTO QUIERES SACAR DEL BANCO?</label><input type='number' id='reponerImporteManual' min='0' step='0.01' inputmode='decimal' value='"+(reponerState.importeManual>0?(reponerState.importeManual/100).toFixed(2):"")+"' oninput='onCambioImporteManual()' placeholder='Ej. 130.00' style='width:100%;font-size:32px;font-weight:900;padding:14px;border-radius:12px;border:1px solid #3b82f6;background:#0f172a;color:#38bdf8;text-align:center;margin-top:8px;outline:none'><div style='font-size:11px;color:#64748b;margin-top:8px;line-height:1.4;text-align:center'>Escribe el importe y la app reparte las piezas variadas. Ajusta con + / −.</div></div><div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>✍️ AJUSTA LAS PIEZAS</div><div id='reponerManualLista'></div></div><div class='card' style='margin:0 0 12px 0;text-align:center;background:"+(reponerState.importeManual>0?"#1e3a8a":"#0f172a")+";border:1px solid "+(reponerState.importeManual>0?"#3b82f6":"#334155")+"'><div style='font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🏦 SACA DEL BANCO</div><div id='reponerManualTotal' style='font-size:38px;font-weight:900;color:#fff'>0,00 €</div><div id='reponerManualEstado' style='font-size:12px;color:#bfdbfe;margin-top:6px'></div></div><button type='button' onclick='confirmarReponer()' id='reponerBtnConfirmar' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:16px;cursor:pointer;margin-bottom:8px'>✅ AÑADIR A LA CAJA</button><button type='button' onclick='resetManualReponer()' style='width:100%;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px'>🗑️ Limpiar todo</button><button type='button' onclick='cerrarReponerPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";
    cont.innerHTML=html; if(Object.keys(reponerState.manualAdd).length===0)denominations.forEach(d=>{reponerState.manualAdd[d.c]=0}); actualizarReponerManual();
  }
}

function cambiarModoReponer(modo){reponerState.modo=modo;if(modo==="manual"){if(Object.keys(reponerState.manualAdd).length===0)denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});if(reponerState.importeManual>0)setTimeout(()=>onCambioImporteManual(),0)}renderReponerInicio()}

function actualizarReponerPropuesta(){
  const zona = document.getElementById("reponerDinamico");
  const btn = document.getElementById("reponerBtnConfirmar");
  if(!zona) return;
  
  // 👇 FORZAMOS que los cálculos usen el stock actualizado
  const rec = configuracionRecomendada();
  const { faltantes, total, totalDeHucha, totalDeBanco } = calcularFaltantes(rec.viajes, rec.colchon);
  const { sobran, totalSobra } = calcularIntercambiosRecomendados();

  let html = "";

  if(!faltantes.length){
    html += `<div class='card' style='margin:0 0 12px 0;text-align:center'><div style='font-size:48px;margin-bottom:12px'>✅</div><div style='font-size:16px;color:#4ade80;font-weight:800;margin-bottom:8px'>Caja suficiente</div><div style='font-size:13px;color:#94a3b8;line-height:1.6'>Con tu gasto actual tienes cambio suficiente. No necesitas ir al banco.</div></div>`;
    if(btn) btn.style.display = "none";
  } else {
    if(btn) btn.style.display = "block";
    
    const conHucha = faltantes.filter(x => x.deHucha > 0).sort((a,b) => b.d.c - a.d.c);
    if(conHucha.length){
      html += `<div class='card' style='margin:0 0 12px 0;text-align:center;background:#2e1065;border:1px solid #7c3aed'><div style='font-size:12px;color:#c4b5fd;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🐷 TIENES EN CASA</div><div style='font-size:26px;font-weight:900;color:#fff'>${moneyText(totalDeHucha)}</div><div style='font-size:12px;color:#c4b5fd;margin-top:4px'>Te cubre parte de lo que falta</div><button type="button" onclick="sacarTodaLaHuchaReponer()" style="width:100%;margin-top:10px;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:14px;cursor:pointer">🐷 SACAR DE LA HUCHA A LA CAJA</button></div>`;
    }
    
    html += `<div class='card' style='margin:0 0 12px 0;text-align:center;background:#1e3a8a;border:1px solid #3b82f6'><div style='font-size:12px;color:#bfdbfe;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>🏦 PEDIR AL BANCO</div><div id='reponerTotal' style='font-size:38px;font-weight:900;color:#fff'>${moneyText(totalDeBanco)}</div><div style='font-size:12px;color:#bfdbfe;margin-top:6px'>Pulsa cada pieza para marcarla/desmarcarla</div></div>`;
    
    html += `<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>📋 DESGLOSE</div>`;
    
    if(conHucha.length){
      html += `<div style='font-size:11px;color:#c4b5fd;font-weight:900;letter-spacing:0.5px;margin:0 0 6px;padding:6px 10px;background:#2e1065;border-radius:8px;display:flex;justify-content:space-between'><span>🐷 DE LA HUCHA</span><span>${moneyText(totalDeHucha)}</span></div>`;
      conHucha.forEach(x => {
        const d = x.d, gc = (d.type === "bill" ? "bill-graphic " : "coin-graphic ") + d.class;
        html += `<div style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #334155'><div class='${gc}' style='flex-shrink:0'>${d.short}</div><div style='flex:1;min-width:0'><div style='font-size:15px;font-weight:800;color:#fff'>${x.deHucha} × ${d.n}</div><div style='font-size:12px;color:#94a3b8'>${moneyText(x.deHucha * d.c)}</div></div><div style='font-size:11px;font-weight:800;color:#c4b5fd;background:#4c1d95;padding:4px 8px;border-radius:6px;white-space:nowrap'>🐷 Hucha</div></div>`;
      });
    }
    
    const rowsBanco = faltantes.filter(x => x.deBanco > 0);
    if(rowsBanco.length){
      html += `<div style='font-size:11px;color:#93c5fd;font-weight:900;letter-spacing:0.5px;margin:14px 0 6px;padding:6px 10px;background:#1e3a8a;border-radius:8px;display:flex;justify-content:space-between'><span>🏦 DEL BANCO</span><span>${moneyText(totalDeBanco)}</span></div>`;
      const b = rowsBanco.filter(x => x.d.type === "bill").sort((a,b) => b.d.c - a.d.c);
      const m = rowsBanco.filter(x => x.d.type === "coin").sort((a,b) => b.d.c - a.d.c);
      const rowF = x => { 
        const d = x.d, c = d.c; 
        const marc = reponerState.marcados[c] !== false; 
        const imp = x.deBanco * c; 
        const gc = (d.type === "bill" ? "bill-graphic " : "coin-graphic ") + d.class; 
        return `<label style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #334155;cursor:pointer'><input type='checkbox' data-c='${c}' ${marc?'checked':''} onchange='toggleMarcadoReponer(this)' style='width:22px;height:22px;cursor:pointer;flex-shrink:0'><div class='${gc}' style='flex-shrink:0'>${d.short}</div><div style='flex:1;min-width:0'><div class='reponerFila' style='font-size:15px;font-weight:800;color:${marc?'#fff':'#475569'}'>${x.deBanco} × ${d.n}</div><div style='font-size:12px;color:#94a3b8'>${moneyText(imp)}</div></div></label>`; 
      };
      if(b.length){ html += `<div style='font-size:11px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin:6px 0 4px'>💵 BILLETES</div>`; b.forEach(x => html += rowF(x)); }
      if(m.length){ html += `<div style='font-size:11px;color:#facc15;font-weight:800;letter-spacing:0.5px;margin:12px 0 4px'>🪙 MONEDAS</div>`; m.forEach(x => html += rowF(x)); }
    }
    html += `</div>`;
  }

  if(sobran.length > 0){
    html += `<div class='card' style='margin:0 0 12px 0;background:#1e293b;border:1px solid #7c3aed'><div style='font-size:12px;color:#c4b5fd;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>🔄 APROVECHA EL VIAJE AL BANCO</div><div style='font-size:12px;color:#94a3b8;margin-bottom:10px;line-height:1.4'>Tienes <b style='color:#c4b5fd'>${moneyText(totalSobra)}</b> en billetes que acumulas.</div><button type='button' onclick='cerrarReponerPantalla();abrirCambioPantalla()' style='width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:14px;cursor:pointer'>🔀 IR A CAMBIAR BILLETE</button></div>`;
  }
  
  zona.innerHTML = html;
}

function sacarTodaLaHuchaReponer(){
  const rec = configuracionRecomendada(), { faltantes } = calcularFaltantes(rec.viajes, rec.colchon);
  let movidas = 0; faltantes.forEach(x => { if(x.deHucha > 0) movidas += sacarDeHucha(x.index, x.deHucha); });
  if(movidas > 0){ mostrarToast("🐷 Movidas " + movidas + " piezas de la Hucha a la Caja"); actualizarReponerPropuesta(); }
}

function toggleMarcadoReponer(cb){
  const c = parseInt(cb.dataset.c); reponerState.marcados[c] = cb.checked;
  const rec = configuracionRecomendada(), { faltantes } = calcularFaltantes(rec.viajes, rec.colchon);
  let nt = 0; faltantes.forEach(x => { if(x.deBanco > 0 && reponerState.marcados[x.d.c] !== false) nt += x.deBanco * x.d.c; });
  const el = document.getElementById("reponerTotal"); if(el) el.textContent = moneyText(nt);
  const div = cb.parentElement.querySelector(".reponerFila"); if(div) div.style.color = cb.checked ? "#fff" : "#475569";
}

function actualizarReponerManual(){
  const cont=document.getElementById("reponerManualLista"); if(!cont)return;
  const grupos = [{ titulo: "💵 BILLETES", tipo: "bill", color: "#4ade80" }, { titulo: "🪙 MONEDAS", tipo: "coin", color: "#facc15" }];
  let html = "";
  grupos.forEach(g => {
    const items = denominations.filter(d => d.type === g.tipo); if(!items.length) return;
    html += "<div style='font-size:12px;color:"+g.color+";font-weight:900;letter-spacing:0.5px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #334155'>"+g.titulo+"</div>";
    items.forEach(d => {
      const i = denominations.findIndex(x => x.c === d.c), act = stock[i] || 0, add = reponerState.manualAdd[d.c] || 0;
      const qu = act + add, tope = topesRecibir[d.c] || 0, objetivo = Math.floor(tope * FACTOR_LLENADO);
      const gc = (d.type === "bill" ? "bill-graphic " : "coin-graphic ") + d.class, subtotal = add * d.c;
      let numColor = "#a78bfa", alerta = "";
      if(add > 0){ if(tope > 0 && qu > tope){ numColor = "#ef4444"; alerta = " ⚠"; } else if(objetivo > 0 && qu > objetivo){ numColor = "#fbbf24"; } else { numColor = "#4ade80"; } } else { numColor = "#475569"; }
      const subtotalColor = subtotal > 0 ? "#4ade80" : "#475569";
      html += "<div style='display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1e293b'><div class='"+gc+"' style='flex-shrink:0;font-size:14px'>"+d.short+"</div><div style='flex:1;min-width:0;font-size:15px;color:#fff;font-weight:800'>"+d.n+alerta+"</div><div style='display:flex;align-items:center;gap:6px;flex-shrink:0'><button type='button' onclick='ajustarManualReponer("+d.c+",-1)' style='width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:pointer'>−</button><div style='width:44px;text-align:center;font-size:22px;font-weight:900;color:"+numColor+"'>"+add+"</div><button type='button' onclick='ajustarManualReponer("+d.c+",1)' style='width:34px;height:34px;padding:0;background:#334155;color:#fff;border:none;border-radius:8px;font-size:20px;font-weight:800;cursor:pointer'>+</button></div><div style='width:76px;text-align:right;font-size:14px;font-weight:900;color:"+subtotalColor+";flex-shrink:0'>"+moneyText(subtotal)+"</div></div>";
    });
  });
  cont.innerHTML = html;
  let tot = 0; denominations.forEach(d => { tot += (reponerState.manualAdd[d.c] || 0) * d.c; });
  const elT = document.getElementById("reponerManualTotal"); if(elT) elT.textContent = moneyText(tot);
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
  const objetivo = denominations.map((d,i) => Math.floor((topesRecibir[d.c]||0) * FACTOR_LLENADO));
  const hueco = denominations.map((d,i) => Math.max(0, objetivo[i] - (stock[i]||0)));
  const añadidos = denominations.map(() => 0);
  let restante = target;
  const maxPieza = Math.max(denominations[denominations.length-1].c, Math.floor(target / 3));
  const huecoFil = denominations.map((d,i) => d.c <= maxPieza ? hueco[i] : 0);
  const costeFil = denominations.reduce((s,d,i) => s + huecoFil[i] * d.c, 0);
  if(costeFil > 0){ const f = Math.min(1, target / costeFil); denominations.forEach((d,i) => { const n = Math.floor(huecoFil[i] * f); añadidos[i] = n; restante -= n * d.c; }); }
  if(restante > 0){ let seguir = true, seguridad = 5000; while(restante > 0 && seguir && seguridad-- > 0){ seguir = false; for(let i = denominations.length - 1; i >= 0; i--){ if(restante <= 0) break; const d = denominations[i]; if(d.c > maxPieza || añadidos[i] >= hueco[i]) continue; if(d.c <= restante){ añadidos[i]++; restante -= d.c; seguir = true; } } } }
  if(restante > 0){ for(let i = 0; i < denominations.length; i++){ if(restante <= 0) break; const d = denominations[i], libre = Math.max(0, hueco[i] - añadidos[i]); if(libre <= 0) continue; const n = Math.min(libre, Math.floor(restante / d.c)); if(n > 0){ añadidos[i] += n; restante -= n * d.c; } } }
  if(restante > 0){ for(let i = 0; i < denominations.length; i++){ if(restante <= 0) break; const d = denominations[i], n = Math.floor(restante / d.c); if(n > 0){ añadidos[i] += n; restante -= n * d.c; } } }
  return añadidos;
}

function ajustarManualReponer(cents,delta){
  const d = denominations.find(x => x.c === cents); if(!d) return;
  const i = denominations.findIndex(x => x.c === cents), act = stock[i] || 0, tope = topesRecibir[cents] || 0, add = reponerState.manualAdd[cents] || 0;
  if(delta > 0 && tope > 0){ const maxAdd = Math.max(0, tope - act); if(add >= maxAdd){ mostrarToast("⚠️ Máximo alcanzado (tope " + tope + ")"); return; } }
  reponerState.manualAdd[cents] = Math.max(0, add + delta); actualizarReponerManual();
}
function resetManualReponer(){denominations.forEach(d=>{reponerState.manualAdd[d.c]=0});reponerState.importeManual=0;const inp=document.getElementById("reponerImporteManual");if(inp)inp.value="";actualizarReponerManual()}

function confirmarReponer(){
  let añadir = [], total = 0;
  if(reponerState.modo === "manual"){
    denominations.forEach((d,i) => { const n = reponerState.manualAdd[d.c] || 0; if(n > 0){ añadir.push({ index: i, cantidad: n }); total += n * d.c; } });
    if(!añadir.length){ alert("No has añadido ninguna pieza."); return; }
  } else {
    const rec = configuracionRecomendada(), { faltantes } = calcularFaltantes(rec.viajes, rec.colchon);
    faltantes.forEach(x => { if(reponerState.marcados[x.d.c] !== false && x.deBanco > 0){ añadir.push({ index: x.index, cantidad: x.deBanco }); total += x.deBanco * x.d.c; } });
    if(!añadir.length){ alert("No has marcado ninguna pieza."); return; }
  }
  if(!confirm("¿Confirmar que has sacado " + moneyText(total) + " del banco y los has metido en la caja?")) return;
  añadir.forEach(x => { stock[x.index] += x.cantidad; statsOps.repuesto[x.index] += x.cantidad; });
  saveStats(); saveStock(); renderStockList(); updateCashSummary();
  alert("✅ Añadido a la caja desde el banco: " + moneyText(total)); cerrarReponerPantalla();
  const pc = document.getElementById("cambioPantalla");
  if(pc && pc.style.display === "block") renderCambioInicio();
}

/* ==================== DIAGNÓSTICO ==================== */
function abrirDiagnostico(){const d=document.getElementById("drawer"),o=document.getElementById("overlay");if(d)d.classList.remove("active");if(o)o.classList.remove("active");const p=document.getElementById("diagnosticoPantalla");if(p)p.style.display="block";renderDiagnostico()}
function cerrarDiagnostico(){const p=document.getElementById("diagnosticoPantalla");if(p)p.style.display="none"}

function renderDiagnostico(){
  const cont=document.getElementById("diagnosticoContenido"); if(!cont)return;
  const ops=statsOps.operations;
  let html="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ESTADO DEL APRENDIZAJE</div>";
  if(ops<10){ const fal=10-ops; html+="<div style='background:#1e3a8a;border:1px solid #3b82f6;border-radius:10px;padding:14px;text-align:center'><div style='font-size:14px;color:#93c5fd;font-weight:700;line-height:1.5'>🧠 Aún aprendiendo<br><br><span style='font-size:13px;color:#bfdbfe'>Llevo registradas <b>"+ops+"</b> operaciones.<br>Necesito al menos 10 para sugerencias fiables.<br><br>Faltan <b>"+fal+"</b> operaciones más.</span></div></div>"; }
  else { html+="<div style='background:#064e3b;border:1px solid #059669;border-radius:10px;padding:12px;text-align:center'><div style='font-size:13px;color:#4ade80;font-weight:700;line-height:1.5'>✅ Aprendizaje activo<br><span style='font-size:12px;color:#a7f3d0'>Basado en <b>"+ops+"</b> operaciones registradas</span></div></div>"; }
  html+="</div>";

  if(ops>0){
    html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>📊 DATOS POR DENOMINACIÓN</div>";
    html+="<div style='display:grid;grid-template-columns:1.1fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.75fr;gap:3px;font-size:9px;color:#64748b;font-weight:700;padding-bottom:6px;border-bottom:1px solid #334155;text-align:right'><span style='text-align:left'>DENOM.</span><span>STOCK</span><span>RECV</span><span>GAST</span><span>DEP.</span><span>REP.</span><span>CAMB.</span><span>ESTIM.</span></div>";
    denominations.forEach((d,i)=>{
      const sn=stock[i], rn=statsOps.received[i]||0, gn=statsOps.spent[i]||0, dp=statsOps.deposited[i]||0, rp=statsOps.repuesto[i]||0, cb=statsOps.cambioNeto[i]||0;
      const rit=gn/ops; let est="—",co="#64748b";
      if(rit>0){ const res=Math.floor(sn/rit); est="~"+res; if(res<5)co="#ef4444"; else if(res<15)co="#fbbf24"; else co="#4ade80"; }
      const cbColor = cb>0?"#4ade80":(cb<0?"#f87171":"#64748b"), cbTxt = cb>0?("+"+cb):String(cb);
      html+="<div style='display:grid;grid-template-columns:1.1fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.55fr 0.75fr;gap:3px;font-size:11px;color:#fff;padding:6px 0;border-bottom:1px solid #1e293b;text-align:right'><span style='text-align:left;font-weight:700'>"+d.n+"</span><span>"+sn+"</span><span style='color:#4ade80'>"+rn+"</span><span style='color:#fbbf24'>"+gn+"</span><span style='color:#f87171'>"+dp+"</span><span style='color:#38bdf8'>"+rp+"</span><span style='color:"+cbColor+"'>"+cbTxt+"</span><span style='color:"+co+";font-weight:800'>"+est+"</span></div>";
    });
    html+="</div>";
  }

  let totalIn=0, totalOut=0;
  denominations.forEach((d,i)=>{ totalIn += (statsOps.manualIn[i]||0) * d.c; totalOut += (statsOps.manualOut[i]||0) * d.c; });
  if(totalIn>0 || totalOut>0){
    html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>📝 MOVIMIENTOS MANUALES</div>";
    html+="<div style='display:flex;justify-content:space-between;padding:6px 0;font-size:13px'><span style='color:#94a3b8'>📥 Entradas (propinas/correcciones)</span><span style='color:#4ade80;font-weight:800'>+"+moneyText(totalIn)+"</span></div>";
    html+="<div style='display:flex;justify-content:space-between;padding:6px 0;font-size:13px'><span style='color:#94a3b8'>📤 Salidas (gastos)</span><span style='color:#f87171;font-weight:800'>−"+moneyText(totalOut)+"</span></div></div>";
  }

  html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>💡 CÓMO LEO ESTOS DATOS</div><div style='font-size:12px;color:#94a3b8;line-height:1.7'><b style='color:#4ade80'>RECV</b> → piezas recibidas del cliente.<br><b style='color:#fbbf24'>GAST</b> → piezas devueltas como cambio.<br><b style='color:#f87171'>DEP.</b> → piezas depositadas a la empresa.<br><b style='color:#38bdf8'>REP.</b> → piezas repuestas del banco.<br><b style='color:#4ade80'>CAMB.</b> → neto por cambio de billete (+recibes / −entregas).<br><b style='color:#38bdf8'>ESTIM.</b> → operaciones que aguantas.<br><br><span style='color:#64748b'>Las sugerencias se calculan con todos estos datos.</span></div></div>";
  cont.innerHTML=html;
}

/* ==================== MOVIMIENTO MANUAL ==================== */
function abrirMovimientoPantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("movimientoPantalla"); if(p)p.style.display="block";
  movimientoState={tipo:"entrada",motivo:"propina",piezas:{}};
  renderMovimientoPantalla();
}
function cerrarMovimientoPantalla(){ const p=document.getElementById("movimientoPantalla"); if(p)p.style.display="none"; }

function renderMovimientoPantalla(){
  const cont=document.getElementById("movimientoContenido"); if(!cont)return;
  const st=movimientoState; let html="";

  html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>TIPO DE MOVIMIENTO</div><div style='display:flex;gap:8px'>";
  html+="<button type='button' onclick='setTipoMovimiento(\"entrada\")' style='flex:1;padding:16px;border-radius:10px;border:2px solid "+(st.tipo==="entrada"?"#22c55e":"#475569")+";background:"+(st.tipo==="entrada"?"linear-gradient(135deg,#14532d,#15803d)":"#1e293b")+";color:"+(st.tipo==="entrada"?"#4ade80":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:16px;letter-spacing:0.5px;box-shadow:"+(st.tipo==="entrada"?"0 0 0 3px rgba(34,197,94,0.25)":"none")+"'>📥 ENTRADA</button>";
  html+="<button type='button' onclick='setTipoMovimiento(\"salida\")' style='flex:1;padding:16px;border-radius:10px;border:2px solid "+(st.tipo==="salida"?"#ef4444":"#475569")+";background:"+(st.tipo==="salida"?"linear-gradient(135deg,#7f1d1d,#991b1b)":"#1e293b")+";color:"+(st.tipo==="salida"?"#fca5a5":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:16px;letter-spacing:0.5px;box-shadow:"+(st.tipo==="salida"?"0 0 0 3px rgba(239,68,68,0.25)":"none")+"'>📤 SALIDA</button>";
  html+="</div></div>";

  html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>MOTIVO</div>";
  if(st.tipo==="entrada"){
    html+="<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px'>";
    const pAct = st.motivo==="propina"; html+="<button type='button' onclick='setMotivoMovimiento(\"propina\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(pAct?"#22c55e":"#475569")+";background:"+(pAct?"linear-gradient(135deg,#14532d,#15803d)":"#1e293b")+";color:"+(pAct?"#4ade80":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(pAct?"0 0 0 3px rgba(34,197,94,0.25)":"none")+"'>💶 Propina</button>";
    const eAct = st.motivo==="encontrado"; html+="<button type='button' onclick='setMotivoMovimiento(\"encontrado\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(eAct?"#8b5cf6":"#475569")+";background:"+(eAct?"linear-gradient(135deg,#4c1d95,#6d28d9)":"#1e293b")+";color:"+(eAct?"#c4b5fd":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(eAct?"0 0 0 3px rgba(139,92,246,0.25)":"none")+"'>🔍 Encontrado</button>";
    const oAct = st.motivo==="otroIngreso"; html+="<button type='button' onclick='setMotivoMovimiento(\"otroIngreso\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(oAct?"#0ea5e9":"#475569")+";background:"+(oAct?"linear-gradient(135deg,#075985,#0369a1)":"#1e293b")+";color:"+(oAct?"#7dd3fc":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(oAct?"0 0 0 3px rgba(14,165,233,0.25)":"none")+"'>📥 Otro</button>";
    html+="</div>";
  } else {
    html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px'>";
    const gAct = st.motivo==="gasto"; html+="<button type='button' onclick='setMotivoMovimiento(\"gasto\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(gAct?"#ef4444":"#475569")+";background:"+(gAct?"linear-gradient(135deg,#7f1d1d,#991b1b)":"#1e293b")+";color:"+(gAct?"#fca5a5":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(gAct?"0 0 0 3px rgba(239,68,68,0.25)":"none")+"'>🚗 Gasto</button>";
    const lAct = st.motivo==="limpieza"; html+="<button type='button' onclick='setMotivoMovimiento(\"limpieza\")' style='padding:14px 6px;border-radius:10px;border:2px solid "+(lAct?"#0ea5e9":"#475569")+";background:"+(lAct?"linear-gradient(135deg,#075985,#0369a1)":"#1e293b")+";color:"+(lAct?"#7dd3fc":"#94a3b8")+";font-weight:900;cursor:pointer;font-size:14px;box-shadow:"+(lAct?"0 0 0 3px rgba(14,165,233,0.25)":"none")+"'>🧽 Limpieza</button>";
    html+="</div>";
  }
  html+="</div>";

  let expl="", colorExp="#94a3b8", bgExp="#1e293b", titulo="";
  if(st.motivo==="propina"){ titulo="💶 Propina"; expl="Sube stock y suma a propinas."; colorExp="#a7f3d0"; bgExp="#064e3b"; }
  else if(st.motivo==="encontrado"){ titulo="🔍 Encontrado"; expl="Sube stock. NO suma a propinas."; colorExp="#ddd6fe"; bgExp="#4c1d95"; }
  else if(st.motivo==="otroIngreso"){ titulo="📥 Otro ingreso"; expl="Sube stock. NO suma a propinas."; colorExp="#bae6fd"; bgExp="#075985"; }
  else if(st.motivo==="gasto"){ titulo="🚗 Gasto"; expl="Resta stock. NO afecta a propinas."; colorExp="#fecaca"; bgExp="#7f1d1d"; }
  else if(st.motivo==="limpieza"){ titulo="🧽 Limpieza"; expl="Gasto de limpieza del coche. Resta stock."; colorExp="#bae6fd"; bgExp="#075985"; }
  html+="<div style='font-size:14px;color:"+colorExp+";padding:12px 14px;background:"+bgExp+";border-radius:8px;margin-bottom:14px;line-height:1.4;font-weight:800;letter-spacing:0.3px'>"+titulo+"<div style='font-size:12px;font-weight:600;color:"+colorExp+";opacity:0.85;margin-top:4px;line-height:1.35'>"+expl+"</div></div>";

  html+="<div class='card' style='margin:0 0 12px 0'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>PIEZAS · TOCA PARA AÑADIR</div><div style='display:grid;grid-template-columns:repeat(3,1fr);gap:8px'>";
  denominations.forEach(d=>{
    const idx = denominations.findIndex(x => x.c === d.c), n = st.piezas[d.c]||0, stockAct = stock[idx] || 0;
    const tope = topesRecibir[d.c] || 0, reserva = reservaMinima[d.c] || 0;
    const gc = (d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;
    let bloquearMas = false, limiteInfo = "";
    if(st.tipo === "entrada"){ if(tope > 0){ const maxAdd = Math.max(0, tope - stockAct); limiteInfo = "máx " + maxAdd; if(n >= maxAdd) bloquearMas = true; } }
    else { const maxRemove = Math.max(0, stockAct - reserva); limiteInfo = "máx " + maxRemove; if(n >= maxRemove) bloquearMas = true; }
    let bgCard = "#283548", borderCard = "#475569";
    if(n > 0){ if(bloquearMas){ bgCard = "#7f1d1d"; borderCard = "#ef4444"; } else { bgCard = "#4c1d95"; borderCard = "#8b5cf6"; } }
    const cardStyle = "position:relative;padding:14px 6px 10px 6px;border-radius:12px;border:2px solid "+borderCard+";background:"+bgCard+";cursor:"+(bloquearMas?"not-allowed":"pointer")+";opacity:"+(bloquearMas?"0.7":"1")+";text-align:center;min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px";
    const onclick = bloquearMas ? "" : "onclick='ajustarMovimiento("+d.c+",1)'";
    html+="<div "+onclick+" style='"+cardStyle+"'>";
    if(n > 0){
      html+="<div style='width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;padding:0 2px'>";
      html+="<div style='min-width:26px;height:26px;padding:0 8px;border-radius:13px;background:#a78bfa;color:#0f172a;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #0f172a'>"+n+"</div>";
      html+="<button type='button' onclick='event.stopPropagation();ajustarMovimiento("+d.c+",-1)' style='width:30px;height:30px;padding:0;border-radius:50%;background:#ef4444;color:#fff;border:2px solid #0f172a;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center'>−</button>";
      html+="</div>";
    } else { html+="<div style='height:4px'></div>"; }
    html+="<div class='"+gc+"' style='font-size:13px;flex-shrink:0'>"+d.short+"</div><div style='font-size:14px;font-weight:900;color:#fff;letter-spacing:0.3px'>"+d.n+"</div><div style='font-size:10px;color:#94a3b8;font-weight:700;line-height:1.2'>tienes "+stockAct+(limiteInfo?" · "+limiteInfo:"")+"</div></div>";
  });
  html+="</div></div>";

  let total=0; denominations.forEach(d=>{ total += (st.piezas[d.c]||0) * d.c; });
  html+="<div class='card' style='margin:0 0 12px 0;text-align:center;background:#1e293b;border:1px solid #475569'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:6px'>TOTAL DEL MOVIMIENTO</div><div style='font-size:32px;font-weight:900;color:#a78bfa'>"+moneyText(total)+"</div></div>";
  html+="<button type='button' onclick='confirmarMovimiento()' style='width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:16px;font-weight:800;font-size:16px;cursor:pointer;margin-bottom:8px'>✅ GUARDAR MOVIMIENTO</button>";
  html+="<button type='button' onclick='cerrarMovimientoPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:700;font-size:15px;cursor:pointer'>✖ Cancelar</button>";
  cont.innerHTML=html;
}

function setTipoMovimiento(t){ movimientoState.tipo = t; movimientoState.motivo = (t === "entrada") ? "propina" : "gasto"; renderMovimientoPantalla(); }
function setMotivoMovimiento(m){ movimientoState.motivo=m; renderMovimientoPantalla(); }
function ajustarMovimiento(c,delta){
  const idx = denominations.findIndex(x => x.c === c), st = movimientoState, stockAct = stock[idx] || 0;
  const tope = topesRecibir[c] || 0, reserva = reservaMinima[c] || 0, n = st.piezas[c] || 0;
  if(delta > 0){
    if(st.tipo === "entrada"){ if(tope > 0){ const maxAdd = Math.max(0, tope - stockAct); if(n >= maxAdd){ mostrarToast("⚠️ Máximo alcanzado (tope " + tope + ")"); return; } } }
    else { const maxRemove = Math.max(0, stockAct - reserva); if(n >= maxRemove){ mostrarToast("⚠️ Máximo alcanzado (solo tienes " + stockAct + ")"); return; } }
  }
  st.piezas[c] = Math.max(0, n + delta); renderMovimientoPantalla();
}

function confirmarMovimiento(){
  const st=movimientoState; let total=0; const piezas=[];
  denominations.forEach(d=>{ const n=st.piezas[d.c]||0; if(n>0) piezas.push({n:n, idx:denominations.findIndex(x=>x.c===d.c)}); total += n*d.c; });
  if(!piezas.length){alert("No has añadido ninguna pieza.");return}
  const tipo=st.tipo, motivo=st.motivo;
  let msgConfirm="";
  if(motivo==="propina") msgConfirm="¿Registrar PROPINA de "+moneyText(total)+"?\n\nSe sumará a las propinas acumuladas.";
  else if(motivo==="encontrado") msgConfirm="¿Registrar dinero ENCONTRADO por "+moneyText(total)+"?\n\nNO se sumará a propinas.";
  else if(motivo==="otroIngreso") msgConfirm="¿Registrar OTRO INGRESO por "+moneyText(total)+"?\n\nNO se sumará a propinas.";
  else if(motivo==="gasto") msgConfirm="¿Registrar GASTO de "+moneyText(total)+"?";
  else if(motivo==="limpieza") msgConfirm="¿Registrar GASTO de LIMPIEZA por "+moneyText(total)+"?";
  if(!confirm(msgConfirm)) return;
  piezas.forEach(p=>{ if(tipo==="entrada") stock[p.idx]+=p.n; else stock[p.idx]=Math.max(0,stock[p.idx]-p.n); });
  piezas.forEach(p=>{ if(tipo==="entrada") statsOps.manualIn[p.idx]+=p.n; else statsOps.manualOut[p.idx]+=p.n; });
  saveStats();
  if(motivo==="propina"){ totalTips += total; saveTips(); }
  saveStock(); renderStockList(); updateCashSummary();
  let msgOk = "✅ Movimiento registrado.";
  if(motivo==="propina") msgOk = "✅ Propina registrada.";
  else if(motivo==="encontrado") msgOk = "✅ Dinero encontrado registrado.";
  else if(motivo==="otroIngreso") msgOk = "✅ Ingreso registrado.";
  else if(motivo==="gasto") msgOk = "✅ Gasto registrado.";
  else if(motivo==="limpieza") msgOk = "✅ Gasto de limpieza registrado.";
  alert(msgOk); cerrarMovimientoPantalla();
}

/* ==================== MODO PEAJE ==================== */
function abrirPeajePantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("peajePantalla"); if(p)p.style.display="block";
  peajeState = { fase: 1, importe: 0, pagado: null, cambioRecibido: {} };
  renderPeajePantalla();
}
function cerrarPeajePantalla(){ document.getElementById("peajePantalla").style.display="none"; }

function renderPeajePantalla(){
  const cont = document.getElementById("peajeContenido"); if(!cont) return;
  const st = peajeState;

  if(st.fase === 1){
    const peajesMes = loadPeajesHistorial().filter(p => p.fecha.startsWith(fechaLocalStr().slice(0,7)));
    const totalMes = peajesMes.reduce((s, p) => s + p.importe, 0);
    cont.innerHTML = `
      <div class="card" style="margin:0 0 12px 0;text-align:center;background:#1e293b;border:1px solid #475569">
        <div style="font-size:14px;color:#94a3b8;font-weight:800;margin-bottom:12px">¿CUÁNTO VALE EL PEAJE?</div>
        <input type="number" id="peajeInput" inputmode="decimal" step="0.01" placeholder="Ej: 4.20" style="width:100%;font-size:32px;font-weight:900;padding:16px;border-radius:12px;border:2px solid #3b82f6;background:#0f172a;color:#38bdf8;text-align:center;outline:none;margin-bottom:14px">
        <button type="button" onclick="calcPeajeSugerencia()" style="width:100%;background:#0284c7;color:#fff;border:none;border-radius:10px;padding:16px;font-weight:900;font-size:16px;cursor:pointer">🔎 Calcular cómo pagar</button>
      </div>
      <div class="card" style="margin:0 0 12px 0;background:#0f172a;border:1px solid #334155;text-align:center">
        <div style="font-size:11px;color:#94a3b8;font-weight:700">GASTADO ESTE MES</div>
        <div style="font-size:20px;font-weight:900;color:#fca5a5;margin-top:4px">${moneyText(totalMes)}</div>
      </div>`;
    setTimeout(() => { const inp = document.getElementById("peajeInput"); if(inp) inp.focus(); }, 100);
    return;
  }

  if(st.fase === 2){
    let html = `<div class="card" style="margin:0 0 12px 0;background:#1e293b;border:2px solid #0284c7"><div style="font-size:12px;color:#93c5fd;font-weight:900;letter-spacing:0.5px;margin-bottom:8px">💵 PAGA CON ESTO (${moneyText(st.importe)})</div><div class="change-grid" style="margin-bottom:12px">`;
    let totEntregado = 0;
    Object.keys(st.pagado).forEach(cStr => {
      const c = parseInt(cStr), n = st.pagado[c], d = denominations.find(x => x.c === c);
      if(d && n > 0){ totEntregado += n * c; const cl = d.type === "bill" ? "bill-graphic " : "coin-graphic "; html += `<div class="cash-item"><div class="badge">x${n}</div><div class="${cl}${d.class}">${d.short}</div></div>`; }
    });
    html += `</div>`;
    const dif = totEntregado - st.importe;
    if(dif > 0) html += `<div style="font-size:12px;color:#fbbf24;background:#78350f;padding:8px;border-radius:8px;text-align:center;margin-bottom:10px">⚠️ Te tienen que devolver <b>${moneyText(dif)}</b></div>`;
    else html += `<div style="font-size:12px;color:#4ade80;background:#064e3b;padding:8px;border-radius:8px;text-align:center;margin-bottom:10px">✅ Pago exacto. No te dan cambio.</div>`;
    html += `<button type="button" onclick="confirmarPagoPeaje()" style="width:100%;background:#b45309;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:900;font-size:15px;cursor:pointer">💸 He pagado</button></div>`;
    cont.innerHTML = html; return;
  }

  if(st.fase === 3){
    let html = `<div class="card" style="margin:0 0 12px 0;background:#1e293b;border:2px solid #fbbf24"><div style="font-size:12px;color:#fbbf24;font-weight:900;letter-spacing:0.5px;margin-bottom:8px">🪙 ¿QUÉ CAMBIO TE HAN DADO?</div><div style="font-size:12px;color:#94a3b8;margin-bottom:12px;text-align:center">Pulsa las piezas que te han devuelto.</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">`;
    denominations.forEach(d => {
      const n = st.cambioRecibido[d.c] || 0, cl = d.type === "bill" ? "bill-graphic " : "coin-graphic ";
      html += `<div onclick="addCambioPeaje(${d.c})" style="background:${n>0?'#4c1d95':'#283548'};border:2px solid ${n>0?'#8b5cf6':'#475569'};border-radius:10px;padding:8px;text-align:center;cursor:pointer;position:relative"><div class="${cl}${d.class}" style="font-size:12px;margin-bottom:4px">${d.short}</div><div style="font-size:11px;color:#fff;font-weight:800">${d.n}</div>${n > 0 ? `<div style="position:absolute;top:-6px;right:-6px;background:#8b5cf6;color:#fff;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px">x${n}</div>` : ""}</div>`;
    });
    html += `</div>`;
    let totCambio = 0; Object.keys(st.cambioRecibido).forEach(cStr => { totCambio += parseInt(cStr) * st.cambioRecibido[cStr]; });
    const esperado = st.totEntregado - st.importe, cuadra = (totCambio === esperado);
    html += `<div style="text-align:center;font-size:14px;font-weight:800;color:${cuadra?'#4ade80':'#fbbf24'};padding:10px;background:#0f172a;border-radius:8px;margin-bottom:12px">Cambio marcado: ${moneyText(totCambio)} / ${moneyText(esperado)}</div>`;
    html += `<button type="button" onclick="finalizarPeaje()" style="width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px">✅ Guardar y cerrar</button><button type="button" onclick="resetCambioPeaje()" style="width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer">🗑️ Limpiar cambio</button></div>`;
    cont.innerHTML = html; return;
  }
}

function calcPeajeSugerencia(){
  const inp = document.getElementById("peajeInput");
  const val = parseFloat(inp.value.replace(',','.')) || 0;
  if(val <= 0){ mostrarToast("Escribe un importe"); return; }
  peajeState.importe = Math.round(val * 100);
  const disp = stock.map((n,i) => Math.max(0, n - (reservaMinima[denominations[i].c] || 0)));
  let used = findSmartChange(peajeState.importe, disp);
  if(!used){ used = findSmartChange(peajeState.importe, stock); }
  if(!used){
    const candidatas = denominations.filter(d => d.c >= peajeState.importe).sort((a,b) => a.c - b.c);
    for(const d of candidatas){ const i = denominations.findIndex(x => x.c === d.c); if(stock[i] > 0) { used = new Array(denominations.length).fill(0); used[i] = 1; break; } }
  }
  if(!used){ mostrarToast("⚠️ No tienes piezas suficientes para pagar este peaje."); return; }

  const pagado = {}; let totEntregado = 0;
  used.forEach((n,i) => { if(n > 0){ pagado[denominations[i].c] = n; totEntregado += n * denominations[i].c; } });
  peajeState.pagado = pagado; peajeState.totEntregado = totEntregado; peajeState.fase = 2;
  renderPeajePantalla();
}

function confirmarPagoPeaje(){
  Object.keys(peajeState.pagado).forEach(cStr => {
    const c = parseInt(cStr), n = peajeState.pagado[c], i = denominations.findIndex(d => d.c === c);
    if(i >= 0 && n > 0){ stock[i] = Math.max(0, stock[i] - n); }
  });
  saveStock(); renderStockList(); updateCashSummary();
  if(peajeState.totEntregado > peajeState.importe){ peajeState.cambioRecibido = {}; peajeState.fase = 3; renderPeajePantalla(); }
  else { finalizarPeaje(); }
}

function addCambioPeaje(cents){ const st = peajeState; st.cambioRecibido[cents] = (st.cambioRecibido[cents] || 0) + 1; renderPeajePantalla(); }
function resetCambioPeaje(){ peajeState.cambioRecibido = {}; renderPeajePantalla(); }

function finalizarPeaje(){
  const st = peajeState; let totCambio = 0;
  Object.keys(st.cambioRecibido).forEach(cStr => {
    const c = parseInt(cStr), n = st.cambioRecibido[cStr];
    if(n > 0){ const i = denominations.findIndex(d => d.c === c); if(i >= 0){ stock[i] += n; } totCambio += c * n; }
  });
  saveStock(); renderStockList(); updateCashSummary();
  guardarPeajeHistorial(st.importe, st.totEntregado, totCambio);
  mostrarToast("✅ Peaje guardado. Caja cuadrada.");
  cerrarPeajePantalla();
}

function guardarPeajeHistorial(importe, pagado, cambioDevuelto){
  const h = loadPeajesHistorial();
  h.push({ fecha: new Date().toISOString(), importe: importe, pagado: pagado, cambio: cambioDevuelto });
  if(h.length > 1000) h.shift();
  savePeajesHistorial(h);
}

/* ==================== CHULETA DE DEPÓSITO (Simplificada) ==================== */
function renderChuletaDeposito(){
  let cont = document.getElementById("chuletaDeposito");
  if(!cont){
    cont = document.createElement("div");
    cont.id = "chuletaDeposito";
    const inp = document.getElementById("cierreInput");
    if(inp && inp.parentNode) inp.parentNode.insertBefore(cont, inp.nextSibling);
    else return;
  }

  const ops = loadHistorialOps();
  
  let totalViajes = 0, numOps = 0, propinasAcumuladas = 0;
  ops.forEach(o => {
    totalViajes += (o.precio || 0);
    propinasAcumuladas += (o.propina || 0);
    numOps++;
  });

  let html = "";
  html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px;margin:12px 0">`;
  html += `<div style="font-size:12px;color:#38bdf8;font-weight:900;letter-spacing:0.5px;margin-bottom:10px">📋 CHULETA DE DEPÓSITO</div>`;

  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px"><span style="color:#94a3b8">🚗 Viajes pendientes (${numOps})</span><span style="color:#fff;font-weight:800">${moneyText(totalViajes)}</span></div>`;
  
  if(propinasAcumuladas > 0) {
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;border-top:1px dashed #475569;margin-top:4px"><span style="color:#fbbf24">💶 Propinas (se quedan)</span><span style="color:#fbbf24;font-weight:800">${moneyText(propinasAcumuladas)}</span></div>`;
  }

  html += `<div style="margin-top:12px;padding:12px;background:linear-gradient(135deg,#064e3b,#065f46);border:1px solid #10b981;border-radius:10px;text-align:center">`;
  html += `<div style="font-size:11px;color:#a7f3d0;font-weight:900;letter-spacing:1px">💡 METE APROXIMADAMENTE</div>`;
  html += `<div style="font-size:28px;font-weight:900;color:#4ade80;margin-top:4px;line-height:1">${moneyText(totalViajes)}</div>`;
  html += `<div style="font-size:11px;color:#a7f3d0;margin-top:6px">Solo el precio de los viajes</div>`;
  html += `</div>`;

  if(totalViajes > 0){
    html += `<button type="button" onclick="usarChuletaDeposito(${totalViajes})" style="width:100%;margin-top:12px;background:#0891b2;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:800;font-size:13px;cursor:pointer">⬇️ USAR ${moneyText(totalViajes)} EN EL IMPORTE</button>`;
  } else {
    html += `<div style="text-align:center;font-size:12px;color:#64748b;margin-top:10px;font-style:italic">No hay viajes pendientes de depositar</div>`;
  }

  html += `</div>`;
  cont.innerHTML = html;
}

function usarChuletaDeposito(centavos){
  const inp = document.getElementById("cierreInput");
  if(inp){
    inp.value = (centavos / 100).toFixed(2);
    if(typeof calcularCierre === "function") calcularCierre();
  }
}

function usarChuletaDeposito(centavos){
  const inp = document.getElementById("cierreInput");
  if(inp){
    inp.value = (centavos / 100).toFixed(2);
    if(typeof calcularCierre === "function") calcularCierre();
  }
}