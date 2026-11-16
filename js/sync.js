// www/sync.js
// Detecta si estamos abriendo la app desde la IP del móvil (PC o Tablet)
const esPC = window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) !== null;

if (esPC) {
  console.log("💻 Modo PC detectado.");
  document.body.classList.add('modo-desktop');

  const apiSyncUrl = `http://${window.location.hostname}:${window.location.port || 8080}/sync`;
  const apiGetDataUrl = `http://${window.location.hostname}:${window.location.port || 8080}/get-all-data`;

  // 1. PANTALLA DE CARGA: Descargar datos del móvil cada vez que entras
  const loader = document.createElement('div');
  loader.style.cssText = "position:fixed;inset:0;background:#0f172a;z-index:999999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#4ade80;font-family:sans-serif;font-size:20px;";
  loader.innerHTML = "Sincronizando con el móvil... ⏳<br><span style='font-size:14px;color:#94a3b8;margin-top:10px;'>Descargando última versión</span>";
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
        // Si había datos nuevos, recargamos para que la app los lea desde el principio
        location.reload();
      } else {
        // Si ya estábamos actualizados, quitamos el cartel de carga
        loader.remove();
      }
    })
    .catch(e => {
      console.error("Error:", e);
      loader.innerHTML = "<span style='color:#ef4444;font-size:24px;'>❌ Sin conexión con el móvil</span><br><span style='font-size:14px;color:#94a3b8;margin-top:10px;'>Asegúrate de que el Modo Web está activado.</span>";
    });

  // 2. ENVIAR DATOS AL MÓVIL: Cuando guardas algo en el PC
  const guardarOriginal = safeStorage.set;
  safeStorage.set = function(k, v) {
    guardarOriginal.call(safeStorage, k, v);
    fetch(apiSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, value: v })
    }).catch(e => console.warn("❌ No se pudo enviar al móvil:", e));
  };

  // 3. RECIBIR DATOS EN VIVO: Cada 3 segundos miramos si el móvil ha cambiado
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
          console.log("🔄 Cambios detectados en el móvil. Actualizando PC...");
          location.reload(); // Recarga la pantalla para mostrar lo nuevo
        }
      }).catch(e => {}); // Silencioso si el móvil se desconecta
  }, 3000);
}