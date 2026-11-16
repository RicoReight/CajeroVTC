📑 Resumen de la Estructura (Guárdalo en un .md)
01. core.js (El motor): Constantes del dinero (billetes, monedas), variables globales del estado (stock, propinas, festivos), funciones de guardar/cargar en el móvil, y utilidades de texto y fechas.

02. calculadora.js (Pantalla principal): Todo lo que pasa cuando das al botón de "Calcular", el algoritmo para dar el cambio, el botón de guardar operación y la lectura de precios por OCR.

03. caja.js (Menú Caja): La lista de billetes que tienes, el aviso de que tienes muchas monedas (para mandarlas a la hucha) y las recomendaciones inteligentes según tu aprendizaje.

04. calendario.js (Días de trabajo): El calendario visual, la lógica de vacaciones, festivos, días personales y la importación de archivos .ics.

05. herramientas.js (Herramientas): Todo lo de esta pestaña: Depósitos, Modo Peaje, Reponer Caja, Cambiar Billetes, PINs de tarjetas, Hucha y el diagnóstico.

06. mapa.js (Mapas): Toda la lógica del GPS, el mapa de Leaflet, los polígonos (AMB, ZBE) y el historial de rutas.

07. sistema.js (Sistema y arranque): El panel de reseteos, los borrados de historial, la configuración de notificaciones push y la función init() que arranca la app.