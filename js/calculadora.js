/* ==================== RESUMEN DE CAJA (BARRA SUPERIOR) ==================== */
function scheduleCashSummary(){
  if(summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(()=>{ summaryTimer=null; updateCashSummary() }, 120);
}

function updateCashSummary(){
  let t=0;
  denominations.forEach((d,i)=>{ t+=d.c*stock[i] });
  const el=document.getElementById("totalCashDisplay");
  if(el) el.textContent=moneyText(t);
  
  const checks=[["status20",2000],["status30",3000],["status50",5000],["status80",8000],["status100",10000]];
  const disp=stockDisponible();
  const cache={};
  checks.forEach(([id,tg])=>{
    if(!(tg in cache)) cache[tg]=estadoPara(tg,disp);
    setStatusBadge(id,cache[tg]);
  });
}

function estadoPara(target,disp){
  if(canMakeAmount(target,disp)) return "yes";
  if(canMakeAmount(target,stock)) return "warn";
  return "no";
}

function estadoParaStock(target,arr){
  const disp=arr.map((n,i)=>Math.max(0,n-(reservaMinima[denominations[i].c]||0)));
  if(canMakeAmount(target,disp)) return "yes";
  if(canMakeAmount(target,arr)) return "warn";
  return "no";
}

function stockDisponible(){
  return stock.map((n,i)=>Math.max(0,n-(reservaMinima[denominations[i].c]||0)));
}

function canMakeAmount(target,avail){
  if(target<=0) return true;
  const r=new Uint8Array(target+1);
  r[0]=1;
  for(let i=0;i<denominations.length;i++){
    const v=denominations[i].c,m=avail[i];
    if(m<=0||v>target)continue;
    const u=new Int32Array(target+1).fill(-1);
    for(let t=0;t<=target;t++) if(r[t]) u[t]=0;
    for(let t=0;t+v<=target;t++){
      if(u[t]<0) continue;
      if(u[t]<m&&u[t+v]<0){ r[t+v]=1; u[t+v]=u[t]+1; }
    }
  }
  return r[target]===1;
}

function setStatusBadge(id,estado){
  const el=document.getElementById(id);
  if(!el) return;
  el.style.background="";
  el.style.color="";
  if(estado==="yes"){ el.textContent="SÍ"; el.className="status-badge yes" }
  else if(estado==="warn"){ el.textContent="MÍN"; el.className="status-badge warn"; el.style.background="#eab308"; el.style.color="#000" }
  else { el.textContent="NO"; el.className="status-badge no" }
}

/* ==================== BOTONES DE DINERO RECIBIDO ==================== */
function renderButtons(){
  const box=document.getElementById("moneyButtons");
  if(!box) return;
  box.innerHTML="";
  const bt=document.createElement("div"); bt.className="section"; bt.textContent="Billetes"; box.appendChild(bt);
  denominations.slice(0,5).forEach(d=>{
    const b=document.createElement("button"); b.type="button"; b.className="money"; b.textContent=d.n; b.addEventListener("click",()=>addMoney(d.c)); box.appendChild(b);
  });
  const ct=document.createElement("div"); ct.className="section"; ct.textContent="Monedas"; box.appendChild(ct);
  denominations.slice(5).forEach(d=>{
    const b=document.createElement("button"); b.type="button"; b.className="money"; b.textContent=d.n; b.addEventListener("click",()=>addMoney(d.c)); box.appendChild(b);
  });
}

function addMoney(c){ received.push(c); updateReceived(); calculate(); }
function undoMoney(){ received.pop(); updateReceived(); calculate(); }
function updateReceived(){
  const t=received.reduce((a,b)=>a+b,0);
  const el=document.getElementById("paidDisplay");
  if(el) el.textContent=moneyText(t);
}

/* ==================== PROPINAS RÁPIDAS Y PRECIO GRANDE ==================== */
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

function mostrarPrecio(){
  const inp=document.getElementById("price");
  if(!inp) return;
  const raw=parseFloat(inp.value.replace(',','.'))||0;
  if(raw<=0){ alert("Escribe primero el precio del viaje."); return; }
  precioActual=Math.round(raw*100);
  const el=document.getElementById("precioGrande");
  if(el) el.textContent=moneyText(precioActual);
  const p=document.getElementById("precioPantalla");
  if(p) p.style.display="flex";
  iniciarAlternanciaPrecio();
}

function iniciarAlternanciaPrecio(){
  detenerAlternanciaPrecio();
  const t=document.getElementById("precioTitulo");
  if(!t) return;
  let en=false;
  t.textContent="A PAGAR";
  precioInterval=setInterval(()=>{ en=!en; t.textContent=en?"TO PAY":"A PAGAR" },3000);
}

function detenerAlternanciaPrecio(){
  if(precioInterval){ clearInterval(precioInterval); precioInterval=null; }
}

function cerrarPrecio(){
  detenerAlternanciaPrecio();
  const p=document.getElementById("precioPantalla");
  if(p) p.style.display="none";
}

/* ==================== MOTOR DE CÁLCULO Y TRANSACCIÓN ==================== */
function findSmartChange(target,avail){
  let best=null,minScore=Infinity;
  function bt(i,rest,used,score){
    if(rest===0){ if(score<minScore){ minScore=score; best=[...used] } return; }
    if(i>=denominations.length||rest<0||score>=minScore) return;
    const v=denominations[i].c;
    const mx=Math.min(avail[i],Math.floor(rest/v));
    for(let n=mx;n>=0;n--){
      used[i]=n;
      const pen=(denominations[i].type==="coin"&&v<=200)?n*2:n;
      bt(i+1,rest-n*v,used,score+pen);
      used[i]=0;
    }
  }
  bt(0,target,new Array(denominations.length).fill(0),0);
  return best;
}

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

  if(price<=0||paid===0){ resultDiv.style.display="none"; return; }

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

    const bd=document.createElement("div"); bd.className="badge"; bd.textContent="x"+devolver;
    const gr=document.createElement("div"); gr.className=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class; gr.textContent=d.short;

    it.appendChild(bd); it.appendChild(gr);
    changeGrid.appendChild(it);
  });

  if(!anyDevolver){
    const vacio=document.createElement("div");
    vacio.style.cssText="grid-column:1/-1;text-align:center;color:#64748b;font-size:12px;font-style:italic;padding:8px 0";
    vacio.textContent="No devuelves nada en efectivo (todo va a propina)";
    changeGrid.appendChild(vacio);
  }

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

      const bd=document.createElement("div"); bd.className="badge"; bd.style.background="#f59e0b"; bd.style.color="#000"; bd.textContent="x"+n;
      const gr=document.createElement("div"); gr.className=(d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class; gr.textContent=d.short;

      it.appendChild(bd); it.appendChild(gr);
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

  const rp = parseFloat(document.getElementById("price").value.replace(',','.')) || 0;
  const precio = Math.round(rp * 100);
  const dado = received.reduce((a,b) => a+b, 0);
  const propina = pendingTransaction.tip || 0;
  const cambio = dado - precio - propina;

  // 1. Actualizamos el stock
  for(let i=0;i<stock.length;i++) stock[i]+=pendingTransaction.incoming[i]-pendingTransaction.used[i];
  
  // 2. Actualizamos propinas
  if(pendingTransaction.tip>0){ totalTips+=pendingTransaction.tip; saveTips(); }
  
  // 3. Actualizamos estadísticas
  statsOps.operations++;
  for(let i=0;i<denominations.length;i++){
    statsOps.received[i]+=pendingTransaction.incoming[i]||0;
    statsOps.spent[i]+=pendingTransaction.used[i]||0;
  }
  saveStats();
  saveStock();

  // 👇 AQUÍ ESTÁ EL CAMBIO. Añadimos estadoJornada y esViajeUber al historial 👇
  añadirHistorialOp({ 
    fecha: new Date().toISOString(), 
    precio, 
    dado, 
    propina, 
    cambio,
    estadoJornada: (typeof estadoApp !== 'undefined') ? estadoApp : "offline",
    esViajeUber: (typeof estadoApp !== 'undefined' && estadoApp === 'ocupado')
  });

  if(typeof renderStockList === "function") renderStockList();
  if(typeof actualizarBotonCochePrincipal === "function") actualizarBotonCochePrincipal();
  
  // 4. Limpiamos la pantalla para el siguiente viaje
  received=[];
  pendingTransaction=null;
  propinasDelCambio = {};
  tipManual = 0;
  document.getElementById("price").value="";
  document.getElementById("tip").value="";
  document.getElementById("changeResult").style.display="none";
  updateReceived();
  
  alert("¡Operación guardada!");
  
  try { programarAvisosDeposito(); } catch(e){}
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

/* ==================== HISTORIAL DE OPERACIONES (Añadir) ==================== */
function añadirHistorialOp(datos){
  const h = loadHistorialOps();
  h.push(datos);
  if(h.length > 500) h.splice(0, h.length - 500);
  saveHistorialOps(h);
}

/* ==================== TOAST (Notificación emergente Premium) ==================== */
function mostrarToast(msg){
  let t = document.getElementById("toastPrecio");
  
  if(!t){
    t = document.createElement("div");
    t.id = "toastPrecio";
    // Estilos base: Cristal oscuro, sombra suave y animación de entrada
    t.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translate(-50%, 40px);
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #f8fafc;
      padding: 14px 22px;
      border-radius: 16px;
      font-weight: 800;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
      opacity: 0;
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Efecto rebote cuco */
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-align: center;
      max-width: 90%;
      box-sizing: border-box;
    `;
    document.body.appendChild(t);
  }
  
  // Si el mensaje tiene un emoji de alerta o error, le ponemos un borde rojizo sutil
  if(msg.includes("❌") || msg.includes("⚠️") || msg.includes("Error")) {
    t.style.border = "1px solid rgba(239, 68, 68, 0.4)";
    t.style.boxShadow = "0 10px 30px -5px rgba(0,0,0,0.6), 0 0 0 1px rgba(239, 68, 68, 0.2)";
  } else {
    t.style.border = "1px solid rgba(74, 222, 128, 0.3)";
    t.style.boxShadow = "0 10px 30px -5px rgba(0,0,0,0.6), 0 0 0 1px rgba(74, 222, 128, 0.2)";
  }

  t.innerHTML = msg;

  // Animación de subida
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translate(-50%, 0)";
  });

  // Temporizador para ocultarlo (y limpiar si se llama varias veces rápido)
  if(t.timeoutId) clearTimeout(t.timeoutId);
  t.timeoutId = setTimeout(() => { 
    t.style.opacity = "0"; 
    t.style.transform = "translate(-50%, 30px)";
  }, 2600); // 2.6 segundos en pantalla
}

/* ==================== OCR (LECTURA DE PRECIO POR IMAGEN) ==================== */
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
  } catch(e){ console.warn("⚠️ Precalentado OCR falló:", e && e.message); }
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
  } catch(e){ console.warn("Portapapeles no disponible:", e && e.name); }
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
        if(m.status === "recognizing text") mostrarOCRModal("🔎 Leyendo… " + Math.round(m.progress * 100) + "%", false);
      }
    });
    const texto = (resultado && resultado.data && resultado.data.text) || "";
    const importe = extraerImporte(texto);
    if(importe == null){
      const preview = (texto || "").replace(/\s+/g, " ").trim().slice(0, 200);
      mostrarOCRModal(
        "❌ No he podido leer el precio." +
        "<div style='font-size:11px;color:#94a3b8;margin-top:10px;padding:8px;background:#0f172a;border-radius:6px;text-align:left;word-break:break-word;max-height:120px;overflow:auto'>" +
        "<b style='color:#38bdf8'>Texto detectado:</b><br>" + (preview || "(vacío)") + "</div>" +
        "<div style='font-size:12px;color:#94a3b8;margin-top:10px'>Prueba con otra captura o escríbelo a mano.</div>", true
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
    (sinHoras.match(/\b\d{2,3}\b/g) || []).map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 2 && n <= 300).forEach(n => candidatos.push(n));
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