<?php

/**
 * Fuente única de los grupos y documentos del wizard de colaboradores.
 * La usa ColaboradorDocumentoCampos (backend) y se envía al frontend vía
 * catalogos() para que el listado se renderice sin hardcoded en el cliente.
 */

$categoriasLicencia = ['a1', 'a2', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'];

return [

    // ── Grupos (definidos una sola vez; el tipo se deduce en el frontend) ──
    'grupos' => [
        'Documentos personales',
        'Documentos de tránsito',
        'Documentos de salud',
        'Documentos empresariales',
        'Documentos académicos',
        'Documentos aprendiz',
        'Documentos People',
        'Documentos plan padrino',
        'Documentos disciplinarios',
        'Documentos de aprendizaje',
    ],

    // ── Documentos: key, label, grupo, pasos donde aplica ──
    'documentos' => [
        // Documentos personales
        ['key' => 'documento_cedula', 'label' => 'Documento de cédula', 'grupo' => 'Documentos personales', 'pasos' => [4]],
        ['key' => 'documento_tipo_identificacion', 'label' => 'Archivo del tipo de documento', 'grupo' => 'Documentos personales', 'pasos' => [1]],
        ['key' => 'documento_hoja_vida', 'label' => 'Hoja de vida', 'grupo' => 'Documentos personales', 'pasos' => [4]],
        ['key' => 'documento_libreta_militar', 'label' => 'Libreta militar', 'grupo' => 'Documentos personales', 'pasos' => [1]],
        ['key' => 'documento_antecedentes_procuraduria', 'label' => 'Antecedentes — Procuraduría', 'grupo' => 'Documentos personales', 'pasos' => [4]],
        ['key' => 'documento_antecedentes_contraloria', 'label' => 'Antecedentes — Contraloría', 'grupo' => 'Documentos personales', 'pasos' => [4]],
        ['key' => 'documento_antecedentes_policia', 'label' => 'Antecedentes — Policía Nacional', 'grupo' => 'Documentos personales', 'pasos' => [4]],
        ['key' => 'documento_certificado_bancario', 'label' => 'Certificado bancario', 'grupo' => 'Documentos personales', 'pasos' => [4]],
        ['key' => 'documento_runt', 'label' => 'RUNT', 'grupo' => 'Documentos personales', 'pasos' => [1, 4]],

        // Documentos de tránsito
        ['key' => 'documento_licencia_conduccion', 'label' => 'Licencia de conducción', 'grupo' => 'Documentos de tránsito', 'pasos' => [4]],
        ...array_map(fn ($c) => [
            'key' => "documento_licencia_{$c}",
            'label' => 'Licencia — '.strtoupper($c),
            'grupo' => 'Documentos de tránsito',
            'pasos' => [4],
        ], $categoriasLicencia),
        ['key' => 'documento_carnet_manejo_defensivo', 'label' => 'Carnet manejo defensivo', 'grupo' => 'Documentos de tránsito', 'pasos' => [2, 4]],
        ['key' => 'documento_certificado_manejo_defensivo', 'label' => 'Certificado manejo defensivo', 'grupo' => 'Documentos de tránsito', 'pasos' => [2, 4]],
        ['key' => 'documento_certificado_carga_pesada', 'label' => 'Certificado conducción de carga pesada', 'grupo' => 'Documentos de tránsito', 'pasos' => [2, 4]],
        ['key' => 'documento_certificados_terreno_plano', 'label' => 'Certificados terreno plano', 'grupo' => 'Documentos de tránsito', 'pasos' => [2]],
        ['key' => 'documento_simit', 'label' => 'Documento Simit', 'grupo' => 'Documentos de tránsito', 'pasos' => [4]],
        ['key' => 'documento_recordatorio_vehiculo_licencia_conduccion', 'label' => 'Recordatorio vehículo / licencia', 'grupo' => 'Documentos de tránsito', 'pasos' => [4]],

        // Documentos de salud
        ['key' => 'documento_eps', 'label' => 'Documento EPS', 'grupo' => 'Documentos de salud', 'pasos' => [1, 4]],
        ['key' => 'documento_pension', 'label' => 'Documento AFP / pensión', 'grupo' => 'Documentos de salud', 'pasos' => [1]],
        ['key' => 'documento_arl', 'label' => 'Documento ARL', 'grupo' => 'Documentos de salud', 'pasos' => [1, 4]],
        ['key' => 'documento_examen_medico_ocupacional', 'label' => 'Examen médico ocupacional', 'grupo' => 'Documentos de salud', 'pasos' => [4]],
        ['key' => 'documento_certificado_comfamiliar', 'label' => 'Certificado Comfamiliar', 'grupo' => 'Documentos de salud', 'pasos' => [4]],
        ['key' => 'documento_afiliacion_comfamiliar', 'label' => 'Afiliación Comfamiliar', 'grupo' => 'Documentos de salud', 'pasos' => [4]],

        // Documentos empresariales
        ['key' => 'documento_carnet_ingreso_cd', 'label' => 'Carnet ingreso CD', 'grupo' => 'Documentos empresariales', 'pasos' => [4]],
        ['key' => 'documento_contrato', 'label' => 'Contrato', 'grupo' => 'Documentos empresariales', 'pasos' => [4]],
        ['key' => 'documento_preaviso_terminacion', 'label' => 'Preaviso de terminación', 'grupo' => 'Documentos empresariales', 'pasos' => [4]],
        ['key' => 'documento_prorroga', 'label' => 'Prórroga', 'grupo' => 'Documentos empresariales', 'pasos' => [4]],

        // Documentos académicos
        ['key' => 'documento_titulo_bachiller', 'label' => 'Título de bachiller', 'grupo' => 'Documentos académicos', 'pasos' => [4]],
        ['key' => 'documento_titulo_tecnico', 'label' => 'Título técnico', 'grupo' => 'Documentos académicos', 'pasos' => [4]],
        ['key' => 'documento_titulo_tecnologo', 'label' => 'Título tecnólogo', 'grupo' => 'Documentos académicos', 'pasos' => [4]],
        ['key' => 'documento_titulo_profesional', 'label' => 'Título profesional', 'grupo' => 'Documentos académicos', 'pasos' => [4]],
        ['key' => 'documento_titulo_academico', 'label' => 'Título — otro', 'grupo' => 'Documentos académicos', 'pasos' => [4]],

        // Documentos aprendiz
        ['key' => 'documento_sena_carta_presentacion', 'label' => 'Carta de presentación (Aprendiz SENA)', 'grupo' => 'Documentos aprendiz', 'pasos' => [3, 4]],

        // Documentos People
        ['key' => 'documento_induccion', 'label' => 'Inducción', 'grupo' => 'Documentos People', 'pasos' => [4]],
        ['key' => 'documento_reinduccion', 'label' => 'Reinducción', 'grupo' => 'Documentos People', 'pasos' => [4]],
        ['key' => 'documento_induccion_pilares', 'label' => 'Inducción pilares', 'grupo' => 'Documentos People', 'pasos' => [4]],

        // Documentos plan padrino
        ['key' => 'documento_plan_padrino', 'label' => 'Plan padrino personal nuevo', 'grupo' => 'Documentos plan padrino', 'pasos' => [4]],

        // Documentos disciplinarios
        ['key' => 'documento_llamado_atencion', 'label' => 'Llamado de atención', 'grupo' => 'Documentos disciplinarios', 'pasos' => [4]],
        ['key' => 'documento_compromisos', 'label' => 'Compromisos', 'grupo' => 'Documentos disciplinarios', 'pasos' => [4]],

        // Documentos de aprendizaje
        ['key' => 'documento_escuela_pilotos', 'label' => 'Certificado escuela de pilotos', 'grupo' => 'Documentos de aprendizaje', 'pasos' => [4]],
        ['key' => 'documento_certificado_brigadista', 'label' => 'Certificado de Brigadista', 'grupo' => 'Documentos de aprendizaje', 'pasos' => [4]],
    ],
];
