/* ==================== CONFIGURACIÓN DEL MARGEN (FACTOR DE LLENADO) ==================== */
let FACTOR_LLENADO = loadFactorLlenado();

function loadFactorLlenado(){
  const s = safeStorage.get("uberCambioFactorLlenado");
  if(s) { 
    const n = parseInt(s); 
    if(!isNaN(n) && n >= 10 && n <= 100) return n / 100; 
  }
  return 0.7; // Por defecto 70% si no hay nada guardado
}

function guardarFactorLlenado(porcentaje){
  safeStorage.set("uberCambioFactorLlenado", String(porcentaje));
  FACTOR_LLENADO = porcentaje / 100;
}

function actualizarFactorLlenadoDesdeUI(){
  const inp = document.getElementById("factorLlenadoInput");
  if(!inp) return;
  let n = parseInt(inp.value) || 70;
  n = Math.max(10, Math.min(100, n));
  guardarFactorLlenado(n);
  mostrarToast("✅ Margen configurado al " + n + "%");
  if(typeof renderTopesList === "function") renderTopesList(); 
}

function actualizarTextoMargen(){
  const inp = document.getElementById("factorLlenadoInput");
  const txtP = document.getElementById("txtMargenPorcentaje");
  const txtE = document.getElementById("txtMargenEjemplo");
  if(!inp || !txtP || !txtE) return;
  
  let n = parseInt(inp.value) || 70;
  n = Math.max(10, Math.min(100, n));
  
  txtP.textContent = n;
  
  const topeEjemplo = 20;
  const bajada = Math.max(1, Math.floor(topeEjemplo * (n / 100)));
  
  txtE.innerHTML = `Si pones <b>${n}%</b>, y tu tope es <b>${topeEjemplo}</b>, la app te pedirá bajar a <b>${bajada}</b>.`;
}

/* ==================== INVENTARIO (LISTA DE CAJA) ==================== */
function renderStockList(){
  const box=document.getElementById("stockList");
  if(!box) return;
  box.innerHTML="";
  stockInputs=[];
  
  const tipEl=document.getElementById("totalTipDisplay");
  if(tipEl) tipEl.textContent="💶 Propinas: "+moneyText(totalTips);
  
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
  
  renderAvisoHucha();
  renderRecomendaciones();
  actualizarBotonModoEdicion();
}

function updateStockVal(i,v){
  stock[i]=Math.max(0,v);
  if(stockInputs[i]) stockInputs[i].value=stock[i];
  saveStock();
}

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
  if(!btn) return;
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

