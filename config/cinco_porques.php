<?php

return [
    // Opciones del selector "Rutina a la que aplica".
    'rutinas' => [
        'Matinal de conductores',
        'Semanal de reparto',
        'OWD',
    ],

    // Opciones del selector "Indicador afectado".
    'indicadores' => [
        'Devolución',
        'Entrega en rango',
        'Modulación',
        'Adherencia a la secuencia',
        'Cashless',
        'Tiempo en ruta',
        'Tiempo medio de liberación',
    ],

    // Cuántas opciones genera la IA por cada nivel de "¿Por qué?".
    'opciones_por_nivel' => 5,
];
