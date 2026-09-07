<?php

return [
    // Días de anticipación con los que se notifica por correo el vencimiento
    // de los documentos habilitantes del vehículo. El comando
    // `flota:revisar-vencimiento-documentos` corre a diario y avisa a los
    // usuarios con rol Flota, Administrador y Reparto.
    'dias_alerta_soat' => 15,
    'dias_alerta_tecnomecanica' => 30,
];
