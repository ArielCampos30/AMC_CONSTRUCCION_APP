export const DEFAULT_TARIFF_META=Object.freeze({
 region:'La Falda / Valle de Punilla, Córdoba',
 baseDate:'2026-09-12',
 basis:'Referencias iniciales de mano de obra. Materiales no incluidos salvo indicación expresa.',
 note:'Valores de referencia comercial para iniciar presupuestos. Deben ajustarse según complejidad, acceso, urgencia, traslado y condiciones reales de obra.',
 sources:Object.freeze([
  'CPIC Córdoba · costos por rubro 2026',
  'Relevamientos de mercado Córdoba 2026 · Clickie',
  'Relevamientos de mercado Córdoba 2026 · Tegu',
  'Relevamientos de mercado Córdoba 2026 · Servidos',
  'Relevamientos de mercado Córdoba 2026 · Todo Resuelto'
 ])
});

export const DEFAULT_TARIFF_RUBRICS=Object.freeze([
 Object.freeze({id:'albanileria',name:'Albañilería'}),
 Object.freeze({id:'plomeria',name:'Plomería'}),
 Object.freeze({id:'herreria',name:'Herrería'}),
 Object.freeze({id:'electricidad',name:'Electricidad'}),
 Object.freeze({id:'gas',name:'Gas'}),
 Object.freeze({id:'pintureria',name:'Pinturería'})
]);

