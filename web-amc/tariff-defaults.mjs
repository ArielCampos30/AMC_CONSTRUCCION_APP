export const DEFAULT_TARIFF_META=Object.freeze({
 region:'La Falda / Valle de Punilla, Córdoba',
 baseDate:'2026-09-12',
 revision:'septiembre-2026-v2',
 basis:'Referencias comerciales AMC de mano de obra vigentes a septiembre de 2026. Se toma deliberadamente el tramo medio/alto de los rangos publicados para evitar presupuestar por debajo del mercado. Materiales no incluidos salvo indicación expresa.',
 note:'Son valores de referencia, no precios cerrados. Ajustar por complejidad, acceso, urgencia, traslado, altura, estado previo y condiciones reales de obra. En gas y trabajos reglamentados interviene profesional matriculado cuando corresponde.',
 sources:Object.freeze([
  'Clickie · precios de oficios actualizados a septiembre 2026, con relevamientos que incluyen Córdoba',
  'Metro Obra · costos de construcción en Córdoba, edición septiembre 2026 con datos al 31/08/2026',
  'ICC Córdoba / DGEyC · costo de construcción de Córdoba, último dato publicado en agosto 2026',
  'Todo Resuelto · tablas de mano de obra vigentes a septiembre 2026',
  'Servidos · referencias de mercado de herrería 2026'
 ])
});

export const DEFAULT_TARIFF_RUBRICS=Object.freeze([
 Object.freeze({id:'construccion-integral',name:'Construcción integral'}),
 Object.freeze({id:'albanileria',name:'Albañilería'}),
 Object.freeze({id:'plomeria',name:'Plomería'}),
 Object.freeze({id:'herreria',name:'Herrería'}),
 Object.freeze({id:'electricidad',name:'Electricidad'}),
 Object.freeze({id:'gas',name:'Gas'}),
 Object.freeze({id:'pintureria',name:'Pinturería'})
]);

