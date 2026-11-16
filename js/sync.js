// js/sync.js
// Detecta si estamos en el PC (la URL es una IP numérica)
const esPC = window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) !== null;

if (esPC) {
  console.log("💻 Modo PC/Tablet detectado.");
  
  const apiSyncUrl = `http://${window.location.hostname}:${window.location.port || 8080}/sync`;
  const apiGetDataUrl = `http://${window.location.hostname}:${window.location.port || 8080}/get-all-data`;

  // 1. Si es la primera vez que carga, descargar datos del móvil
  if (!localStorage.getItem("uberCambioSincronizado")) {
    console.log("📥 Descargando datos iniciales del móvil...");
    document.body.innerHTML = "<div style='display:flex;height:100vh;justify-content:center;align-items:center;color:#4ade80;font-family:sans-serif;font-size:24px;'>Sincronizando datos del móvil... ⏳</div>";
    
    fetch(apiGetDataUrl)
      .then(res => res.json())
      .then(datos => {
        for (const key in datos) {
          localStorage.setItem(key, datos[key]);
        }
        localStorage.setItem("uberCambioSincronizado", "1");
        location.reload(); // Recargamos para que la app lea los datos nuevos
      })
      .catch(e => {
        console.error("Error descargando datos:", e);
        document.body.innerHTML = "<div style='display:flex;height:100vh;justify-content:center;align-items:center;color:#ef4444;font-family:sans-serif;'>❌ Error al conectar con el móvil. Asegúrate de que el Modo Web está activo.</div>";
      });
  } else {
    // 2. Si ya tenemos datos, abrir directamente el calendario y activar diseño PC
    setTimeout(() => {
      document.body.classList.add('modo-desktop');
      
      // Ocultar pantalla principal y abrir Días de trabajo
      const appPrincipal = document.querySelector('.app');
      if (appPrincipal) appPrincipal.style.display = 'none';
      
      if (typeof abrirDiasPantalla === 'function') {
        abrirDiasPantalla();
      }
    }, 100);

    // 3. Interceptar guardados para enviarlos al móvil
    const guardarOriginal = safeStorage.set;
    safeStorage.set = function(k, v) {
      guardarOriginal.call(safeStorage, k, v); 
      
      fetch(apiSyncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, value: v })
      }).catch(e => console.warn("❌ No se pudo enviar al móvil:", e));
    };
  }
}