/* ==================== AVISO HUCHA (MONEDAS SOBRANTES) ==================== */
function renderAvisoHucha(){
  const box = document.getElementById("avisoHuchaBox");
  if(box) box.remove();
  if(statsOps.operations < 10) return;

  const sobrantes = [];
  denominations.forEach((d, i) => {
    if(d.type !== "coin") return; 
    const t = topesRecibir[d.c] || 0;
    if(t <= 0) return; 
    const sa = stock[i] || 0;
    
    // 👇 Si superas el máximo, calculamos cuánto sobra
    if(sa > t){
      const objetivo = Math.max(1, Math.floor(t * FACTOR_LLENADO));
      sobrantes.push({ d, index: i, cantidad: sa - objetivo, stock: sa, tope: t });
    }
  });
  if(!sobrantes.length) return;

  const total = sobrantes.reduce((s,x) => s + x.cantidad * x.d.c, 0);
  const cont = document.getElementById("stockList");
  if(!cont) return;

  const div = document.createElement("div");
  div.id = "avisoHuchaBox";
  div.style.cssText = "margin-top:12px;padding:12px;background:#2e1065;border:2px solid #7c3aed;border-radius:10px";
  let html = `<div style="font-size:12px;color:#c4b5fd;font-weight:900;letter-spacing:0.5px;margin-bottom:6px">🐷 MONEDAS SOBRANTES</div>`;
  html += `<div style="font-size:12px;color:#e9d5ff;line-height:1.4;margin-bottom:8px">Has superado el límite. Te sobran <b>${moneyText(total)}</b>. Pásalas a la Hucha para dejar hueco.</div>`;
  
  sobrantes.slice(0, 3).forEach(x => {
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:13px;color:#fff">
      <span>Tienes ${x.stock} × ${x.d.n} (tope ${x.tope})</span>
      <button type="button" onclick="abrirModalMoverHucha(${x.index}, ${x.cantidad})" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-weight:800;font-size:12px;cursor:pointer">🐷 Quitar ${x.cantidad}</button>
    </div>`;
  });
  
  html += `<button type="button" onclick="moverTodasMonedasAHuchaDesdeCaja()" style="width:100%;margin-top:8px;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:800;font-size:13px;cursor:pointer">🐷 Mover TODAS las sobrantes</button>`;
  div.innerHTML = html;
  cont.appendChild(div);
}

function moverTodasMonedasAHuchaDesdeCaja(){
  const { monedasSobran } = calcularIntercambiosRecomendados();
  if(!monedasSobran.length) return;
  if(!confirm("¿Mover todas las monedas sobrantes a la Hucha?")) return;
  let movidas = 0;
  monedasSobran.forEach(x => { movidas += moverAHucha(x.index, x.cantidad); });
  mostrarToast("🐷 Movidas " + movidas + " piezas a la Hucha");
}

/* ==================== RECOMENDACIONES (APRENDIZAJE) ==================== */
function renderRecomendaciones(){
  const box=document.getElementById("recomendacionesBox");
  if(!box) return;
  if(statsOps.operations<10){ box.innerHTML=""; return; }
  
  const ops=statsOps.operations;
  const falt=[],sob=[];
  
  denominations.forEach((d,i)=>{
    const aR=statsOps.received[i]/ops;
    const aS=statsOps.spent[i]/ops;
    if(aS>0 && statsOps.spent[i]>statsOps.received[i]+2){
      const r=stock[i]/aS;
      if(r<30) falt.push({d,falta:Math.max(1,Math.ceil(aS*30)-stock[i])});
    }
    if(aR>aS*2 && statsOps.received[i]>8 && stock[i]>8){
      sob.push({d,exceso:statsOps.received[i]-statsOps.spent[i]});
    }
  });
  
  if(!falt.length && !sob.length){ box.innerHTML=""; return; }
  
  let html="<div style='background:#0f172a;border:1px solid #475569;border-radius:10px;padding:12px;margin-top:14px'><div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>🤖 SUGERENCIAS · últimas "+ops+" operaciones</div>";
  
  if(falt.length){
    html+="<div style='font-size:11px;color:#fbbf24;font-weight:700;margin-bottom:4px'>⚠️ SE TE AGOTAN</div>";
    falt.forEach(x=>{ html+="<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'><span>"+x.d.n+"</span><span style='color:#fbbf24;font-weight:700'>pedir +"+x.falta+"</span></div>" });
  }
  
  if(sob.length){
    html+="<div style='font-size:11px;color:#4ade80;font-weight:700;margin:10px 0 4px'>💚 ACUMULAS DE MÁS</div>";
    sob.forEach(x=>{ html+="<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'><span>"+x.d.n+"</span><span style='color:#4ade80;font-weight:700'>+"+x.exceso+" de más</span></div>" });
  }
  
  html+="</div>";
  box.innerHTML=html;
}

/* ==================== CÁLCULO DE INTERCAMBIOS Y FALTANTES ==================== */
function calcularIntercambiosRecomendados(){
  const ops = statsOps.operations;
  if(ops < 10) return { sobran: [], totalSobra: 0, monedasSobran: [], totalMonedasSobra: 0 };

  const sobran = [];
  let totalSobra = 0;
  const monedasSobran = [];
  let totalMonedasSobra = 0;

  denominations.forEach((d, i) => {
    const sa = stock[i] || 0;
    const t = topesRecibir[d.c] || 0;
    
    if(t <= 0) return;

    if(sa > t){
      const objetivo = Math.max(1, Math.floor(t * FACTOR_LLENADO));
      const cantidad = sa - objetivo;

      if(cantidad > 0){
        if(d.type === "bill"){
          sobran.push({ d, index: i, cantidad, stock: sa, objetivo });
          totalSobra += cantidad * d.c;
        } else {
          monedasSobran.push({ d, index: i, cantidad, stock: sa, objetivo });
          totalMonedasSobra += cantidad * d.c;
        }
      }
    }
  });

  sobran.sort((a, b) => (b.cantidad * b.d.c) - (a.cantidad * a.d.c));
  monedasSobran.sort((a, b) => b.cantidad - a.cantidad);

  return { sobran, totalSobra, monedasSobran, totalMonedasSobra };
}

function calcularFaltantes(v, c){
  const ops = statsOps.operations;
  const fal = [], obj = {};
  denominations.forEach((d, i) => {
    const sa = stock[i] || 0;
    const ha = hucha[i] || 0;
    const t = (topesRecibir[d.c] || 0);
    
    if(t === 0) return;

    const limSup = Math.max(1, Math.floor(t * FACTOR_LLENADO));
    let o;
    if(ops >= 5){ const gm = statsOps.spent[i]/ops; o = Math.ceil(gm*v) + c; }
    else { const ba = ARRANQUE[d.c] || 0; o = Math.ceil(ba*(v/20)) + c; }
    o = Math.min(o, limSup);
    obj[d.c] = o;
    
    const falta = Math.max(0, o - sa);
    if(falta > 0){
      const deHucha = Math.min(falta, ha);
      const deBanco = falta - deHucha;
      fal.push({ d, index: i, falta, deHucha, deBanco });
    }
  });
  const total = fal.reduce((s,x) => s + x.falta * x.d.c, 0);
  const totalDeHucha = fal.reduce((s,x) => s + x.deHucha * x.d.c, 0);
  const totalDeBanco = fal.reduce((s,x) => s + x.deBanco * x.d.c, 0);
  return { faltantes: fal, total, totalDeHucha, totalDeBanco };
}

function configuracionRecomendada(){
  const ops=statsOps.operations;
  let v=20;
  if(ops>=5) v=Math.min(30,Math.max(15,Math.round(ops*0.8)));
  let c=ops>=30?4:3;
  return{viajes:v,colchon:c};
}