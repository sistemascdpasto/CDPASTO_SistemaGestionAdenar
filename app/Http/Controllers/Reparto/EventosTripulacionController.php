<?php

namespace App\Http\Controllers\Reparto;

use App\Models\Reparto\AlertaVelocidadCurva;
use App\Models\Reparto\ChecklistVehiculo;
use App\Models\Reparto\EventosTripulacion;
use App\Models\Reparto\Modulacion;
use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class EventosTripulacionController
{
    // =========================================================================
    // CONSTANTES
    // =========================================================================

    /**
     * campo del modelo → variantes del encabezado (ya normalizadas:
     * minúsculas, sin tildes, espacios simples).
     */
    private const HEADER_ALIASES = [
        'doc_transporte' => [
            'transporte', 'doc transporte', 'doc_transporte', 'documento transporte',
            'documento_transporte', 'docto transporte', 'docto_transporte', 'otm', 'numero',
        ],
        'placa' => ['placa', 'placa vehiculo', 'placa_vehiculo'],
        'entrega_en_rango' => [
            'entrega en rango', 'entrega_en_rango', 'entregas en rango', 'entrega rango',
        ],
        'rechazos' => ['rechazos', 'rechazo', 'total rechazos'],
        'alertas_velocidad_curvas' => [
            '# de alertas de velocidad en curvas', '# alertas de velocidad en curvas',
            '# de alertas velocidad en curvas', '# alertas velocidad en curvas',
            '# de alertas', '# alertas', 'alertas de velocidad en curvas',
            'alertas velocidad en curvas', 'alertas velocidad curvas',
            'alertas_velocidad_curvas', 'alertas velocidad', 'total alertas',
        ],
        'adherencia_tiempo' => [
            '% adherencia al tiempo', 'adherencia al tiempo', 'adherencia tiempo',
            'adherencia_tiempo', '% adherencia tiempo',
        ],
        'modulacion' => ['modulacion', 'modularcion'],
        'adherencia_checklist_pre' => [
            'adherencia check list pre operacional', 'adherencia checklist pre operacional',
            'adherencia check list pre', 'adherencia checklist pre', 'adherencia_checklist_pre',
            'checklist pre', 'check list pre', 'pre operacional',
        ],
        'adherencia_checklist_post' => [
            'adherencia check list post operacional', 'adherencia checklist post operacional',
            'adherencia check list post', 'adherencia checklist post', 'adherencia_checklist_post',
            'checklist post', 'check list post', 'post operacional',
        ],
        'rmd' => ['rmd'],
    ];

    /**
     * Reglas difusas, en orden de prioridad.
     * Cada regla: campo => lista de grupos; TODOS los grupos deben tener
     * al menos una coincidencia en el encabezado compactado.
     */
    private const FUZZY_RULES = [
        ['alertas_velocidad_curvas', [['alerta'], ['velocidad', 'curva']]],
        ['adherencia_checklist_pre', [['adherencia'], ['pre']]],
        ['adherencia_checklist_post', [['adherencia'], ['post']]],
        ['adherencia_tiempo', [['adherencia'], ['tiempo']]],
        ['entrega_en_rango', [['entrega'], ['rango']]],
        ['adherencia_checklist_pre', [['check', 'list'], ['pre']]],
        ['adherencia_checklist_post', [['check', 'list'], ['post']]],
        ['doc_transporte', [['otm', 'transporte']]],
    ];

    /** Campos que vienen como porcentaje (0.85 → 85.00 ó "85%" → 85.00) */
    private const PCT_FIELDS = [
        'entrega_en_rango', 'rechazos', 'adherencia_tiempo', 'modulacion',
        'adherencia_checklist_pre', 'adherencia_checklist_post',
    ];

    /** Campos enteros */
    private const INT_FIELDS = ['alertas_velocidad_curvas'];

    /** filtro del request → [columna, modo de comparación] */
    private const FILTERS = [
        'placa'            => ['placa', 'prefix_upper'],
        'cedula'           => ['documento', 'prefix'],
        'nombre'           => ['nombre', 'contains'],
        'doc_transporte'   => ['doc_transporte', 'contains'],
        'fecha_desde'      => ['fecha', '>='],
        'fecha_hasta'      => ['fecha', '<='],
        'planeacion_fecha' => ['fecha', '='],
    ];

    // =========================================================================
    // LISTADO
    // =========================================================================

    /**
     * Lista eventos desde eventos_tripulacion y los enriquece con la
     * adherencia_checklist calculada desde checklist_vehiculos (virtual).
     */
    public function index(Request $request): Response
    {
        $query = EventosTripulacion::query()->orderByDesc('fecha');
        $this->applyFilters($query, $request);

        $paginator    = $query->paginate(50)->withQueryString();
        $checklistMap = $this->loadChecklistMap($paginator->getCollection());

        // Arrays planos: Inertia serializa de forma predecible
        $paginator->setCollection(
            $paginator->getCollection()->map(fn ($e) => $this->serializeEvento($e, $checklistMap))
        );

        return Inertia::render('reparto/eventos-tripulacion/index', [
            'eventos' => $paginator,
            'filters' => collect(self::FILTERS)
                ->mapWithKeys(fn ($_, $key) => [$key => $request->input($key, '')]),
            'fechas_planeaciones' => Modulacion::query()
                ->orderByDesc('fecha')
                ->pluck('fecha')
                ->map(fn ($f) => Carbon::parse($f)->format('Y-m-d'))
                ->unique()
                ->values(),
            'flash' => session()->only(['success', 'error', 'warning']),
        ]);
    }

    private function applyFilters($query, Request $request): void
    {
        foreach (self::FILTERS as $key => [$column, $mode]) {
            if (!$request->filled($key)) {
                continue;
            }

            $value = trim((string) $request->input($key));

            match ($mode) {
                'prefix_upper' => $query->where($column, 'LIKE', strtoupper($value) . '%'),
                'prefix'       => $query->where($column, 'LIKE', $value . '%'),
                'contains'     => $query->where($column, 'LIKE', '%' . $value . '%'),
                default        => $query->whereDate($column, $mode, $value),
            };
        }
    }

    /** Mapa "placa|Y-m-d" → fila de checklist (máximo cumplimiento del día). */
    private function loadChecklistMap(Collection $rows): Collection
    {
        $placas = $rows->pluck('placa')->filter()->unique()->values()->all();
        $fechas = $rows->pluck('fecha')
            ->filter()
            ->map(fn ($f) => Carbon::parse($f)->format('Y-m-d'))
            ->unique()->values()->all();

        if (!$placas || !$fechas) {
            return collect();
        }

        return ChecklistVehiculo::query()
            ->selectRaw('placa_vehiculo, DATE(fecha) as dia, MAX(cumpl) as max_cumpl')
            ->whereIn('placa_vehiculo', $placas)
            ->whereIn(DB::raw('DATE(fecha)'), $fechas)
            ->where('operacion', 'Salida')
            ->whereIn('estado', ['Aprobado', 'Finalizado'])
            ->groupByRaw('placa_vehiculo, DATE(fecha)')
            ->get()
            ->keyBy(fn ($r) => $r->placa_vehiculo . '|' . $r->dia);
    }

    private function serializeEvento($evento, Collection $checklistMap): array
    {
        $dia = $evento->fecha ? Carbon::parse($evento->fecha)->format('Y-m-d') : null;
        $cl  = ($evento->placa && $dia) ? $checklistMap->get($evento->placa . '|' . $dia) : null;

        $float = fn ($v) => $v === null ? null : (float) $v;

        return [
            'id'                        => $evento->id,
            'fecha'                     => $dia,
            'placa'                     => $evento->placa,
            'doc_transporte'            => $evento->doc_transporte,
            'documento'                 => $evento->documento,
            'nombre'                    => $evento->nombre,
            'cargo'                     => $evento->cargo,
            'adherencia_checklist_pre'  => $float($evento->adherencia_checklist_pre),
            'adherencia_checklist_post' => $float($evento->adherencia_checklist_post),
            'modulacion'                => $float($evento->modulacion),
            'adherencia_tiempo'         => $float($evento->adherencia_tiempo),
            'entrega_en_rango'          => $float($evento->entrega_en_rango),
            'rechazos'                  => $float($evento->rechazos),
            'alertas_velocidad_curvas'  => $evento->alertas_velocidad_curvas,
            'rmd'                       => $evento->rmd,
            'adherencia_checklist'      => $cl ? round((float) $cl->max_cumpl, 2) : null,
            'created_at'                => $evento->created_at?->toDateTimeString(),
        ];
    }

    // =========================================================================
    // REFRESH (desde alertas existentes)
    // =========================================================================

    /**
     * 1. Agrupa alertas por fecha+placa y suma los eventos del día.
     * 2. Busca la modulación de ese día para esa placa.
     * 3. Asigna el total a cada colaborador de la tripulación.
     */
    public function refresh(Request $request)
    {
        try {
            $colaboradores = $this->loadColaboradores();
            Log::info('[EventosTripulacion::refresh] Colaboradores cargados en memoria: ' . count($colaboradores));

            $grupos = AlertaVelocidadCurva::query()
                ->selectRaw('DATE(fecha) as fecha, mes, nombre as placa, SUM(COALESCE(cantidad_eventos, 1)) as total_eventos')
                ->whereNotNull('nombre')
                ->whereNotNull('fecha')
                ->groupBy(DB::raw('DATE(fecha)'), 'mes', 'nombre')
                ->get();

            $stats = ['creados' => 0, 'sin_modulacion' => 0, 'omitidos' => 0];

            foreach ($grupos as $grupo) {
                $placa = strtoupper(trim($grupo->placa));
                $fecha = $grupo->fecha ? Carbon::parse($grupo->fecha)->format('Y-m-d') : null;

                if (!$fecha) {
                    continue;
                }

                try {
                    $this->refreshGroup($fecha, $placa, (int) $grupo->total_eventos, $colaboradores, $stats);
                } catch (Throwable $e) {
                    Log::warning("EventosTripulacion::refresh - error en {$fecha}/{$placa}: " . $e->getMessage());
                }
            }

            $msg = "✅ Actualización completada.\n"
                . "• Registros creados/actualizados: {$stats['creados']}\n"
                . "• Grupos sin modulación: {$stats['sin_modulacion']}\n"
                . ($stats['omitidos'] > 0
                    ? "• ⚠ Omitidos (cédula no en tabla colaboradores): {$stats['omitidos']}"
                    : '');

            Log::info("[EventosTripulacion::refresh] Resumen - creados: {$stats['creados']} | sin modulacion: {$stats['sin_modulacion']} | omitidos por cédula inválida: {$stats['omitidos']}");

            return redirect()->route('reparto.eventos-tripulacion.index')->with('success', $msg);
        } catch (Throwable $e) {
            Log::error('Error en EventosTripulacionController::refresh', ['error' => $e->getMessage()]);
            return back()->withErrors(['error' => 'Error al actualizar eventos: ' . $e->getMessage()]);
        }
    }

    /** Procesa un grupo fecha+placa. Los errores los captura el llamador. */
    private function refreshGroup(string $fecha, string $placa, int $totalEventos, array $colaboradores, array &$stats): void
    {
        $modulacion = Modulacion::whereHas('items', fn ($q) => $q->where('placa', $placa))
            ->whereDate('fecha', $fecha)
            ->first();

        if (!$modulacion) {
            $stats['sin_modulacion']++;
            return;
        }

        $item = $modulacion->items()->where('placa', $placa)->first();

        foreach ($item?->tripulacion ?? [] as $persona) {
            $documento = $persona['cedula'] ?? $persona['documento'] ?? null;
            $docLimpio = $documento ? trim((string) $documento) : null;

            // Solo se guarda si la cédula existe en colaboradores
            if (!$docLimpio || !array_key_exists($docLimpio, $colaboradores)) {
                $stats['omitidos']++;
                Log::debug('[EventosTripulacion::refresh] Omitido - cédula no registrada: '
                    . ($docLimpio ?? 'VACÍO') . " | fecha: {$fecha} | placa: {$placa}");
                continue;
            }

            EventosTripulacion::updateOrCreate(
                ['fecha' => $fecha, 'placa' => $placa, 'documento' => $documento],
                [
                    'doc_transporte' => $item->doc_tras ?? null,
                    'nombre'         => $colaboradores[$docLimpio] ?: ($persona['nombres'] ?? $persona['nombre'] ?? null),
                    'cargo'          => $persona['cargo'] ?? null,
                    'total_eventos'  => $totalEventos,
                ]
            );

            $stats['creados']++;
        }
    }

    // =========================================================================
    // IMPORTACIÓN DESDE EXCEL
    // =========================================================================

    /**
     * Procesa Excel/CSV y guarda en eventos_tripulacion con clave
     * (fecha, placa, documento) para no duplicar al reimportar.
     */
    public function store(Request $request): RedirectResponse
    {
        set_time_limit(300);
        ini_set('memory_limit', '512M');

        if ($error = $this->uploadGuardError($request)) {
            return $error;
        }

        $request->validate([
            'archivo'          => 'required|file|mimes:xlsx,xls,csv|max:20480',
            'fecha_planeacion' => 'required|date_format:Y-m-d',
        ], [
            'archivo.required'             => 'Debes seleccionar un archivo.',
            'archivo.mimes'                => 'El archivo debe ser Excel (.xlsx, .xls) o CSV.',
            'archivo.max'                  => 'El archivo no puede superar 20 MB.',
            'fecha_planeacion.required'    => 'Debes seleccionar una planeación.',
            'fecha_planeacion.date_format' => 'La fecha de planeación no tiene un formato válido.',
        ]);

        $fechaPlaneacion = $request->input('fecha_planeacion');

        try {
            $modulacion = Modulacion::with('items')
                ->whereDate('fecha', $fechaPlaneacion)
                ->firstOr(fn () => throw new DomainException(
                    "❌ No existe ninguna planeación registrada para la fecha {$fechaPlaneacion}."
                ));

            $diaKey = Carbon::parse($modulacion->fecha)->format('Y-m-d');
            [$planeacionIdx, $docsEnPlaneacion, $placasPorDoc] = $this->buildPlaneacionIndex($modulacion);

            Log::info("[EventosTripulacion::store] Planeación {$diaKey} — ítems con cruce posible: " . count($planeacionIdx));

            $colaboradores = $this->loadColaboradores();
            $existentes    = $this->loadExistingKeys($diaKey);

            [$headers, $rows] = $this->readSheet($request->file('archivo')->getPathname());
            [$fieldMap, $noMapeados] = $this->mapHeaders($headers);

            Log::info('[EventosTripulacion] Headers: ' . json_encode($headers));
            if ($noMapeados) {
                Log::warning('[EventosTripulacion] Sin mapeo: ' . json_encode($noMapeados));
            }

            $anio = (int) Carbon::parse($diaKey)->format('Y');
            $mes  = (int) Carbon::parse($diaKey)->format('n');
            $now  = now()->toDateTimeString();

            $stats      = ['nuevos' => 0, 'actualizados' => 0, 'omitidos' => 0, 'pendientes' => 0];
            $guardados  = [];   // cédula => nº de registros (nuevos + actualizados)
            $pendientes = ['doc_y_placa' => [], 'doc' => [], 'placa' => []];
            $nuevos     = [];

            foreach ($rows as $i => $values) {
                if ($this->isEmptyRow($values)) {
                    continue;
                }

                $data = $this->extractRowData($fieldMap, $values);
                $placa = strtoupper(trim((string) ($data['placa'] ?? '')));
                $doc   = strtoupper(trim((string) ($data['doc_transporte'] ?? '')));

                if ($doc === '' || $placa === '') {
                    $stats['omitidos']++;
                    continue;
                }

                $tripulantes = $planeacionIdx["{$doc}|{$placa}"] ?? null;

                if ($tripulantes === null) {
                    // Sin cruce: solo se reporta, no se inserta (no hay fecha válida)
                    $stats['pendientes']++;
                    $this->registrarPendiente($doc, $placa, $docsEnPlaneacion, $placasPorDoc, $pendientes, $i + 2);
                    continue;
                }

                // Un registro por colaborador; indicadores del Excel, identidad de la planeación
                foreach ($tripulantes as $miembro) {
                    $cedula = $miembro['cedula'];

                    $registro = $data + [];
                    $registro['fecha']     = $diaKey;
                    $registro['placa']     = $placa;
                    $registro['anio']      = $anio;
                    $registro['mes']       = $mes;
                    $registro['documento'] = $cedula;
                    $registro['nombre']    = $colaboradores[$cedula] ?? ($miembro['nombres'] ?: null);
                    $registro['cargo']     = $miembro['cargo'];

                    $key = "{$diaKey}|{$placa}|{$cedula}";
                    $guardados[$cedula] = ($guardados[$cedula] ?? 0) + 1;

                    if (isset($existentes[$key])) {
                        $stats['actualizados']++;
                        EventosTripulacion::where('fecha', $diaKey)
                            ->where('placa', $placa)
                            ->where('documento', $cedula)
                            ->update($registro + ['updated_at' => $now]);
                        continue;
                    }

                    $existentes[$key] = true;
                    $nuevos[] = $registro + ['created_at' => $now, 'updated_at' => $now];
                    $stats['nuevos']++;
                }
            }

            foreach (array_chunk($nuevos, 200) as $lote) {
                EventosTripulacion::insert($lote);
            }

            Log::info("[EventosTripulacion::store] Planeación {$diaKey} — "
                . "nuevos={$stats['nuevos']} | actualizados={$stats['actualizados']} | "
                . "omitidos_sin_doc_placa={$stats['omitidos']} | pendientes_sin_cruce={$stats['pendientes']}");

            if (array_filter($pendientes)) {
                Log::warning("[EventosTripulacion::store] Pendientes sin cruce en planeación {$diaKey}: "
                    . 'doc+placa=' . count($pendientes['doc_y_placa'])
                    . ' | solo_doc=' . count($pendientes['doc'])
                    . ' | solo_placa=' . count($pendientes['placa']));
            }

            return back()->with(array_filter([
                'success' => $this->buildSummaryMessage($diaKey, $stats, $guardados),
                'warning' => $this->buildWarningMessage($pendientes, $noMapeados),
            ]));
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        } catch (Throwable $e) {
            Log::error('[EventosTripulacion] Error importando: ' . $e->getMessage());
            return back()->with('error', '❌ Error al procesar el archivo: ' . $e->getMessage());
        }
    }

    // ── Pasos de store ───────────────────────────────────────────────────────

    /** Detecta rechazos de PHP por tamaño antes de llegar a la validación. */
    private function uploadGuardError(Request $request): ?RedirectResponse
    {
        $uploadError = $request->file('archivo')?->getError();

        if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            return back()->with('error', '❌ El archivo supera el límite de tamaño permitido por el servidor. Intenta dividirlo en partes más pequeñas o contacta al administrador para aumentar el límite.');
        }

        if (!$request->hasFile('archivo') && empty($_FILES)) {
            return back()->with('error', '❌ El archivo no pudo ser recibido. Es posible que supere el límite del servidor (post_max_size). Intenta con un archivo más pequeño.');
        }

        return null;
    }

    /**
     * Índice de cruce de la planeación.
     *
     * @return array{0: array, 1: array, 2: array}
     *   [ "DOC|PLACA" => tripulantes[], doc => true, doc => [placa => true] ]
     */
    private function buildPlaneacionIndex(Modulacion $modulacion): array
    {
        $idx = $docs = $placasPorDoc = [];

        foreach ($modulacion->items as $item) {
            $docTras = strtoupper(trim((string) ($item->doc_tras ?? '')));
            $placa   = strtoupper(trim((string) ($item->placa ?? '')));

            if ($docTras === '' || $placa === '') {
                continue;
            }

            $key = "{$docTras}|{$placa}";
            $docs[$docTras] = true;
            $placasPorDoc[$docTras][$placa] = true;

            foreach (is_array($item->tripulacion) ? $item->tripulacion : [] as $miembro) {
                if (!empty($miembro['cedula'])) {
                    $idx[$key][] = $this->crewMember($miembro['cedula'], $miembro['nombres'] ?? '', $miembro['cargo'] ?? '');
                }
            }

            // Colaborador directo en el item (sin array tripulacion)
            if (empty($idx[$key]) && !empty($item->cedula)) {
                $idx[$key][] = $this->crewMember($item->cedula, $item->nombres ?? '', $item->cargo ?? '');
            }
        }

        return [$idx, $docs, $placasPorDoc];
    }

    private function crewMember(mixed $cedula, mixed $nombres, mixed $cargo): array
    {
        return [
            'cedula'  => trim((string) $cedula),
            'nombres' => trim((string) $nombres),
            'cargo'   => trim((string) $cargo),
        ];
    }

    /** cédula => nombre completo oficial (tabla colaboradores). */
    private function loadColaboradores(): array
    {
        return Colaborador::query()
            ->whereNotNull('cedula')
            ->get(['cedula', 'nombres', 'apellidos'])
            ->mapWithKeys(fn ($c) => [trim((string) $c->cedula) => trim("{$c->nombres} {$c->apellidos}")])
            ->toArray();
    }

    /** Claves "Y-m-d|PLACA|documento" ya guardadas para esa fecha. */
    private function loadExistingKeys(string $diaKey): array
    {
        return EventosTripulacion::query()
            ->select(['fecha', 'placa', 'documento', 'rr'])
            ->whereDate('fecha', $diaKey)
            ->get()
            ->mapWithKeys(function ($row) {
                $doc   = trim((string) ($row->documento ?? $row->rr ?? ''));
                $dia   = $row->fecha ? Carbon::parse($row->fecha)->format('Y-m-d') : '';
                $placa = strtoupper(trim((string) ($row->placa ?? '')));
                return ["{$dia}|{$placa}|{$doc}" => true];
            })
            ->toArray();
    }

    /** @return array{0: string[], 1: array[]} [encabezados crudos, filas de datos] */
    private function readSheet(string $path): array
    {
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);

        $sheet = $reader->load($path)->getActiveSheet();
        $rows  = $sheet->rangeToArray(
            'A1:' . $sheet->getHighestDataColumn() . $sheet->getHighestDataRow(),
            null, false, false, false
        );

        $headers = array_map(fn ($h) => trim((string) $h), array_shift($rows) ?? []);

        return [$headers, $rows];
    }

    /**
     * @return array{0: array<int, ?string>, 1: string[]} [índice de columna => campo, encabezados sin mapear]
     */
    private function mapHeaders(array $headers): array
    {
        $fieldMap = $noMapeados = $asignados = [];

        foreach ($headers as $ci => $raw) {
            $norm  = $this->normalizeHeader($raw);
            $field = self::columnMap()[$norm] ?? $this->fuzzyMatchHeader($norm);

            // Duplicado: se ignora la segunda aparición
            if (in_array($field, $asignados, true)) {
                $field = null;
            }

            $fieldMap[$ci] = $field;

            if ($field !== null) {
                $asignados[] = $field;
            } elseif ($raw !== '') {
                $noMapeados[] = $raw;
            }
        }

        return [$fieldMap, $noMapeados];
    }

    private function isEmptyRow(array $values): bool
    {
        return collect($values)->every(fn ($v) => $v === null || $v === '');
    }

    private function extractRowData(array $fieldMap, array $values): array
    {
        $data = [];
        foreach (array_filter($fieldMap) as $idx => $field) {
            $data[$field] = $this->castValue($field, $values[$idx] ?? null);
        }
        return $data;
    }

    /** Clasifica una fila sin cruce (solo para el reporte). */
    private function registrarPendiente(string $doc, string $placa, array $docs, array $placasPorDoc, array &$pendientes, int $rowNum): void
    {
        $docExiste   = isset($docs[$doc]);
        $placaExiste = $docExiste && isset($placasPorDoc[$doc][$placa]);

        match (true) {
            !$docExiste && !isset($docs[$placa]) => $pendientes['doc_y_placa']["{$doc} | {$placa}"] = true,
            !$docExiste                          => $pendientes['doc'][$doc] = true,
            default                              => $pendientes['placa']["{$doc} | {$placa}"]
                                                        = implode(', ', array_keys($placasPorDoc[$doc])),
        };

        Log::debug("[EventosTripulacion::store] Fila {$rowNum} sin cruce | doc={$doc} | placa={$placa}"
            . ' | doc_existe=' . ($docExiste ? 'sí' : 'no')
            . ' | placa_existe=' . ($placaExiste ? 'sí' : 'no'));
    }

    // ── Mensajes ─────────────────────────────────────────────────────────────

    private function buildSummaryMessage(string $diaKey, array $stats, array $guardados): string
    {
        $msg = "Importación completada — planeación {$diaKey}.\nNuevos: {$stats['nuevos']}";
        $msg .= $stats['actualizados'] > 0 ? " · Actualizados: {$stats['actualizados']}" : '';
        $msg .= $stats['omitidos'] > 0 ? " · Sin doc/placa en Excel: {$stats['omitidos']}" : '';

        if ($guardados) {
            $msg .= "\n\nCédulas guardadas:\n";
            foreach ($guardados as $ced => $cnt) {
                $msg .= "• {$ced}: {$cnt} registro" . ($cnt > 1 ? 's' : '') . "\n";
            }
        }

        return $msg;
    }

    /** Detalle de pendientes y columnas no reconocidas ('' si no hay nada). */
    private function buildWarningMessage(array $pendientes, array $noMapeados): string
    {
        $bloques = [];

        if ($pendientes['doc']) {
            $bloques[] = "Documento de transporte no encontrado en la planeación:\n"
                . collect(array_keys($pendientes['doc']))->map(fn ($d) => "• Doc: {$d}")->implode("\n");
        }

        if ($pendientes['placa']) {
            $bloques[] = "Placa no coincide con la asociada al documento:\n"
                . collect($pendientes['placa'])->map(function ($disponibles, $detalle) {
                    [$doc, $placa] = explode(' | ', $detalle, 2);
                    return "• Doc: {$doc} · Placa Excel: {$placa} · En planeación: {$disponibles}";
                })->implode("\n");
        }

        if ($pendientes['doc_y_placa']) {
            $bloques[] = "Documento y placa no encontrados en la planeación:\n"
                . collect(array_keys($pendientes['doc_y_placa']))->map(function ($detalle) {
                    [$doc, $placa] = explode(' | ', $detalle, 2);
                    return "• Doc: {$doc} · Placa: {$placa}";
                })->implode("\n");
        }

        if ($noMapeados) {
            $bloques[] = 'Columnas no reconocidas: ' . implode(', ', $noMapeados);
        }

        return implode("\n\n", $bloques);
    }

    // =========================================================================
    // PLANTILLA
    // =========================================================================

    /** Descarga una plantilla Excel con los 10 encabezados del formato actual. */
    public function downloadTemplate(): HttpResponse|StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Eventos Tripulación');

        $headers = [
            'TRANSPORTE', 'PLACA', 'ENTREGA EN RANGO', 'RECHAZOS', '# ALERTAS VEL. CURVAS',
            '% ADH. TIEMPO', 'MODULACION', 'CHECK-LIST PRE OPERACIONAL',
            'CHECK-LIST POST OPERACIONAL', 'RMD',
        ];
        $example = ['8008417416', 'COLJV386', '85.00', '3.50', '5', '90.00', '95.00', '88.50', '92.00', 'ACTIVO'];
        $widths  = [13, 15, 18, 11, 23, 15, 16, 21, 22, 13];

        $lastCol = Coordinate::stringFromColumnIndex(count($headers));
        $center  = [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical'   => Alignment::VERTICAL_CENTER,
        ];

        $sheet->fromArray($headers, null, 'A1');
        $sheet->fromArray($example, null, 'A2');

        // Encabezados: fondo azul, texto blanco en negrita, borde blanco
        $sheet->getStyle("A1:{$lastCol}1")->applyFromArray([
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1D4ED8']],
            'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
            'alignment' => $center + ['wrapText' => true],
            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
        ]);

        // Fila de ejemplo: fondo gris claro
        $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F1F5F9']],
            'font'      => ['size' => 10],
            'alignment' => $center,
            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]],
        ]);

        foreach ($widths as $i => $width) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($i + 1))->setWidth($width);
        }
        $sheet->getRowDimension(1)->setRowHeight(30);
        $sheet->getRowDimension(2)->setRowHeight(18);

        $writer = new Xlsx($spreadsheet);

        return response()->streamDownload(
            fn () => $writer->save('php://output'),
            'plantilla_eventos_tripulacion.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        );
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /** variante normalizada → campo (se construye una sola vez). */
    private static function columnMap(): array
    {
        static $map = null;

        return $map ??= collect(self::HEADER_ALIASES)
            ->flatMap(fn (array $aliases, string $field) => array_fill_keys($aliases, $field))
            ->all();
    }

    /** Minúsculas, sin tildes, sin saltos de línea/NBSP, espacios simples. */
    private function normalizeHeader(string $header): string
    {
        $h = mb_strtolower(trim($header));
        $h = str_replace(["\xC2\xA0", "\r\n", "\r", "\n", "\t"], ' ', $h);
        $h = strtr($h, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);

        return trim(preg_replace('/\s+/', ' ', $h));
    }

    /** Coincidencia difusa según FUZZY_RULES (el orden importa). */
    private function fuzzyMatchHeader(string $norm): ?string
    {
        $compact = preg_replace('/[\s_\-\.#%]+/', '', $norm);

        foreach (self::FUZZY_RULES as [$field, $groups]) {
            $coincide = collect($groups)->every(
                fn (array $needles) => collect($needles)->contains(fn ($n) => str_contains($compact, $n))
            );

            if ($coincide) {
                return $field;
            }
        }

        return null;
    }

    /** Convierte un valor crudo al tipo correcto según el campo. */
    private function castValue(string $field, mixed $raw): mixed
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        if (in_array($field, self::INT_FIELDS, true)) {
            return is_numeric($raw) ? (int) $raw : null;
        }

        // Excel guarda 85% como 0.85 (→ ×100); texto "85.80%" se toma directo
        if (in_array($field, self::PCT_FIELDS, true)) {
            $num = is_string($raw) ? trim(str_replace(['%', ' '], '', $raw)) : $raw;

            if (!is_numeric($num)) {
                return null;
            }

            $val = (float) $num;
            return $val <= 1.0 ? $val * 100 : $val;
        }

        // Texto: evita "8008417416.0" y limpia NBSP
        $str = (is_float($raw) && $raw == (int) $raw) ? (string) (int) $raw : (string) $raw;
        $str = trim(str_replace("\xC2\xA0", ' ', $str));

        return $str === '' ? null : $str;
    }
}