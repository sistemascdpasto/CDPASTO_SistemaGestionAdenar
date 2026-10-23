<?php

return [
    // Resultado por encima de este valor se considera prueba positiva (HU039).
    'umbral_positivo' => 0.000,

    // Horas mínimas entre dos pruebas del mismo tipo para un mismo colaborador (HU029).
    'intervalo_minimo_horas' => 4,

    // Condición de salud: una entrada sin salida deja de contar como jornada abierta después
    // de estas horas (cubre turnos nocturnos y horas extra). Pasado ese tiempo la salida se
    // considera no registrada y el colaborador puede marcar su entrada del día siguiente, en
    // lugar de verse obligado a registrar una «salida» con su estado de salud de llegada.
    'horas_maximas_jornada' => (int) env('SEGURIDAD_HORAS_MAXIMAS_JORNADA', 16),

    // Días de anticipación para alertar sobre calibración/certificado próximos a vencer (HU019).
    'dias_alerta_calibracion' => 15,

    // Días de anticipación para alertar sobre contratos próximos a vencer (HU03).
    'dias_alerta_vencimiento_contrato' => 30,

    // Días de historial considerados para el índice de riesgo del colaborador (HU045).
    'dias_indice_riesgo' => 90,

    // Consentimiento de firma electrónica para el autorregistro de condición de
    // salud del colaborador. Texto de declaración de buena fe según HU030;
    // fundamento de la autorización de firma electrónica en los artículos 7
    // (Firma) y 28 (Atributos jurídicos de una firma digital) de la Ley 527 de
    // 1999. La versión se guarda junto con cada registro para que cambios
    // futuros al texto no alteren retroactivamente lo que el colaborador
    // aceptó en su momento (los registros existentes con 'v1' no se alteran).
    'consentimiento_condicion_salud' => [
        'version' => 'v2',
        'texto' => 'Como colaborador, manifiesto mi condición de salud actual bajo declaración de buena fe, para '
            .'permitir el registro y seguimiento de mi estado de salud conforme a los procedimientos establecidos '
            .'por la organización. Así mismo, de conformidad con el artículo 7 (Firma) y el artículo 28 (Atributos '
            .'jurídicos de una firma digital) de la Ley 527 de 1999, autorizo expresamente que la firma digital '
            .'capturada en mi última prueba de alcoholemia realizada sea utilizada como mi firma electrónica para '
            .'identificarme y manifestar mi aceptación del contenido de esta declaración de salud. Entiendo que el '
            .'sistema conservará la fecha, hora, dirección IP y la versión de este texto como evidencia de mi '
            .'aceptación.',
    ],

    // Catálogos del formulario multipaso de colaboradores (HU01/HU02). Se
    // mantienen aquí en vez de una tabla de base de datos porque las listas
    // del requerimiento original llegaron incompletas/recortadas: así se
    // pueden completar o corregir sin necesidad de una migración.
    'colaboradores' => [
        'cargos' => [
            'APRENDIZ SENA',
            'AUXILIAR ADMINISTRATIVO',
            'AUXILIAR CONTABLE',
            'AUXILIAR DE FLOTA',
            'AUXILIAR DE LIQUIDACIÓN',
            'AUXILIAR DE REPARTO',
            'AUXILIAR SST',
            'CALL CENTER',
            'CONDUCTOR',
            'CONDUCTOR DE REPARTO',
            'CONDUCTOR MULA',
            'CONTADORA',
            'COORDINADOR DE DESPACHO',
            'COORDINADOR DE FLOTA',
            'COORDINADOR DE LIQUIDACIÓN',
            'COORDINADOR DE REPARTO',
            'COORDINADORA SST',
            'JEFE DE BODEGA',
            'PROFESIONAL RH',
            'PROGRAMADOR',
            'RESPONSABLE DE REPARTO',
            'SUPERVISOR DE ÁREA',
        ],

        'centros' => [
            'UC',
            'UD',
            'KA',
            'SUR',
            'JL',
            'MOVILIZADOR',
            'INCAPACIDAD JL',
        ],

        'centros_trabajo' => [
            'Sura riesgo I',
            'Sura riesgo IV',
        ],

        'tipos_contrato' => [
            'Contrato a término indefinido',
            'Contrato a término fijo',
            'Contrato por duración de obra o labor determinada',
            'Contrato ocasional, accidental o transitorio',
            'Contrato de aprendizaje — SENA',
            'Contrato de Aprendiz',
        ],

        'motivos_retiro' => [
            'RENUNCIA VOLUNTARIA',
            'RENUNCIA - INCUMPLIMIENTO PROTOCOLO SEGURIDAD',
            'VENCIMIENTO DE TÉRMINO',
            'VENCIMIENTO DE TÉRMINO - RENUNCIA',
            'RENUNCIA - ALCOHOLEMIA',
            'TERMINACIÓN DE CONTRATO',
            'TERMINACIÓN DE CONTRATO - ALCOHOLEMIA',
            'TERMINACIÓN DE CONTRATO - ALCOHOLEMIA + DEJÓ TIRADO EL PUESTO',
        ],

        'eps_opciones' => [
            'EMSSANAR',
            'SANITAS',
            'FAMISANAR',
            'NUEVA EPS',
            'MALLAMAS',
            'ASMET SALUD',
        ],

        'afp_opciones' => [
            'PORVENIR',
            'PROTECCIÓN',
            'COLPENSIONES',
            'FONDO NACIONAL DEL AHORRO',
        ],

        'arl_opciones' => [
            'ARL Positiva',
            'ARL SURA',
            'Riesgos Laborales Colmena',
            'Seguros Bolívar',
            'AXA Colpatria',
            'MAPFRE Colombia',
            'Seguros de Vida Alfa',
            'La Equidad Seguros',
            'Seguros de Vida Aurora',
        ],

        // La opción "Otro" no va aquí: los selects de tipo de documento ya la
        // agregan aparte (mismo valor, una sola vez) para revelar el campo de
        // texto libre. Incluirla también en esta lista duplicaba la opción.
        'tipos_documento' => [
            'Cédula de ciudadanía',
            'Tarjeta de identidad',
            'Cédula de extranjería',
            'Pasaporte',
            'Permiso Especial de Permanencia (PEP)',
            'Registro civil',
        ],

        'licencia_conduccion_categorias' => [
            'A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3',
        ],
    ],

    // TTL de caché (segundos) para las integraciones externas de solo lectura
    // usadas por los selects del wizard de colaboradores.
    'referencias_externas' => [
        'cache_ttl_segundos' => 24 * 60 * 60,
    ],

    // Catálogos para normalizar el Excel de ACI (HU-023). Igual que con
    // colaboradores, el Excel real trae variantes de escritura (ej. 13
    // formas distintas de escribir "Compañia") que se resuelven contra
    // estas listas canónicas con coincidencia exacta o parcial.
    'acis' => [
        'reporte_de' => [
            'Acto Inseguro',
            'Condición Inseguro',
        ],

        'areas' => [
            'Ruta',
            'Viaje/Comisión',
            'Patios',
            'Vehículos/Maquinaria',
            'Oficinas',
            'Áreas comunes',
            'Almacén',
            'Inside DC',
            'Taller mecánico',
            'Pasillos, pasos peatonales o áreas seguras',
        ],

        'clasificaciones' => [
            'Riesgo Vial',
            'Riesgo Biológico',
            'Riesgo Físico',
            'Riesgo Ergonómico',
            'Riesgo Mecánico',
            'Riesgo Público',
            'Riesgo Psicosocial',
            'Riesgo Resbalones, Tropezones o Caídas',
            'Trabajos de alto riesgo',
            'Riesgo Eléctrico',
            'Riesgo Locativo',
        ],

        'estatus_asignacion' => [
            'Pendiente',
            'Asignado',
            'Cerrado',
        ],

        'companias' => [
            'ADENAR',
            'EASY LOGÍSTICA',
            'BAVARIA',
            'ALIANZA DISTRIBUIDORA DE NARIÑO',
            'ABINBEV',
        ],
    ],

    // Exámenes médicos ocupacionales (HU-045 y siguientes). La periodicidad
    // de los exámenes Periódicos es fija según el HU ("12 meses"); vive aquí
    // por si cambia sin tener que tocar código.
    'examenes_medicos' => [
        'periodicidad_meses' => 12,

        // HU-033 CA-033.7: valor por defecto del campo "Empresa" del
        // seguimiento del examen — editable por fila, no hardcodeado en el
        // formulario.
        'empresa_default' => 'Adenar',

        // Catálogo de recomendaciones (HU-054): son registros, no columnas —
        // esta lista solo define las categorías válidas y los estados de
        // seguimiento (HU-055); los ~50 valores concretos viven en la tabla
        // `recomendaciones` (sembrados por RecomendacionSeeder) y se
        // administran desde la pantalla de catálogo.
        'recomendaciones' => [
            'categorias' => [
                'medica' => 'Médica',
                'ocupacional' => 'Ocupacional',
                'habitos' => 'Hábitos y estilos de vida',
            ],
            'estados_seguimiento' => [
                'Pendiente',
                'En seguimiento',
                'Atendida',
                'No atendida',
            ],
        ],

        // Egreso (HU no numerada): flujo simplificado, sin matriz ni
        // periodicidad. El "seguimiento a recomendaciones" aquí es un cierre
        // de cara al retiro, no el mismo catálogo de HU-054/055.
        'egreso' => [
            'seguimiento_recomendaciones' => [
                'Egreso sin cambio aparente al ingreso',
                'Soporte desestimiento u otro',
            ],
        ],
    ],
];
