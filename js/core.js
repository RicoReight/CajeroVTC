"use strict";

/* ==================== ALMACENAMIENTO Y CONSTANTES ==================== */
const safeStorage = {
  get(k){ try { return localStorage.getItem(k) } catch(e){ return null } },
  set(k,v){ try { localStorage.setItem(k,v) } catch(e){} },
  remove(k){ try { localStorage.removeItem(k) } catch(e){} }
};

const denominations = [
  {c:10000,n:"100 €",short:"100€",type:"bill",class:"b-100"},{c:5000,n:"50 €",short:"50€",type:"bill",class:"b-50"},
  {c:2000,n:"20 €",short:"20€",type:"bill",class:"b-20"},{c:1000,n:"10 €",short:"10€",type:"bill",class:"b-10"},
  {c:500,n:"5 €",short:"5€",type:"bill",class:"b-5"},{c:200,n:"2 €",short:"2 €",type:"coin",class:"c-200"},
  {c:100,n:"1 €",short:"1 €",type:"coin",class:"c-100"},{c:50,n:"0,50 €",short:"0.50",type:"coin",class:"c-gold"},
  {c:20,n:"0,20 €",short:"0.20",type:"coin",class:"c-gold"},{c:10,n:"0,10 €",short:"0.10",type:"coin",class:"c-gold"},
  {c:5,n:"0,05 €",short:"0.05",type:"coin",class:"c-copper"},{c:2,n:"0,02 €",short:"0.02",type:"coin",class:"c-copper"},
  {c:1,n:"0,01 €",short:"0.01",type:"coin",class:"c-copper"}
];

const RESERVA_DEFAULT = {10000:0,5000:0,2000:1,1000:1,500:1,200:2,100:2,50:3,20:5,10:5,5:3,2:3,1:5};
const TOPES_DEFAULT = {1:30,2:30,5:30,10:25,20:25,50:20,100:20,200:20,500:8,1000:8,2000:5,5000:3,10000:2};
const ARRANQUE = {10000:0,5000:0,2000:2,1000:3,500:4,200:5,100:8,50:8,20:15,10:15,5:10,2:10,1:15};

/* ==================== VARIABLES GLOBALES DE ESTADO ==================== */
let stock = loadStock(), totalTips = loadTips(), reservaMinima = loadReserva(), topesRecibir = loadTopes();
let hucha = loadHucha();
let diaReset = loadDiaReset(), ultimoResetPropinas = loadUltimoResetPropinas(), statsOps = loadStats();
let resetSkip = parseInt(safeStorage.get("uberCambioResetSkip")) || 0;
let modoEdicion = safeStorage.get("uberCambioModoEdicion") === "1";
let diasNoTrabajados = loadDiasNoTrabajados();
let festivos = loadFestivos();
let diasPersonales = loadDiasPersonales();
let diasVacacionesAsignados = loadVacacionesAsignados();

let received=[], pendingTransaction=null, stockInputs=[], reservaInputs=[], summaryTimer=null, precioInterval=null, precioActual=0;
let propinasDelCambio = {}, tipManual = 0;
let cambioState={aEntregar:{},aRecibir:{},modo:null,orden:[],ordenRecibir:[],sinDatos:false};
let __recomendacionCambio = { entregar: {}, pedir: {} };
let reponerState={viajes:20,colchon:3,marcados:{},modo:"auto",manualAdd:{},importeManual:0};
let movimientoState={tipo:"entrada",motivo:"propina",piezas:{}};
let peajeState = { fase: 1, importe: 0, pagado: null, cambioRecibido: {} };

