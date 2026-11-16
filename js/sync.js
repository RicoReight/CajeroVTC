// js/sync.js
const esPC = window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) !== null;

if (esPC) {
  console.log("💻 Modo PC detectado. Sincronización activa.");
  document.body.classList.add('modo-desktop');

  // Inyectar CSS para que no se solape
  const style = document.createElement('style');
  style.innerHTML = `
    body.modo-desktop:has(#diasPantalla[style*="display: block"]) .app { display: none !important; }
    body.modo-desktop #diasPantalla { background: #0f172a !important; }
  `;
  document.head.appendChild(style);

  const apiSyncUrl = `http://${window.location.hostname}:8080/sync`;
  const apiGetDataUrl = `http://${window.location.hostname}:8080/get-all-data`;

  // Función para abrir el calendario al entrar
  function abrirCalendarioPC() {
    const app = document.querySelector('.app');
    if (app) app.style.display = 'none';
    if (typeof abrirDiasPantalla === 'function') abrirDiasPantalla();
  }

  // 1. Descargar datos al entrar
  const loader = document.createElement('div');
  loader.style.cssText = "position:fixed;inset:0;background:#0f172a;z-index:999999;display:flex;justify-content:center;align-items:center;color:#4ade80;font-family:sans-serif;font-size:20px;";
  loader.innerHTML = "Sincronizando con el móvil... ⏳";
  document.body.appendChild(loader);

  fetch(apiGetDataUrl)
    .then(res => res.json())
    .then(datos => {
      let cambios = false;
      for (const key in datos) {
        if (localStorage.getItem(key) !== datos[key]) {
          localStorage.setItem(key, datos[key]);
          cambios = true;
        }
      }
      if (cambios) {
        location.reload();
      } else {
        loader.remove();
        abrirCalendarioPC();
      }
    })
    .catch(e => {
      console.error("Error al conectar:", e);
      loader.innerHTML = "<span style='color:#ef4444;'>❌ Sin conexión con el móvil. ¿Modo Web activo?</span>";
    });

  // 2. Enviar cambios al móvil
  const guardarOriginal = safeStorage.set;
  safeStorage.set = function(k, v) {
    guardarOriginal.call(safeStorage, k, v);
    console.log("📤 Enviando al móvil:", k);
    fetch(apiSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, value: v })
    }).catch(e => console.warn("❌ Error al enviar:", e));
  };

  // 3. Recibir cambios en vivo (cada 3s)
  setInterval(() => {
    fetch(apiGetDataUrl)
      .then(res => res.json())
      .then(datos => {
        let cambios = false;
        for (const key in datos) {
          if (localStorage.getItem(key) !== datos[key]) {
            localStorage.setItem(key, datos[key]);
            cambios = true;
          }
        }
        if (cambios) {
          console.log("🔄 Cambios detectados desde el móvil. Recargando...");
          location.reload(); 
        }
      }).catch(e => {}); 
  }, 3000);
}