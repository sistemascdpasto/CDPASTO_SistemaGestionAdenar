<?php

namespace App\Support\Chatbot;

/**
 * Base de conocimiento del chatbot: el contenido integro del "Folleto 2026 -
 * Entrevista Reparto" (CD Pasto) mas el "Cuestionario para entrevistas en
 * Check to Coach" (Almacen: metas de productividad, GOB/SCO/Tool Kit de
 * Inventarios, picking), transcritos en preguntas y respuestas.
 *
 * En vez de inyectar el folleto completo en cada peticion al modelo (excede
 * el limite de tokens por minuto del plan gratuito de Groq), buscarRelevantes()
 * hace una seleccion simple por coincidencia de palabras clave entre la
 * pregunta del usuario y cada entrada, y solo esas se agregan al contexto.
 *
 * Si el folleto cambia (nueva ronda de indicadores, nuevas encuestas, etc.),
 * actualizar el arreglo ENTRADAS es suficiente -- no requiere tocar el
 * controlador.
 */
class DpoFaqKnowledgeBase
{
    /**
     * Palabras que se ignoran al comparar la pregunta del usuario con las
     * entradas del folleto -- son demasiado genericas para discriminar tema
     * (aparecen en casi todas las preguntas del folleto).
     */
    private const STOPWORDS = [
        'que', 'cual', 'cuales', 'como', 'donde', 'cuando', 'quien', 'quienes',
        'por', 'para', 'con', 'sin', 'sus', 'una', 'uno', 'unos', 'unas',
        'los', 'las', 'del', 'esta', 'esto', 'estos', 'estas', 'ese',
        'esa', 'esos', 'esas', 'hay', 'les', 'nos', 'son', 'fue', 'ser',
        'hacer', 'puede', 'pueden', 'puedo', 'tiene', 'tienen', 'tengo',
        'the', 'and', 'cada', 'todo', 'toda', 'todos', 'todas', 'desde',
        'hasta', 'sobre', 'entre', 'otro', 'otra', 'otros', 'otras',
    ];

