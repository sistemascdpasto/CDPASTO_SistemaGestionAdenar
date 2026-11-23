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
];
