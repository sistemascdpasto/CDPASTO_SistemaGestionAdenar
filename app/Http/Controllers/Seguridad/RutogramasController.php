<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Reparto\Cliente;
use App\Models\Reparto\Modulacion;
use App\Models\Seguridad\AsignacionConductor;
use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class RutogramasController extends Controller
{
    public function index(Request $request, ?string $vista = null): Response
    {
        $vistas = [
            null => 'rutas',
            'criticidad' => 'criticidad',
            'conductores' => 'conductores',
            'mapa-calor' => 'mapa',
        ];

        abort_unless(array_key_exists($vista, $vistas), 404);

        $datosModulacion = $this->obtenerDatosModulacion();

        $fechaParam = $request->query('fecha');
        $fechaInicial = $fechaParam;

        if (!$fechaInicial) {
            $hoy = date('Y-m-d');
            if (isset($datosModulacion['datosPorFecha'][$hoy])) {
                $fechaInicial = $hoy;
            } elseif (!empty($datosModulacion['fechasRegistradas'])) {
                $fechaInicial = $datosModulacion['fechasRegistradas'][0]['fecha'];
            } else {
                $fechaInicial = $hoy;
            }
        }

        // Corte mensual para la vista de conductores. Si no se indica, se
        // usa el mes actual (o el mes más reciente con modulaciones).
        $mesConductores = $request->query('mes');
        if (!$mesConductores) {
            $hoy = date('Y-m');
            $mesesConDatos = array_unique(array_map(
                fn($f) => substr($f, 0, 7),
                array_keys($datosModulacion['datosPorFecha'])
            ));
            rsort($mesesConDatos);
            $mesConductores = in_array($hoy, $mesesConDatos) ? $hoy : ($mesesConDatos[0] ?? $hoy);
        }

        // Meses disponibles (con modulaciones) para el selector del frontend.
        $mesesDisponiblesConductores = array_values(array_unique(array_map(
            fn($f) => substr($f, 0, 7),
            array_keys($datosModulacion['datosPorFecha'])
        )));
        rsort($mesesDisponiblesConductores);

        $conductoresMes = $this->obtenerConductoresMes($mesConductores);

        $colaboradores = Colaborador::select([
                'cedula', 'nombres', 'apellidos', 'cargo',
                'anios_experiencia', 'fecha_ingreso_empresa',
            ])
            ->where('is_active', true)
            ->get()
            ->map(fn($c) => [
                'cedula'               => $c->cedula,
                'nombre_completo'      => $c->nombre_completo,
                'cargo'                => $c->cargo,
                'anios_experiencia'    => $c->anios_experiencia,
                'fecha_ingreso_empresa'=> $c->fecha_ingreso_empresa?->format('Y-m-d'),
            ]);

        return Inertia::render('seguridad/rutogramas/index', [
            'vista' => $vistas[$vista],
            'datosModulacionPorFecha' => $datosModulacion['datosPorFecha'],
            'viajesPorFecha' => $datosModulacion['viajesPorFecha'],
            'fechasRegistradas' => $datosModulacion['fechasRegistradas'],
            'fechaInicial' => $fechaInicial,
            'colaboradores' => $colaboradores,
            'conductoresMes' => $conductoresMes,
            'mesConductoresActual' => $mesConductores,
            'mesesDisponiblesConductores' => $mesesDisponiblesConductores,
            'mapaCalorData' => $this->obtenerDatosMapaCalor($datosModulacion),
        ]);
    }

    /**
     * Construye el resumen mensual de conductores con sus rutas asignadas
     * a partir de las modulaciones del mes indicado (formato YYYY-MM).
     *
     * Por cada colaborador que aparece como CONDUCTOR en la tripulación de
     * algún item de modulación en ese mes se generan:
     *   - Datos básicos (cédula, nombre, cargo, experiencias, aptitud).
     *   - Array de rutas únicas (municipio + placas + fechas).
     *   - Criticidad calculada: mayoría de municipios que resultan de alta → alta, etc.
     *   - Estadísticas: total viajes, total municipios únicos, días activos.
     */
    private function obtenerConductoresMes(string $mes): array
    {
        [$anio, $numeroMes] = array_map('intval', explode('-', $mes . '-01'));

        $modulaciones = Modulacion::with(['items'])
            ->whereYear('fecha', $anio)
            ->whereMonth('fecha', $numeroMes)
            ->orderBy('fecha')
            ->get();

        $porConductor = [];

        foreach ($modulaciones as $mod) {
            $fecha = $mod->fecha;

            foreach ($mod->items as $item) {
                $placa = strtoupper(trim((string)($item->placa ?? '')));
                $tripulacion = is_array($item->tripulacion) ? $item->tripulacion : [];

                // Identificar conductor y su cédula/cargo desde la tripulación
                $conductorNombre = '';
                $conductorCedula = '';
                $conductorCargo  = '';

                foreach ($tripulacion as $m) {
                    $cargoTripMasc = strtoupper((string)($m['cargo'] ?? ''));
                    if (str_contains($cargoTripMasc, 'CONDUCTOR')) {
                        $conductorNombre = trim((string)($m['nombres'] ?? ''));
                        $conductorCedula = trim((string)($m['cedula'] ?? ''));
                        $conductorCargo  = trim((string)($m['cargo'] ?? ''));
                        break;
                    }
                }

                // Si no hay conductor explícito, tomar el primer miembro (responsable)
                if ($conductorNombre === '' && !empty($tripulacion)) {
                    $primero = $tripulacion[0];
                    $conductorNombre = trim((string)($primero['nombres'] ?? ''));
                    $conductorCedula = trim((string)($primero['cedula'] ?? ''));
                    $conductorCargo  = trim((string)($primero['cargo'] ?? ''));
                }

                if ($conductorNombre === '') {
                    continue;
                }

                // Clave del conductor: cédula si existe, sino nombre normalizado
                $clave = $conductorCedula ?: mb_strtolower(trim($conductorNombre));

                if (!isset($porConductor[$clave])) {
                    $porConductor[$clave] = [
                        'cedula'               => $conductorCedula,
                        'nombre'               => $conductorNombre,
                        'cargo'                => $conductorCargo,
                        'dias_activos'         => [],
                        'viajes'               => [],
                        'municipios_acumulados'=> [],
                    ];
                }

                // Agregar día activo
                if (!in_array($fecha, $porConductor[$clave]['dias_activos'], true)) {
                    $porConductor[$clave]['dias_activos'][] = $fecha;
                }

                // Extraer municipios de los viajes de este item
                $viajes = is_array($item->viajes) ? $item->viajes : [];
                foreach ($viajes as $vIdx => $viaje) {
                    $destinosRaw = !empty($viaje['destinos']) && is_array($viaje['destinos'])
                        ? $viaje['destinos']
                        : [['lugares' => $viaje['lugares'] ?? '', 'barrio' => $viaje['barrio'] ?? '']];

                    $municipiosViaje = [];
                    foreach ($destinosRaw as $d) {
                        $mun = trim((string)($d['lugares'] ?? ''));
                        if ($mun !== '') {
                            $municipiosViaje[] = $mun;
                            $porConductor[$clave]['municipios_acumulados'][] = $mun;
                        }
                    }

                    $porConductor[$clave]['viajes'][] = [
                        'fecha'      => $fecha,
                        'placa'      => $placa,
                        'num_viaje'  => $vIdx + 1,
                        'municipios' => array_values(array_unique($municipiosViaje)),
                        'cliente'    => trim((string)($viaje['cliente'] ?? '')),
                        'peso'       => trim((string)($viaje['peso'] ?? '')),
                        'doc_tras'   => trim((string)($item->doc_tras ?? '')),
                    ];
                }
            }
        }

        // Construir el array final con estadísticas y enriquecer desde la BD
        $cedulas = array_filter(array_column($porConductor, 'cedula'));
        $colaboradoresDB = Colaborador::select([
                'id', 'cedula', 'nombres', 'apellidos', 'cargo',
                'anios_experiencia', 'fecha_nacimiento', 'fecha_ingreso_empresa',
                'fecha_vencimiento_licencia',
            ])
            ->with(['documentos' => function ($q) {
                $q->select('colaborador_id', 'campo')
                  ->whereIn('campo', ['documento_licencia_a1','documento_licencia_a2','documento_licencia_b1','documento_licencia_b2','documento_licencia_b3','documento_licencia_c1','documento_licencia_c2','documento_licencia_c3']);
            }])
            ->whereIn('cedula', $cedulas)
            ->get()
            ->keyBy('cedula');

        $resultado = [];
        $numero    = 1;

        foreach ($porConductor as $clave => $datos) {
            $cedula = $datos['cedula'];
            $colab  = isset($cedula) ? ($colaboradoresDB[$cedula] ?? null) : null;

            // Municipios únicos del mes
            $municipiosUnicos = array_values(array_unique($datos['municipios_acumulados']));

            // Criticidad dominante: se calcula como el nivel más alto
            // que aparece según palabras clave en los municipios.
            // Si no hay información de criticidad, queda como 'sin_datos'.
            // (El frontend puede cruzar con su tabla de criticidad.)
            $totalViajes  = count($datos['viajes']);
            $diasActivos  = count($datos['dias_activos']);

            // Rutas agrupadas por municipio con sus fechas y placas
            $rutasPorMunicipio = [];
            foreach ($datos['viajes'] as $v) {
                foreach ($v['municipios'] as $mun) {
                    $k = mb_strtolower($mun);
                    if (!isset($rutasPorMunicipio[$k])) {
                        $rutasPorMunicipio[$k] = [
                            'municipio' => $mun,
                            'fechas'    => [],
                            'placas'    => [],
                            'total_viajes' => 0,
                        ];
                    }
                    $rutasPorMunicipio[$k]['total_viajes']++;
                    if (!in_array($v['fecha'], $rutasPorMunicipio[$k]['fechas'], true)) {
                        $rutasPorMunicipio[$k]['fechas'][] = $v['fecha'];
                    }
                    if ($v['placa'] !== '' && !in_array($v['placa'], $rutasPorMunicipio[$k]['placas'], true)) {
                        $rutasPorMunicipio[$k]['placas'][] = $v['placa'];
                    }
                }
            }
            // Ordenar rutas por total de viajes desc
            usort($rutasPorMunicipio, fn($a, $b) => $b['total_viajes'] <=> $a['total_viajes']);

            // Experiencia interna: meses desde fecha de ingreso
            $expInterna = null;
            if ($colab?->fecha_ingreso_empresa) {
                $meses = (int) Carbon::parse($colab->fecha_ingreso_empresa)->diffInMonths(Carbon::now());
                $anos  = intdiv($meses, 12);
                $mesesResto = $meses % 12;
                $expInterna = $anos > 0
                    ? "{$anos}a " . ($mesesResto > 0 ? "{$mesesResto}m" : '')
                    : "{$mesesResto}m";
            }

            $resultado[] = [
                'numero'                    => $numero++,
                'cedula'                    => $cedula ?: '—',
                'nombre'                    => $colab ? $colab->nombre_completo : $datos['nombre'],
                'cargo'                     => $colab?->cargo ?? $datos['cargo'] ?: '—',
                'edad'                      => $colab?->edad ?? null,
                'experiencia_externa'       => $colab?->anios_experiencia ? $colab->anios_experiencia . ' años' : '—',
                'experiencia_interna'       => $expInterna ?? '—',
                'aptitud'                   => null, // Se mantiene en Excel / definición manual
                'total_viajes'              => $totalViajes,
                'dias_activos'              => $diasActivos,
                'municipios_unicos'         => $municipiosUnicos,
                'rutas'                     => array_values($rutasPorMunicipio),
                'licencia_categoria'        => $this->categoriaLicenciaMasAlta($colab),
                'fecha_vencimiento_licencia'=> $colab?->fecha_vencimiento_licencia?->toDateString(),
            ];
        }

        // Ordenar por nombre
        usort($resultado, fn($a, $b) => strcmp($a['nombre'], $b['nombre']));
        // Re-numerar tras ordenar
        foreach ($resultado as $i => &$r) {
            $r['numero'] = $i + 1;
        }
        unset($r);

        return $resultado;
    }

    /**
     * Extrae las rutas, municipios y barrios registrados en las planeaciones de modulación.
     */
    private function obtenerDatosModulacion(): array
    {
        $modulaciones = Modulacion::with(['items'])->orderBy('fecha', 'desc')->get();

        $datosPorFecha = [];
        $viajesPorFecha = [];
        $fechasRegistradas = [];

        $diasSemana = [
            1 => 'Lunes',
            2 => 'Martes',
            3 => 'Miércoles',
            4 => 'Jueves',
            5 => 'Viernes',
            6 => 'Sábado',
            7 => 'Domingo',
        ];

        foreach ($modulaciones as $mod) {
            $fecha = $mod->fecha;
            $lugaresFecha = [];
            $viajesFecha = [];

            foreach ($mod->items as $item) {
                $placa = strtoupper(trim((string)($item->placa ?? '')));
                $docTras = trim((string)($item->doc_tras ?? ''));

                $responsable = '';
                $conductor = '';
                $tripulacion = is_array($item->tripulacion) ? $item->tripulacion : [];

                foreach ($tripulacion as $m) {
                    $cargo = strtoupper((string)($m['cargo'] ?? ''));
                    if (str_contains($cargo, 'RESPONSABLE')) {
                        $responsable = trim((string)($m['nombres'] ?? ''));
                    }
                    if (str_contains($cargo, 'CONDUCTOR')) {
                        $conductor = trim((string)($m['nombres'] ?? ''));
                    }
                }
                if ($responsable === '') {
                    $responsable = $conductor ?: trim((string)($item->nombres ?? ($tripulacion[0]['nombres'] ?? '')));
                }
                if ($conductor === '') {
                    $conductor = $responsable;
                }

                $viajes = is_array($item->viajes) ? $item->viajes : [];
                foreach ($viajes as $viajeIdx => $viaje) {
                    $cliente = trim((string)($viaje['cliente'] ?? ''));
                    $peso = trim((string)($viaje['peso'] ?? ''));

                    $destinosRaw = !empty($viaje['destinos']) && is_array($viaje['destinos']) ? $viaje['destinos'] : [];
                    if (empty($destinosRaw)) {
                        $destinosRaw = [[
                            'lugares' => $viaje['lugares'] ?? '',
                            'barrio'  => $viaje['barrio'] ?? '',
                            'hora'    => $viaje['hora'] ?? null,
                        ]];
                    }

                    $viajeDestinos = [];
                    $viajeMunicipios = [];
                    $viajeBarrios = [];

                    foreach ($destinosRaw as $destIdx => $d) {
                        $municipio = trim((string)($d['lugares'] ?? ''));
                        $barrio = trim((string)($d['barrio'] ?? ''));
                        $hora = trim((string)($d['hora'] ?? ''));

                        if ($municipio === '' && $barrio === '' && $cliente === '') {
                            continue;
                        }

                        $munDisplay = $municipio !== '' ? $municipio : '(Sin municipio)';
                        $barrioDisplay = $barrio !== '' ? $barrio : '(Centro / General)';
                        $viajeNum = $viajeIdx + 1;
                        $viajeLabel = count($viajes) > 1 ? " (V{$viajeNum})" : '';

                        $nombreDisplay = $responsable !== '' ? $responsable : ($item->nombres ?: ($cliente ?: "Vehículo {$placa}"));

                        $lugaresFecha[] = [
                            'id'              => "{$item->id}_{$viajeIdx}_{$destIdx}",
                            'codigo'          => $placa . $viajeLabel,
                            'nombre'          => $nombreDisplay,
                            'ciudad'          => $munDisplay,
                            'barrio'          => $barrioDisplay,
                            'placa'           => $placa,
                            'placa_adicional' => $item->placa_adicional,
                            'doc_tras'        => $docTras,
                            'responsable'     => $responsable,
                            'conductor'       => $conductor,
                            'cliente'         => $cliente,
                            'peso'            => $peso,
                            'viaje'           => $viajeNum,
                            'hora'            => $hora ?: null,
                        ];

                        $viajeDestinos[] = [
                            'municipio' => $munDisplay,
                            'barrio'    => $barrioDisplay,
                            'hora'      => $hora ?: null,
                        ];
                        if ($municipio !== '') {
                            $viajeMunicipios[] = $municipio;
                        }
                        if ($barrio !== '') {
                            $viajeBarrios[] = $barrio;
                        }
                    }

                    if (!empty($viajeDestinos) || $cliente !== '') {
                        $munsUnicos = array_values(array_unique($viajeMunicipios));
                        $barsUnicos = array_values(array_unique($viajeBarrios));

                        $viajesFecha[] = [
                            'id'              => "{$item->id}_{$viajeIdx}",
                            'viaje_numero'    => $viajeIdx + 1,
                            'placa'           => $placa,
                            'placa_adicional' => $item->placa_adicional,
                            'doc_tras'        => $docTras,
                            'responsable'     => $responsable,
                            'conductor'       => $conductor,
                            'cliente'         => $cliente,
                            'peso'            => $peso,
                            'destinos'        => $viajeDestinos,
                            'municipio'       => implode(', ', $munsUnicos) ?: '(Sin municipio)',
                            'municipios'      => $munsUnicos,
                            'barrio'          => implode(', ', $barsUnicos) ?: '(Centro / General)',
                            'barrios'         => $barsUnicos,
                            'total_destinos'  => count($viajeDestinos),
                        ];
                    }
                }
            }

            if (!empty($lugaresFecha) || !empty($viajesFecha)) {
                $datosPorFecha[$fecha] = $lugaresFecha;
                $viajesPorFecha[$fecha] = $viajesFecha;

                $carbonFecha = Carbon::parse($fecha);
                $diaSemana = $diasSemana[$carbonFecha->dayOfWeekIso] ?? $carbonFecha->format('l');

                $fechasRegistradas[] = [
                    'fecha'            => $fecha,
                    'dia_semana'       => $diaSemana,
                    'fecha_formateada' => $carbonFecha->format('d/m/Y'),
                    'total_viajes'     => count($viajesFecha),
                    'total_vehiculos'  => count(array_unique(array_column($viajesFecha, 'placa'))),
                    'total_lugares'    => count($lugaresFecha),
                    'total_municipios' => count(array_unique(array_column($lugaresFecha, 'ciudad'))),
                    'total_barrios'    => count(array_unique(array_map(fn($l) => $l['ciudad'] . '|' . $l['barrio'], $lugaresFecha))),
                ];
            }
        }

        return [
            'datosPorFecha' => $datosPorFecha,
            'viajesPorFecha' => $viajesPorFecha,
            'fechasRegistradas' => $fechasRegistradas,
        ];
    }

    /**
     * Construye los puntos del mapa de calor cruzando:
     *  - Municipios y barrios de la planeación de modulación
     *  - Coordenadas reales de reparto_clientes (lat/lon por municipio+barrio)
     *  - Criticidad de asignacion_conductores por cédula del conductor
     *  - Lista de conductores que visitaron cada municipio/barrio
     *
     * Retorna un array de puntos, uno por cada par municipio+barrio único,
     * con lat, lon, criticidad dominante y conductores asociados.
     *
     * @param array{datosPorFecha: array, viajesPorFecha: array, fechasRegistradas: array} $datosModulacion
     * @return array<int, array{
     *   municipio: string,
     *   barrio: string,
     *   lat: float,
     *   lon: float,
     *   criticidad: string,
     *   total_visitas: int,
     *   conductores: array<int, array{nombre: string, cedula: string, visitas: int}>,
     * }>
     */
    private function obtenerDatosMapaCalor(array $datosModulacion): array
    {
        // ── 1. Acumular frecuencia y conductores por municipio+barrio ──────────
        // clave: "municipio|barrio" (normalizado)
        /** @var array<string, array{
         *   municipio: string,
         *   barrio: string,
         *   visitas: int,
         *   conductores: array<string, int>,  // cédula → visitas
         *   nombres: array<string, string>,   // cédula → nombre
         * }> $acumulado */
        $acumulado = [];

        foreach ($datosModulacion['datosPorFecha'] as $lugaresFecha) {
            foreach ($lugaresFecha as $lugar) {
                $mun  = trim((string)($lugar['ciudad'] ?? ''));
                $bar  = trim((string)($lugar['barrio'] ?? ''));
                $cond = trim((string)($lugar['conductor'] ?? ''));
                $resp = trim((string)($lugar['responsable'] ?? ''));
                $nombre = $cond ?: $resp;

                if ($mun === '' || str_starts_with($mun, '(')) continue;

                $key = mb_strtolower("{$mun}|{$bar}");

                if (! isset($acumulado[$key])) {
                    $acumulado[$key] = [
                        'municipio' => $mun,
                        'barrio'    => $bar,
                        'visitas'   => 0,
                        'conductores' => [],
                        'nombres'     => [],
                    ];
                }

                $acumulado[$key]['visitas']++;

                if ($nombre !== '') {
                    // Usamos nombre normalizado como clave provisional si no hay cédula
                    $clave = mb_strtolower($nombre);
                    $acumulado[$key]['conductores'][$clave] = ($acumulado[$key]['conductores'][$clave] ?? 0) + 1;
                    $acumulado[$key]['nombres'][$clave] = $nombre;
                }
            }
        }

        if (empty($acumulado)) {
            return [];
        }

        // ── 2. Criticidad por conductor (desde asignacion_conductores) ─────────
        // Cargar todos los registros de criticidad disponibles (por nombre normalizado)
        $criticidadPorNombre = [];
        if (Schema::hasTable('asignacion_conductores')) {
            AsignacionConductor::whereNotNull('criticidad_matriz_rutas')
                ->get(['cedula', 'criticidad_matriz_rutas'])
                ->each(function ($ac) use (&$criticidadPorNombre) {
                    $cedula = trim((string)($ac->cedula ?? ''));
                    if ($cedula !== '') {
                        $criticidadPorNombre[mb_strtolower($cedula)] = mb_strtolower(trim((string)$ac->criticidad_matriz_rutas));
                    }
                });

            // También por nombre desde Colaborador → AsignacionConductor
            Colaborador::whereHas('asignacionConductor')
                ->with('asignacionConductor')
                ->get(['id', 'nombres', 'apellidos', 'cedula'])
                ->each(function ($col) use (&$criticidadPorNombre) {
                    $nombreNorm = mb_strtolower(trim("{$col->nombres} {$col->apellidos}"));
                    $cedula     = mb_strtolower(trim((string)$col->cedula));
                    $crit       = mb_strtolower(trim((string)($col->asignacionConductor->criticidad_matriz_rutas ?? '')));
                    if ($crit !== '') {
                        if ($cedula !== '') $criticidadPorNombre[$cedula] = $crit;
                        if ($nombreNorm !== '') $criticidadPorNombre[$nombreNorm] = $crit;
                    }
                });
        }

        // ── 3. Coordenadas desde reparto_clientes (promedio por municipio+barrio) ──
        // Acumulamos suma de lat/lon y conteo para promediar, así el pin cae
        // en el centroide real del barrio/municipio, no en un cliente arbitrario.
        // Normalización: minúsculas + quitar tildes + trim (igual que el frontend).
        $normalize = function (string $s): string {
            // Convertir a NFD y eliminar marcas de acento (equivalente a JS .normalize('NFD').replace(/[\u0300-\u036f]/g,''))
            $nfd = \Normalizer::normalize(mb_strtolower(trim($s)), \Normalizer::FORM_D);
            return preg_replace('/\p{Mn}/u', '', $nfd) ?? mb_strtolower(trim($s));
        };

        // acumPorUbicacion: key → [sumLat, sumLon, count]
        $acumCoords = [];

        if (Schema::hasTable('reparto_clientes')) {
            Cliente::whereNotNull('latitud')
                ->whereNotNull('longitud')
                ->whereNotNull('municipio')
                ->where('latitud', '!=', 0)
                ->where('longitud', '!=', 0)
                // Solo coordenadas en rango Colombia
                ->whereBetween('latitud', [-4, 13])
                ->whereBetween('longitud', [-81, -66])
                ->get(['municipio', 'barrio', 'latitud', 'longitud'])
                ->each(function ($c) use (&$acumCoords, $normalize) {
                    $munNorm = $normalize((string)$c->municipio);
                    $barNorm = $normalize((string)($c->barrio ?? ''));
                    $lat     = (float)$c->latitud;
                    $lon     = (float)$c->longitud;

                    // Índice municipio+barrio exacto
                    $key = "{$munNorm}|{$barNorm}";
                    if (! isset($acumCoords[$key])) {
                        $acumCoords[$key] = ['sumLat' => 0.0, 'sumLon' => 0.0, 'n' => 0];
                    }
                    $acumCoords[$key]['sumLat'] += $lat;
                    $acumCoords[$key]['sumLon'] += $lon;
                    $acumCoords[$key]['n']++;

                    // Índice solo municipio (fallback)
                    $keyMun = "{$munNorm}|";
                    if (! isset($acumCoords[$keyMun])) {
                        $acumCoords[$keyMun] = ['sumLat' => 0.0, 'sumLon' => 0.0, 'n' => 0];
                    }
                    $acumCoords[$keyMun]['sumLat'] += $lat;
                    $acumCoords[$keyMun]['sumLon'] += $lon;
                    $acumCoords[$keyMun]['n']++;
                });
        }

        // Convertir sumas a promedios
        $coordsPorUbicacion = [];
        foreach ($acumCoords as $key => $v) {
            if ($v['n'] > 0) {
                $coordsPorUbicacion[$key] = [
                    'lat' => $v['sumLat'] / $v['n'],
                    'lon' => $v['sumLon'] / $v['n'],
                ];
            }
        }

        // ── 4. Construir puntos del mapa ───────────────────────────────────────
        $NIVEL_PRIORIDAD = ['alta' => 3, 'media' => 2, 'baja' => 1, '' => 0];

        $puntos = [];

        foreach ($acumulado as $item) {
            $munNorm = $normalize($item['municipio']);
            $barNorm = $normalize($item['barrio']);

            // Buscar coordenadas:
            // 1) municipio+barrio exacto (normalizado)
            // 2) búsqueda parcial: municipio exacto + barrio que contenga o esté contenido en barNorm
            // 3) solo municipio (centroide de todos los clientes del municipio)
            // 4) null → el frontend geocodifica por nombre con COORDS_NARINO
            $coords = $coordsPorUbicacion["{$munNorm}|{$barNorm}"] ?? null;

            if ($coords === null && $barNorm !== '' && !str_starts_with($barNorm, '(')) {
                // Búsqueda parcial: recorrer claves del mismo municipio
                foreach ($coordsPorUbicacion as $clave => $c) {
                    if (! str_starts_with($clave, "{$munNorm}|")) continue;
                    $barClave = substr($clave, strlen($munNorm) + 1);
                    if ($barClave === '') continue;
                    if (str_contains($barNorm, $barClave) || str_contains($barClave, $barNorm)) {
                        $coords = $c;
                        break;
                    }
                }
            }

            // Fallback: centroide del municipio
            $coords = $coords ?? $coordsPorUbicacion["{$munNorm}|"] ?? null;
            // Si sigue null, el frontend geocodifica
            $coords = $coords ?? ['lat' => null, 'lon' => null];

            // Criticidad dominante: el nivel más alto entre todos los conductores del punto
            $nivelDominante = '';
            $prioridadMax   = 0;

            foreach (array_keys($item['conductores']) as $claveCondutor) {
                $crit = $criticidadPorNombre[$claveCondutor] ?? '';
                // Intentar coincidencia parcial si no hay exacta
                if ($crit === '' && count($criticidadPorNombre) > 0) {
                    foreach ($criticidadPorNombre as $k => $v) {
                        if (str_contains($claveCondutor, $k) || str_contains($k, $claveCondutor)) {
                            $crit = $v;
                            break;
                        }
                    }
                }
                $prio = $NIVEL_PRIORIDAD[$crit] ?? 0;
                if ($prio > $prioridadMax) {
                    $prioridadMax   = $prio;
                    $nivelDominante = $crit;
                }
            }

            // Si ningún conductor tiene criticidad asignada, dejar vacío (el frontend lo clasifica como 'baja')
            $conductoresArray = [];
            foreach ($item['conductores'] as $clave => $visitas) {
                $conductoresArray[] = [
                    'nombre'  => $item['nombres'][$clave] ?? $clave,
                    'cedula'  => $clave,
                    'visitas' => $visitas,
                ];
            }
            // Ordenar por visitas desc
            usort($conductoresArray, fn ($a, $b) => $b['visitas'] <=> $a['visitas']);

            $puntos[] = [
                'municipio'     => $item['municipio'],
                'barrio'        => $item['barrio'],
                'lat'           => $coords['lat'],
                'lon'           => $coords['lon'],
                'criticidad'    => $nivelDominante ?: 'baja',
                'total_visitas' => $item['visitas'],
                'conductores'   => $conductoresArray,
                // true si las coords vienen de reparto_clientes, false si se geocodificará en frontend
                'coords_exactas' => $coords['lat'] !== null,
            ];
        }

        // ── 5. Separar puntos que comparten coordenadas exactas (mismo municipio, ──
        //       distinto barrio) con un micro-desplazamiento para que sean visibles.
        $coordsUsadas = [];
        foreach ($puntos as &$punto) {
            if ($punto['lat'] === null) continue;
            $key = round($punto['lat'], 5) . ',' . round($punto['lon'], 5);
            $veces = $coordsUsadas[$key] ?? 0;
            if ($veces > 0) {
                // Desplazar ~50-100 m en dirección aleatoria pero determinista
                $angulo = ($veces * 137.5) * (M_PI / 180); // ángulo áureo
                $radio  = 0.0005 * ceil($veces / 8);        // ~55 m por anillo
                $punto['lat'] += $radio * cos($angulo);
                $punto['lon'] += $radio * sin($angulo);
            }
            $coordsUsadas[$key] = $veces + 1;
        }
        unset($punto);
        usort($puntos, function ($a, $b) {
            $aCoords = ($a['lat'] !== null) ? 1 : 0;
            $bCoords = ($b['lat'] !== null) ? 1 : 0;
            if ($aCoords !== $bCoords) return $bCoords - $aCoords;
            return $b['total_visitas'] - $a['total_visitas'];
        });

        return $puntos;
    }

    /**
     * Devuelve la categoría de licencia más alta que tiene el colaborador.
     * Orden: A1 < A2 < B1 < B2 < B3 < C1 < C2 < C3.
     * Se detecta a partir de los documentos de licencia cargados.
     */
    private function categoriaLicenciaMasAlta(?Colaborador $colab): ?string
    {
        if (! $colab) {
            return null;
        }

        $orden = ['A1' => 1, 'A2' => 2, 'B1' => 3, 'B2' => 4, 'B3' => 5, 'C1' => 6, 'C2' => 7, 'C3' => 8];

        $campos = $colab->documentos->pluck('campo')->unique();

        $masAlta = null;
        $prioridad = 0;

        foreach ($campos as $campo) {
            // campo tiene forma: documento_licencia_c3 → extraer 'C3'
            if (! preg_match('/^documento_licencia_([a-c][1-3])$/i', $campo, $m)) {
                continue;
            }
            $cat = strtoupper($m[1]);
            if (($orden[$cat] ?? 0) > $prioridad) {
                $prioridad = $orden[$cat];
                $masAlta   = $cat;
            }
        }

        return $masAlta;
    }
}