/* ==================== FUNCIONES DE CARGA (LOAD) ==================== */
function loadStock(){const s=safeStorage.get("uberCambioStock");if(s){try{const a=JSON.parse(s);if(Array.isArray(a)&&a.length===denominations.length)return a.map(x=>Math.max(0,parseInt(x)||0))}catch(e){}}return[0,0,2,3,4,10,10,20,40,10,10,10,10]}
function loadTips(){return parseInt(safeStorage.get("uberCambioTips"))||0}
function loadReserva(){const b=Object.assign({},RESERVA_DEFAULT);const s=safeStorage.get("uberCambioReserva");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object")denominations.forEach(d=>{if(typeof o[d.c]==="number")b[d.c]=Math.max(0,parseInt(o[d.c])||0)})}catch(e){}}return b}
function loadTopes(){const b=Object.assign({},TOPES_DEFAULT);const s=safeStorage.get("uberCambioTopes");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object")denominations.forEach(d=>{if(typeof o[d.c]==="number")b[d.c]=Math.max(0,parseInt(o[d.c])||0)})}catch(e){}}return b}
function loadHucha(){const s=safeStorage.get("uberCambioHucha");if(s){try{const a=JSON.parse(s);if(Array.isArray(a)&&a.length===denominations.length)return a.map(x=>Math.max(0,parseInt(x)||0))}catch(e){}}return new Array(denominations.length).fill(0)}
function loadDiaReset(){const n=parseInt(safeStorage.get("uberCambioDiaReset"));return (n>=0&&n<=31)?n:20}
function loadUltimoResetPropinas(){return safeStorage.get("uberCambioUltimoResetPropinas")||null}
function loadStats(){const s=safeStorage.get("uberCambioStats");if(s){try{const o=JSON.parse(s);if(o&&Array.isArray(o.received)&&Array.isArray(o.spent)){return{operations:parseInt(o.operations)||0,received:o.received.map(x=>parseInt(x)||0),spent:o.spent.map(x=>parseInt(x)||0),deposited:Array.isArray(o.deposited)?o.deposited.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),repuesto:Array.isArray(o.repuesto)?o.repuesto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),cambioNeto:Array.isArray(o.cambioNeto)?o.cambioNeto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),manualIn:Array.isArray(o.manualIn)?o.manualIn.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0),manualOut:Array.isArray(o.manualOut)?o.manualOut.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0)}}}catch(e){}}return{operations:0,received:new Array(denominations.length).fill(0),spent:new Array(denominations.length).fill(0),deposited:new Array(denominations.length).fill(0),repuesto:new Array(denominations.length).fill(0),cambioNeto:new Array(denominations.length).fill(0),manualIn:new Array(denominations.length).fill(0),manualOut:new Array(denominations.length).fill(0)}}
function loadDiasNoTrabajados(){const s=safeStorage.get("uberCambioDiasNoTrabajados");if(s){try{const a=JSON.parse(s);if(Array.isArray(a))return a.map(Number).filter(n=>n>=0&&n<=6)}catch(e){}}return [0,1]}
function loadFestivos(){const s=safeStorage.get("uberCambioFestivos");if(s){try{const arr=JSON.parse(s);if(Array.isArray(arr)){return arr.map(f=>({fechaDisfrute:null,sacrificado:false,aprobado:false,...f}))}}catch(e){}}return [];}
function loadDiasPersonales(){const s=safeStorage.get("uberCambioDiasPersonales");if(s){try{const arr=JSON.parse(s);if(Array.isArray(arr))return arr}catch(e){}}return []}
function loadVacacionesAsignados(){const s=safeStorage.get("uberCambioVacacionesAsignadas");if(s){try{const o=JSON.parse(s);if(o&&typeof o==="object"&&!Array.isArray(o))return o}catch(e){}}return {}}
function loadHistorialOps(){const s=safeStorage.get("uberCambioHistorialOps");if(s){try{const arr=JSON.parse(s);if(Array.isArray(arr))return arr}catch(e){}}return []}
function loadCambios(){const s=safeStorage.get("uberCambioCambios");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function loadCierres(){const s=safeStorage.get("uberCambioCierres");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function loadHistoricoResets(){const s=safeStorage.get("uberCambioHistoricoResets");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}
function loadPeajesHistorial(){const s=safeStorage.get("uberCambioPeajesHistorial");if(s){try{return JSON.parse(s)||[]}catch(e){return[]}}return[]}

/* ==================== FUNCIONES DE GUARDADO (SAVE) ==================== */
function saveStock(){safeStorage.set("uberCambioStock",JSON.stringify(stock));scheduleCashSummary()}
function saveTips(){safeStorage.set("uberCambioTips",String(totalTips))}
function saveReserva(){safeStorage.set("uberCambioReserva",JSON.stringify(reservaMinima));scheduleCashSummary();if(received.length)calculate()}
function saveTopes(){safeStorage.set("uberCambioTopes",JSON.stringify(topesRecibir))}
function saveHucha(){safeStorage.set("uberCambioHucha",JSON.stringify(hucha))}
function saveDiaReset(){safeStorage.set("uberCambioDiaReset",String(diaReset))}
function saveUltimoResetPropinas(){safeStorage.set("uberCambioUltimoResetPropinas",ultimoResetPropinas||"")}
function saveStats(){safeStorage.set("uberCambioStats",JSON.stringify(statsOps))}
function saveResetSkip(){safeStorage.set("uberCambioResetSkip",String(resetSkip))}
function saveDiasNoTrabajados(){safeStorage.set("uberCambioDiasNoTrabajados",JSON.stringify(diasNoTrabajados))}
function saveFestivos(){safeStorage.set("uberCambioFestivos",JSON.stringify(festivos));try{programarAvisosFestivos()}catch(e){};try{actualizarBotonCochePrincipal()}catch(e){}}
function saveDiasPersonales(){safeStorage.set("uberCambioDiasPersonales",JSON.stringify(diasPersonales))}
function saveVacacionesAsignados(){safeStorage.set("uberCambioVacacionesAsignadas",JSON.stringify(diasVacacionesAsignados))}
function saveHistorialOps(h){safeStorage.set("uberCambioHistorialOps",JSON.stringify(h))}
function saveCambios(c){safeStorage.set("uberCambioCambios",JSON.stringify(c))}
function saveCierres(c){safeStorage.set("uberCambioCierres",JSON.stringify(c))}
function saveHistoricoResets(h){safeStorage.set("uberCambioHistoricoResets",JSON.stringify(h))}
function savePeajesHistorial(h){safeStorage.set("uberCambioPeajesHistorial",JSON.stringify(h))}

/* ==================== UTILIDADES ==================== */
function moneyText(c){return(c/100).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}
function fechaLocalStr(d){if(!d)d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+dd}
function formatearFechaBonita(fechaStr){const p=fechaStr.split("-");const meses=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];const dd=String(parseInt(p[2])).padStart(2,"0");const mm=String(parseInt(p[1])).padStart(2,"0");return dd+"/"+mm+"/"+p[0]+" ("+meses[parseInt(p[1])-1]+")"}
function sumarMesesExacto(fecha,meses){const d=new Date(fecha.getTime());const dia=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+meses);const ultimoDia=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(dia,ultimoDia));return d}
function esDiaNoTrabajado(fechaStr){const p=fechaStr.split("-");const d=new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2]));return diasNoTrabajados.includes(d.getDay())}