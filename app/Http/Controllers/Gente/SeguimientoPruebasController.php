<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Http\Requests\Gente\ImportarPlanPadrinoCriteriosRequest;
use App\Models\Gente\ColaboradorPadrinoColumnaExtra;
use App\Models\Gente\ColaboradorPadrinoColumnaExtraValor;
use App\Models\Gente\ColaboradorPadrinoCriterio;
use App\Models\Gente\ColaboradorPadrinoHistorial;
use App\Models\Gente\ColaboradorPadrinoIndicador;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorPruebaPeriodo;
use App\Models\Seguridad\ColaboradorPruebaPeriodoEvidencia;
use App\Services\Gente\PlanPadrinoCriteriosImportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SeguimientoPruebasController extends Controller
{
    /**
     * Etapa => días desde el ingreso en que corresponde la prueba.
     * 7 días se cuenta como 8 (incluye el mismo día de la fecha de contrato).
     */
    private const ETAPAS_DIAS = [
        '7_dias'  => 8,
        '30_dias' => 30,
        '90_dias' => 90,
    ];

    private const ETAPAS_LABEL = [
        '7_dias'  => '7 días',
        '30_dias' => '30 días',
        '90_dias' => '90 días',
    ];

    /** Meta mensual de ACI para calcular el porcentaje. */
    private const META_ACI_MENSUAL = 32;

    /** Días de gracia antes de considerar una prueba "a destiempo". */
    private const DIAS_GRACIA = 2;

    // ─────────────────────────────────────────────────────────────────────────
    // SEGUIMIENTO DE PRUEBAS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tabla matriz de seguimiento de pruebas de período de prueba (7, 30, 90 días).
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $filtroEstado = $request->string('estado')->trim()->toString(); // todos, pendientes, destiempo, realizadas

        $hoy = Carbon::today();

        $query = Colaborador::query()
            ->where('is_active', true)
            ->with(['pruebasPeriodo.realizadoPor', 'pruebasPeriodo.evidencias'])
            ->orderBy('apellidos')
            ->orderBy('nombres');

        $this->aplicarBusqueda($query, $search);

        $colaboradoresDb = $query->get();

        $rows = [];
        $metrics = [
            'pendientes_7'     => 0,
            'pendientes_30'    => 0,
            'pendientes_90'    => 0,
            'total_destiempo'  => 0,
            'total_realizadas' => 0,
        ];

        foreach ($colaboradoresDb as $colaborador) {
            $fechaIngreso = $this->fechaIngreso($colaborador);
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->fecha_retiro_empresa;

            $etapasMap = [];
            $hasAnyActiveEtapa = false;

            foreach (self::ETAPAS_DIAS as $etapaKey => $dias) {
                $fechaPrueba = $fechaIngreso->copy()->addDays($dias);
                $cumplioDias = $hoy->greaterThanOrEqualTo($fechaPrueba);
                $aplicaRetiro = is_null($fechaRetiro) || $fechaRetiro->greaterThanOrEqualTo($fechaPrueba);
                $aplicaEtapa = $cumplioDias && $aplicaRetiro;

                $record = $colaborador->pruebasPeriodo->firstWhere('etapa', $etapaKey);
                $diasVencido = $hoy->greaterThan($fechaPrueba) ? (int) $fechaPrueba->diffInDays($hoy) : 0;

                $base = [
                    'fecha_prueba'            => $fechaPrueba->format('Y-m-d'),
                    'fecha_prueba_formateada' => $fechaPrueba->format('d/m/Y'),
                ];

                if ($record && $record->realizada) {
                    $hasAnyActiveEtapa = true;
                    $metrics['total_realizadas']++;
                    $etapasMap[$etapaKey] = $base + [
                        'aplica'            => true,
                        'estado'            => 'realizada',
                        'dias_vencido'      => $diasVencido,
                        'fecha_realizacion' => $record->fecha_realizacion?->format('d/m/Y H:i'),
                        'realizado_por'     => $record->realizadoPor?->name ?? 'Usuario',
                        'observaciones'     => $record->observaciones,
                        'prueba_periodo_id' => $record->id,
                        'evidencias'        => $this->mapEvidencias($record),
                    ];
                } elseif ($aplicaEtapa) {
                    $hasAnyActiveEtapa = true;
                    $limiteGracia = $fechaPrueba->copy()->addDays(self::DIAS_GRACIA);
                    $esDestiempo = $hoy->greaterThan($limiteGracia);

                    if ($esDestiempo) {
                        $metrics['total_destiempo']++;
                    }

                    $metricKey = 'pendientes_' . (int) $etapaKey; // 7_dias => pendientes_7
                    $metrics[$metricKey]++;

                    $etapasMap[$etapaKey] = $base + [
                        'aplica'            => true,
                        'estado'            => $esDestiempo ? 'destiempo' : 'pendiente',
                        'dias_vencido'      => $diasVencido,
                        'fecha_realizacion' => null,
                        'realizado_por'     => null,
                        'observaciones'     => null,
                        'prueba_periodo_id' => $record?->id,
                        'evidencias'        => $record ? $this->mapEvidencias($record) : [],
                    ];
                } else {
                    $etapasMap[$etapaKey] = $base + [
                        'aplica'            => false,
                        'estado'            => 'no_aplica',
                        'dias_vencido'      => 0,
                        'fecha_realizacion' => null,
                        'realizado_por'     => null,
                        'observaciones'     => null,
                        'prueba_periodo_id' => null,
                        'evidencias'        => [],
                    ];
                }
            }

            if (! $hasAnyActiveEtapa) {
                continue;
            }

            // Filtrado secundario por estado
            if ($filtroEstado === 'pendientes') {
                if (! collect($etapasMap)->contains(fn ($e) => $e['estado'] === 'pendiente')) {
                    continue;
                }
            } elseif ($filtroEstado === 'destiempo') {
                if (! collect($etapasMap)->contains(fn ($e) => $e['estado'] === 'destiempo')) {
                    continue;
                }
            } elseif ($filtroEstado === 'realizadas') {
                $allRealizadas = collect($etapasMap)
                    ->filter(fn ($e) => $e['aplica'])
                    ->every(fn ($e) => $e['estado'] === 'realizada');
                if (! $allRealizadas) {
                    continue;
                }
            }

            $rows[] = [
                'id'              => $colaborador->id,
                'cedula'          => $colaborador->cedula,
                'nombre_completo' => $colaborador->nombre_completo,
                'cargo'           => $colaborador->cargo ?? 'Sin cargo',
                'fecha_ingreso'   => $fechaIngreso->format('d/m/Y'),
                'imagen'          => $colaborador->imagen,
                'etapas'          => $etapasMap,
            ];
        }

        return Inertia::render('gente/plan-padrinos/index', [
            'colaboradores' => $rows,
            'metrics'       => $metrics,
            'filters'       => [
                'search' => $search,
                'estado' => $filtroEstado,
            ],
        ]);
    }

    /**
     * Marca o desmarca una etapa de prueba para un colaborador.
     */
    public function toggle(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => 'required|exists:colaboradores,id',
            'etapa'          => 'required|in:7_dias,30_dias,90_dias',
            'realizada'      => 'required|boolean',
            'observaciones'  => 'nullable|string|max:500',
        ]);

        $record = ColaboradorPruebaPeriodo::firstOrNew([
            'colaborador_id' => $validated['colaborador_id'],
            'etapa'          => $validated['etapa'],
        ]);

        if ($validated['realizada']) {
            $record->realizada = true;
            $record->fecha_realizacion = Carbon::now();
            $record->realizado_por_id = $request->user()->id;
            if (isset($validated['observaciones'])) {
                $record->observaciones = $validated['observaciones'];
            }
        } else {
            $record->realizada = false;
            $record->fecha_realizacion = null;
            $record->realizado_por_id = null;
            $record->observaciones = null;
        }

        $record->save();

        return back()->with('status', 'Prueba registrada correctamente.');
    }

    /**
     * Sube una o varias fotografías de evidencia para una etapa específica.
     */
    public function subirEvidencias(Request $request): RedirectResponse
    {
        $request->validate([
            'colaborador_id' => 'required|exists:colaboradores,id',
            'etapa'          => 'required|in:7_dias,30_dias,90_dias',
            'evidencias'     => 'required|array|min:1',
            'evidencias.*'   => 'required|file|mimes:jpg,jpeg,png,webp,heic,pdf|max:20480',
        ]);

        $targetId = (int) $request->input('colaborador_id');

        abort_unless(
            $this->puedeGestionarEvidencias($request->user(), $targetId),
            403,
            'No tienes permiso para subir evidencias de este colaborador.'
        );

        $etapa = $request->input('etapa');

        $record = ColaboradorPruebaPeriodo::firstOrCreate(
            [
                'colaborador_id' => $targetId,
                'etapa'          => $etapa,
            ],
            [
                'realizada'         => false,
                'fecha_realizacion' => null,
                'realizado_por_id'  => null,
            ]
        );

        $folderPath = "plan-padrinos/evidencias/{$etapa}/colaborador_{$targetId}";

        foreach ($request->file('evidencias', []) as $archivo) {
            $path = $archivo->store($folderPath, 'public');
            $record->evidencias()->create(['path' => $path]);
        }

        return back()->with('status', 'Evidencias subidas correctamente en su respectiva carpeta.');
    }

    /**
     * Elimina una fotografía de evidencia.
     */
    public function eliminarEvidencia(Request $request, ColaboradorPruebaPeriodoEvidencia $evidencia): RedirectResponse
    {
        $duenoId = (int) ($evidencia->pruebaPeriodo?->colaborador_id ?? 0);

        abort_unless(
            $duenoId > 0 && $this->puedeGestionarEvidencias($request->user(), $duenoId),
            403,
            'No tienes permiso para eliminar esta evidencia.'
        );

        Storage::disk('public')->delete($evidencia->path);
        $evidencia->delete();

        return back()->with('status', 'Evidencia eliminada.');
    }

    /**
     * JSON para la campana de notificaciones del header (usuarios de Seguridad).
     */
    public function alertasBell(Request $request): JsonResponse
    {
        $hoy = Carbon::today();

        $colaboradores = Colaborador::query()
            ->where('is_active', true)
            ->with(['pruebasPeriodo'])
            ->get();

        $alertas = [];
        $totalHoy = 0;
        $totalAtrasadas = 0;

        foreach ($colaboradores as $colaborador) {
            $fechaIngreso = $this->fechaIngreso($colaborador);
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->fecha_retiro_empresa;

            foreach (self::ETAPAS_DIAS as $etapaKey => $dias) {
                $fechaPrueba = $fechaIngreso->copy()->addDays($dias);

                // Regla de fecha de retiro
                if (! is_null($fechaRetiro) && $fechaRetiro->lessThan($fechaPrueba)) {
                    continue;
                }

                // Ya realizada
                $yaRealizada = $colaborador->pruebasPeriodo->contains(
                    fn ($p) => $p->etapa === $etapaKey && $p->realizada
                );
                if ($yaRealizada) {
                    continue;
                }

                // Debe haber llegado la fecha
                if ($hoy->lessThan($fechaPrueba)) {
                    continue;
                }

                $etiqueta = self::ETAPAS_LABEL[$etapaKey];
                $esHoy = $fechaPrueba->isSameDay($hoy);
                $diasVencido = (int) $fechaPrueba->diffInDays($hoy);

                if ($esHoy) {
                    $totalHoy++;
                    $tipo = 'hoy';
                    $mensaje = "Prueba de {$etiqueta} programada para hoy";
                } else {
                    $totalAtrasadas++;
                    $tipo = 'atrasada';
                    $mensaje = "Prueba de {$etiqueta} atrasada (hace {$diasVencido} " . ($diasVencido === 1 ? 'día' : 'días') . ')';
                }

                $alertas[] = [
                    'colaborador_id'   => $colaborador->id,
                    'colaborador'      => $colaborador->nombre_completo,
                    'cedula'           => $colaborador->cedula,
                    'cargo'            => $colaborador->cargo ?? 'Sin cargo',
                    'etapa_key'        => $etapaKey,
                    'etapa_label'      => $etiqueta,
                    'fecha_programada' => $fechaPrueba->format('d/m/Y'),
                    'tipo'             => $tipo,
                    'dias_vencido'     => $diasVencido,
                    'mensaje'          => $mensaje,
                ];
            }
        }

        // Primero las atrasadas más críticas, luego las de hoy
        usort($alertas, function ($a, $b) {
            if ($a['tipo'] === $b['tipo']) {
                return $b['dias_vencido'] <=> $a['dias_vencido'];
            }

            return $a['tipo'] === 'atrasada' ? -1 : 1;
        });

        return response()->json([
            'total'           => count($alertas),
            'total_hoy'       => $totalHoy,
            'total_atrasadas' => $totalAtrasadas,
            'alertas'         => $alertas,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRITERIOS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Submódulo Criterios del Plan Padrino (solo personal operativo).
     */
    public function criterios(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $cargoFiltro = $request->string('cargo')->trim()->toString();
        $autonomiaFiltro = $request->string('autonomia')->trim()->toString();
        $mes = $request->integer('mes') ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;

        $hoy = Carbon::today();

        $query = Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->with(['padrinoCriterio'])
            ->orderBy('apellidos')
            ->orderBy('nombres');

        $this->aplicarBusqueda($query, $search);

        if ($cargoFiltro !== '') {
            $query->where('cargo', $cargoFiltro);
        }

        $colaboradoresDb = $query->get();

        // Indicadores toggle indexados por colaborador_id
        $indicadoresPorColaborador = ColaboradorPadrinoIndicador::where('mes', $mes)
            ->where('anio', $anio)
            ->whereIn('colaborador_id', $colaboradoresDb->pluck('id'))
            ->get()
            ->keyBy('colaborador_id');

        // Columnas extra globales + valores del mes/año: [columna_id => [colaborador_id => bool]]
        $columnasExtra = ColaboradorPadrinoColumnaExtra::orderBy('orden')->get();

        $valoresExtra = [];
        if ($columnasExtra->isNotEmpty()) {
            ColaboradorPadrinoColumnaExtraValor::whereIn('columna_extra_id', $columnasExtra->pluck('id'))
                ->where('mes', $mes)
                ->where('anio', $anio)
                ->get()
                ->each(function ($v) use (&$valoresExtra) {
                    $valoresExtra[$v->columna_extra_id][$v->colaborador_id] = (bool) $v->valor;
                });
        }

        // Conteo de ACI por colaborador en el mes/año
        $conteoAcisPorColaborador = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('colaborador_id')
            ->select('colaborador_id', DB::raw('count(*) as total'))
            ->groupBy('colaborador_id')
            ->pluck('total', 'colaborador_id');

        // Evaluaciones OWD Ruta
        $preguntasRutaRaw = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->whereMonth('evaluaciones_owd.fecha_evaluacion', $mes)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->select('evaluaciones_owd.colaborador_id', 'evaluaciones_owd.qr_safety', 'evaluacion_owd_preguntas.puntuacion')
            ->get();

        // Resolver colaborador_id nulo mediante qr_safety
        $colaboradoresPorQrOwd = Colaborador::whereNotNull('codigo_qr_skap')
            ->select(['id', 'codigo_qr_skap'])
            ->get()
            ->keyBy('codigo_qr_skap');

        $preguntasRutaPorColaborador = $preguntasRutaRaw
            ->groupBy(function ($p) use ($colaboradoresPorQrOwd) {
                if ($p->colaborador_id) {
                    return $p->colaborador_id;
                }

                return $colaboradoresPorQrOwd->get($p->qr_safety)?->id;
            })
            ->filter(fn ($grupo, $key) => $key !== null && $key !== '');

        $rows = [];
        $metrics = [
            'total_operativos'      => 0,
            'autonomos'             => 0,
            'en_desarrollo'         => 0,
            'total_evaluados_excel' => 0,
        ];

        foreach ($colaboradoresDb as $colaborador) {
            $fechaIngreso = $this->fechaIngreso($colaborador);
            [$antiguedadTexto, $diasEnEmpresa] = $this->calcularAntiguedad($fechaIngreso, $hoy, 'Sin fecha de ingreso');

            $autonomiaSugerida = $this->calcularAutonomiaSugerida($diasEnEmpresa);
            $nivelAutonomiaActual = $colaborador->nivel_autonomia ?: $autonomiaSugerida;
            $esPersonalizado = ! empty($colaborador->nivel_autonomia);

            if ($autonomiaFiltro !== '' && $nivelAutonomiaActual !== $autonomiaFiltro) {
                continue;
            }

            $metrics['total_operativos']++;
            if (in_array($nivelAutonomiaActual, ['Nivel 3', 'Nivel 4', 'Padrino'], true)) {
                $metrics['autonomos']++;
            } else {
                $metrics['en_desarrollo']++;
            }

            $criterio = $colaborador->padrinoCriterio;
            if ($criterio) {
                $metrics['total_evaluados_excel']++;
            }

            // ACI
            $aciRealizadas = (int) ($conteoAcisPorColaborador[$colaborador->id] ?? 0);
            $porcentajeAci = min(100, round(($aciRealizadas / self::META_ACI_MENSUAL) * 100, 1));

            // OWD Ruta (100% si no hay ningún NO OK, 0% si hay alguno, null si no hay datos)
            $preguntasRuta = $preguntasRutaPorColaborador->get($colaborador->id, collect());
            $okRuta = 0;
            $noOkRuta = 0;
            foreach ($preguntasRuta as $p) {
                $texto = $this->normalizarPuntuacion($p->puntuacion);
                if ($this->esNoOk($texto)) {
                    $noOkRuta++;
                } elseif (str_contains($texto, 'ok')) {
                    $okRuta++;
                }
            }

            if (($okRuta + $noOkRuta) > 0) {
                $porcentajeOwdRuta = $noOkRuta > 0 ? 0.0 : 100.0;
                $porcentajeOwdRutaLabel = "{$porcentajeOwdRuta}%";
            } else {
                $porcentajeOwdRuta = null;
                $porcentajeOwdRutaLabel = 'N/A';
            }

            $indicador = $indicadoresPorColaborador->get($colaborador->id);

            $rows[] = [
                'id'                        => $colaborador->id,
                'cedula'                    => $colaborador->cedula,
                'codigo_qr_skap'            => $colaborador->codigo_qr_skap,
                'nombre_completo'           => $colaborador->nombre_completo,
                'cargo'                     => $colaborador->cargo ?? 'Sin cargo',
                'area'                      => $colaborador->area ?? 'Operativa',
                'imagen'                    => $colaborador->imagen,
                'fecha_ingreso'             => $fechaIngreso?->format('d/m/Y') ?? 'N/R',
                'antiguedad_texto'          => $antiguedadTexto,
                'dias_en_empresa'           => $diasEnEmpresa,
                'nivel_autonomia'           => $nivelAutonomiaActual,
                'nivel_autonomia_db'        => $colaborador->nivel_autonomia,
                'autonomia_sugerida'        => $autonomiaSugerida,
                'es_personalizado'          => $esPersonalizado,
                'es_padrino'                => (bool) $colaborador->es_padrino,
                'tipo_padrino'              => $colaborador->tipo_padrino,
                // ACI
                'aci_realizadas'            => $aciRealizadas,
                'porcentaje_aci'            => $porcentajeAci,
                // OWD
                'porcentaje_owd_ruta'       => $porcentajeOwdRuta,
                'porcentaje_owd_ruta_label' => $porcentajeOwdRutaLabel,
                // Indicadores toggle (default true = 100% si no existe registro)
                'safety_together'           => (bool) ($indicador->safety_together ?? true),
                'comunicacion_asertiva'     => (bool) ($indicador->comunicacion_asertiva ?? true),
                'habilidades'               => (bool) ($indicador->habilidades ?? true),
                'eventos_seguridad'         => (bool) ($indicador->eventos_seguridad ?? true),
                // Columnas extra: [columna_id => bool] (default true)
                'columnas_extra_valores'    => $columnasExtra->mapWithKeys(
                    fn ($col) => [$col->id => $valoresExtra[$col->id][$colaborador->id] ?? true]
                )->toArray(),
                'criterio_evaluacion'       => $criterio ? [
                    'qr_safety'                  => $criterio->qr_safety,
                    'funcional_7_dias'           => $criterio->funcional_7_dias,
                    'funcional_30_dias'          => $criterio->funcional_30_dias,
                    'funcional_90_dias'          => $criterio->funcional_90_dias,
                    'funcional_total'            => $criterio->funcional_total,
                    'hab_tecnicas_1'             => $criterio->hab_tecnicas_1,
                    'hab_tecnicas_2'             => $criterio->hab_tecnicas_2,
                    'hab_tecnicas_3'             => $criterio->hab_tecnicas_3,
                    'habilidades_tecnicas_total' => $criterio->habilidades_tecnicas_total,
                    'autonomia_1'                => $criterio->autonomia_1,
                    'autonomia_2'                => $criterio->autonomia_2,
                    'autonomia_3'                => $criterio->autonomia_3,
                    'autonomia_4'                => $criterio->autonomia_4,
                    'autonomia_total'            => $criterio->autonomia_total,
                ] : null,
            ];
        }

        $cargosUnicos = $colaboradoresDb->pluck('cargo')->filter()->unique()->values()->all();

        return Inertia::render('gente/plan-padrinos/criterios', [
            'colaboradores'            => $rows,
            'metrics'                  => $metrics,
            'cargos'                   => $cargosUnicos,
            'filters'                  => [
                'search'    => $search,
                'cargo'     => $cargoFiltro,
                'autonomia' => $autonomiaFiltro,
                'mes'       => $mes,
                'anio'      => $anio,
            ],
            'nivelesAutonomiaOpciones' => ['Nivel 0', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Padrino'],
            'columnas_extra'           => $columnasExtra->map(fn ($c) => [
                'id'     => $c->id,
                'nombre' => $c->nombre,
                'orden'  => $c->orden,
            ])->values()->toArray(),
        ]);
    }

    /**
     * Importa la evaluación de Criterios y Autonomía desde Excel cruzando por QR Safety.
     */
    public function importarCriterios(ImportarPlanPadrinoCriteriosRequest $request, PlanPadrinoCriteriosImportService $service): RedirectResponse
    {
        $resultado = $service->importar($request->file('archivo')->getRealPath());

        $mensaje = "Importación de Criterios completada: {$resultado['creados']} creados, "
            . "{$resultado['actualizados']} actualizados de {$resultado['procesados']} filas procesadas.";

        $tipo = match (true) {
            $resultado['procesados'] === 0 => 'error',
            $resultado['errores'] > 0      => 'warning',
            default                        => 'success',
        };

        return redirect()->route('gente.plan-padrinos.criterios')->with('status', ['message' => $mensaje, 'type' => $tipo]);
    }

    /**
     * Limpia la tabla de criterios de evaluación importados.
     * IMPORTANTE: protege esta ruta con middleware de rol (Administrador / Gente).
     */
    public function limpiarCriterios(): RedirectResponse
    {
        ColaboradorPadrinoCriterio::truncate();

        return redirect()->route('gente.plan-padrinos.criterios')->with('status', [
            'message' => 'Todas las evaluaciones de criterios importadas fueron eliminadas.',
            'type'    => 'success',
        ]);
    }

    /**
     * Alterna un indicador (safety_together, comunicacion_asertiva, habilidades, eventos_seguridad)
     * para un colaborador en un mes/año. Si no existe registro se crea con todos en true.
     */
    public function toggleIndicador(Request $request): RedirectResponse
    {
        $colaboradorId = $request->integer('colaborador_id');
        $mes = $request->integer('mes');
        $anio = $request->integer('anio');
        $campo = $request->string('campo')->toString();

        $camposValidos = ['safety_together', 'comunicacion_asertiva', 'habilidades', 'eventos_seguridad'];

        abort_unless(in_array($campo, $camposValidos, true), 422, 'Campo no válido.');
        abort_unless($colaboradorId > 0 && $mes >= 1 && $mes <= 12 && $anio >= 2024, 422, 'Parámetros inválidos.');

        $indicador = ColaboradorPadrinoIndicador::firstOrCreate(
            ['colaborador_id' => $colaboradorId, 'mes' => $mes, 'anio' => $anio],
            [
                'safety_together'       => true,
                'comunicacion_asertiva' => true,
                'habilidades'           => true,
                'eventos_seguridad'     => true,
            ]
        );

        $indicador->$campo = ! $indicador->$campo;
        $indicador->save();

        return redirect()->back()->with('status', [
            'message' => 'Indicador actualizado.',
            'type'    => 'success',
        ]);
    }

    /**
     * Crea una nueva columna extra global (persiste en todos los meses hasta eliminarla).
     */
    public function crearColumnaExtra(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100',
        ]);

        $nombre = trim($validated['nombre']);
        abort_if($nombre === '', 422, 'El nombre de la columna es obligatorio.');

        $orden = ColaboradorPadrinoColumnaExtra::max('orden') ?? 0;

        ColaboradorPadrinoColumnaExtra::create([
            'nombre' => $nombre,
            'orden'  => $orden + 1,
        ]);

        return redirect()->back()->with('status', [
            'message' => "Columna \"{$nombre}\" creada.",
            'type'    => 'success',
        ]);
    }

    /**
     * Elimina una columna extra (el cascade elimina también sus valores).
     */
    public function eliminarColumnaExtra(ColaboradorPadrinoColumnaExtra $columna): RedirectResponse
    {
        $nombre = $columna->nombre;
        $columna->delete();

        return redirect()->back()->with('status', [
            'message' => "Columna \"{$nombre}\" eliminada.",
            'type'    => 'success',
        ]);
    }

    /**
     * Alterna el valor mensual de una celda de columna extra para un colaborador.
     */
    public function toggleColumnaExtraValor(ColaboradorPadrinoColumnaExtra $columna, Request $request): RedirectResponse
    {
        $colaboradorId = $request->integer('colaborador_id');
        $mes = $request->integer('mes');
        $anio = $request->integer('anio');

        abort_unless($colaboradorId > 0 && $mes >= 1 && $mes <= 12 && $anio >= 2024, 422, 'Parámetros inválidos.');

        $valor = ColaboradorPadrinoColumnaExtraValor::firstOrCreate(
            [
                'columna_extra_id' => $columna->id,
                'colaborador_id'   => $colaboradorId,
                'mes'              => $mes,
                'anio'             => $anio,
            ],
            ['valor' => true] // primera vez empieza en true y luego se invierte
        );

        $valor->valor = ! $valor->valor;
        $valor->save();

        return redirect()->back()->with('status', [
            'message' => 'Valor actualizado.',
            'type'    => 'success',
        ]);
    }

    /**
     * Descarga la plantilla CSV para la importación de Criterios y Autonomía.
     */
    public function plantillaCriterios(): StreamedResponse
    {
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="plantilla_criterios_plan_padrinos.csv"',
        ];

        $callback = function () {
            $file = fopen('php://output', 'w');
            fwrite($file, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM UTF-8

            fputcsv($file, [
                'QR Safety',
                'Nombre',
                'Funcional 7 días',
                'Funcional 30 días',
                'Funcional 90 días',
                'Funcional',
                'Hab. técnicas 1',
                'Hab. técnicas 2',
                'Hab. técnicas 3',
                'Habilidades Técnicas',
                'Autonomía 1',
                'Autonomía 2',
                'Autonomía 3',
                'Autonomía 4',
                'Autonomía',
            ]);

            fputcsv($file, array_merge(['F1V2ETVY', 'Jhon Ferney Amado'], array_fill(0, 13, '100')));

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ROLES / AUTONOMÍA
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Actualiza el nivel de autonomía de un colaborador.
     */
    public function updateAutonomia(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id'  => 'required|exists:colaboradores,id',
            'nivel_autonomia' => 'required|string|in:Nivel 0,Nivel 1,Nivel 2,Nivel 3,Nivel 4,Padrino',
        ]);

        $colaborador = Colaborador::findOrFail($validated['colaborador_id']);
        $colaborador->nivel_autonomia = $validated['nivel_autonomia'];
        $colaborador->save();

        return back()->with('status', 'Nivel de autonomía actualizado.');
    }

    /**
     * Actualiza el rol de padrino (Padrino / Apadrinado / Ninguno) de un colaborador.
     */
    public function updateRolPadrino(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => 'required|exists:colaboradores,id',
            'tipo_padrino'   => 'nullable|string|in:Padrino,Apadrinado,Ninguno',
        ]);

        $tipo = $validated['tipo_padrino'] ?? null;

        $colaborador = Colaborador::findOrFail($validated['colaborador_id']);
        $colaborador->tipo_padrino = ($tipo === 'Ninguno') ? null : $tipo;
        $colaborador->es_padrino = ($tipo === 'Padrino');
        $colaborador->save();

        return back()->with('status', 'Rol de padrino actualizado.');
    }

    /**
     * Guarda el mensaje de presentación de un padrino.
     * NOTA: método reconstruido (el original se perdió en el archivo corrupto).
     * Verifica que el nombre coincida con tu ruta.
     */
    public function guardarMensajePadrino(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id'  => 'required|exists:colaboradores,id',
            'mensaje_padrino' => 'nullable|string|max:2000',
        ]);

        $colaborador = Colaborador::findOrFail($validated['colaborador_id']);
        $colaborador->mensaje_padrino = $validated['mensaje_padrino'] ?? null;
        $colaborador->save();

        return back()->with('status', 'Mensaje actualizado.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PADRINOS / APADRINADOS / PAREJAS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Vista de los Padrinos: tarjetas con foto, cargo, nombre e historial.
     */
    public function padrinos(): Response
    {
        $hoy = Carbon::today();

        $padrinosDb = Colaborador::query()
            ->where('is_active', true)
            ->where('es_padrino', true)
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'imagen', 'mensaje_padrino', 'correo', 'celular_1', 'fecha_ingreso_empresa', 'created_at'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get();

        $padrinoIds = $padrinosDb->pluck('id');

        // Un solo query por lado de la relación (evita N+1)
        $historialPorPadrino = DB::table('colaborador_padrino_historial')
            ->whereIn('padrino_id', $padrinoIds)
            ->orderBy('fecha_inicio')
            ->get()
            ->groupBy('padrino_id');

        $historialPorApadrinado = DB::table('colaborador_padrino_historial')
            ->whereIn('colaborador_id', $padrinoIds)
            ->orderBy('fecha_inicio')
            ->get()
            ->groupBy('colaborador_id');

        // Mapa único de colaboradores relacionados
        $relacionadosIds = $historialPorPadrino->flatten(1)->pluck('colaborador_id')
            ->merge($historialPorApadrinado->flatten(1)->pluck('padrino_id'))
            ->unique()
            ->values();

        $relacionados = Colaborador::query()
            ->whereIn('id', $relacionadosIds)
            ->get(['id', 'nombres', 'apellidos', 'cargo', 'imagen'])
            ->keyBy('id');

        $padrinos = $padrinosDb->map(function ($c) use ($hoy, $historialPorPadrino, $historialPorApadrinado, $relacionados) {
            $fechaIngreso = $this->fechaIngreso($c);
            $fechaIngresoTexto = $fechaIngreso ? $fechaIngreso->format('d/m/Y') : 'N/R';
            $diasEnEmpresa = $fechaIngreso ? (int) $fechaIngreso->diffInDays($hoy) : 0;

            // Historial como PADRINO
            $comoPadrino = $historialPorPadrino->get($c->id, collect());

            $apadrinadosLista = $comoPadrino->map(function ($h) use ($hoy, $relacionados) {
                $inicio = Carbon::parse($h->fecha_inicio);
                $fin = $h->fecha_fin ? Carbon::parse($h->fecha_fin) : $hoy;
                $apad = $relacionados->get($h->colaborador_id);

                return [
                    'id'              => $h->colaborador_id,
                    'nombre_completo' => $apad ? $apad->nombre_completo : 'Desconocido',
                    'cargo'           => $apad ? ($apad->cargo ?? 'Sin cargo') : '—',
                    'imagen'          => $apad?->imagen,
                    'fecha_inicio'    => $inicio->format('d/m/Y'),
                    'fecha_fin'       => $h->fecha_fin ? $fin->format('d/m/Y') : null,
                    'dias'            => (int) $inicio->diffInDays($fin),
                    'activo'          => $h->fecha_fin === null,
                ];
            })->values()->all();

            $diasTotalPadrino = (int) collect($apadrinadosLista)->sum('dias');

            // Historial como APADRINADO
            $comoApadrinado = $historialPorApadrinado->get($c->id, collect());

            $historialApadrinadoLista = $comoApadrinado->map(function ($h) use ($hoy, $relacionados) {
                $inicio = Carbon::parse($h->fecha_inicio);
                $fin = $h->fecha_fin ? Carbon::parse($h->fecha_fin) : $hoy;
                $pad = $relacionados->get($h->padrino_id);

                return [
                    'padrino_id'     => $h->padrino_id,
                    'padrino_nombre' => $pad ? $pad->nombre_completo : 'Desconocido',
                    'padrino_cargo'  => $pad ? ($pad->cargo ?? 'Sin cargo') : '—',
                    'padrino_imagen' => $pad?->imagen,
                    'fecha_inicio'   => $inicio->format('d/m/Y'),
                    'fecha_fin'      => $h->fecha_fin ? $fin->format('d/m/Y') : null,
                    'dias'           => (int) $inicio->diffInDays($fin),
                    'activo'         => $h->fecha_fin === null,
                ];
            })->values()->all();

            // Tiempo legible del total como padrino
            $tiempoTexto = 'Sin actividad';
            if ($diasTotalPadrino > 0) {
                $years = intdiv($diasTotalPadrino, 365);
                $months = intdiv($diasTotalPadrino % 365, 30);
                $days = $diasTotalPadrino % 365 % 30;
                $partes = [];
                if ($years > 0) {
                    $partes[] = "{$years} " . ($years === 1 ? 'año' : 'años');
                }
                if ($months > 0) {
                    $partes[] = "{$months} " . ($months === 1 ? 'mes' : 'meses');
                }
                if ($days > 0) {
                    $partes[] = "{$days} " . ($days === 1 ? 'día' : 'días');
                }
                $tiempoTexto = implode(', ', $partes);
            }

            return [
                'id'                   => $c->id,
                'cedula'               => $c->cedula,
                'nombre_completo'      => $c->nombre_completo,
                'cargo'                => $c->cargo ?? 'Sin cargo',
                'imagen'               => $c->imagen,
                'mensaje_padrino'      => $c->mensaje_padrino,
                'correo'               => $c->correo,
                'celular'              => $c->celular_1,
                'fecha_ingreso_texto'  => $fechaIngresoTexto,
                'dias_en_empresa'      => $diasEnEmpresa,
                'veces_padrino'        => $comoPadrino->count(),
                'dias_total_padrino'   => $diasTotalPadrino,
                'tiempo_total_texto'   => $tiempoTexto,
                'apadrinados_lista'    => $apadrinadosLista,
                'veces_apadrinado'     => $comoApadrinado->count(),
                'historial_apadrinado' => $historialApadrinadoLista,
            ];
        });

        // Apadrinados disponibles (mismos criterios que apadrinados())
        $fechaLimite = $hoy->copy()->subDays(90);
        $apadrinadosList = $this->queryApadrinadosDisponibles($fechaLimite)
            ->orderByRaw('COALESCE(fecha_ingreso_empresa, created_at) DESC')
            ->get()
            ->map(function ($c) {
                $fechaIngreso = $this->fechaIngreso($c);

                return [
                    'id'              => $c->id,
                    'cedula'          => $c->cedula,
                    'nombre_completo' => $c->nombre_completo,
                    'cargo'           => $c->cargo ?? 'Sin cargo',
                    'imagen'          => $c->imagen,
                    'fecha_ingreso'   => $fechaIngreso ? $fechaIngreso->format('d/m/Y') : 'N/R',
                    'padrino_id'      => $c->padrino_id,
                ];
            });

        return Inertia::render('gente/plan-padrinos/padrinos', [
            'padrinos'        => $padrinos,
            'apadrinadosList' => $apadrinadosList,
        ]);
    }

    /**
     * Vista de los Apadrinados: operativos de reciente ingreso sin padrino.
     */
    public function apadrinados(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $hoy = Carbon::today();
        $fechaLimite = $hoy->copy()->subDays(90);

        // Criterios: activos, área operativa, sin retiro, sin padrino, no padrinos,
        // ingreso <= 90 días (o sin fecha) y sin evidencias en la etapa de 90 días.
        $query = $this->queryApadrinadosDisponibles($fechaLimite)
            ->with(['padrino.apadrinados', 'padrino.padrino', 'pruebasPeriodo.evidencias'])
            ->orderByRaw('COALESCE(fecha_ingreso_empresa, created_at) DESC');

        $this->aplicarBusqueda($query, $search);

        $apadrinados = $query->get()->map(fn ($c) => $this->mapApadrinado($c, $hoy));

        $padrinosList = Colaborador::query()
            ->where('is_active', true)
            ->where('es_padrino', true)
            ->with(['apadrinados', 'padrino'])
            ->select(['id', 'nombres', 'apellidos', 'cargo', 'imagen', 'padrino_id', 'tipo_padrino', 'fecha_ingreso_empresa'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn ($p) => $this->mapPadrinoBasico($p));

        $metrics = [
            'total'             => $apadrinados->count(),
            'recientes_30'      => $apadrinados->where('dias_en_empresa', '<=', 30)->count(),
            'periodo_prueba_90' => $apadrinados->where('dias_en_empresa', '<=', 90)->count(),
        ];

        return Inertia::render('gente/plan-padrinos/apadrinados', [
            'apadrinados'  => $apadrinados->values(),
            'padrinosList' => $padrinosList,
            'metrics'      => $metrics,
            'filters'      => ['search' => $search],
        ]);
    }

    /**
     * Asigna (o quita) un Padrino a un colaborador Apadrinado y registra el historial:
     * cierra la relación anterior (si existe) y abre una nueva con fecha_inicio = hoy.
     */
    public function asignarPadrino(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => 'required|exists:colaboradores,id',
            'padrino_id'     => [
                'nullable',
                'different:colaborador_id',
                Rule::exists('colaboradores', 'id')->where('es_padrino', true),
            ],
        ]);

        $nuevoPadrinoId = isset($validated['padrino_id']) ? (int) $validated['padrino_id'] : null;

        DB::transaction(function () use ($validated, $nuevoPadrinoId) {
            $colaborador = Colaborador::lockForUpdate()->findOrFail($validated['colaborador_id']);
            $hoy = Carbon::today()->toDateString();
            $anteriorId = $colaborador->padrino_id !== null ? (int) $colaborador->padrino_id : null;

            if ($anteriorId === $nuevoPadrinoId) {
                return; // sin cambios
            }

            // Cerrar relación anterior
            if ($anteriorId !== null) {
                ColaboradorPadrinoHistorial::where('colaborador_id', $colaborador->id)
                    ->where('padrino_id', $anteriorId)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => $hoy]);
            }

            // Abrir nueva relación
            if ($nuevoPadrinoId !== null) {
                ColaboradorPadrinoHistorial::create([
                    'colaborador_id' => $colaborador->id,
                    'padrino_id'     => $nuevoPadrinoId,
                    'fecha_inicio'   => $hoy,
                    'fecha_fin'      => null,
                ]);
                $colaborador->tipo_padrino = 'Apadrinado';
            }

            $colaborador->padrino_id = $nuevoPadrinoId;
            $colaborador->save();
        });

        return back()->with('status', 'Padrino asignado correctamente.');
    }

    /**
     * Vista de Parejas: catálogo de Padrinos y sus Apadrinados asignados.
     */
    public function parejas(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $padrinoIdFiltro = $request->integer('padrino_id') ?: null;

        // abiertos = sin evidencias de 90 días | cerrados = con evidencias de 90 días
        $estado = $request->string('estado', 'abiertos')->toString();
        if (! in_array($estado, ['abiertos', 'cerrados'], true)) {
            $estado = 'abiertos';
        }

        $hoy = Carbon::today();
        $currentColaboradorId = $request->user()?->colaborador?->id;

        // 1. Padrinos
        $padrinosList = Colaborador::query()
            ->where('is_active', true)
            ->where('es_padrino', true)
            ->with(['apadrinados', 'padrino'])
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'imagen', 'mensaje_padrino', 'correo', 'celular_1', 'padrino_id', 'tipo_padrino', 'fecha_ingreso_empresa'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn ($p) => $this->mapPadrinoBasico($p) + [
                'cedula'          => $p->cedula,
                'mensaje_padrino' => $p->mensaje_padrino,
                'correo'          => $p->correo,
                'celular'         => $p->celular_1,
            ]);

        // 2. Apadrinados con padrino ya asignado
        $query = Colaborador::query()
            ->where('is_active', true)
            ->where('tipo_padrino', 'Apadrinado')
            ->whereNotNull('padrino_id')
            ->with(['padrino.apadrinados', 'padrino.padrino', 'pruebasPeriodo.evidencias'])
            ->orderByRaw('COALESCE(fecha_ingreso_empresa, created_at) DESC');

        if ($estado === 'abiertos') {
            $query->whereDoesntHave('pruebasPeriodo', function ($q) {
                $q->where('etapa', '90_dias')->whereHas('evidencias');
            });
        } else {
            $query->whereHas('pruebasPeriodo', function ($q) {
                $q->where('etapa', '90_dias')->whereHas('evidencias');
            });
        }

        $this->aplicarBusqueda($query, $search);

        if ($padrinoIdFiltro) {
            $query->where('padrino_id', $padrinoIdFiltro);
        }

        $apadrinados = $query->get()->map(fn ($c) => $this->mapApadrinado($c, $hoy));

        // Apadrinados todavía sin padrino (disponibles para asignar)
        $sinPadrino = $this->queryApadrinadosDisponibles($hoy->copy()->subDays(90))->count();

        $metrics = [
            'total_padrinos'    => $padrinosList->count(),
            'total_apadrinados' => $apadrinados->count(),
            'parejas_activas'   => $apadrinados->whereNotNull('padrino_id')->count(),
            'sin_padrino'       => $sinPadrino,
        ];

        return Inertia::render('gente/plan-padrinos/parejas', [
            'padrinos'               => $padrinosList,
            'apadrinados'            => $apadrinados->values(),
            'metrics'                => $metrics,
            'current_colaborador_id' => $currentColaboradorId,
            'filters'                => [
                'search'     => $search,
                'padrino_id' => $padrinoIdFiltro,
                'estado'     => $estado,
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS PRIVADOS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fecha de ingreso normalizada a inicio de día (evita fallos al comparar con horas).
     */
    private function fechaIngreso(Colaborador $colaborador): ?Carbon
    {
        $fecha = $colaborador->fecha_ingreso_empresa ?? $colaborador->created_at;

        return $fecha ? Carbon::parse($fecha)->startOfDay() : null;
    }

    /**
     * Aplica el filtro de búsqueda estándar (nombres, apellidos, cédula, cargo).
     */
    private function aplicarBusqueda(Builder $query, string $search): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function ($q) use ($search) {
            $q->where('nombres', 'like', "%{$search}%")
              ->orWhere('apellidos', 'like', "%{$search}%")
              ->orWhere('cedula', 'like', "%{$search}%")
              ->orWhere('cargo', 'like', "%{$search}%");
        });
    }

    /**
     * Antigüedad legible y días en la empresa.
     *
     * @return array{0: string, 1: int} [texto, días]
     */
    private function calcularAntiguedad(?Carbon $fechaIngreso, Carbon $hoy, string $textoSinFecha = 'Sin fecha'): array
    {
        if (! $fechaIngreso) {
            return [$textoSinFecha, 0];
        }

        $diasEnEmpresa = (int) $fechaIngreso->diffInDays($hoy);

        $years = (int) $fechaIngreso->diffInYears($hoy);
        $months = (int) $fechaIngreso->copy()->addYears($years)->diffInMonths($hoy);
        $days = (int) $fechaIngreso->copy()->addYears($years)->addMonths($months)->diffInDays($hoy);

        $parts = [];
        if ($years > 0) {
            $parts[] = "{$years} " . ($years === 1 ? 'año' : 'años');
        }
        if ($months > 0) {
            $parts[] = "{$months} " . ($months === 1 ? 'mes' : 'meses');
        }
        if ($years === 0 && $months === 0) {
            $parts[] = "{$days} " . ($days === 1 ? 'día' : 'días');
        }

        return [implode(', ', $parts) ?: '0 días', $diasEnEmpresa];
    }

    /**
     * Criterios únicos de "apadrinados disponibles" (sin padrino, recientes, no cerrados).
     */
    private function queryApadrinadosDisponibles(Carbon $fechaLimite): Builder
    {
        return Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->whereNull('fecha_retiro_empresa')
            ->whereNull('padrino_id')
            ->where(fn ($q) => $q->where('es_padrino', false)->orWhereNull('es_padrino'))
            ->where(fn ($q) => $q->whereNull('fecha_ingreso_empresa')
                ->orWhere('fecha_ingreso_empresa', '>=', $fechaLimite))
            ->whereDoesntHave('pruebasPeriodo', function ($q) {
                $q->where('etapa', '90_dias')->whereHas('evidencias');
            });
    }

    /**
     * Estructura de historial de un padrino para las vistas de apadrinados/parejas.
     */
    private function mapHistorialPadrino(Colaborador $p): array
    {
        return [
            'veces_padrino'    => $p->apadrinados->count(),
            'apadrinados_list' => $p->apadrinados->map(fn ($a) => [
                'id'              => $a->id,
                'nombre_completo' => $a->nombre_completo,
                'cargo'           => $a->cargo ?? 'Sin cargo',
                'imagen'          => $a->imagen,
                'fecha_ingreso'   => $a->fecha_ingreso_empresa ? $a->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
            ])->values()->all(),
            'fue_apadrinado'   => $p->padrino_id !== null || $p->tipo_padrino === 'Apadrinado',
            'padrino_guia'     => $p->padrino ? [
                'id'              => $p->padrino->id,
                'nombre_completo' => $p->padrino->nombre_completo,
                'cargo'           => $p->padrino->cargo ?? 'Sin cargo',
                'imagen'          => $p->padrino->imagen,
            ] : null,
            'fecha_ingreso'    => $p->fecha_ingreso_empresa ? $p->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
        ];
    }

    /**
     * Datos básicos de un padrino con su historial.
     */
    private function mapPadrinoBasico(Colaborador $p): array
    {
        return [
            'id'              => $p->id,
            'nombre_completo' => $p->nombre_completo,
            'cargo'           => $p->cargo ?? 'Sin cargo',
            'imagen'          => $p->imagen,
            'historial'       => $this->mapHistorialPadrino($p),
        ];
    }

    /**
     * Fila de apadrinado (compartida por apadrinados() y parejas()).
     */
    private function mapApadrinado(Colaborador $c, Carbon $hoy): array
    {
        $fechaIngreso = $this->fechaIngreso($c);
        [$antiguedadTexto, $diasEnEmpresa] = $this->calcularAntiguedad($fechaIngreso, $hoy);

        $evidencias = $c->pruebasPeriodo->flatMap(function ($prueba) {
            return $prueba->evidencias->map(fn ($e) => [
                'id'    => $e->id,
                'url'   => '/storage/' . $e->path,
                'etapa' => $prueba->etapa,
                'fecha' => $e->created_at ? $e->created_at->format('d/m/Y H:i') : null,
            ]);
        })->values()->all();

        return [
            'id'               => $c->id,
            'cedula'           => $c->cedula,
            'nombre_completo'  => $c->nombre_completo,
            'cargo'            => $c->cargo ?? 'Sin cargo',
            'area'             => $c->area ?? 'General',
            'imagen'           => $c->imagen,
            'fecha_ingreso'    => $fechaIngreso ? $fechaIngreso->format('d/m/Y') : 'N/R',
            'antiguedad_texto' => $antiguedadTexto,
            'dias_en_empresa'  => $diasEnEmpresa,
            'es_padrino'       => (bool) $c->es_padrino,
            'tipo_padrino'     => $c->tipo_padrino,
            'padrino_id'       => $c->padrino_id,
            'padrino'          => $c->padrino ? [
                'id'              => $c->padrino->id,
                'nombre_completo' => $c->padrino->nombre_completo,
                'cargo'           => $c->padrino->cargo ?? 'Sin cargo',
                'imagen'          => $c->padrino->imagen,
                'historial'       => $this->mapHistorialPadrino($c->padrino),
            ] : null,
            'nivel_autonomia'  => $c->nivel_autonomia ?? 'Nivel 0',
            'evidencias'       => $evidencias,
        ];
    }

    /**
     * Evidencias de una prueba en formato para el front.
     */
    private function mapEvidencias(ColaboradorPruebaPeriodo $record): array
    {
        return $record->evidencias->map(fn ($e) => [
            'id'  => $e->id,
            'url' => '/storage/' . $e->path,
        ])->values()->all();
    }

    /**
     * ¿Puede el usuario subir/eliminar evidencias del colaborador dado?
     * Managers: siempre. Resto: solo el propio colaborador o su padrino.
     */
    private function puedeGestionarEvidencias($user, int $colaboradorObjetivoId): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->hasRole('Administrador') || $user->hasRole('Gente')) {
            return true;
        }

        $miColaboradorId = $user->colaborador?->id;
        if ($miColaboradorId === null) {
            return false; // evita el falso positivo null === null
        }

        $miColaboradorId = (int) $miColaboradorId;

        if ($colaboradorObjetivoId === $miColaboradorId) {
            return true;
        }

        $padrinoId = Colaborador::whereKey($colaboradorObjetivoId)->value('padrino_id');

        return $padrinoId !== null && (int) $padrinoId === $miColaboradorId;
    }

    /**
     * Normaliza una puntuación OWD: minúsculas y separadores (_ - espacios) a un espacio.
     */
    private function normalizarPuntuacion(mixed $valor): string
    {
        $texto = strtolower(trim((string) $valor));

        return preg_replace('/[\s_\-]+/', ' ', $texto) ?? $texto;
    }

    private function esNoOk(string $textoNormalizado): bool
    {
        return str_contains($textoNormalizado, 'no ok')
            || str_contains($textoNormalizado, 'not ok')
            || str_contains($textoNormalizado, 'nook');
    }

    /**
     * Sugerencia del nivel de autonomía según días en la empresa.
     */
    private function calcularAutonomiaSugerida(int $dias): string
    {
        return match (true) {
            $dias < 30  => 'Nivel 0',
            $dias < 90  => 'Nivel 1',
            $dias < 180 => 'Nivel 2',
            $dias < 365 => 'Nivel 3',
            default     => 'Nivel 4',
        };
    }
}