const rows=[
 // Construcción integral
 ['int-llave-mano-mo','construccion-integral','Mano de obra integral vivienda tradicional llave en mano - sin materiales','m²',600000,'Referencia para una vivienda desde cero con mano de obra coordinada hasta terminación: replanteo, fundaciones, estructura, mampostería, techos, revoques, pisos/revestimientos, instalaciones y pintura. No incluye materiales, proyecto/honorarios, tasas, conexiones, estudios ni trabajos extraordinarios. Debe cerrarse con cómputo y planos.'],
 ['int-obra-gris-mo','construccion-integral','Mano de obra integral de obra gris - sin materiales','m²',390000,'Referencia para estructura, mampostería, cubierta y trabajos base hasta obra gris. Alcance exacto a definir por proyecto; no incluye materiales ni terminaciones finales.'],

 // Albañilería
 ['alb-visita','albanileria','Visita técnica y presupuesto','servicio',30000,'Relevamiento inicial en obra.'],
 ['alb-jornal','albanileria','Jornal de albañil oficial','jornal',50000,'Referencia comercial diaria de mano de obra para Punilla; ayudante, cargas, traslado o especialidad pueden modificar el valor.'],
 ['alb-pared-hueco','albanileria','Levantar pared de ladrillo hueco','m²',20000,'Solo mano de obra; no incluye materiales ni estructura especial.'],
 ['alb-revoque-grueso','albanileria','Revoque grueso','m²',15000,'Solo mano de obra; valor comercial AMC dentro del tramo alto de referencias de septiembre.'],
 ['alb-revoque-fino','albanileria','Revoque fino','m²',12000,'Solo mano de obra sobre base apta.'],
 ['alb-revoque-completo','albanileria','Revoque completo grueso + fino','m²',20000,'Solo mano de obra.'],
 ['alb-contrapiso-carpeta','albanileria','Contrapiso + carpeta','m²',19000,'Solo mano de obra; espesor y nivelación normales.'],
 ['alb-ceramico','albanileria','Colocación de cerámicos','m²',16500,'Solo colocación; base preparada, cortes y diseños especiales aparte.'],
 ['alb-porcelanato','albanileria','Colocación de porcelanato','m²',28000,'Solo colocación; cortes especiales, gran formato y nivelación compleja se cotizan aparte.'],
 ['alb-grietas','albanileria','Reparación de grietas y fisuras','m²',15000,'Referencia para reparación superficial; primero verificar causa y estabilidad.'],
 ['alb-encadenado','albanileria','Ejecución de encadenado','ml',21000,'Solo mano de obra; armadura, hormigón y encofrado especial aparte.'],

 // Plomería
 ['plo-visita','plomeria','Visita técnica y diagnóstico','servicio',25000,'Diagnóstico inicial; puede descontarse si se contrata el trabajo.'],
 ['plo-hora','plomeria','Hora de plomero','hora',45000,'Referencia comercial de mano de obra; urgencia y traslado aparte.'],
 ['plo-canilla','plomeria','Cambio de canilla simple','unidad',55000,'Solo mano de obra; sin grifería ni flexibles.'],
 ['plo-destape','plomeria','Destape simple de pileta o inodoro','unidad',52000,'Sin máquina especial ni apertura de cañería.'],
 ['plo-griferia','plomeria','Cambio de grifería completa','unidad',60000,'Solo mano de obra.'],
 ['plo-perdida-visible','plomeria','Reparación de pérdida visible','unidad',70000,'No incluye rotura ni recomposición de revestimientos.'],
 ['plo-perdida-empotrada','plomeria','Reparación de pérdida en cañería empotrada','unidad',85000,'Referencia base comercial; acceso, rotura y recomposición se cotizan aparte.'],
 ['plo-inodoro','plomeria','Instalación de inodoro completo','unidad',65000,'Solo mano de obra; conexión existente en condiciones.'],
 ['plo-presurizadora','plomeria','Instalación de bomba o presurizador','unidad',105000,'Solo mano de obra y puesta en servicio básica.'],
 ['plo-bano','plomeria','Renovación integral de plomería de baño','servicio',1200000,'Referencia de mano de obra para recambio integral de agua y desagües del baño; artefactos, materiales, albañilería y alcance final se cotizan según obra.'],

 // Herrería
 ['her-visita','herreria','Visita y relevamiento de herrería','servicio',30000,'Medición y diagnóstico inicial.'],
 ['her-soldadura-simple','herreria','Reparación o soldadura simple','servicio',70000,'Trabajo menor en obra; materiales y consumibles especiales aparte.'],
 ['her-soldadura-media','herreria','Soldadura y reparación de complejidad media','servicio',110000,'Referencia para varias uniones o reparación estructural menor.'],
 ['her-reja-fabricacion','herreria','Fabricación de reja de hierro - mano de obra','m²',85000,'No incluye hierro, pintura, traslado ni colocación. La sección y el diseño pueden cambiar fuertemente el valor.'],
 ['her-reja-colocacion','herreria','Colocación de reja','m²',55000,'Base de colocación normal; anclajes especiales y trabajo en altura aparte.'],
 ['her-porton-reparacion','herreria','Reparación de portón metálico','unidad',140000,'Referencia comercial según herrajes, soldaduras, alineación y estado previo.'],
 ['her-estructura-liviana','herreria','Fabricación de estructura metálica liviana - mano de obra','m²',110000,'Referencia inicial; requiere medición y cálculo según sección, uniones y carga.'],

 // Electricidad
 ['ele-visita','electricidad','Visita técnica y diagnóstico eléctrico','servicio',45000,'Diagnóstico inicial y presupuesto.'],
 ['ele-hora','electricidad','Hora de electricista','hora',50000,'Referencia comercial; urgencia, matrícula y traslado pueden modificar el valor.'],
 ['ele-punto','electricidad','Colocación o recambio de toma / interruptor','punto',22000,'Solo mano de obra; instalación existente accesible.'],
 ['ele-luminaria','electricidad','Instalación de luminaria o plafón simple','unidad',32000,'Solo mano de obra.'],
 ['ele-termica','electricidad','Cambio de llave térmica o disyuntor','unidad',42000,'Solo mano de obra; tablero en condiciones.'],
 ['ele-corto','electricidad','Diagnóstico y reparación de cortocircuito','servicio',77000,'Referencia alta del rango de septiembre; puede variar según tiempo de búsqueda y acceso.'],
 ['ele-pat','electricidad','Puesta a tierra domiciliaria','servicio',72000,'Solo mano de obra y verificación básica; jabalina y materiales aparte.'],
 ['ele-tablero','electricidad','Instalación de tablero principal 4 a 6 circuitos','unidad',220000,'Mano de obra de armado, canalización y conexión; materiales aparte.'],
 ['ele-cableado','electricidad','Recableado completo de monoambiente','servicio',250000,'Referencia alta de septiembre de mano de obra; depende de cantidad de bocas y canalizaciones.'],
 ['ele-dci','electricidad','Certificado DCI / declaración de conformidad eléctrica','servicio',220000,'Referencia para intervención de electricista matriculado; adecuaciones necesarias se cotizan aparte.'],

 // Gas
 ['gas-visita','gas','Visita de gasista matriculado','servicio',58000,'Trabajos de gas deben ser realizados/certificados por profesional matriculado cuando corresponda.'],
 ['gas-cocina','gas','Conexión de cocina o anafe','unidad',120000,'Solo mano de obra; requiere gasista matriculado y condiciones reglamentarias.'],
 ['gas-calefon','gas','Conexión o instalación de calefón','unidad',130000,'Solo mano de obra; conducto, materiales y adecuaciones aparte.'],
 ['gas-termotanque','gas','Cambio o instalación de termotanque a gas','unidad',115000,'Solo mano de obra; materiales y adecuaciones aparte.'],
 ['gas-calefactor','gas','Instalación de calefactor tiro balanceado','unidad',132000,'Referencia alta del rango de septiembre; perforación y zinguería especial aparte.'],
 ['gas-hermeticidad','gas','Prueba de hermeticidad completa','servicio',123000,'Debe realizarla un profesional habilitado.'],
 ['gas-perdida','gas','Detección y reparación de pérdida de gas','servicio',125000,'Referencia base comercial; materiales, roturas y adecuaciones reglamentarias aparte.'],
 ['gas-service-calefon','gas','Service y limpieza de calefón','unidad',85000,'Limpieza, revisión y regulación básica.'],
 ['gas-habilitacion','gas','Habilitación o rehabilitación de servicio','servicio',360000,'Referencia de mano de obra y gestión; tasas, materiales y adecuaciones no incluidos.'],

 // Pinturería
 ['pin-interior','pintureria','Pintura interior látex - 2 manos','m²',16000,'Solo mano de obra sobre superficie en buen estado; referencia comercial cercana al tramo alto de septiembre.'],
 ['pin-techo','pintureria','Pintura de cielorraso / techo','m²',13000,'Solo mano de obra; altura normal.'],
 ['pin-exterior','pintureria','Pintura exterior','m²',11500,'Solo mano de obra; altura y andamios pueden modificar el valor.'],
 ['pin-enduido','pintureria','Pintura interior con enduido y lijado','m²',17000,'Preparación + terminación estándar; reparar humedad se cotiza aparte.'],
 ['pin-dano','pintureria','Preparación de pared con humedad o daño severo','m²',15000,'Referencia de mano de obra; primero resolver la causa de humedad.'],
 ['pin-puerta','pintureria','Pintura de puerta con marco','unidad',60000,'Mano de obra con preparación normal; materiales aparte.'],
 ['pin-reja','pintureria','Pintura de reja con esmalte','m²',19000,'Incluye preparación manual normal; óxido severo se cotiza aparte.'],
 ['pin-preparacion','pintureria','Lijado y preparación superficial','m²',6000,'Preparación liviana previa a pintura.']
];

export const DEFAULT_TARIFF_ITEMS=Object.freeze(rows.map(([id,rubricId,tarea,unidad,precio,obs])=>Object.freeze({
 id,rubricId,tarea,unidad,precio,tipo:'mano_obra',fecha:DEFAULT_TARIFF_META.baseDate,obs
})));