    /**
     * @var array<int, array{seccion: string, pregunta: string, respuesta: string}>
     */
    private const ENTRADAS =
        [
            0 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Qué es DPO?',
                'respuesta' => 'Es un manual de operaciones en el cual encontramos la manera correcta para medir y ejecutar los diferentes procesos y métodos en la actividad de distribución. Es simplemente cómo hacer las cosas. Se divide en 7 partes o pilares: PEOPLE, SEGURIDAD, REPARTO, ALMACÉN, PLANEACIÓN, FLOTA y GESTIÓN.',
            ],
            1 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Cuál es el modelo DPO y cuáles son sus 7 pilares?',
                'respuesta' => 'Los 7 pilares son: 1) Gente, 2) Seguridad, 3) Reparto, 4) Almacén, 5) Planeación, 6) Flota, 7) Gestión.',
            ],
            2 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Cuál es nuestro sueño?',
                'respuesta' => 'Ser el mejor Centro de Distribución de Colombia en nuestro clúster nivel 4 para el año 2027. Nos destacaremos por brindar un excelente servicio (NPS > 70%), realizar entregas eficientes y a tiempo (OTIF > 95%) y mantener una cultura de seguridad sólida (TRI = 0). Lograremos este objetivo gracias al compromiso, pasión y disciplina de nuestra gente.',
            ],
            3 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Cuál es la variable para conductores, RR y auxiliares y en dónde la pueden ver?',
                'respuesta' => 'Auxiliares: $50.000. RR: $140.000. Conductores: $120.000. Se gana cumpliendo con los indicadores establecidos de los pilares de Seguridad, People, Reparto y Flota. Se puede visualizar en el dashboard compartido en los grupos de la empresa.',
            ],
            4 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Si presentas alguna novedad en pagos de nómina a quién nos podemos dirigir?',
                'respuesta' => 'Con el equipo de Recursos Humanos de la empresa.',
            ],
            5 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Cómo puede conectar sus objetivos con su compensación?',
                'respuesta' => 'Con los indicadores que me cancelan puedo trabajar con mis objetivos de mejora en el servicio y la experiencia de nuestros clientes, alineando mis metas personales con los resultados que la empresa espera. Me enfoco en cumplir y superar mis indicadores de desempeño, asegurando que mi trabajo genere valor.',
            ],
            6 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Sabes qué es el programa de comunicación?',
                'respuesta' => 'Son todas las actividades programadas durante el año para generar Engagement, lideradas por el área de Recursos Humanos para el Pilar de People. En el buzón o link de ideas y sugerencias diligenciamos todas las ideas y/o sugerencias que podríamos implementar en nuestra operación o CD.',
            ],
            7 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Qué es el banco de ideas?',
                'respuesta' => 'Las ideas más innovadoras que se registran en el buzón de ideas y sugerencias son premiadas y ejecutadas en el QR del programa de banco de ideas o buenas prácticas.',
            ],
            8 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Qué es la encuesta Engagement?',
                'respuesta' => 'Es una encuesta que ejecuta nuestra empresa a sus colaboradores en la cual analiza el nivel de satisfacción de ellos con la empresa (¿me siento orgulloso(a) de trabajar en la compañía?, ¿me siento reconocido(a) por mi trabajo?). La última encuesta se realizó en el primer semestre del 2026, en abril, con una puntuación de 79.94%.',
            ],
            9 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Sabías cuál es la encuesta de servicios generales?',
                'respuesta' => 'Es una encuesta aplicada por Bavaria S.A. dirigida a los colaboradores, en la cual se toman sus opiniones sobre las instalaciones en el centro de distribución, como baños, iluminación e instalaciones de servicio. La última encuesta se realizó en el primer semestre del 2026, en mayo, con una puntuación de 67.17%.',
            ],
            10 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Qué es SKAP?',
                'respuesta' => 'Es un programa que mide los conocimientos y habilidades de los colaboradores. Tiene 3 etapas: 1) Inducción funcional (3 niveles), 2) Inducción técnica (3 niveles), 3) Operador autónomo (4 niveles).',
            ],
            11 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Conoce su progreso y qué le falta para cerrar los GAPS en SKAP?',
                'respuesta' => 'Se puede conocer en la aplicación Safety 360. Para cerrar los GAPS se debe cumplir con cada una de las capacitaciones de los niveles que aún no se logran conseguir.',
            ],
            12 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => '¿Qué es política antidiscriminación?',
                'respuesta' => 'Es el documento donde se establece que en nuestra empresa toda persona es bienvenida y aceptada sin importar su color de piel, edad, preferencia sexual o religión. Esta política se creó para convivir en un entorno donde prevalezca el respeto. Si existe algún irrespeto se puede comunicar y notificar en la línea de ética.',
            ],
            13 => [
                'seccion' => 'DPO Y MODELO GENERAL',
                'pregunta' => 'Vacaciones, ¿cómo puedo solicitarlas?',
                'respuesta' => 'Al cumplirse un año de trabajo se otorgan vacaciones, después de la fecha de contratación. Si se quiere solicitar el periodo de vacaciones, hay que comunicarse con el área de Recursos Humanos.',
            ],
            14 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Exámenes de ingreso y periódicos, ¿cada cuánto se los hacen?',
                'respuesta' => 'Al ingresar se ejecutan exámenes generales y de columna, y cada año la empresa programa un examen periódico para saber cómo se encuentra el cuerpo del colaborador. Si llega a presentarse una novedad, la empresa lo notifica.',
            ],
            15 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Seguridad psicológica y el comportamiento inclusivo, ¿qué son?',
                'respuesta' => 'La seguridad psicológica es sentirse libre para hablar, compartir ideas y asumir riesgos. La inclusión es el comportamiento que reconoce, entiende y valora las diferencias, y promueve la participación de todos.',
            ],
            16 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Compensación diaria y el logro de incentivos, ¿cómo funciona?',
                'respuesta' => 'Consiste en capacitar a los equipos para que asuman la RESPONSABILIDAD de impulsar la ejecución, permitiéndoles disponer de RECURSOS continuamente mejorados de tal manera que logren sus metas de referencia, y además comprometiéndolos mediante la RECOMPENSA por estos logros.',
            ],
            17 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué pasa cuando no cumples un indicador?',
                'respuesta' => 'Se realiza una retroalimentación por parte del área de reparto y se miran planes de acción de mejora. Adicionalmente se realiza la herramienta de los 5 por qué para determinar la causa raíz.',
            ],
            18 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Conoce y puede explicar cuál es el sueño del CD y los KPIs definidos para apalancar el cumplimiento del sueño?',
                'respuesta' => 'Clúster nivel 4. NPS > 70%. OTIF ≥ 95%. TRI = 0.',
            ],
            19 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Desde su rol qué impacto tiene para lograr el cumplimiento del sueño?',
                'respuesta' => 'Generando un buen servicio en cada uno de nuestros clientes y siempre teniendo presente la seguridad.',
            ],
            20 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Conoce sobre la metodología de 3R?',
                'respuesta' => 'Es capacitar a los equipos para que asuman la RESPONSABILIDAD de impulsar la ejecución, permitiéndoles disponer de RECURSOS continuamente mejorados de tal manera que logren sus metas de referencia, y además comprometiéndolos mediante la RECOMPENSA por estos logros.',
            ],
            21 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cómo conectas cada R en tu rol?',
                'respuesta' => 'Cumpliendo mis tareas con responsabilidad, mediante los recursos que me da la compañía para hacerlas de la manera más óptima, logrando recompensas donde se incluyen mis reconocimientos.',
            ],
            22 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Línea ética, ¿para qué sirve?',
                'respuesta' => 'Es donde se pueden denunciar irregularidades como trato inadecuado, acoso sexual, y todo acto irregular. Cuenta con un mecanismo de denuncia establecido y debidamente comunicado a todos los empleados (R1.1.2), un propósito, una gestión, canales disponibles (correo electrónico, línea telefónica 01 8000 518 8370) y tratamiento confidencial de la información recibida.',
            ],
            23 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué es el comité de gente?',
                'respuesta' => 'Está conformado por cada uno de los líderes de la empresa y ABI, en el cual invitan a un compañero de reparto para que acompañe la reunión que se realiza una vez al mes, donde se debaten temas sobre capacitaciones, actividades programadas para el mes, indicadores de People, y se pueden llevar novedades presentadas en la operación.',
            ],
            24 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuáles son nuestros peligros prioritarios?',
                'respuesta' => 'Tránsito, Biomecánicos, Psicosocial, Públicos (robos, atracos).',
            ],
            25 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuáles son nuestras políticas?',
                'respuesta' => 'Política SST: prevenir accidentes y enfermedades, mejorar continuamente y cumplir con los requisitos legales. Política de prevención de consumo de alcohol, tabaco y sustancias psicoactivas: se prohíbe el porte, comercialización o consumo de estas sustancias durante la jornada laboral, y presentarse a trabajar bajo sus efectos.',
            ],
            26 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Pirámide de seguridad, ¿cuáles son sus términos?',
                'respuesta' => 'FAT: fatalidad, muerte del colaborador. LTI: accidente que genera una incapacidad médica. MDI: accidente que genera modificación del cargo. MTI: accidente con tratamiento médico que no genera incapacidad ni restricciones médicas. FAI: accidente con primeros auxilios (uso del botiquín). ACIS: reportes de Actos y Condiciones Inseguras y Seguras. TRI: unión de LTI, MDI o MTI. SIF: está presente en toda la pirámide, representa la posible muerte del trabajador o una secuela o limitación permanente en su cuerpo.',
            ],
            27 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Recordemos, ¿qué es un SIF?',
                'respuesta' => 'SIF real: accidentes que se concretaron y que causaron lesiones o fatalidades. SIF potencial: accidentes que se concretaron y tuvieron el potencial de ser lesiones o fatalidades. SIF precursor: incidente o comportamiento que pueden ser potenciales lesiones graves o fatalidades.',
            ],
            28 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué son ACIS?',
                'respuesta' => 'Es una herramienta a través de la cual reportamos los actos inseguros y las condiciones inseguras que identificamos en nuestra operación. Este reporte se hace por la Safety App. La meta son 32 reportes mensuales.',
            ],
            29 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuándo y cuál fue el último accidente laboral?',
                'respuesta' => 'Conductor Iván Cristóbal Madroñero, 8 de octubre de 2025, LTI en Pasto.',
            ],
            30 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Integrantes de la brigada de emergencia, ¿quiénes son?',
                'respuesta' => 'Un integrante de la tripulación (conductor).',
            ],
            31 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué es el COPASST?',
                'respuesta' => 'Significa Comité Paritario de Seguridad y Salud en el Trabajo, en el cual se reúnen dos representantes por parte de la empresa y dos representantes por parte de los colaboradores, y se tratan temas de seguridad.',
            ],
            32 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Funciones del COPASST, ¿cuáles son?',
                'respuesta' => 'Proponer medidas y el desarrollo de actividades de promoción y prevención. Proponer actividades de capacitación en SST. Colaborar con los funcionarios de entidades gubernamentales de seguridad y salud en el trabajo. Vigilar el desarrollo de las actividades en materia de seguridad y salud en el trabajo. Analizar accidentes de trabajo y enfermedades profesionales y proponer al empleador las medidas correctivas.',
            ],
            33 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Capacidad de cargas, ¿cuál es?',
                'respuesta' => 'Producto o canasta 330: solo 2 en hombro. Producto 750 o 1000: solo 1 canasta. PET 1 litro: 1.',
            ],
            34 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Uso de la carretilla, ¿cómo es?',
                'respuesta' => 'No sobrecargar la carretilla. Emplear para cada producto la carga adecuada: máximo 5 canastas de producto 330, o 4 canastas de 750 o 1000. No más de 5 por temas de seguridad, para no obstruir la visibilidad y cuidar la carretilla.',
            ],
            35 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuál es la política de manejo de efectivo?',
                'respuesta' => 'No recibir ni contar dinero dentro del establecimiento del cliente. Montos máximos de $500.000 para trasladar hacia la caja fuerte. No se puede aceptar pagos en monedas superiores a $50.000. Solicitar acompañamiento policial por montos mayores de $3.500.000. En el bolsillo no se puede tener más de $110.000 (en billetes de 60.000 y 50.000, en monedas).',
            ],
            36 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Sabes qué es un pictograma?',
                'respuesta' => 'Es un dibujo o gráfico que expresa un peligro. Ejemplo: pictograma de ACPM–UREA.',
            ],
            37 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué hacer en caso de accidente?',
                'respuesta' => '1) Conserve la calma y evite otros riesgos. 2) Reporte al supervisor inmediato o responsable SST. 3) Espere indicaciones y la llegada al sitio; acuda a la atención médica para valoración. 4) Rinda la versión de los hechos y participe en la investigación. 5) Reporte el evento en CREDIT 360.',
            ],
            38 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Elementos de protección personal y su reposición, ¿cuáles son?',
                'respuesta' => 'Guantes, gafas, uniforme con reflectivos, casco, botas de seguridad.',
            ],
            39 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuándo fue la última capacitación y simulacro?',
                'respuesta' => 'Fecha del último simulacro nacional: 22 de octubre de 2025, en el CD Pasto. Tema: evacuación por sismos y terremotos.',
            ],
            40 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué son rutas críticas?',
                'respuesta' => 'Son aquellas rutas que tienen alto potencial de accidente, robos, o de difícil acceso.',
            ],
            41 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué hacer cuando hay muchos riesgos en una entrega o cliente?',
                'respuesta' => 'Se debe reportar al área SST, Supervisores y SAC las novedades identificadas, con el fin de programar una visita POC, evaluar los riesgos del establecimiento y definir medidas de seguridad.',
            ],
            42 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué es un cliente Cashless?',
                'respuesta' => 'Cliente en zonas N3 que solo puede realizar su pago a través de medios electrónicos. Está prohibido recibirle dinero en efectivo a un cliente Cashless.',
            ],
            43 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Prohibiciones en tareas de alto riesgo, ¿cuáles son?',
                'respuesta' => 'No estamos autorizados para: realizar trabajo en alturas (igual o superior a 1.5 m), ingresar a espacios confinados, manipular redes eléctricas, ni manipular herramientas mecánicas o de transporte de productos de los clientes.',
            ],
            44 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Conoce el programa Campeones de Seguridad?',
                'respuesta' => 'Para ser campeón de seguridad se requiere: tripulación sin TRI\'S (LTI+MDI+MTI), reporte de incidentes, uso de todos los Elementos de Protección Personal y dotación de la tripulación, reporte de mínimos vitales, asistencia y participación en capacitaciones, reportes ACIS, y no tener eventos de telemetría.',
            ],
            45 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Funciones de un campeón de seguridad de almacén o reparto, ¿cuáles son?',
                'respuesta' => 'Ser líder de seguridad de la tripulación: garantizar los comportamientos seguros en ruta, reportar todo accidente/incidente/acto/condición insegura, sensibilizar a sus compañeros cuando incumplan temas de seguridad, cuidar y velar por la seguridad de la tripulación, e informar requerimientos de seguridad de los tripulantes.',
            ],
            46 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Santo y seña?',
                'respuesta' => 'Es lo que se debe reportar si se está en una situación de peligro. La palabra clave es: "Tránsito normal".',
            ],
            47 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Para qué sirve la Safety App?',
                'respuesta' => 'Para realizar los reportes de actos y condiciones inseguras (ACIS), y para la realización de las inducciones de SKAP y la ejecución de las OWD.',
            ],
            48 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Regreso seguro a casa, frecuencia y temas de capacitación, ¿cuáles son?',
                'respuesta' => 'Frecuencia de capacitación: 3 veces al año (febrero, mayo y agosto). Temas: límites de velocidad, uso de EPP, uso de cinturón, respetar las señales de tránsito, tener al día el SOAT, el técnico mecánica y la licencia de conducción.',
            ],
            49 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cada cuánto hacen pruebas de botón de pánico?',
                'respuesta' => 'Todas las semanas, los sábados.',
            ],
            50 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué es el Día Mundial de la Seguridad?',
                'respuesta' => 'Se celebra el 28 de abril, y se realiza para promover la prevención de los accidentes y las enfermedades laborales en todo el mundo.',
            ],
            51 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué es la Semana de la Seguridad?',
                'respuesta' => 'Es una semana donde se abordan diferentes temas para gestión de riesgos asociados a seguridad industrial y salud en el trabajo. Se realizan actividades participativas y procesos de formación.',
            ],
            52 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Conoce cuáles son los parámetros de conducción segura?',
                'respuesta' => 'Hábitos de conducción regulares: aceleraciones bruscas, frenados bruscos, ralentí excesivo. Hábitos de conducción críticos: excesos de velocidad, giros bruscos, no uso del cinturón de seguridad. Alertas dashcam: no uso de cinturón, consumo de alimentos mientras conduce, distracción al conducir, 4 tripulantes en cabina, uso del celular, manipulación u obstrucción de la cámara.',
            ],
            53 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Parqueo seguro, ¿cómo es?',
                'respuesta' => 'Instalar conos, prender estacionarias, cabina asegurada, vidrios arriba, camión apagado y llaves en el bolsillo, inspección 360 antes de arrancar.',
            ],
            54 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Parqueo seguro en curva, pendientes y vías de doble carril, ¿cómo es?',
                'respuesta' => 'Está prohibido parquear en curvas. Para parqueo en pendientes: llantas hacia el andén, poner un cambio de seguridad, usar el freno de mano, uso de tacos en las llantas, dejar bloqueada la dirección hacia el andén, uso de conos (uno adelante y uno atrás, a 1 metro del vehículo), y poner las luces de parqueo.',
            ],
            55 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuáles son los pasos del protocolo de reversa?',
                'respuesta' => 'No está permitido realizar reversa dentro del CD. Para descarga donde un cliente, la reversa se debe realizar con apoyo de un auxiliar, quien desciende del vehículo, se ubica en el andén a 5 m para dar señales al conductor, en un lugar visible utilizando una paleta de PARE/SIGA; el conductor debe estar siempre mirando los espejos y lunas; al terminar de estacionar, dejar un cambio de seguridad, usar el freno de mano, subir los vidrios y despegar.',
            ],
            56 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => 'Límites de velocidad, ¿cuáles son?',
                'respuesta' => 'CD: 10 km/h. Veredas: 25 km/h. Curvas: 20 km/h. Ciudad: 45 km/h. Vía nacional: 55 km/h.',
            ],
            57 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Conoce y puede explicar cuáles son sus roles para desarrollar CIL?',
                'respuesta' => 'CIL significa limpieza, inspección y lubricación.',
            ],
            58 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuál es el proceso crítico de flota?',
                'respuesta' => '% de adherencia al checklist de retorno (actividad crítica) y el número de vehículos que no realizan el checklist de retorno.',
            ],
            59 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Cuál es la tarea crítica de flota?',
                'respuesta' => 'Diagnóstico de mantenimiento ejecutado.',
            ],
            60 => [
                'seccion' => 'SEGURIDAD',
                'pregunta' => '¿Qué son HCI?',
                'respuesta' => 'HCI son los hábitos de conducción insegura, que se dividen en 2: críticos y regulares. Regulares: frenadas bruscas, aceleraciones bruscas, ralentí excesivo. Críticos: excesos de velocidad (curva, CD, ciudad, vía nacional), no uso de cinturón, giro brusco, comportamientos inseguros con cámara (uso del celular, comer, cinturón, manipulación de la cámara).',
            ],
            61 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => 'Vamos a conocer, ¿qué son las 5-S?',
                'respuesta' => 'Es la metodología que nos enseña a ejecutar orden y aseo en el vehículo, con 5 pasos: 1) Clasificar, 2) Organizar, 3) Limpiar, 4) Estandarización, 5) Mantener. El área de Flota ejecuta una inspección semanal y da el resultado en la calcomanía de 5-S pegada en el vidrio de la parte de atrás de las sillas, donde 100 es el puntaje más alto. Meta de productividad y eficiencia: 85%.',
            ],
            62 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Qué es un rutograma?',
                'respuesta' => 'Es el documento gráfico que muestra los peligros que hay en nuestra ruta. El desplazamiento se reporta en la matinal.',
            ],
            63 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Conoce y puede explicar cuáles son las actividades que usted puede realizar en la estación ATO y qué valor agrega al estado de flota?',
                'respuesta' => 'La estación ATO es la zona delimitada en azul con borde amarillo que se encuentra en el parqueadero de camiones. En esta zona los conductores pueden realizar: 5S, inspección (mínimos vitales, niveles, fugas de aire o de líquidos), revisión y medición de llantas, cambio de bombillos y tapas stop, ajuste de espejos, lubricación de carpas y cortinas, y ajuste de tornillería.',
            ],
            64 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Conoce cuáles son los objetivos de sostenibilidad de ABI, qué KPI/PI de CD?',
                'respuesta' => 'Metas de sostenibilidad 2025: Gestión Hídrica, Agricultura Inteligente, Empaque Circular, Acción Climática, Emprendimiento.',
            ],
            65 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Qué es logística verde?',
                'respuesta' => 'Flota eléctrica, disminución de rendimiento de combustible en KgCO2/HL (consiste en mover más hectolitros con menos galones), retorno de envase. Son ideas y proyectos con elementos que se destinaban a desechar y se reutilizan con un fin para nuestra operación, generando reducción en costos o haciendo el trabajo más fácil. Ejemplos: checklist digital (ahorra papel), reutilizar carpas para parqueadero o bolsos, vehículos amables con el ambiente, uso de recipientes de urea para almacenamiento de PFN.',
            ],
            66 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Cuál es la meta del rendimiento de combustible?',
                'respuesta' => 'Para el CD Pasto es 11 km/gal. En el mes de julio estuvo en 11,07 km/gal.',
            ],
            67 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => 'Dígame buenas prácticas que mejoran el rendimiento de combustible.',
                'respuesta' => '1) Mantener las llantas bien calibradas. 2) No hacer excesos de RPM. 3) No exceder el ralentí a 5 minutos. 4) Realizar mantenimientos preventivos a tiempo (cambio de aceite motor y filtros). 5) Purgar la trampa de combustible.',
            ],
            68 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Cada cuánto se calibran las llantas?',
                'respuesta' => 'Se debe calibrar mínimo 2 veces al mes, por nuestro proveedor autorizado RENTING. FVR: 105 (todas). Internacional: 100 delantera y 110 traseras.',
            ],
            69 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿En qué momento se llena el checklist del vehículo?',
                'respuesta' => 'Salida: cada conductor debe realizar el checklist de salida antes de sacar el vehículo del CD. Retorno: al ingresar el vehículo después de terminar la ruta asignada, debe realizar el checklist preoperacional.',
            ],
            70 => [
                'seccion' => 'FLOTA, 5-S Y SOSTENIBILIDAD',
                'pregunta' => '¿Qué es estándar de flota?',
                'respuesta' => 'Son los requerimientos internos de la compañía para los vehículos. Se dividen en 5 sistemas: 1) Documentación del equipo, 2) Seguridad, 3) Calidad, 4) Señalización, 5) Imagen de marca.',
            ],
            71 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es una SOP?',
                'respuesta' => 'Es un documento que muestra la manera estándar de realizar un proceso. Para crearla participan los líderes y el equipo operativo.',
            ],
            72 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Dónde pueden ver las SOPs y cada cuánto se actualiza?',
                'respuesta' => 'Las SOPs se pueden ver en el tablero del team room y en los QRs pegados en el team room. Se actualizan cada 6 meses o cada vez que hay un cambio en el proceso.',
            ],
            73 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es una OPL?',
                'respuesta' => 'Es el paso a paso de un proceso, de manera resumida, con imágenes o fotografías. Ejemplo: uso del cinturón.',
            ],
            74 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es una OWD, quién las ejecuta?',
                'respuesta' => 'Es una encuesta en la que se observa y califica la ejecución de un proceso para tomar planes de acción. La realizan los líderes de operación: supervisores, coordinadores, safety y flota.',
            ],
            75 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué son herramientas de gestión y para qué se utilizan?',
                'respuesta' => 'Son herramientas que se utilizan para lograr el cumplimiento de un indicador. Se usan cuando no se cumple un indicador.',
            ],
            76 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Cuáles herramientas de gestión utilizan?',
                'respuesta' => '5 por qué, OWD, Espina de pescado, Action Log, OPL.',
            ],
            77 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es la herramienta 5 por qué?',
                'respuesta' => 'Es una herramienta de gestión que ayuda a identificar la causa raíz de un problema, generando 5 preguntas o posibles causales que llevan a la solución de raíz.',
            ],
            78 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es la herramienta de gestión DOFA?',
                'respuesta' => 'Herramienta de gestión donde se observan: Debilidades (internas), Oportunidades (externas), Fortalezas (internas), Amenazas (externas).',
            ],
            79 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es la herramienta de gestión espina de pescado?',
                'respuesta' => 'Herramienta que parece el esqueleto de un pescado, donde en la cabeza se pone la causa raíz o problema, y en las espinas los problemas que causa o impacta cada una.',
            ],
            80 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Cuándo se activa una herramienta de gestión?',
                'respuesta' => 'Cuando el indicador se sale del disparador, o cuando se llevan 3 días seguidos fuera de meta.',
            ],
            81 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿De qué trata el flujograma de procesos?',
                'respuesta' => 'Es un diagrama que permite entender el funcionamiento de un proceso; en este caso, el negocio de la distribución.',
            ],
            82 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es descripción del negocio?',
                'respuesta' => 'Es una visual (flujograma) de la descripción del negocio: todo el proceso logístico desde el primer paso hasta el último. Se compone de Proveedores/Entrada (insumos), Proceso (¿qué es el proceso?), Salidas (resultados) y Partes interesadas (clientes).',
            ],
            83 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Cómo afrontar un momento de crisis?',
                'respuesta' => 'Un momento de crisis es cuando se impacta la operación, como una protesta, una pandemia mundial o un terremoto. Para afrontarlo hay que tomar las cosas con tranquilidad, sin llevarle la contraria a los manifestantes.',
            ],
            84 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Te evalúan el procedimiento de entrega?',
                'respuesta' => 'Sí, por medio de una OWD.',
            ],
            85 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Cuándo fue la última vez que te evaluaron?',
                'respuesta' => 'En la última visita por parte del supervisor.',
            ],
            86 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Cómo es el proceso de recargues?',
                'respuesta' => 'Ingresa el vehículo, se lleva a bahía de cargue y descargue, se espera en la zona segura, el RR realiza el proceso de liquidación y, finalizado, se sale de nuevo a ruta. Meta: menos de 30 minutos. Durante el cargue o descargue se asegura de que no haya movimientos del vehículo ni que otra persona ingrese, para evitar un accidente.',
            ],
            87 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Hacen jornada de salud ocupacional? ¿Qué tipo de programas?',
                'respuesta' => 'Sí. Programa de tamizaje, optometría, y hábitos saludables.',
            ],
            88 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué es el plan padrino? ¿Cómo funciona?',
                'respuesta' => 'Es el acompañamiento que se le realiza a los colaboradores nuevos en cada una de sus funciones, para asegurar la correcta ejecución de estas. Este acompañamiento lo realiza el padrino, que es designado por su experiencia y el cumplimiento de sus metas.',
            ],
            89 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Para qué sirve el SDCA Toolbox?',
                'respuesta' => 'Es el "kit de herramientas" que sirve para mantener la estabilidad de los procesos, garantizando que se cumplan los estándares definidos antes de buscar mejoras. Se aplica para controlar y mejorar procesos existentes, asegurando el cumplimiento y corrigiendo desviaciones. Está ubicado al lado del tablero del 5 por qué, y sirve para guiar en la selección de las herramientas de gestión según los problemas o procesos que se estén trabajando.',
            ],
            90 => [
                'seccion' => 'GESTIÓN Y HERRAMIENTAS',
                'pregunta' => '¿Qué tipo de riesgos estamos expuestos en la operación?',
                'respuesta' => 'Riesgo público (hurtos, protestas, manifestaciones), riesgo de atropellamiento, volcaduras, conatos de incendio, caídas del mismo nivel y de diferente nivel, cortaduras.',
            ],
            91 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Cuál es el proceso de pre ruta?',
                'respuesta' => 'Es el proceso que se desarrolla antes de la ruta. Empieza con el ingreso al CD hasta que sale el vehículo del CD para la ruta.',
            ],
            92 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Qué indicador se mide en pre ruta? ¿Cuál es la meta?',
                'respuesta' => 'El indicador que se mide en el proceso de pre ruta es el TML (Tiempo Medio de Liberación). La meta es 59 minutos.',
            ],
            93 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Cuál es el proceso de post ruta? ¿Cuál es la meta?',
                'respuesta' => 'Es el proceso que se desarrolla después de la ruta: empieza desde que el vehículo ingresa al CD hasta que se realiza la marcación de salida en GeoVictoria. La meta es de 30 minutos. El indicador con el que se mide este tiempo es TR (Tiempo de Retorno), también llamado TV (Tiempo Vespertino) o TI (Tiempo Interno).',
            ],
            94 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Dónde pueden ver los indicadores digitales?',
                'respuesta' => 'Se envían a través del grupo de WhatsApp, o también por medio de la página de reparto.',
            ],
            95 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Qué hacen cuando tienen un indicador en azul? (herramienta de 5 por qué)',
                'respuesta' => 'Cuando un indicador está en azul, indica que no se cumplió la meta del indicador y se activa el disparador. Ante este caso se debe realizar una herramienta de gestión como el 5 por qué.',
            ],
            96 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿En dónde realizan las herramientas de 5 por qué?',
                'respuesta' => 'Los 5 por qué se realizan a través de la plataforma de Road Map, cuando no se cumple con los indicadores.',
            ],
            97 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Dónde puede ver la compensación variable? ¿Qué indicadores y qué meta tienen? ¿Cuánto pueden ganar si cumplen con todos los indicadores?',
                'respuesta' => 'La compensación variable se puede observar a través de la página de reparto y también a través de la plataforma o aplicación del Gran Prix. La ganancia de la variable es de $140.000 para Responsable de Ruta (RR), y $120.000 y $50.000 para Conductores y Auxiliares respectivamente.',
            ],
            98 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Cómo les evalúan la ejecución de las SOP o los procesos? (OWD)',
                'respuesta' => 'La evaluación de un proceso se realiza a través de la corrida de una OWD, evaluando el desempeño de las actividades diarias. No se han corrido OWD a los compañeros debido a que quienes pueden realizarlas son los líderes.',
            ],
            99 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Conocen el SDCA Toolbox? ¿Cómo lo usan? ¿En qué momento se usa?',
                'respuesta' => 'El SDCA Toolbox es el "kit de herramientas" que sirve para mantener la estabilidad de los procesos, garantizando que se cumplan los estándares definidos antes de buscar mejoras. Se aplica para controlar y mejorar procesos existentes.',
            ],
            100 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Saben qué es una GOP? ¿Cuáles GOP tenemos desde el proceso? ¿Cómo podemos aportar en las GOPs?',
                'respuesta' => 'Es una lista de chequeo de buenas prácticas que ayudan a mejorar los procesos. Impactamos en la GOP de OTIF y RMD.',
            ],
            101 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Dónde pueden ver las SOPs de reparto? ¿Cada cuánto se actualizan? ¿Podemos aportar a la modificación de la SOP?',
                'respuesta' => 'Las SOP de reparto se pueden ver por la página de reparto y también en el Team Room. Se deben actualizar cada año, o cada que haya una actualización o cambio en el desarrollo del proceso. Sí se puede aportar a la modificación de la SOP si el proceso desarrollado cambia.',
            ],
            102 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Qué se debe hacer cuando hay un rechazo? ¿Qué causales de rechazo se tienen?',
                'respuesta' => 'Ante la posibilidad de un rechazo se debe realizar la modulación o reporte a través de torre de control, para que se gestione con el cliente o la parte comercial. Las causales de rechazo son: sin dinero, mala calidad, no hizo pedido, sin envase, promesa de venta no cumplida, cerrado, mal facturado.',
            ],
            103 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Cuáles son los KPI del sueño? ¿En qué indicadores impactan mayormente?',
                'respuesta' => 'Los KPIs del sueño son NPS, OTIF y TRI. Los indicadores a los cuales impactamos son todos.',
            ],
            104 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Cómo aportan en el VLC desde el rol?',
                'respuesta' => 'Cuidando nuestras herramientas de trabajo y no trayendo rechazos, de esta manera se cuidan los costos de operación.',
            ],
            105 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Qué estrategias se tienen en el centro de distribución derivadas del DOFA?',
                'respuesta' => 'Cuidar nuestras herramientas de trabajo y no traer rechazos, de esta manera se cuidan los costos de operación.',
            ],
            106 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Conocen el mapa de procesos y la descripción del negocio? ¿Por qué está el espacio en amarillo?',
                'respuesta' => 'El mapa de procesos es el detalle de cómo realizar el proceso de un negocio. Está en amarillo porque es la tarea crítica dentro de cada negocio.',
            ],
            107 => [
                'seccion' => 'REPARTO: PRE RUTA, POST RUTA E INDICADORES',
                'pregunta' => '¿Qué es un SLA o acuerdo de servicio?',
                'respuesta' => 'Es un compromiso formal entre un proveedor de servicios y un cliente, que define los niveles de calidad y desempeño esperados para un servicio específico.',
            ],
            108 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Cuál es el proceso crítico y la tarea crítica?',
                'respuesta' => 'Proceso crítico: es el proceso clave que impacta directamente en los resultados (ejecución de entrega). Tarea crítica: es la actividad esencial dentro del proceso que debe ejecutarse correctamente para evitar problemas (la modulación).',
            ],
            109 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Por qué tenemos una columna de KPI y una de PI en el tablero diario? ¿Cómo impacta en el PI al KPI?',
                'respuesta' => 'Para saber a qué indicador más grande estamos impactando. Ejemplo: el % de modulación lo estamos impactando en el rechazo como KPI.',
            ],
            110 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Saben cómo cierran los KPIs en el mes?',
                'respuesta' => 'Sí, en el tablero mensual. Debajo de cada mes se encuentra el resultado del desempeño.',
            ],
            111 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Por qué no se cumplieron los KPIs?',
                'respuesta' => 'Hay varios factores, como: desviaciones en los procesos operativos, recursos insuficientes, fallas en la planificación o ejecución, problemas de comunicación o alineación.',
            ],
            112 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Los indicadores del tablero diario siempre son los mismos? ¿Por qué se modifican?',
                'respuesta' => 'No. Pueden cambiar dependiendo del desempeño del indicador durante el mes; si hay un cambio o mejora continua, se puede excluir del tablero diario.',
            ],
            113 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Conocen la herramienta de gestión de reporte de anormalidad? ¿Han participado en la ejecución de alguno?',
                'respuesta' => 'Es una herramienta que permite identificar, registrar y corregir desviaciones en los procesos. (Respuesta personal según cada colaborador).',
            ],
            114 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué es el protocolo SERVIR?',
                'respuesta' => 'El protocolo SERVIR indica cómo se debe proceder con la entrega, priorizando el servicio y a los clientes: S-Saludar, E-Explicar, R-Realizar, V-Verificar, I-Informar, R-Recibir.',
            ],
            115 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué es Rate My Delivery (RMD)?',
                'respuesta' => 'Es la calificación de los clientes ante la prestación del servicio de entrega, y se evalúa de 1 a 5 estrellas.',
            ],
            116 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué es un PFN?',
                'respuesta' => 'Un PFN es un producto fuera de norma, es decir, no cumple con las especificaciones, estándares o requisitos establecidos por la empresa.',
            ],
            117 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué es entrega en rango?',
                'respuesta' => 'Es la medición de facturar a los clientes en un rango menor a 30 metros.',
            ],
            118 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué es el resecuenciamiento dinámico?',
                'respuesta' => 'Es la forma en que se ordenan los clientes para hacer la ruta de manera más fácil. Recordemos: si estamos perdidos podemos activar Google Maps en el IREP o Waze en nuestros celulares.',
            ],
            119 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Cuál es la encuesta NPS?',
                'respuesta' => 'Es una encuesta dirigida a los clientes de Bavaria S.A., con varias preguntas de diferentes áreas, con el fin de calificar la percepción que tienen de la empresa. De acuerdo con su puntuación, la empresa los clasifica en 3 tipos: Clientes Detractores (inconformes, no quieren nada con Bavaria, califican de 0 a 6), Cliente Neutro (nivel medio, califica de 7 a 8), Cliente Promotor (feliz con la compañía, califica de 9 a 10).',
            ],
            120 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué es DQI y ZCP4?',
                'respuesta' => 'DQI: indicador que mide las roturas en ruta. ZCP4: diferencias logísticas en envase o producto.',
            ],
            121 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => 'Una queja, ¿cuál medio se utiliza?',
                'respuesta' => 'La aplicación de BEES, o la línea nacional 018000526555.',
            ],
            122 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Cuánto tiempo tenemos para responder una queja?',
                'respuesta' => '48 horas.',
            ],
            123 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Qué significa TML?',
                'respuesta' => 'El TML es el Tiempo Medio de Liberación: el tiempo que se dura desde que se llega en la mañana al CD hasta que se sale del CD a reparto. Incluye la ejecución de la matinal y el tiempo de verificación de la carga hasta la salida del vehículo. Meta: 45 minutos.',
            ],
            124 => [
                'seccion' => 'CALIDAD Y CLIENTE',
                'pregunta' => '¿Cuándo fue la última capacitación de calidad?',
                'respuesta' => 'En el mes de julio. Estas charlas dan recomendaciones de cómo tratar el producto y no dañarlo; por ejemplo, no tirar fuerte las latas porque se pueden fisurar o romper.',
            ],
            125 => [
                'seccion' => 'REPARTO: TR, TI Y RECHAZOS EN RUTA',
                'pregunta' => '¿Qué es el TR (Tiempo en Ruta)?',
                'respuesta' => 'Es el tiempo que dura el vehículo realizando la distribución. Tiene una meta de ejecución de ruta de 10 horas desde que sale del CD.',
            ],
            126 => [
                'seccion' => 'REPARTO: TR, TI Y RECHAZOS EN RUTA',
                'pregunta' => '¿Qué significa TI?',
                'respuesta' => 'El TI es el Tiempo Interno: el tiempo que se dura dentro del CD después de finalizar la ruta. Suma el checkin, arreglo y conteo de dinero, consignación de dinero, entrega y arreglo de papelería a OL y UC. Meta: 35 minutos.',
            ],
            127 => [
                'seccion' => 'REPARTO: TR, TI Y RECHAZOS EN RUTA',
                'pregunta' => '¿Qué haces cuando tienes un rechazo?',
                'respuesta' => 'Se debe reportar por medio de WhatsApp en el grupo de modulación, y esperar los tiempos establecidos: hasta 15 cajas, 15 minutos; de 15 a 50 cajas, 30 minutos; más de 50 cajas, 45 minutos.',
            ],
            128 => [
                'seccion' => 'REPARTO: TR, TI Y RECHAZOS EN RUTA',
                'pregunta' => '¿Conoces las causales de rechazo?',
                'respuesta' => 'Sí: cerrado, sin dinero, mal facturado, sin envase, no hizo pedido.',
            ],
            129 => [
                'seccion' => 'REPARTO: TR, TI Y RECHAZOS EN RUTA',
                'pregunta' => '¿Tienes alguna forma de informar problemas de ruta?',
                'respuesta' => 'Mediante los grupos de WhatsApp: para modulaciones, el grupo de modulación; para corrección de coordenadas, hay un grupo específico; para flota, hay otro. También Road Map para modular, y los buzones de sugerencia encontrados en el QR del vehículo.',
            ],

            // ── Cuestionario para entrevistas en Check to Coach (Almacén) ──
            130 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuál es el PI crítico de flota (montacargas)?',
                'respuesta' => 'El PI crítico de flota es el checklist preoperacional que debe realizarse antes de operar la máquina, al iniciar el turno.',
            ],
            131 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuál es la meta de rendimiento de combustible de los montacargas (GLP)?',
                'respuesta' => 'Meta de consumo de GLP Pasto: 5.2 Litros/Hora.',
            ],
            132 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Qué es Copla?',
                'respuesta' => 'Copla es una entidad que ofrece control de plagas en el centro de distribución. Cuentan con un sistema de trampas distribuidas en todas las áreas del CD, con controles semanales.',
            ],
            133 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Qué es el FNP y cómo se calcula?',
                'respuesta' => 'El FNP se calcula como Hecto litros / Horas montacargas.',
            ],
            134 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuáles son las metas de productividad de picking, sorting y vertimiento en Pasto?',
                'respuesta' => 'Picking: 340 cajas/hora. Picking MKTP: 370 cajas/hora. Sorting: 360 cajas/hora. Vertimiento lata: 40 cajas/hora. Vertimiento retornable: 70 cajas/hora. Vertimiento PET: 25 cajas/hora.',
            ],
            135 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuáles son las metas de productividad de reempaque y termoencogido en Pasto?',
                'respuesta' => 'Reempaque: 30 cajas/hora. Termoencogido: 120 cajas/hora.',
            ],
            136 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuál es la meta de errores de armado?',
                'respuesta' => '48 errores semanales.',
            ],
            137 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuál es la meta de TAT SIDER?',
                'respuesta' => '75 minutos.',
            ],
            138 => [
                'seccion' => 'ALMACÉN: METAS DE PRODUCTIVIDAD Y MONTACARGAS',
                'pregunta' => '¿Cuál es la meta de segundos viajes?',
                'respuesta' => '30 minutos.',
            ],
            139 => [
                'seccion' => 'ALMACÉN: GOB, SCO Y TOOL KIT DE INVENTARIOS',
                'pregunta' => '¿Qué es un PI dinámico?',
                'respuesta' => 'Es aquel PI que ayuda a apalancar un KPI que viene perforando (fallando) mal. Por ejemplo: si el KPI WNP terminó mal en agosto, se apalanca con un PI como la productividad de picking.',
            ],
            140 => [
                'seccion' => 'ALMACÉN: GOB, SCO Y TOOL KIT DE INVENTARIOS',
                'pregunta' => '¿Qué es una GOB y qué procesos evalúa?',
                'respuesta' => 'La GOB es una evaluación mensual de procesos que realiza el CD. Evalúa: Total Productivity Warehouse, SCO y Tool Kit de Inventarios.',
            ],
            141 => [
                'seccion' => 'ALMACÉN: GOB, SCO Y TOOL KIT DE INVENTARIOS',
                'pregunta' => '¿Qué preguntas evalúa la GOB de Total Productivity Warehouse?',
                'respuesta' => 'De monitoreo: si el DC revisa el menor rendimiento por actividad/tarea de almacén con análisis de causa raíz, y si sigue los KPIs de complejidad de carga entrante (tipo de transporte, SKUs por carga) definiendo acciones para reducirla. De ejecución: seguimiento a esos mismos KPIs de complejidad de carga entrante, y si el DC rastrea los errores de carga que causan reestructuraciones con análisis de causa raíz. De preparación: si se ha formado a los empleados de almacén en múltiples habilidades/tareas para mejorar la flexibilidad laboral, y si se ha usado la Herramienta de Optimización de Diseño para analizar la distribución del almacén y probar escenarios de mejora.',
            ],
            142 => [
                'seccion' => 'ALMACÉN: GOB, SCO Y TOOL KIT DE INVENTARIOS',
                'pregunta' => '¿Qué procesos evalúa la GOB de SCO?',
                'respuesta' => 'Evalúa: que las áreas de almacenamiento se mantengan entre 3°C y 25°C (los barriles de cerveza de barril en cámara fría según política de zona); que se minimice la exposición de productos a la luz solar; que los palés de madera con clavos sobresalientes u otros daños se retiren y separen de inmediato para reparación; y que la rotura de producto se registre y monitoree por empleado, tarea y razón, con análisis de causa raíz para los grupos de fallo más altos.',
            ],
            143 => [
                'seccion' => 'ALMACÉN: GOB, SCO Y TOOL KIT DE INVENTARIOS',
                'pregunta' => '¿Qué aspectos evalúa el Tool Kit de Inventarios?',
                'respuesta' => 'Evalúa: que exista un SOP bien documentado para el proceso de entrada de materiales (área receptora y de producción); un SOP para el proceso de transferencia de mercancías a otros almacenes o instalaciones de producción; un SOP para el proceso de inventario mientras las operaciones no se detienen completamente; y que los recuentos de inventario de productos terminados se realicen según la política (1 vez al mes).',
            ],
            144 => [
                'seccion' => 'ALMACÉN: PICKING Y CONTROL DE PRODUCTO',
                'pregunta' => '¿Qué es el ABC en picking?',
                'respuesta' => 'Es un sistema de colores que permite determinar la rotación del producto: letra A color verde (80%), letra B color amarillo (15%), letra C color naranja (5%). En la bodega de almacenamiento estos colores se identifican en el piso.',
            ],
            145 => [
                'seccion' => 'ALMACÉN: PICKING Y CONTROL DE PRODUCTO',
                'pregunta' => '¿Qué es una SOP en el centro de distribución?',
                'respuesta' => 'Es la descripción detallada de un proceso del centro de distribución, como reempaque, picking, sorting o vertimiento.',
            ],
            146 => [
                'seccion' => 'ALMACÉN: PICKING Y CONTROL DE PRODUCTO',
                'pregunta' => '¿Qué es WIP en el centro de distribución?',
                'respuesta' => 'Es una herramienta que permite medir las productividades del centro de distribución, como picking y errores de armado.',
            ],
            147 => [
                'seccion' => 'ALMACÉN: PICKING Y CONTROL DE PRODUCTO',
                'pregunta' => '¿Qué es SmartLift y qué mide la telemetría de los montacargas?',
                'respuesta' => 'La herramienta de telemetría de los montacargas se llama SmartLift. Con ella se pueden medir impactos, movimientos, ralentí, etc., y su impacto en la productividad del almacén. Los operadores de montacargas deben conocerla.',
            ],
            148 => [
                'seccion' => 'ALMACÉN: PICKING Y CONTROL DE PRODUCTO',
                'pregunta' => '¿Qué es la política de bloqueo?',
                'respuesta' => 'Es un control que permite identificar el producto vendible y no vendible. Se compone de 4 pasos: bloqueo en el sistema SAP, bloqueo mecánico, candados y tarjeta roja.',
            ],
            149 => [
                'seccion' => 'ALMACÉN: PICKING Y CONTROL DE PRODUCTO',
                'pregunta' => '¿Cuáles son los colores de las tarjetas de marcación y qué significan?',
                'respuesta' => 'Verde: despacho. Naranja: en espera. Rojo: producto bloqueado.',
            ],
        ];

    /**
     * @return array<int, array{seccion: string, pregunta: string, respuesta: string}>
     */
    public static function todas(): array
    {
        return self::ENTRADAS;
    }

    /**
     * Selecciona las entradas del folleto mas relacionadas con la pregunta
     * del usuario, por coincidencia simple de palabras clave (sin
     * dependencias externas ni embeddings -- suficiente para ~130 entradas
     * cortas). Las coincidencias en el enunciado de la pregunta del folleto
     * pesan mas que las coincidencias que solo aparecen en la respuesta.
     *
     * @return array<int, array{seccion: string, pregunta: string, respuesta: string}>
     */
    public static function buscarRelevantes(string $consultaUsuario, int $limite = 6): array
    {
        $palabrasConsulta = self::normalizar($consultaUsuario);

        if ($palabrasConsulta === []) {
            return [];
        }

        $puntuadas = [];

        foreach (self::ENTRADAS as $entrada) {
            $palabrasPregunta = self::normalizar($entrada['pregunta']);
            $palabrasRespuesta = self::normalizar($entrada['respuesta']);
            $puntaje = 0;

            foreach ($palabrasConsulta as $palabra) {
                if (in_array($palabra, $palabrasPregunta, true)) {
                    $puntaje += 3;
                } elseif (in_array($palabra, $palabrasRespuesta, true)) {
                    $puntaje += 1;
                }
            }

            if ($puntaje > 0) {
                $puntuadas[] = ['puntaje' => $puntaje, 'entrada' => $entrada];
            }
        }

        usort($puntuadas, fn (array $a, array $b) => $b['puntaje'] <=> $a['puntaje']);

        return array_map(fn (array $p) => $p['entrada'], array_slice($puntuadas, 0, $limite));
    }

    /**
     * @return list<string>
     */
    private static function normalizar(string $texto): array
    {
        $texto = mb_strtolower($texto, 'UTF-8');
        $texto = strtr($texto, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        ]);

        preg_match_all('/[a-z0-9]+/', $texto, $coincidencias);

        return array_values(array_unique(array_filter(
            $coincidencias[0],
            fn (string $palabra) => mb_strlen($palabra) > 2 && ! in_array($palabra, self::STOPWORDS, true)
        )));
    }
}