const rows=[
 // Albañilería
 ['alb-visita','albanileria','Visita técnica y presupuesto','servicio',20000,'Relevamiento inicial en obra.'],
 ['alb-jornal','albanileria','Jornal de albañil oficial','jornal',52000,'Referencia diaria de mano de obra.'],
 ['alb-pared-hueco','albanileria','Levantar pared de ladrillo hueco','m²',20000,'Solo mano de obra; no incluye materiales ni estructura especial.'],
 ['alb-revoque-grueso','albanileria','Revoque grueso','m²',9000,'Solo mano de obra.'],
 ['alb-revoque-fino','albanileria','Revoque fino','m²',7000,'Solo mano de obra sobre base apta.'],
 ['alb-revoque-completo','albanileria','Revoque completo grueso + fino','m²',16000,'Solo mano de obra.'],
 ['alb-contrapiso-carpeta','albanileria','Contrapiso + carpeta','m²',14500,'Solo mano de obra; espesor y nivelación normales.'],
 ['alb-ceramico','albanileria','Colocación de cerámicos','m²',13000,'Solo colocación; base preparada.'],
 ['alb-porcelanato','albanileria','Colocación de porcelanato','m²',24500,'Solo colocación; cortes especiales se cotizan aparte.'],
 ['alb-grietas','albanileria','Reparación de grietas y fisuras','m²',10500,'Referencia para reparación superficial; primero verificar causa y estabilidad.'],

 // Plomería
 ['plo-visita','plomeria','Visita técnica y diagnóstico','servicio',22000,'Diagnóstico inicial; puede descontarse si se contrata el trabajo.'],
 ['plo-hora','plomeria','Hora de plomero','hora',42000,'Solo mano de obra.'],
 ['plo-canilla','plomeria','Cambio de canilla simple','unidad',45000,'Solo mano de obra; sin grifería ni flexibles.'],
 ['plo-destape','plomeria','Destape simple de pileta o inodoro','unidad',44000,'Sin máquina especial ni apertura de cañería.'],
 ['plo-griferia','plomeria','Cambio de grifería completa','unidad',50000,'Solo mano de obra.'],
 ['plo-perdida-visible','plomeria','Reparación de pérdida visible','unidad',60000,'No incluye rotura ni recomposición de revestimientos.'],
 ['plo-perdida-empotrada','plomeria','Reparación de pérdida en cañería empotrada','unidad',75000,'Referencia base; acceso, rotura y recomposición se cotizan aparte.'],
 ['plo-inodoro','plomeria','Instalación de inodoro completo','unidad',35000,'Solo mano de obra; conexión existente en condiciones.'],
 ['plo-presurizadora','plomeria','Instalación de bomba o presurizador','unidad',55000,'Solo mano de obra y puesta en servicio básica.'],
 ['plo-bano','plomeria','Renovación de plomería de baño','servicio',1050000,'Referencia de mano de obra para reforma integral; cotizar alcance exacto.'],

 // Herrería
 ['her-visita','herreria','Visita y relevamiento de herrería','servicio',20000,'Medición y diagnóstico inicial.'],
 ['her-soldadura-simple','herreria','Reparación o soldadura simple','servicio',45000,'Trabajo menor en obra; materiales y consumibles especiales aparte.'],
 ['her-soldadura-media','herreria','Soldadura y reparación de complejidad media','servicio',65000,'Referencia para varias uniones o reparación estructural menor.'],
 ['her-reja-fabricacion','herreria','Fabricación de reja de hierro - mano de obra','m²',55000,'No incluye hierro, pintura, traslado ni colocación.'],
 ['her-reja-colocacion','herreria','Colocación de reja','m²',35000,'Base de colocación normal; anclajes especiales aparte.'],
 ['her-porton-reparacion','herreria','Reparación de portón metálico','unidad',90000,'Referencia base según herrajes, soldaduras y alineación.'],
 ['her-estructura-liviana','herreria','Fabricación de estructura metálica liviana - mano de obra','m²',75000,'Referencia inicial; requiere medición y cálculo según sección y carga.'],

 // Electricidad
 ['ele-visita','electricidad','Visita técnica y diagnóstico eléctrico','servicio',40000,'Diagnóstico inicial y presupuesto.'],
 ['ele-hora','electricidad','Hora de electricista','hora',50000,'Solo mano de obra.'],
 ['ele-punto','electricidad','Colocación o recambio de toma / interruptor','punto',19000,'Solo mano de obra; instalación existente accesible.'],
 ['ele-luminaria','electricidad','Instalación de luminaria o plafón simple','unidad',29000,'Solo mano de obra.'],
 ['ele-termica','electricidad','Cambio de llave térmica o disyuntor','unidad',34000,'Solo mano de obra; tablero en condiciones.'],
 ['ele-corto','electricidad','Diagnóstico y reparación de cortocircuito','servicio',85000,'Referencia base; puede variar según tiempo de búsqueda.'],
 ['ele-pat','electricidad','Puesta a tierra domiciliaria','servicio',120000,'Solo mano de obra y verificación básica; materiales aparte.'],
 ['ele-tablero','electricidad','Instalación de tablero principal 4 a 6 circuitos','unidad',315000,'Mano de obra de armado, canalización y conexión; materiales aparte.'],
 ['ele-cableado','electricidad','Recableado completo de monoambiente','servicio',180000,'Referencia de mano de obra; depende de cantidad de bocas y canalizaciones.'],

 // Gas
 ['gas-visita','gas','Visita de gasista matriculado','servicio',45000,'Trabajos de gas deben ser realizados/certificados por profesional matriculado cuando corresponda.'],
 ['gas-cocina','gas','Conexión de cocina o anafe','unidad',95000,'Solo mano de obra; requiere gasista matriculado y condiciones reglamentarias.'],
 ['gas-calefon','gas','Conexión o instalación de calefón','unidad',148000,'Solo mano de obra; conducto, materiales y adecuaciones aparte.'],
 ['gas-termotanque','gas','Cambio o instalación de termotanque a gas','unidad',135000,'Solo mano de obra; materiales y adecuaciones aparte.'],
 ['gas-calefactor','gas','Instalación de calefactor tiro balanceado','unidad',110000,'Referencia base; perforación y zinguería especial aparte.'],
 ['gas-hermeticidad','gas','Prueba de hermeticidad completa','servicio',95000,'Debe realizarla un profesional habilitado.'],
 ['gas-perdida','gas','Detección y reparación de pérdida de gas','servicio',90000,'Referencia base; materiales y roturas adicionales aparte.'],
 ['gas-service-calefon','gas','Service y limpieza de calefón','unidad',80000,'Limpieza, revisión y regulación básica.'],
 ['gas-habilitacion','gas','Habilitación o rehabilitación de servicio','servicio',350000,'Referencia de mano de obra y gestión; tasas/materiales no incluidos.'],

 // Pinturería
 ['pin-interior','pintureria','Pintura interior látex - 2 manos','m²',5500,'Solo mano de obra sobre superficie en buen estado.'],
 ['pin-techo','pintureria','Pintura de cielorraso / techo','m²',6500,'Solo mano de obra; altura normal.'],
 ['pin-exterior','pintureria','Pintura exterior','m²',7500,'Solo mano de obra; altura y andamios pueden modificar el valor.'],
 ['pin-enduido','pintureria','Pintura interior con enduido y lijado','m²',11000,'Preparación + terminación estándar; reparar humedad se cotiza aparte.'],
 ['pin-dano','pintureria','Preparación de pared con humedad o daño severo','m²',15500,'Referencia de mano de obra; primero resolver la causa de humedad.'],
 ['pin-puerta','pintureria','Pintura de puerta con marco','unidad',50000,'Mano de obra con preparación normal; materiales aparte.'],
 ['pin-reja','pintureria','Pintura de reja con esmalte','m²',12000,'Incluye preparación manual normal; óxido severo se cotiza aparte.'],
 ['pin-preparacion','pintureria','Lijado y preparación superficial','m²',3000,'Preparación liviana previa a pintura.']
];

export const DEFAULT_TARIFF_ITEMS=Object.freeze(rows.map(([id,rubricId,tarea,unidad,precio,obs])=>Object.freeze({
 id,rubricId,tarea,unidad,precio,tipo:'mano_obra',fecha:DEFAULT_TARIFF_META.baseDate,obs
})));
