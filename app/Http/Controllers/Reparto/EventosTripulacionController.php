<?php

namespace App\Http\Controllers\Reparto;

use App\Models\Reparto\EventosTripulacion;
use App\Models\Reparto\ChecklistVehiculo;
use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class EventosTripulacionController
{
    // =========================================================================
    // CONSTANTES DE IMPORTACIÓN
    // =========================================================================

    /**
     * Mapa flexible: variante del encabezado (normalizada) → campo del modelo.
     * Cubre los 19 campos del Excel más sus variantes tipográficas habituales.
     */
    private const COLUMN_MAP = [
        // Temporalidad
        'año'                               => 'anio',
        'ano'                               => 'anio',
        'anio'                              => 'anio',
        'year'                              => 'anio',
        'mes'                               => 'mes',
        'month'                             => 'mes',

        // Fecha
        'fecha'                             => 'fecha',
        'date'                              => 'fecha',

        // Vehículo / ruta
        'placa'                             => 'placa',
        'placa vehiculo'                    => 'placa',
        'placa_vehiculo'                    => 'placa',

        // Documento de transporte
        'transporte'                        => 'doc_transporte',
        'doc transporte'                    => 'doc_transporte',
        'doc_transporte'                    => 'doc_transporte',
        'documento transporte'              => 'doc_transporte',
        'documento_transporte'              => 'doc_transporte',
        'docto transporte'                  => 'doc_transporte',
        'docto_transporte'                  => 'doc_transporte',
        'otm'                               => 'doc_transporte',

        // Identificadores regionales
        'rr'                                => 'rr',
        'rr pasto'                          => 'rr_pasto',
        'rr_pasto'                          => 'rr_pasto',
        'rrpasto'                           => 'rr_pasto',

        // Persona
        'cedula'                            => 'documento',
        'cédula'                            => 'documento',
        'documento'                         => 'documento',
        'cedula conductor'                  => 'documento',
        'cedula_conductor'                  => 'documento',
        'cc'                                => 'documento',
        'identificacion'                    => 'documento',
        'identificación'                    => 'documento',
        'nombre'                            => 'nombre',
        'nombres'                           => 'nombre',
        'nombre conductor'                  => 'nombre',
        'nombre completo'                   => 'nombre',
        'cargo'                             => 'cargo',
        'rol'                               => 'cargo',

        // Indicadores de eventos (enteros)
        '# de excesos de tiempo en ruta'    => 'excesos_tiempo_ruta',
        '# excesos de tiempo en ruta'       => 'excesos_tiempo_ruta',
        '# de excesos tiempo en ruta'       => 'excesos_tiempo_ruta',
        '# excesos tiempo en ruta'          => 'excesos_tiempo_ruta',
        '# de excesos de tiempo ruta'       => 'excesos_tiempo_ruta',
        '# excesos de tiempo ruta'          => 'excesos_tiempo_ruta',
        '# de excesos tiempo ruta'          => 'excesos_tiempo_ruta',
        '# excesos tiempo ruta'             => 'excesos_tiempo_ruta',
        '# de excesos'                      => 'excesos_tiempo_ruta',
        '# excesos'                         => 'excesos_tiempo_ruta',
        'excesos de tiempo en ruta'         => 'excesos_tiempo_ruta',
        'excesos tiempo en ruta'            => 'excesos_tiempo_ruta',
        'excesos de tiempo ruta'            => 'excesos_tiempo_ruta',
        'excesos tiempo ruta'               => 'excesos_tiempo_ruta',
        'excesos_tiempo_ruta'               => 'excesos_tiempo_ruta',
        'exceso tiempo'                     => 'excesos_tiempo_ruta',
        'excesos tiempo'                    => 'excesos_tiempo_ruta',
        'excesos en ruta'                   => 'excesos_tiempo_ruta',
        'total excesos'                     => 'excesos_tiempo_ruta',
        'nro excesos tiempo ruta'           => 'excesos_tiempo_ruta',
        'numero excesos tiempo ruta'        => 'excesos_tiempo_ruta',
        'cantidad excesos tiempo ruta'      => 'excesos_tiempo_ruta',
        '# de alertas de velocidad en curvas' => 'alertas_velocidad_curvas',
        '# alertas de velocidad en curvas'  => 'alertas_velocidad_curvas',
        '# de alertas velocidad en curvas'  => 'alertas_velocidad_curvas',
        '# alertas velocidad en curvas'     => 'alertas_velocidad_curvas',
        '# de alertas de velocidad curvas'  => 'alertas_velocidad_curvas',
        '# alertas de velocidad curvas'     => 'alertas_velocidad_curvas',
        '# de alertas velocidad curvas'     => 'alertas_velocidad_curvas',
        '# alertas velocidad curvas'        => 'alertas_velocidad_curvas',
        '# de alertas'                      => 'alertas_velocidad_curvas',
        '# alertas'                         => 'alertas_velocidad_curvas',
        'alertas de velocidad en curvas'    => 'alertas_velocidad_curvas',
        'alertas velocidad en curvas'       => 'alertas_velocidad_curvas',
        'alertas de velocidad curvas'       => 'alertas_velocidad_curvas',
        'alertas velocidad curvas'          => 'alertas_velocidad_curvas',
        'alertas_velocidad_curvas'          => 'alertas_velocidad_curvas',
        'alertas velocidad'                 => 'alertas_velocidad_curvas',
        'total alertas'                     => 'alertas_velocidad_curvas',
        'alertas en curvas'                 => 'alertas_velocidad_curvas',
        'nro alertas velocidad curvas'      => 'alertas_velocidad_curvas',
        'numero alertas velocidad curvas'   => 'alertas_velocidad_curvas',
        'cantidad alertas velocidad curvas' => 'alertas_velocidad_curvas',
        'total eventos'                     => 'total_eventos',
        'total_eventos'                     => 'total_eventos',
        'cantidad eventos'                  => 'total_eventos',

        // Adherencias check list (%)
        'adherencia check list pre operacional'  => 'adherencia_checklist_pre',
        'adherencia checklist pre operacional'   => 'adherencia_checklist_pre',
        'adherencia check list pre'              => 'adherencia_checklist_pre',
        'adherencia checklist pre'               => 'adherencia_checklist_pre',
        'adherencia_checklist_pre'               => 'adherencia_checklist_pre',
        'checklist pre'                          => 'adherencia_checklist_pre',
        'check list pre'                         => 'adherencia_checklist_pre',
        'pre operacional'                        => 'adherencia_checklist_pre',
        'adherencia check list post operacional' => 'adherencia_checklist_post',
        'adherencia checklist post operacional'  => 'adherencia_checklist_post',
        'adherencia check list post'             => 'adherencia_checklist_post',
        'adherencia checklist post'              => 'adherencia_checklist_post',
        'adherencia_checklist_post'              => 'adherencia_checklist_post',
        'checklist post'                         => 'adherencia_checklist_post',
        'check list post'                        => 'adherencia_checklist_post',
        'post operacional'                       => 'adherencia_checklist_post',

        // Indicadores de desempeño
        'rendimiento de combustible'        => 'rendimiento_combustible',
        'rendimiento combustible'           => 'rendimiento_combustible',
        'rendimiento_combustible'           => 'rendimiento_combustible',
        'rend combustible'                  => 'rendimiento_combustible',
        'rend. combustible'                 => 'rendimiento_combustible',
        'combustible'                       => 'rendimiento_combustible',
        'modulacion'                        => 'modulacion',
        'modulación'                        => 'modulacion',
        'modularcion'                       => 'modulacion',   // typo frecuente
        '% adherencia al tiempo'            => 'adherencia_tiempo',
        'adherencia al tiempo'              => 'adherencia_tiempo',
        'adherencia tiempo'                 => 'adherencia_tiempo',
        'adherencia_tiempo'                 => 'adherencia_tiempo',
        '% adherencia tiempo'               => 'adherencia_tiempo',
        'entrega en rango'                  => 'entrega_en_rango',
        'entrega_en_rango'                  => 'entrega_en_rango',
        'entregas en rango'                 => 'entrega_en_rango',
        'entrega rango'                     => 'entrega_en_rango',
        'rechazos'                          => 'rechazos',
        'rechazo'                           => 'rechazos',
        'total rechazos'                    => 'rechazos',
        'rmd'                               => 'rmd',
    ];

    /** Campos de fecha → se convierten a Y-m-d */
    private const DATE_FIELDS = ['fecha'];

    /** Campos que vienen como porcentaje (0.85 → 85.00) */
    private const PCT_FIELDS = [
        'adherencia_checklist_pre',
        'adherencia_checklist_post',
        'adherencia_tiempo',
        'entrega_en_rango',
        'rechazos',         // viene como 0.035 → 3.50% o como 3.5 → 3.50%
    ];

    /** Campos enteros */
    private const INT_FIELDS = [
        'anio',
        'mes',
        'total_eventos',
        'alertas_velocidad_curvas',
    ];

    /**
     * Campos que vienen como tiempo (HH:MM:SS o HH:MM:SS a. m./p. m.)
     * → se convierten a minutos enteros para almacenar como SMALLINT.
     * Ej: "1:30:00" → 90 min | "10:00:00 a. m." → 600 min
     */
    private const TIME_AS_MINUTES_FIELDS = [
        'excesos_tiempo_ruta',
    ];

    /** Campos decimales que NO son porcentaje (pueden venir escalados) */
    private const DECIMAL_FIELDS = [
        'rendimiento_combustible',
    ];

    /** Mapa de meses en español/inglés → número */
    private const MESES_MAP = [
        'enero'=>1,'january'=>1,'jan'=>1,'ene'=>1,
        'febrero'=>2,'february'=>2,'feb'=>2,
        'marzo'=>3,'march'=>3,'mar'=>3,
        'abril'=>4,'april'=>4,'abr'=>4,'apr'=>4,
        'mayo'=>5,'may'=>5,
        'junio'=>6,'june'=>6,'jun'=>6,
        'julio'=>7,'july'=>7,'jul'=>7,
        'agosto'=>8,'august'=>8,'ago'=>8,'aug'=>8,
        'septiembre'=>9,'september'=>9,'sep'=>9,'sept'=>9,
        'octubre'=>10,'october'=>10,'oct'=>10,
        'noviembre'=>11,'november'=>11,'nov'=>11,
        'diciembre'=>12,'december'=>12,'dic'=>12,'dec'=>12,
    ];

    // =========================================================================
    /**
     * Mostrar lista de eventos de tripulación.
     *
     * Lee directamente de la tabla eventos_tripulacion, que se alimenta de:
     *  - Importación desde Excel (store)
     *  - Reprocesamiento desde alertas existentes (refresh)
     *
     * Enriquece cada fila con la adherencia_checklist calculada desde
     * checklist_vehiculos (columna virtual, no guardada en BD).
     */
    public function index(Request $request): Response
    {
        $query = EventosTripulacion::query()->orderByDesc('fecha');

        // ── Filtros ───────────────────────────────────────────────────────────
        if ($request->filled('placa')) {
            $query->where('placa', 'LIKE', strtoupper(trim($request->input('placa'))) . '%');
        }
        if ($request->filled('cedula')) {
            $query->where('documento', 'LIKE', trim($request->input('cedula')) . '%');
        }
        if ($request->filled('nombre')) {
            $query->where('nombre', 'LIKE', '%' . trim($request->input('nombre')) . '%');
        }
        if ($request->filled('doc_transporte')) {
            $query->where('doc_transporte', 'LIKE', '%' . trim($request->input('doc_transporte')) . '%');
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->input('fecha_desde'));
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->input('fecha_hasta'));
        }

        $paginator = $query->paginate(50)->withQueryString();

        // ── Adherencia Check List (enriquecimiento virtual) ───────────────────
        $rows = $paginator->getCollection();

        // Precarga checklist solo si hay registros
        $checklistMap = collect();
        if ($rows->isNotEmpty()) {
            $placasUnicas = $rows->pluck('placa')->filter()->unique()->values()->toArray();
            $fechasUnicas = $rows->pluck('fecha')
                ->filter()
                ->map(fn ($f) => Carbon::parse($f)->format('Y-m-d'))
                ->unique()->values()->toArray();

            if (!empty($placasUnicas) && !empty($fechasUnicas)) {
                $checklistMap = ChecklistVehiculo::query()
                    ->selectRaw('placa_vehiculo, DATE(fecha) as dia, MAX(cumpl) as max_cumpl')
                    ->whereIn('placa_vehiculo', $placasUnicas)
                    ->whereIn(DB::raw('DATE(fecha)'), $fechasUnicas)
                    ->where('operacion', 'Salida')
                    ->whereIn('estado', ['Aprobado', 'Finalizado'])
                    ->groupByRaw('placa_vehiculo, DATE(fecha)')
                    ->get()
                    ->keyBy(fn ($r) => $r->placa_vehiculo . '|' . $r->dia);
            }
        }

        // Serializar a arrays planos — evita que Eloquent envíe objetos Carbon
        // o propiedades dinámicas que Inertia no serializa de forma predecible
        $eventos = $rows->map(function ($evento) use ($checklistMap) {
            $dia = $evento->fecha ? Carbon::parse($evento->fecha)->format('Y-m-d') : null;
            $clKey = $evento->placa && $dia ? ($evento->placa . '|' . $dia) : null;
            $cl = $clKey ? $checklistMap->get($clKey) : null;

            return [
                'id'                       => $evento->id,
                'fecha'                    => $dia,
                'placa'                    => $evento->placa,
                'doc_transporte'           => $evento->doc_transporte,
                'anio'                     => $evento->anio,
                'mes'                      => $evento->mes,
                'rr'                       => $evento->rr,
                'rr_pasto'                 => $evento->rr_pasto,
                'documento'                => $evento->documento,
                'nombre'                   => $evento->nombre,
                'cargo'                    => $evento->cargo,
                'total_eventos'            => $evento->total_eventos,
                'excesos_tiempo_ruta'      => $evento->excesos_tiempo_ruta,
                'alertas_velocidad_curvas' => $evento->alertas_velocidad_curvas,
                'adherencia_checklist_pre' => $evento->adherencia_checklist_pre !== null
                    ? (float) $evento->adherencia_checklist_pre : null,
                'adherencia_checklist_post'=> $evento->adherencia_checklist_post !== null
                    ? (float) $evento->adherencia_checklist_post : null,
                'rendimiento_combustible'  => $evento->rendimiento_combustible !== null
                    ? (float) $evento->rendimiento_combustible : null,
                'modulacion'               => $evento->modulacion,
                'adherencia_tiempo'        => $evento->adherencia_tiempo !== null
                    ? (float) $evento->adherencia_tiempo : null,
                'entrega_en_rango'         => $evento->entrega_en_rango !== null
                    ? (float) $evento->entrega_en_rango : null,
                'rechazos'                 => $evento->rechazos,
                'rmd'                      => $evento->rmd,
                'adherencia_checklist'     => $cl !== null
                    ? round((float) $cl->max_cumpl, 2) : null,
                'created_at'               => $evento->created_at?->toDateTimeString(),
            ];
        });

        // Reemplazar la colección del paginador con los arrays planos
        $paginator->setCollection($eventos);

        return Inertia::render('reparto/eventos-tripulacion/index', [
            'eventos' => $paginator,
            'filters' => [
                'placa'          => $request->input('placa', ''),
                'cedula'         => $request->input('cedula', ''),
                'nombre'         => $request->input('nombre', ''),
                'doc_transporte' => $request->input('doc_transporte', ''),
                'fecha_desde'    => $request->input('fecha_desde', ''),
                'fecha_hasta'    => $request->input('fecha_hasta', ''),
            ],
            'flash' => session()->only(['success', 'error']),
        ]);
    }

    /**
     * Actualizar/re-procesar eventos desde alertas existentes.
     *
     * Lógica correcta:
     *  1. Agrupar alertas por fecha+placa y SUMAR todos los eventos del día.
     *  2. Por cada grupo, buscar la modulación de ese día para esa placa.
     *  3. Asignar el total sumado a cada colaborador de la tripulación.
     */
    public function refresh(Request $request)
    {
        try {
            // Precarga de cédulas y nombres completos de colaboradores existentes (O(1) lookup)
            $colaboradoresMap = Colaborador::query()
                ->whereNotNull('cedula')
                ->get(['cedula', 'nombres', 'apellidos'])
                ->mapWithKeys(function ($colab) {
                    $ced = trim((string) $colab->cedula);
                    $nom = trim("{$colab->nombres} {$colab->apellidos}");
                    return [$ced => $nom];
                })
                ->toArray();
            $totalColaboradores = count($colaboradoresMap);
            Log::info("[EventosTripulacion::refresh] Colaboradores cargados en memoria: {$totalColaboradores}");

            // Paso 1: agrupar por fecha+placa, sumar cantidad_eventos
            // Se usa DATE(fecha) para normalizar y se incluye el mes para validación
            $grupos = \App\Models\Reparto\AlertaVelocidadCurva::query()
                ->selectRaw('DATE(fecha) as fecha, mes, nombre as placa, SUM(COALESCE(cantidad_eventos, 1)) as total_eventos')
                ->whereNotNull('nombre')
                ->whereNotNull('fecha')
                ->groupBy(DB::raw('DATE(fecha)'), 'mes', 'nombre')
                ->get();

            $eventosCreados        = 0;
            $sinModulacion         = 0;
            $omitidosSinColaborador = 0;

            foreach ($grupos as $grupo) {
                $placa        = strtoupper(trim($grupo->placa));
                // DATE(fecha) ya devuelve string Y-m-d, pero normalizamos por seguridad
                $fecha        = $grupo->fecha ? Carbon::parse($grupo->fecha)->format('Y-m-d') : null;
                $totalEventos = (int) $grupo->total_eventos;

                if (!$fecha) continue;

                try {
                    // Paso 2: buscar modulación para esa fecha exacta y placa
                    $modulacion = \App\Models\Reparto\Modulacion::whereHas('items', function ($q) use ($placa) {
                            $q->where('placa', $placa);
                        })
                        ->whereDate('fecha', $fecha)
                        ->with('items')
                        ->first();

                    if (!$modulacion) {
                        $sinModulacion++;
                        continue;
                    }

                    $item = $modulacion->items()->where('placa', $placa)->first();
                    if (!$item || !$item->tripulacion) continue;

                    // Paso 3: crear/actualizar un registro por colaborador con el total real
                    foreach ($item->tripulacion as $persona) {
                        $documento = $persona['cedula'] ?? $persona['documento'] ?? null;
                        $nombreRaw = $persona['nombres'] ?? $persona['nombre'] ?? null;

                        // ✅ VALIDACIÓN: solo guardar si la cédula existe en la tabla colaboradores
                        $docLimpio = $documento ? trim((string) $documento) : null;
                        if (!$docLimpio || !array_key_exists($docLimpio, $colaboradoresMap)) {
                            $omitidosSinColaborador++;
                            Log::debug("[EventosTripulacion::refresh] Omitido - cédula no registrada: "
                                . ($docLimpio ?? 'VACÍO')
                                . " | fecha: {$fecha} | placa: {$placa}");
                            continue;
                        }

                        // El nombre se toma directamente de la tabla colaboradores
                        $nombreFinal = $colaboradoresMap[$docLimpio] ?: $nombreRaw;

                        EventosTripulacion::updateOrCreate(
                            [
                                'fecha'     => $fecha,
                                'placa'     => $placa,
                                'documento' => $documento,
                            ],
                            [
                                'doc_transporte' => $item->doc_tras ?? null,
                                'nombre'         => $nombreFinal,
                                'cargo'          => $persona['cargo'] ?? null,
                                'total_eventos'  => $totalEventos,
                            ]
                        );

                        $eventosCreados++;
                    }
                } catch (\Exception $e) {
                    \Log::warning("EventosTripulacion::refresh - error en {$fecha}/{$placa}: " . $e->getMessage());
                    continue;
                }
            }

            $msg = "✅ Actualización completada.\n";
            $msg .= "• Registros creados/actualizados: {$eventosCreados}\n";
            $msg .= "• Grupos sin modulación: {$sinModulacion}\n";
            if ($omitidosSinColaborador > 0) {
                $msg .= "• ⚠ Omitidos (cédula no en tabla colaboradores): {$omitidosSinColaborador}";
            }
            Log::info("[EventosTripulacion::refresh] Resumen - creados: {$eventosCreados} | sin modulacion: {$sinModulacion} | omitidos por cédula inválida: {$omitidosSinColaborador}");

            return redirect()->route('reparto.eventos-tripulacion.index')
                ->with('success', $msg);

        } catch (\Exception $e) {
            \Log::error('Error en EventosTripulacionController::refresh', ['error' => $e->getMessage()]);
            return back()->withErrors(['error' => 'Error al actualizar eventos: ' . $e->getMessage()]);
        }
    }

    // =========================================================================
    // IMPORTACIÓN DESDE EXCEL
    // =========================================================================

    /**
     * Procesa el archivo Excel/CSV y guarda los registros en eventos_tripulacion.
     * Usa upsert por (fecha, placa, documento) para no crear duplicados al
     * reimportar; si el documento está vacío se usa (fecha, placa, rr) como clave.
     */
    public function store(Request $request): RedirectResponse
    {
        set_time_limit(300);
        ini_set('memory_limit', '512M');

        // Detectar si PHP rechazó el archivo por límite de tamaño antes de llegar al controller
        // En ese caso el archivo llega como UPLOAD_ERR_INI_SIZE o UPLOAD_ERR_FORM_SIZE
        if ($request->hasFile('archivo')) {
            $uploadError = $request->file('archivo')->getError();
            if ($uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE) {
                return back()->with('error', '❌ El archivo supera el límite de tamaño permitido por el servidor. Intenta dividirlo en partes más pequeñas o contacta al administrador para aumentar el límite.');
            }
        }

        // Si no llegó ningún archivo (request vacío por límite PHP post_max_size)
        if (!$request->hasFile('archivo') && empty($_FILES)) {
            return back()->with('error', '❌ El archivo no pudo ser recibido. Es posible que supere el límite del servidor (post_max_size). Intenta con un archivo más pequeño.');
        }

        $request->validate([
            'archivo' => 'required|file|mimes:xlsx,xls,csv|max:20480',
        ], [
            'archivo.required' => 'Debes seleccionar un archivo.',
            'archivo.mimes'    => 'El archivo debe ser Excel (.xlsx, .xls) o CSV.',
            'archivo.max'      => 'El archivo no puede superar 20 MB.',
        ]);

        try {
            $path        = $request->file('archivo')->getPathname();
            $reader      = IOFactory::createReaderForFile($path);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($path);
            $sheet       = $spreadsheet->getActiveSheet();
            $highestRow  = $sheet->getHighestDataRow();
            $highestCol  = $sheet->getHighestDataColumn();

            // ── 1. Leer y normalizar encabezados ──────────────────────────
            $fieldMap              = [];
            $rawHeaders            = [];
            $encabezadosNoMapeados = [];

            foreach ($sheet->getRowIterator(1, 1) as $row) {
                $ci              = 0;
                $camposAsignados = [];
                foreach ($row->getCellIterator('A', $highestCol) as $cell) {
                    $raw             = trim((string) $cell->getValue());
                    $rawHeaders[$ci] = $raw;
                    $norm            = $this->normalizeHeader($raw);

                    $field = self::COLUMN_MAP[$norm] ?? $this->fuzzyMatchHeader($norm);

                    // Encabezado duplicado: ya asignado → ignorar segunda aparición
                    if ($field !== null && in_array($field, $camposAsignados, true)) {
                        $field = null;
                    }

                    $fieldMap[$ci] = $field;

                    if ($field !== null) {
                        $camposAsignados[] = $field;
                    } elseif ($raw !== '') {
                        $encabezadosNoMapeados[] = $raw;
                    }
                    $ci++;
                }
            }

            Log::info('[EventosTripulacion] Headers: ' . json_encode($rawHeaders));
            Log::info('[EventosTripulacion] Mapeo: ' . json_encode($fieldMap));
            if (!empty($encabezadosNoMapeados)) {
                Log::warning('[EventosTripulacion] Sin mapeo: ' . json_encode($encabezadosNoMapeados));
            }

            // ── 2. Precarga colaboradores registrados ─────────────────────
            // ✅ VALIDACIÓN REQUERIDA: solo se aceptan cédulas que existan en la tabla colaboradores.
            // Se arma un hashmap (cedula => nombre_completo) para validación O(1) y asignación del nombre oficial.
            $colaboradoresMap = Colaborador::query()
                ->whereNotNull('cedula')
                ->get(['cedula', 'nombres', 'apellidos'])
                ->mapWithKeys(function ($colab) {
                    $ced = trim((string) $colab->cedula);
                    $nom = trim("{$colab->nombres} {$colab->apellidos}");
                    return [$ced => $nom];
                })
                ->toArray();
            $totalColaboradores = count($colaboradoresMap);
            Log::info("[EventosTripulacion::store] Colaboradores registrados cargados: {$totalColaboradores}");

            // ── 3. Precargar claves únicas existentes ─────────────────────
            // Clave de deduplicación: "fecha|placa|documento"
            // Si documento es null se usa "fecha|placa|rr" como fallback.
            $existentes = EventosTripulacion::query()
                ->select(['fecha', 'placa', 'documento', 'rr'])
                ->get()
                ->mapWithKeys(function ($row) {
                    $doc = $row->documento ?? $row->rr ?? '';
                    $dia = $row->fecha ? Carbon::parse($row->fecha)->format('Y-m-d') : '';
                    return [$dia . '|' . $row->placa . '|' . $doc => true];
                })
                ->toArray();

            // ── 4. Procesar filas ─────────────────────────────────────────
            $insertados                 = 0;
            $actualizados               = 0;
            $omitidos                   = 0;
            $omitidosSinColaborador     = 0;
            $cedulasNoEncontradas       = [];   // para mostrar ejemplos al usuario
            $cedulasNoEncontradasSet    = [];   // para evitar duplicados en la lista
            $batch                      = [];
            $now                        = now()->toDateTimeString();

            for ($rowNum = 2; $rowNum <= $highestRow; $rowNum++) {
                $rowValues = [];
                $ci        = 0;
                foreach ($sheet->getRowIterator($rowNum, $rowNum) as $row) {
                    foreach ($row->getCellIterator('A', $highestCol) as $cell) {
                        $rowValues[$ci] = $cell->getValue();
                        $ci++;
                    }
                }

                // Saltar filas completamente vacías
                $allEmpty = true;
                foreach ($rowValues as $v) {
                    if ($v !== null && $v !== '') { $allEmpty = false; break; }
                }
                if ($allEmpty) continue;

                // Construir array campo => valor
                $data = [];
                foreach ($fieldMap as $idx => $field) {
                    if ($field === null) continue;
                    $data[$field] = $this->castValue($field, $rowValues[$idx] ?? null);
                }

                // Corregir fecha usando el campo "mes" si hay discrepancia
                if (!empty($data['mes']) && !empty($data['fecha'])) {
                    try {
                        $carbonFecha = Carbon::parse($data['fecha']);
                        if ($carbonFecha->month !== (int) $data['mes']) {
                            $data['fecha'] = Carbon::createFromDate(
                                $carbonFecha->year,
                                (int) $data['mes'],
                                $carbonFecha->day
                            )->format('Y-m-d');
                        }
                    } catch (\Throwable) {
                        // dejar la fecha como vino
                    }
                }

                // Rellenar anio/mes desde la fecha si no vinieron del Excel
                if (!empty($data['fecha'])) {
                    try {
                        $cf = Carbon::parse($data['fecha']);
                        $data['anio'] = $data['anio'] ?? $cf->year;
                        $data['mes']  = $data['mes']  ?? $cf->month;
                    } catch (\Throwable) {}
                }

                // Omitir si no hay fecha ni placa (fila inútil), o si falta la placa (campo NOT NULL)
                if (empty($data['fecha']) && empty($data['placa'])) {
                    $omitidos++;
                    continue;
                }
                if (empty($data['placa'])) {
                    $omitidos++;
                    Log::debug("[EventosTripulacion::store] Fila {$rowNum} omitida - placa vacía | fecha: " . ($data['fecha'] ?? '?') . " | doc: " . ($data['documento'] ?? '?'));
                    continue;
                }

                // ✅ VALIDACIÓN REQUERIDA: la CÉDULA (documento) debe existir en tabla colaboradores
                $docLimpio = !empty($data['documento']) ? trim((string) $data['documento']) : null;
                if ($docLimpio === null || !array_key_exists($docLimpio, $colaboradoresMap)) {
                    $omitidosSinColaborador++;

                    // Guardar hasta 10 ejemplos únicos de cédulas no encontradas para el reporte
                    if ($docLimpio !== null && count($cedulasNoEncontradas) < 10 && !isset($cedulasNoEncontradasSet[$docLimpio])) {
                        $cedulasNoEncontradas[] = $docLimpio;
                        $cedulasNoEncontradasSet[$docLimpio] = true;
                    }

                    Log::debug(
                        "[EventosTripulacion::store] Fila {$rowNum} omitida - cédula no registrada en colaboradores: "
                        . ($docLimpio ?? 'VACÍO')
                        . " | fecha: " . ($data['fecha'] ?? '?')
                        . " | placa: " . ($data['placa'] ?? '?')
                    );
                    continue;
                }

                // El nombre SIEMPRE se toma de la tabla colaboradores (nombres + apellidos)
                if (!empty($colaboradoresMap[$docLimpio])) {
                    $data['nombre'] = $colaboradoresMap[$docLimpio];
                }

                // Clave de deduplicación
                $docKey = $data['documento'] ?? $data['rr'] ?? '';
                $diaKey = !empty($data['fecha']) ? Carbon::parse($data['fecha'])->format('Y-m-d') : '';
                $placaKey = $data['placa'] ?? '';
                $key = $diaKey . '|' . $placaKey . '|' . $docKey;

                if (isset($existentes[$key])) {
                    // Actualizar registro existente en vez de duplicar
                    $actualizados++;
                    EventosTripulacion::where('fecha', $diaKey)
                        ->where('placa', $placaKey)
                        ->where(function ($q) use ($data) {
                            if (!empty($data['documento'])) {
                                $q->where('documento', $data['documento']);
                            } else {
                                $q->where('rr', $data['rr'] ?? null);
                            }
                        })
                        ->update(array_merge($data, ['updated_at' => $now]));
                    continue;
                }

                $existentes[$key] = true;
                $data['created_at'] = $now;
                $data['updated_at'] = $now;
                $batch[]            = $data;
                $insertados++;

                if (count($batch) >= 200) {
                    // Filtrar por seguridad: descartar filas sin placa antes del insert bulk
                    $batchValido = array_filter($batch, fn($r) => !empty($r['placa']));
                    if (!empty($batchValido)) {
                        EventosTripulacion::insert(array_values($batchValido));
                    }
                    $batch = [];
                }
            }

            if (!empty($batch)) {
                $batchValido = array_filter($batch, fn($r) => !empty($r['placa']));
                if (!empty($batchValido)) {
                    EventosTripulacion::insert(array_values($batchValido));
                }
            }

            // Log resumen de la importación
            Log::info("[EventosTripulacion::store] Resumen importacion: "
                . "nuevos={$insertados} | "
                . "actualizados={$actualizados} | "
                . "omitidos_sin_fecha_placa={$omitidos} | "
                . "omitidos_cedula_no_registrada={$omitidosSinColaborador} | "
                . "total_colaboradores_validos={$totalColaboradores}"
            );
            if (!empty($cedulasNoEncontradas)) {
                Log::warning("[EventosTripulacion::store] Muestra de cédulas NO encontradas en tabla colaboradores: "
                    . implode(', ', $cedulasNoEncontradas));
            }

            $msg = "✅ Importación completada.\n";
            $msg .= "• Nuevos registros: {$insertados}\n";
            if ($actualizados > 0) $msg .= "• Actualizados: {$actualizados}\n";
            if ($omitidos > 0)     $msg .= "• Filas sin fecha/placa: {$omitidos}\n";
            if ($omitidosSinColaborador > 0) {
                $msg .= "• ⚠ Filas omitidas (cédula NO está en tabla colaboradores): {$omitidosSinColaborador}";
                if (!empty($cedulasNoEncontradas)) {
                    $msg .= "\n  Ejemplos: " . implode(', ', $cedulasNoEncontradas);
                    if ($omitidosSinColaborador > count($cedulasNoEncontradas)) {
                        $msg .= " ...y " . ($omitidosSinColaborador - count($cedulasNoEncontradas)) . " más.";
                    }
                }
                $msg .= "\n  Primero debes cargar el colaborador en el módulo de Gente/Colaboradores.";
            }
            if (!empty($encabezadosNoMapeados)) {
                $msg .= "\n• ⚠ Columnas no reconocidas: " . implode(', ', $encabezadosNoMapeados);
            }

            return back()->with('success', $msg);

        } catch (\Throwable $e) {
            Log::error('[EventosTripulacion] Error importando: ' . $e->getMessage());
            return back()->with('error', '❌ Error al procesar el archivo: ' . $e->getMessage());
        }
    }

    /**
     * Descarga una plantilla Excel con los encabezados correctos.
     */
    public function downloadTemplate(): HttpResponse|\Symfony\Component\HttpFoundation\StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Eventos Tripulación');

        $headers = [
            'AÑO',
            'MES',
            'FECHA',
            'PLACA',
            'TRANSPORTE',
            'RR',
            'RR PASTO',
            'CEDULA',
            'CARGO',
            '# DE EXCESOS DE TIEMPO EN RUTA',
            '# DE ALERTAS DE VELOCIDAD EN CURVAS',
            'ADHERENCIA CHECK LIST PRE OPERACIONAL',
            'ADHERENCIA CHECK LIST POST OPERACIONAL',
            'RENDIMIENTO DE COMBUSTIBLE',
            'MODULACION',
            '% ADHERENCIA AL TIEMPO',
            'ENTREGA EN RANGO',
            'RECHAZOS',
            'RMD',
        ];

        foreach ($headers as $col => $header) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col + 1);
            $cell      = $sheet->getCell($colLetter . '1');
            $cell->setValue($header);

            // Estilo del encabezado
            $cell->getStyle()->getFont()->setBold(true);
            $cell->getStyle()->getFill()
                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                ->getStartColor()->setRGB('1E40AF'); // azul oscuro
            $cell->getStyle()->getFont()->getColor()->setRGB('FFFFFF');
            $cell->getStyle()->getAlignment()
                ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

            $sheet->getColumnDimension($colLetter)->setAutoSize(true);
        }

        // Fila de ejemplo
        $example = [
            '2026', '8', '2026-08-28', 'COLJV386', '8008417416',
            'REGIONAL SUR', 'PASTO', '1085279964', 'CONDUCTOR DE REPARTO',
            '2', '5', '95.00', '88.50', '12.5', 'NORMAL',
            '90.00', '85.00', '1', 'ACTIVO',
        ];
        foreach ($example as $col => $val) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col + 1);
            $sheet->getCell($colLetter . '2')->setValue($val);
        }

        $writer   = new Xlsx($spreadsheet);
        $filename = 'plantilla_eventos_tripulacion.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    // =========================================================================
    // HELPERS DE IMPORTACIÓN
    // =========================================================================

    /** Normaliza un encabezado para compararlo con COLUMN_MAP */
    private function normalizeHeader(string $header): string
    {
        $h = mb_strtolower(trim($header));
        $h = str_replace(
            ["\xC2\xA0", "\r\n", "\r", "\n", "\t"],
            [' ',          ' ',   ' ',  ' ',  ' '],
            $h
        );
        $h = str_replace(['á','é','í','ó','ú','ü','ñ'], ['a','e','i','o','u','u','n'], $h);
        $h = preg_replace('/\s+/', ' ', $h);
        return trim($h);
    }

    /** Coincidencia difusa para encabezados no previstos en el mapa exacto */
    private function fuzzyMatchHeader(string $norm): ?string
    {
        $compact = preg_replace('/[\s_\-\.#%]+/', '', $norm);

        // Excesos de tiempo en ruta — combinaciones de palabras clave
        if ((str_contains($compact, 'exceso') || str_contains($compact, 'excesos'))
            && (str_contains($compact, 'tiempo') || str_contains($compact, 'ruta'))) {
            return 'excesos_tiempo_ruta';
        }
        // Alertas de velocidad en curvas — combinaciones de palabras clave
        if ((str_contains($compact, 'alerta') || str_contains($compact, 'alertas'))
            && (str_contains($compact, 'velocidad') || str_contains($compact, 'curva') || str_contains($compact, 'curvas'))) {
            return 'alertas_velocidad_curvas';
        }
        // Adherencia checklist pre
        if (str_contains($compact, 'adherencia') && (str_contains($compact, 'pre') || str_contains($compact, 'preoperacional'))) {
            return 'adherencia_checklist_pre';
        }
        // Adherencia checklist post
        if (str_contains($compact, 'adherencia') && (str_contains($compact, 'post') || str_contains($compact, 'postoperacional'))) {
            return 'adherencia_checklist_post';
        }
        // Adherencia al tiempo (debe ir DESPUES de checklist pre/post para no matchearlos)
        if (str_contains($compact, 'adherencia') && str_contains($compact, 'tiempo')) {
            return 'adherencia_tiempo';
        }
        // Rendimiento combustible
        if ((str_contains($compact, 'rendimiento') || str_contains($compact, 'rend') || str_contains($compact, 'combustible'))
            && (str_contains($compact, 'combustible') || str_contains($compact, 'galon') || str_contains($compact, 'consumo'))) {
            return 'rendimiento_combustible';
        }
        // Entrega en rango
        if (str_contains($compact, 'entrega') && str_contains($compact, 'rango')) {
            return 'entrega_en_rango';
        }
        // Fallback: checklist via "check" o "list" + pre/post
        if (str_contains($compact, 'check') || str_contains($compact, 'list')) {
            if (str_contains($compact, 'pre')) return 'adherencia_checklist_pre';
            if (str_contains($compact, 'post')) return 'adherencia_checklist_post';
        }
        // Total eventos / cantidad eventos fallback
        if (str_contains($compact, 'total') && str_contains($compact, 'evento')) {
            return 'total_eventos';
        }

        return null;
    }

    /** Convierte un valor crudo al tipo correcto según el campo */
    private function castValue(string $field, mixed $raw): mixed
    {
        if ($raw === null || $raw === '') return null;

        // Fechas
        if (in_array($field, self::DATE_FIELDS, true)) {
            if (is_numeric($raw)) {
                try {
                    return ExcelDate::excelToDateTimeObject((float) $raw)->format('Y-m-d');
                } catch (\Throwable) {}
            }
            $str = trim((string) $raw);
            $strNorm = preg_replace('/\s*a\.\s*m\.\s*/i', ' AM ', $str);
            $strNorm = preg_replace('/\s*p\.\s*m\.\s*/i', ' PM ', $strNorm);
            $strNorm = preg_replace('/\s*a\.\s*m\s*/i', ' AM ', $strNorm);
            $strNorm = preg_replace('/\s*p\.\s*m\s*/i', ' PM ', $strNorm);
            $strNorm = preg_replace('/\s+/', ' ', trim($strNorm));

            try {
                if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/', $strNorm, $pm)) {
                    $strNorm = "{$pm[1]}-{$pm[2]}-{$pm[3]}" . (strlen($strNorm) > strlen($pm[0]) ? substr($strNorm, strlen($pm[0])) : '');
                }
                return Carbon::parse($strNorm)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }

        // Tiempos → minutos enteros
        // Acepta: "1:30:00", "10:00:00 a. m.", "08:20:00 a. m.", "0:15:00 p. m.", serial Excel (fracción de día)
        if (in_array($field, self::TIME_AS_MINUTES_FIELDS, true)) {
            // Serial numérico de Excel (fracción del día: 0.5 = 12h = 720 min)
            if (is_numeric($raw)) {
                $val = (float) $raw;
                // Si es un entero puro (0, 1, 2…) ya es un conteo, no un tiempo
                if ($val == (int) $val && $val >= 0 && $val < 1441) {
                    return (int) $val;
                }
                // Fracción de día
                return (int) round($val * 1440);
            }

            $str = trim((string) $raw);
            $isPm = (bool) preg_match('/p\.\s*m\.|pm/i', $str);
            $isAm = (bool) preg_match('/a\.\s*m\.|am/i', $str);

            $strClean = trim(preg_replace('/\s*(a\.\s*m\.|p\.\s*m\.|am|pm)/i', '', $str));

            // Formato HH:MM:SS o H:MM:SS o H:MM
            if (preg_match('/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/', $strClean, $m)) {
                $horas    = (int) $m[1];
                $minutos  = (int) $m[2];
                $segundos = isset($m[3]) ? (int) $m[3] : 0;

                if ($isPm && $horas < 12) {
                    $horas += 12;
                } elseif ($isAm && $horas === 12) {
                    $horas = 0;
                }

                return $horas * 60 + $minutos + (int) round($segundos / 60);
            }

            // Si solo vino un número (texto), tratar como minutos
            if (is_numeric($strClean)) {
                return (int) $strClean;
            }

            return null;
        }

        // Porcentajes: Excel guarda 85% como 0.85 → ×100; texto "85.80%" → limpiar y usar directo
        if (in_array($field, self::PCT_FIELDS, true)) {
            // Si viene como string con símbolo %, limpiar y usar el valor directo
            if (is_string($raw)) {
                $cleaned = trim(str_replace(['%', ' '], '', $raw));
                if (is_numeric($cleaned)) {
                    $val = (float) $cleaned;
                    // Si ya viene como porcentaje legible (ej: 85.80), usar directo
                    // Si viene como decimal (ej: 0.858), escalar ×100
                    return $val <= 1.0 ? round($val * 100, 2) : round($val, 2);
                }
                return null; // "SIN CALIFICACION" u otro texto → null
            }
            if (!is_numeric($raw)) return null;
            $val = (float) $raw;
            return $val <= 1.0 ? round($val * 100, 2) : round($val, 2);
        }

        // Mes: número o nombre
        if ($field === 'mes') {
            if (is_numeric($raw)) return (int) $raw;
            $key = mb_strtolower(trim((string) $raw));
            $key = str_replace(['á','é','í','ó','ú'], ['a','e','i','o','u'], $key);
            return self::MESES_MAP[$key] ?? null;
        }

        // Enteros
        if (in_array($field, self::INT_FIELDS, true)) {
            if (!is_numeric($raw)) return null;  // "SIN CALIFICACION" u otro texto → null
            return (int) $raw;
        }

        // Decimales simples (pueden venir con % como texto, ej: "1249.88%")
        if (in_array($field, self::DECIMAL_FIELDS, true)) {
            if (is_string($raw)) {
                $cleaned = trim(str_replace(['%', ' '], '', $raw));
                if (is_numeric($cleaned)) return round((float) $cleaned, 4);
                return null;
            }
            if (!is_numeric($raw)) return null;  // "SIN CALIFICACION" u otro texto → null
            return round((float) $raw, 4);
        }

        // Texto: limpiar NBSP y espacios de Excel
        $str = (string) $raw;
        if (is_float($raw) && $raw == (int) $raw) {
            $str = (string) (int) $raw; // evita "1085279964.0"
        }
        $str = str_replace("\xC2\xA0", ' ', $str);
        return trim($str) === '' ? null : trim($str);
    }
}
