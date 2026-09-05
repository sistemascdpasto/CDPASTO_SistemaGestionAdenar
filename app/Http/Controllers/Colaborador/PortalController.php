<?php

namespace App\Http\Controllers\Colaborador;

use App\Http\Controllers\Controller;
use App\Models\Reparto\CompensacionVariable;
use App\Models\Reparto\ModulacionItem;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\EvaluacionCalculator;
use App\Services\Seguridad\IndiceRiesgoCalculator;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PortalController extends Controller
{
    public function index(Request $request, EvaluacionCalculator $evaluacion, IndiceRiesgoCalculator $riesgo): Response
    {
        $colaborador = $this->colaboradorDe($request);

        if (! $colaborador) {
            return Inertia::render('colaborador/sin-vincular');
        }

        return Inertia::render('dashboard/colaborador', [
            'colaborador' => [
                'id' => $colaborador->id,
                'nombre_completo' => $colaborador->nombre_completo,
                'cargo' => $colaborador->cargo,
                'turno' => $colaborador->turno,
                'area' => $colaborador->area,
                'imagen' => $colaborador->imagen,
            ],
            'estadoHoy' => $evaluacion->paraColaboradorHoy($colaborador),
            'jornadaAbierta' => $evaluacion->faltaRegistrarSalida($colaborador),
            'indiceRiesgo' => $riesgo->calcular($colaborador),
            'ultimasPruebas' => $colaborador->pruebasAlcoholemia()
                ->with('alcoholimetro:id,codigo')
                ->latest('fecha_hora')
                ->limit(5)
                ->get(),
            'ultimasCondiciones' => $colaborador->condicionesSalud()
                ->latest('fecha_hora')
                ->limit(5)
                ->get(),
            'alertasPendientes' => $colaborador->alertas()->where('atendida', false)->count(),
            'asignacionConductor' => $colaborador->asignacionesConductor()->latest('id')->first(),
        ]);
    }

    public function perfil(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        return Inertia::render('colaborador/perfil', [
            'colaborador' => $colaborador,
        ]);
    }

    public function pruebas(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        return Inertia::render('colaborador/pruebas', [
            'pruebas' => $colaborador->pruebasAlcoholemia()
                ->with('alcoholimetro:id,codigo')
                ->latest('fecha_hora')
                ->paginate(15),
        ]);
    }

    public function rutas(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        return Inertia::render('colaborador/rutas', [
            'asignaciones' => $colaborador->asignacionesConductor()->latest('id')->get(),
        ]);
    }

    public function misRutasReparto(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        // Rutas donde el colaborador es conductor principal (colaborador_id)
        $itemsDirectos = ModulacionItem::with('modulacion')
            ->where('colaborador_id', $colaborador->id)
            ->get();

        // Rutas donde el colaborador aparece en el JSON de tripulación
        // Buscamos por colaborador_id o por cédula dentro del array JSON
        $itemsEnTripulacion = ModulacionItem::with('modulacion')
            ->where('colaborador_id', '!=', $colaborador->id)
            ->orWhereNull('colaborador_id')
            ->get()
            ->filter(function (ModulacionItem $item) use ($colaborador) {
                $tripulacion = $item->tripulacion ?? [];
                foreach ($tripulacion as $miembro) {
                    if (
                        (isset($miembro['colaborador_id']) && (int) $miembro['colaborador_id'] === $colaborador->id) ||
                        (isset($miembro['cedula']) && $colaborador->cedula && trim($miembro['cedula']) === trim($colaborador->cedula))
                    ) {
                        return true;
                    }
                }
                return false;
            });

        // Unir y ordenar por fecha descendente, evitar duplicados
        $todos = $itemsDirectos->concat($itemsEnTripulacion)->unique('id');

        $resultado = $todos
            ->sortByDesc(fn($item) => $item->modulacion?->fecha ?? '')
            ->values()
            ->map(function (ModulacionItem $item) use ($colaborador) {
                $modulacion = $item->modulacion;

                // Determinar si es conductor principal o tripulante
                $esConductor = $item->colaborador_id === $colaborador->id;

                // Buscar cargo del colaborador en la tripulación si no es conductor principal
                $cargoEnRuta = $item->cargo ?? null;
                if (!$esConductor) {
                    foreach ($item->tripulacion ?? [] as $miembro) {
                        if (
                            (isset($miembro['colaborador_id']) && (int) $miembro['colaborador_id'] === $colaborador->id) ||
                            (isset($miembro['cedula']) && $colaborador->cedula && trim($miembro['cedula']) === trim($colaborador->cedula))
                        ) {
                            $cargoEnRuta = $miembro['cargo'] ?? $cargoEnRuta;
                            break;
                        }
                    }
                }

                return [
                    'id'                   => $item->id,
                    'fecha'                => $modulacion?->fecha,
                    'placa'                => $item->placa,
                    'cargo'                => $cargoEnRuta,
                    'es_conductor'         => $esConductor,
                    'ud_programado_por'    => $modulacion?->ud_programado_por,
                    'despachado_por'       => $modulacion?->despachado_por_nombre,
                    'viajes'               => $item->viajes ?? [],
                    'tripulacion'          => $item->tripulacion ?? [],
                ];
            });

        return Inertia::render('colaborador/mis-rutas-reparto/index', [
            'planeaciones' => $resultado,
        ]);
    }

    public function misIndicadoresReparto(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);
        $cedula = trim((string) ($colaborador->cedula ?? ''));

        // ── Mes seleccionado ──────────────────────────────────────────────────
        // Formato esperado: YYYY-MM. Valor por defecto = mes presente.
        $mesInput = (string) $request->input('mes', now()->format('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $mesInput)) {
            $mesInput = now()->format('Y-m');
        }
        try {
            // ⚠ CREACIÓN SEGURA: forzamos día 1 a las 00:00 para evitar desbordes
            // de día 30/31 a meses que no tienen (ej: 30-feb → 2-mar).
            [$anio, $mesNum] = array_map('intval', explode('-', $mesInput));
            $mesNum = max(1, min(12, $mesNum));
            $mesCarbon = \Carbon\Carbon::create($anio, $mesNum, 1, 0, 0, 0, config('app.timezone'))->startOfMonth();
        } catch (\Throwable $e) {
            report($e);
            $mesCarbon = now(config('app.timezone'))->startOfMonth();
        }
        $mesSeleccionado = $mesCarbon->format('Y-m');
        $mesInicio = $mesCarbon->copy()->startOfMonth()->format('Y-m-d');
        $mesFin    = $mesCarbon->copy()->endOfMonth()->format('Y-m-d');

        \Log::debug('[Portal][misIndicadoresReparto] INPUT mes=' . $request->input('mes') . ' → mesSeleccionado=' . $mesSeleccionado . ' rango=' . $mesInicio . ' a ' . $mesFin);

        // ── Rango de meses disponibles para el selector (últimos 13 meses) ──
        $mesesDisponibles = [];
        $tmp = now(config('app.timezone'))->startOfMonth();
        for ($i = 0; $i < 13; $i++) {
            $mesIter = $tmp->copy()->subMonths($i);
            $mesesDisponibles[] = [
                'value' => $mesIter->format('Y-m'),
                'label' => $mesIter->locale('es_ES')->isoFormat('MMMM YYYY'),
            ];
        }
        \Log::debug('[Portal][misIndicadoresReparto] mesesDisponibles (primeros 3): ' . json_encode(array_slice($mesesDisponibles, 0, 3)));

        // ── Sin cédula no hay datos ───────────────────────────────────────────
        if (empty($cedula)) {
            return Inertia::render('colaborador/mis-indicadores-reparto/index', [
                'colaborador' => [
                    'nombre' => $colaborador->nombre_completo,
                    'cedula' => '',
                    'cargo'  => $colaborador->cargo,
                    'imagen' => $colaborador->imagen,
                ],
                'indicadores' => null,
                'historial'   => [],
                'periodo'     => null,
                'mesSeleccionado' => $mesSeleccionado,
                'mesesDisponibles' => $mesesDisponibles,
            ]);
        }

        // ── Registros del colaborador en eventos_tripulacion (FILTRADO POR MES)
        $rows = \App\Models\Reparto\EventosTripulacion::query()
            ->where('documento', $cedula)
            ->whereNotNull('fecha')
            ->whereBetween('fecha', [$mesInicio, $mesFin])
            ->orderByDesc('fecha')
            ->get([
                'fecha', 'placa', 'doc_transporte', 'cargo',
                'adherencia_tiempo', 'entrega_en_rango', 'rechazos',
                'modulacion', 'adherencia_checklist_pre', 'adherencia_checklist_post',
                'rendimiento_combustible',
                'alertas_velocidad_curvas', 'excesos_tiempo_ruta', 'rmd',
                'nombre',
            ]);

        // ── Sin registros ─────────────────────────────────────────────────────
        if ($rows->isEmpty()) {
            return Inertia::render('colaborador/mis-indicadores-reparto/index', [
                'colaborador' => [
                    'nombre' => $colaborador->nombre_completo ?? $rows->first()?->nombre ?? '',
                    'cedula' => $cedula,
                    'cargo'  => $colaborador->cargo,
                    'imagen' => $colaborador->imagen,
                ],
                'indicadores' => null,
                'historial'   => [],
                'periodo'     => null,
                'mesSeleccionado' => $mesSeleccionado,
                'mesesDisponibles' => $mesesDisponibles,
            ]);
        }

        // ── Metas ─────────────────────────────────────────────────────────────
        $METAS = [
            'adh_tiempo'  => 95.0,
            'entrega'     => 95.0,
            'rechazos'    => 2.0,    // % (menor = mejor)
            'modulacion'  => 95.0,   // viene 0-1 → ×100
            'cl_pre'      => 100.0,
            'cl_post'     => 100.0,
            'combustible' => 95.0,   // rendimiento (mayor = mejor)
            'alertas'     => 0.0,    // menor = mejor
            'excesos'     => 0.0,    // menor = mejor
            'rmd'         => 5.0,    // escala 1-5
        ];

        // ── Promedios ─────────────────────────────────────────────────────────
        $cnt    = $rows->count();
        $avg    = fn ($col) => $rows->filter(fn ($r) => is_numeric($r->$col))->avg($col);

        $promedios = [
            'adh_tiempo' => $avg('adherencia_tiempo'),
            'entrega'    => $avg('entrega_en_rango'),
            'rechazos'   => $cnt > 0 ? round($rows->sum('rechazos') / $cnt, 2) : null,
            'modulacion' => $rows->filter(fn ($r) => is_numeric($r->modulacion))
                ->pipe(fn ($c) => $c->count() > 0
                    ? round($c->avg(fn ($r) => (float)$r->modulacion * 100), 1) : null),
            'cl_pre'     => $avg('adherencia_checklist_pre'),
            'cl_post'    => $avg('adherencia_checklist_post'),
            'combustible'=> $avg('rendimiento_combustible'),
            'alertas'    => $avg('alertas_velocidad_curvas'),
            'excesos'    => $avg('excesos_tiempo_ruta'),
            'rmd'        => $rows->filter(fn ($r) => is_numeric($r->rmd))
                ->pipe(fn ($c) => $c->count() > 0 ? round($c->avg('rmd'), 2) : null),
        ];

        // ── Cumplimiento por indicador (0-100%) ───────────────────────────────
        $INVERTIDOS = ['rechazos', 'alertas', 'excesos'];
        $cumplimiento = [];
        $estrellas    = 0;

        foreach ($promedios as $key => $valor) {
            if ($valor === null) { $cumplimiento[$key] = null; continue; }
            $meta = $METAS[$key];

            if (in_array($key, $INVERTIDOS)) {
                if ($meta == 0) {
                    $pct = $valor == 0 ? 100 : round(max(0, 100 - ($valor * 10)), 1);
                } else {
                    $pct = $valor <= $meta ? 100 : round(max(0, 100 - (($valor - $meta) / $meta) * 100), 1);
                }
            } elseif ($key === 'rmd') {
                $pct = $meta > 1 ? round(min(100, max(0, (($valor - 1) / ($meta - 1)) * 100)), 1) : ($valor >= $meta ? 100 : 0);
            } else {
                $pct = round(min(100, ($valor / $meta) * 100), 1);
            }

            $cumplimiento[$key] = $pct;
            if ($pct >= 95) $estrellas++;
        }

        // Conteo total de indicadores con datos
        $totalIndicadores = count(array_filter($cumplimiento, fn ($v) => $v !== null));

        // ── Historial: últimas 10 fechas distintas ────────────────────────────
        $historial = $rows->take(10)->map(fn ($r) => [
            'fecha'   => \Carbon\Carbon::parse($r->fecha)->format('d/m/Y'),
            'placa'   => $r->placa,
            'adh'     => $r->adherencia_tiempo !== null ? round((float)$r->adherencia_tiempo, 1) : null,
            'entrega' => $r->entrega_en_rango  !== null ? round((float)$r->entrega_en_rango,  1) : null,
            'cl_pre'  => $r->adherencia_checklist_pre !== null ? round((float)$r->adherencia_checklist_pre, 1) : null,
        ])->values();

        // ── Período ───────────────────────────────────────────────────────────
        $minFecha = \Carbon\Carbon::parse($rows->last()->fecha)->format('d/m/Y');
        $maxFecha = \Carbon\Carbon::parse($rows->first()->fecha)->format('d/m/Y');

        return Inertia::render('colaborador/mis-indicadores-reparto/index', [
            'colaborador' => [
                'nombre' => $colaborador->nombre_completo ?? $rows->first()?->nombre ?? 'Colaborador',
                'cedula' => $cedula,
                'cargo'  => $rows->first()?->cargo ?? $colaborador->cargo,
                'placa'  => $rows->first()?->placa ?? '',
                'imagen' => $colaborador->imagen,
            ],
            'indicadores' => [
                'promedios'        => $promedios,
                'cumplimiento'     => $cumplimiento,
                'estrellas'        => $estrellas,
                'total_indicadores'=> $totalIndicadores,
                'total_jornadas'   => $cnt,
                'metas'            => $METAS,
            ],
            'historial' => $historial,
            'periodo'   => ['desde' => $minFecha, 'hasta' => $maxFecha],
            'mesSeleccionado' => $mesSeleccionado,
            'mesesDisponibles' => $mesesDisponibles,
        ]);
    }


    public function alertas(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        return Inertia::render('colaborador/alertas', [
            'alertas' => $colaborador->alertas()->latest()->paginate(15),
        ]);
    }

    public function miPlanPremiacion(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        $mes  = $request->integer('mes')  ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;

        $normStr = function ($txt): string {
            $str = mb_strtoupper(trim((string) $txt), 'UTF-8');
            $str = str_replace(['Á','É','Í','Ó','Ú','Ü','Ñ'], ['A','E','I','O','U','U','N'], $str);
            return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
        };

        // ── ACIs del mes ─────────────────────────────────────────────────────
        $metaBase      = 32;
        $aciRealizadas = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->where('colaborador_id', $colaborador->id)
            ->count();
        $porcentajeAci = round(($aciRealizadas / $metaBase) * 100, 1);

        // ── Historial ACI últimos 6 meses ─────────────────────────────────
        $historialAci = [];
        for ($i = 5; $i >= 0; $i--) {
            $f     = Carbon::create($anio, $mes, 1)->subMonths($i);
            $count = Aci::whereMonth('fecha_incidente', $f->month)
                ->whereYear('fecha_incidente', $f->year)
                ->where('colaborador_id', $colaborador->id)
                ->count();
            $historialAci[] = [
                'mes'    => $f->translatedFormat('M Y'),
                'total'  => $count,
                'pct'    => round(($count / $metaBase) * 100, 1),
                'cumple' => $count >= $metaBase,
            ];
        }

        // ── OWD Ruta ──────────────────────────────────────────────────────
        $preguntasRuta = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->whereMonth('evaluaciones_owd.fecha_evaluacion', $mes)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->where(function ($q) use ($colaborador) {
                $q->where('evaluaciones_owd.colaborador_id', $colaborador->id)
                  ->orWhere('evaluaciones_owd.qr_safety', $colaborador->codigo_qr_skap);
            })
            ->get(['evaluacion_owd_preguntas.puntuacion']);

        $noOk = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string)$p->puntuacion), 'no ok'))->count();
        $ok   = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string)$p->puntuacion), 'ok') && !str_contains(strtolower((string)$p->puntuacion), 'no ok'))->count();
        $owdRuta = ($ok + $noOk) > 0 ? ($noOk > 0 ? 0.0 : 100.0) : null;

        // ── Calificaciones ────────────────────────────────────────────────
        $promedioCalif = DB::table('colaborador_calificaciones')
            ->where('identificacion', $colaborador->cedula)
            ->whereNotNull('nota_modulo')
            ->avg('nota_modulo');
        $promedioCalif = $promedioCalif !== null ? round((float)$promedioCalif, 1) : null;

        // ── DPO Academy ───────────────────────────────────────────────────
        $estaEnDpo = DB::table('dpo_academy')
            ->where(function ($q) use ($colaborador, $normStr) {
                $q->where('colaborador_id', $colaborador->id)
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(qr_safety,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->codigo_qr_skap ?? '')])
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(nombre,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->nombre_completo ?? '')]);
            })->exists();

        // ── Ausentismo ────────────────────────────────────────────────────
        $ausentismo = DB::table('ausentismos')
            ->whereMonth('fecha', $mes)->whereYear('fecha', $anio)
            ->where(function ($q) use ($colaborador) {
                $q->where('colaborador_id', $colaborador->id)
                  ->orWhere('identificador', $colaborador->cedula);
            })->get();
        $tieneIncapacidad    = $ausentismo->contains(fn ($r) =>
            in_array(trim((string)($r->entro_1 ?? '')), ['','00:00','00:00:00','0','--:--'], true) &&
            in_array(trim((string)($r->entro_2 ?? '')), ['','00:00','00:00:00','0','--:--'], true)
        );
        $porcentajeAusentismo = $ausentismo->isEmpty() ? null : ($tieneIncapacidad ? 0.0 : 100.0);

        // ── Malas Marcaciones ─────────────────────────────────────────────
        $tieneMalasMarcaciones = DB::table('correcciones_marcaciones')
            ->where(function ($q) use ($colaborador, $normStr) {
                $q->whereRaw('UPPER(REGEXP_REPLACE(identificacion,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->cedula)])
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(nombre_completo,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->nombre_completo ?? '')]);
            })->exists();

        // ── Eventos Tripulación ───────────────────────────────────────────
        $evento = DB::table('eventos_tripulacion')
            ->whereMonth('fecha', $mes)->whereYear('fecha', $anio)
            ->where(function ($q) use ($colaborador, $normStr) {
                $q->whereRaw('UPPER(REGEXP_REPLACE(documento,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->cedula)])
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(nombre,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->nombre_completo ?? '')]);
            })
            ->select(['rechazos','adherencia_tiempo','rmd','adherencia_checklist_pre','adherencia_checklist_post'])
            ->first();

        // ── SAC ───────────────────────────────────────────────────────────
        $casosSac = DB::table('sac')
            ->whereMonth('fecha', $mes)->whereYear('fecha', $anio)
            ->where('colaborador_id', $colaborador->id)
            ->count();

        // ── Armar métricas ────────────────────────────────────────────────
        $metricas = [
            'aci'            => ['valor' => $porcentajeAci,       'label' => "{$porcentajeAci}%",     'pilar' => 'Seguridad', 'peso' => 10,  'emoji' => '🛡️', 'titulo' => 'ACI',                'meta_desc' => '(Realizadas ÷ 32) × 100'],
            'owd'            => ['valor' => $owdRuta,              'label' => $owdRuta !== null ? "{$owdRuta}%" : 'N/A',        'pilar' => 'Seguridad', 'peso' => 15,  'emoji' => '✅', 'titulo' => 'OWD Ruta',           'meta_desc' => 'Sin NO OK = 100% | Con NO OK = 0%'],
            'calificaciones' => ['valor' => $promedioCalif,        'label' => $promedioCalif !== null ? "{$promedioCalif}%" : 'N/A', 'pilar' => 'Seguridad', 'peso' => 10, 'emoji' => '🎓', 'titulo' => 'Calificaciones',     'meta_desc' => 'Promedio de notas por módulo'],
            'dpo'            => ['valor' => $estaEnDpo ? 0.0:100.0,'label' => $estaEnDpo ? '0%':'100%',                        'pilar' => 'Gente',     'peso' => 5,   'emoji' => '📚', 'titulo' => 'DPO Academy',        'meta_desc' => 'Sin registro = 100% | En listado = 0%'],
            'ausentismo'     => ['valor' => $porcentajeAusentismo, 'label' => $porcentajeAusentismo !== null ? "{$porcentajeAusentismo}%" : 'N/A', 'pilar' => 'Gente', 'peso' => 5, 'emoji' => '📅', 'titulo' => 'Ausentismo', 'meta_desc' => 'Sin incapacidad = 100%'],
            'marcaciones'    => ['valor' => $tieneMalasMarcaciones ? 0.0:100.0, 'label' => $tieneMalasMarcaciones ? '0%':'100%', 'pilar' => 'Gente', 'peso' => 5, 'emoji' => '🕐', 'titulo' => 'Malas Marcaciones', 'meta_desc' => 'Sin corrección = 100%'],
            'rechazos'       => ['valor' => $evento?->rechazos !== null ? ((float)$evento->rechazos >= 2.3 ? 100.0 : 0.0) : null, 'label' => $evento?->rechazos !== null ? ((float)$evento->rechazos >= 2.3 ? '100%':'0%') : 'N/A', 'pilar' => 'Reparto', 'peso' => 11, 'emoji' => '🔄', 'titulo' => 'Rechazos', 'meta_desc' => '≥ 2.3% rechazos = 100%'],
            'sac'            => ['valor' => $casosSac === 0 ? 100.0:0.0, 'label' => $casosSac === 0 ? '100%':'0%', 'pilar' => 'Reparto', 'peso' => 8, 'emoji' => '🎧', 'titulo' => 'SAC', 'meta_desc' => 'Sin casos = 100%'],
            'adherencia'     => ['valor' => $evento?->adherencia_tiempo !== null ? ((float)$evento->adherencia_tiempo >= 83 ? 100.0:0.0) : null, 'label' => $evento?->adherencia_tiempo !== null ? ((float)$evento->adherencia_tiempo >= 83 ? '100%':'0%') : 'N/A', 'pilar' => 'Reparto', 'peso' => 8, 'emoji' => '⏰', 'titulo' => 'Adherencia Tiempo', 'meta_desc' => '≥ 83% = 100%'],
            'rmd'            => ['valor' => $evento?->rmd !== null ? ((float)$evento->rmd >= 4 ? 100.0:0.0) : null, 'label' => $evento?->rmd !== null ? ((float)$evento->rmd >= 4 ? '100%':'0%') : 'N/A', 'pilar' => 'Reparto', 'peso' => 8, 'emoji' => '🏆', 'titulo' => 'RMD', 'meta_desc' => 'Promedio ≥ 4 = 100%'],
            'cl_pre'         => ['valor' => $evento?->adherencia_checklist_pre !== null ? round((float)$evento->adherencia_checklist_pre, 1) : null, 'label' => $evento?->adherencia_checklist_pre !== null ? round((float)$evento->adherencia_checklist_pre, 1).'%' : 'N/A', 'pilar' => 'Flota', 'peso' => 7.5, 'emoji' => '🔍', 'titulo' => 'Checklist Pre', 'meta_desc' => 'Promedio adherencia CL pre operacional'],
            'cl_post'        => ['valor' => $evento?->adherencia_checklist_post !== null ? round((float)$evento->adherencia_checklist_post, 1) : null, 'label' => $evento?->adherencia_checklist_post !== null ? round((float)$evento->adherencia_checklist_post, 1).'%' : 'N/A', 'pilar' => 'Flota', 'peso' => 7.5, 'emoji' => '🏁', 'titulo' => 'Checklist Post', 'meta_desc' => 'Promedio adherencia CL post operacional'],
        ];

        return Inertia::render('colaborador/mi-plan-premiacion/index', [
            'colaborador' => [
                'id'              => $colaborador->id,
                'nombre_completo' => $colaborador->nombre_completo,
                'cedula'          => $colaborador->cedula,
                'cargo'           => $colaborador->cargo ?? 'Sin cargo',
                'area'            => $colaborador->area ?? 'General',
                'imagen'          => $colaborador->imagen ?? null,
                'aci_realizadas'  => $aciRealizadas,
            ],
            'metricas'          => $metricas,
            'historial_aci'     => $historialAci,
            'mes'               => $mes,
            'anio'              => $anio,
        ]);
    }

    private function colaboradorDe(Request $request): ?Colaborador
    {
        return $request->user()->colaborador;
    }

    private function colaboradorDeOFallar(Request $request): Colaborador
    {
        return $this->colaboradorDe($request) ?? abort(
            403,
            'Tu cuenta todavía no está vinculada a un registro de colaborador. Contacta a un administrador.'
        );
    }
}
