<?php

/**
 * Registro canónico de submódulos por pilar, usado para el control de acceso
 * granular por usuario (ver App\Support\ModuleAccessRegistry).
 *
 * Debe mantenerse en sincronía manualmente con resources/js/data/modules.ts
 * (ahí vive el equivalente para la navegación del sidebar). Cada clave es el
 * mismo "slug" usado en la URL (/modules/{modulo}/{slug}) y en modules.ts.
 *
 * Cada entrada es:
 *   - un string: la etiqueta, y el submódulo hereda el/los rol(es) dueños
 *     del pilar (más Administrador, que siempre tiene acceso).
 *   - un array ['label' => ..., 'roles' => [...]]: cuando el submódulo lo
 *     pueden ver roles distintos a los del pilar (ej. Colaborador también
 *     entra a Medición de Tiempos en Inventario). 'roles' es la lista
 *     completa de roles con acceso de lectura (Administrador se agrega
 *     siempre automáticamente, no hace falta repetirlo).
 *
 * Los submódulos que no aparecen aquí (páginas internas sin entrada propia
 * en el sidebar, ej. catálogo de barrios) no son personalizables por usuario
 * y siguen controlados solo por el rol general del pilar, como hasta ahora.
 */
return [
    'seguridad' => [
        'dispositivos' => 'Dispositivos (Alcoholimetría)',
        'pruebas' => 'Pruebas de Alcoholemia',
        'condiciones-salud' => 'Condiciones de Salud',
        'indicador' => 'Tablero de Indicadores',
        'alertas' => 'Alertas',
        'acis' => 'Reportes ACI',
        'acis-indicadores' => 'Indicadores ACI',
        'acis-consultar-qr' => 'Consultar QR SKAP',
        'evaluaciones-owd' => 'Evaluaciones OWD',
        'evaluaciones-owd-indicadores' => 'Indicadores OWD',
        'evaluaciones-owd-incumplimientos' => 'Incumplimientos OWD',
        'planes-accion-owd' => 'Planes de Acción OWD',
        'evaluaciones-owd-importaciones' => 'Historial de Cargas OWD',
        'examenes-medicos' => 'Exámenes Médicos (Bandeja)',
        'examenes-medicos-indicadores' => 'Indicadores Exámenes Médicos',
        'examenes-medicos-catalogo' => 'Catálogo de Exámenes',
        'examenes-medicos-matriz' => 'Matriz Cargo-Examen',
        'examenes-medicos-conceptos' => 'Conceptos de Aptitud',
        'examenes-medicos-recomendaciones' => 'Catálogo de Recomendaciones',
        'encuestas-morbilidad' => 'Encuestas de Morbilidad',
        'encuestas-morbilidad-preguntas' => 'Catálogo de Preguntas de Morbilidad',
        'glosario' => 'Glosario',
        'rutas-criticas' => 'Mapa de Rutas Críticas',
        'rutogramas' => 'Rutogramas',
    ],

    'reparto' => [
        'modulacion' => 'Planeación de Ruta',
        'modulacion-historial' => 'Historial de Planeaciones',
        'eventos-tripulacion' => 'Eventos de Tripulación',
        'indicadores' => 'Indicadores de Velocidad',
        'indicadores-adherencia' => 'Indicadores de Adherencia',
        'indicadores-tiempo' => 'Adherencia al Tiempo',
        'indicadores-entrega-rango' => 'Entrega en Rango Ind.',
        'indicadores-resumen' => 'Resumen Ejecutivo',
        'compensacion-variable' => ['label' => 'Compensación Variable', 'roles' => ['Reparto']],
        'compensacion-variable-diaria' => 'Compensación Variable Diaria',
        'medicion-tiempos-inventario' => ['label' => 'Medición de Tiempos en Inventario', 'roles' => ['Reparto', 'Colaborador']],
        'revision-aleatoria' => ['label' => 'Revisión Aleatoria', 'roles' => ['Reparto']],
        'cinco-porques' => ['label' => '5 Por Qué', 'roles' => ['Reparto', 'Colaborador']],
        'clientes' => ['label' => 'Catálogo de Clientes', 'roles' => ['Reparto']],
    ],

    'gente' => [
        'colaboradores' => ['label' => 'Colaboradores', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'correccion-marcaciones' => ['label' => 'Corrección de Marcaciones', 'roles' => ['Gente', 'Seguridad', 'Reparto']],
        // La página principal (vista general) es exclusiva de Gente, pero
        // "Criterios" (y su plantilla/alertas) ya es de lectura amplia para
        // Seguridad, Reparto y Flota — se usa el conjunto más amplio para no
        // bloquear esa sub-vista a quien sí tiene acceso real por ruta.
        'plan-padrinos' => ['label' => 'Plan Padrinos', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'plan-premiacion' => ['label' => 'Plan Premiación', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'calificaciones' => ['label' => 'Calificaciones', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'dpo-academy' => ['label' => 'DPO Academy', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'ausentismo' => ['label' => 'Ausentismo', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'sac' => ['label' => 'SAC', 'roles' => ['Gente', 'Seguridad', 'Reparto', 'Flota']],
        'asistencia-geovictoria' => ['label' => 'Asistencia GeoVictoria', 'roles' => ['Gente', 'Reparto']],
    ],

    'flota' => [
        'vehiculos' => 'Documentación',
        'disponibilidad' => 'Disponibilidad',
        'carretas' => 'Carretas',
        'simit-consultas' => 'Consultas SIMIT',
        'varadas' => 'Control de Varadas',
        'actas-taller' => 'Actas de Taller',
        'ocupacion-carga' => 'Ocupación de Carga',
    ],
];
