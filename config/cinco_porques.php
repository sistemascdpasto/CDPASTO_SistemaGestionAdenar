<?php

return [
    // "Rutina a la que aplica". Hoy es un valor fijo (el formulario lo muestra
    // como campo de solo lectura, no como selector). Se deja como lista para
    // que la validación `Rule::in` siga funcionando y para poder reactivar el
    // selector en el futuro agregando más opciones.
    'rutinas' => [
        'Matutina de distribución',
    ],

    // Opciones del selector "Indicador afectado".
    'indicadores' => [
        'Adherencia a la secuencia',
        'Adherencia en tiempo planeado',
        'Adherencia a los kilómetros',
        'Cashless',
        'Delivery Experience (NPS)',
        'Devolución',
        'Entrega en rango',
        'Modulación',
        'Paradas no planeadas',
        'Rechazos',
        'RMD',
        'Rotura',
        'SAC',
        'Tiempo en ruta',
        'Tiempo interno',
        'Tiempo medio de liberación',
    ],

    // Cuántas opciones genera la IA por cada nivel de "¿Por qué?".
    'opciones_por_nivel' => 5,
];
