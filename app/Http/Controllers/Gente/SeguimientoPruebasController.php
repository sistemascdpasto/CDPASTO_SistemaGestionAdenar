<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Http\Requests\Gente\ImportarPlanPadrinoCriteriosRequest;
use App\Models\Gente\ColaboradorPadrinoCriterio;
use App\Models\Gente\ColaboradorPadrinoColumnaExtra;
use App\Models\Gente\ColaboradorPadrinoColumnaExtraValor;
use App\Models\Gente\ColaboradorPadrinoHistorial;
use App\Models\Gente\ColaboradorPadrinoIndicador;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorPruebaPeriodo;
use App\Models\Seguridad\ColaboradorPruebaPeriodoEvidencia;
use App\Services\Gente\PlanPadrinoCriteriosImportService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SeguimientoPruebasController extends Controller
{
    /**
     * Muestra la tabla matriz de seguimiento de pruebas de período de prueba (7, 30, 90 días)
     * y Plan Padrino.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $filtroEstado = $request->string('estado')->trim()->toString(); // 'todos', 'pendientes', 'destiempo', 'realizadas'

        $hoy = Carbon::today();

        // 1. Solo colaboradores activos
        $query = Colaborador::query()
            ->where('is_active', true)
            ->with(['pruebasPeriodo.realizadoPor', 'pruebasPeriodo.evidencias'])
            ->orderBy('apellidos')
            ->orderBy('nombres');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nombres', 'like', "%{$search}%")
                  ->orWhere('apellidos', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('cargo', 'like', "%{$search}%");
            });
        }

        $colaboradoresDb = $query->get();

        $rows = [];
        $metrics = [
            'pendientes_7' => 0,
            'pendientes_30' => 0,
            'pendientes_90' => 0,
            'total_destiempo' => 0,
            'total_realizadas' => 0,
        ];

        foreach ($colaboradoresDb as $colaborador) {
            $fechaIngreso = $colaborador->fecha_ingreso_empresa ?? $colaborador->created_at;
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->fecha_retiro_empresa;

            $etapasMap = [];
            $hasAnyActiveEtapa = false;

            // 7 días se calcula como 9 días contando el mismo día de la fecha de contrato (+8 días)
            $etapasConfig = [
                '7_dias' => 8,
                '30_dias' => 30,
                '90_dias' => 90,
            ];

            foreach ($etapasConfig as $etapaKey => $dias) {
                $fechaPrueba = $fechaIngreso->copy()->addDays($dias);
                $cumplioDias = $hoy->greaterThanOrEqualTo($fechaPrueba);
                $aplicaRetiro = is_null($fechaRetiro) || $fechaRetiro->greaterThanOrEqualTo($fechaPrueba);

                $aplicaEtapa = $cumplioDias && $aplicaRetiro;

                $record = $colaborador->pruebasPeriodo->firstWhere('etapa', $etapaKey);

                $diasVencido = $hoy->greaterThan($fechaPrueba) ? (int) $fechaPrueba->diffInDays($hoy) : 0;

                if ($record && $record->realizada) {
                    $hasAnyActiveEtapa = true;
                    $metrics['total_realizadas']++;
                    $etapasMap[$etapaKey] = [
                        'aplica' => true,
                        'estado' => 'realizada',
                        'fecha_prueba' => $fechaPrueba->format('Y-m-d'),
                        'fecha_prueba_formateada' => $fechaPrueba->format('d/m/Y'),
                        'dias_vencido' => $diasVencido,
                        'fecha_realizacion' => $record->fecha_realizacion?->format('d/m/Y H:i'),
                        'realizado_por' => $record->realizadoPor?->name ?? 'Usuario',
                        'observaciones' => $record->observaciones,
                        'prueba_periodo_id' => $record->id,
                        'evidencias' => $record->evidencias->map(fn ($e) => [
                            'id'  => $e->id,
                            'url' => '/storage/' . $e->path,
                        ])->values()->all(),
                    ];
                } elseif ($aplicaEtapa) {
                    $hasAnyActiveEtapa = true;
                    $limiteGrace = $fechaPrueba->copy()->addDays(2);
                    $esDestiempo = $hoy->greaterThan($limiteGrace);

                    if ($esDestiempo) {
                        $metrics['total_destiempo']++;
                        $estadoStr = 'destiempo';
                    } else {
                        $estadoStr = 'pendiente';
                    }

                    if ($etapaKey === '7_dias') {
                        $metrics['pendientes_7']++;
                    } elseif ($etapaKey === '30_dias') {
                        $metrics['pendientes_30']++;
                    } elseif ($etapaKey === '90_dias') {
                        $metrics['pendientes_90']++;
                    }

                    $etapasMap[$etapaKey] = [
                        'aplica' => true,
                        'estado' => $estadoStr,
                        'fecha_prueba' => $fechaPrueba->format('Y-m-d'),
                        'fecha_prueba_formateada' => $fechaPrueba->format('d/m/Y'),
                        'dias_vencido' => $diasVencido,
                        'fecha_realizacion' => null,
                        'realizado_por' => null,
                        'observaciones' => null,
                        'prueba_periodo_id' => $record?->id ?? null,
                        'evidencias' => $record
                            ? $record->evidencias->map(fn ($e) => [
                                'id'  => $e->id,
                                'url' => '/storage/' . $e->path,
                            ])->values()->all()
                            : [],
                    ];
                } else {
                    $etapasMap[$etapaKey] = [
                        'aplica' => false,
                        'estado' => 'no_aplica',
                        'fecha_prueba' => $fechaPrueba->format('Y-m-d'),
                        'fecha_prueba_formateada' => $fechaPrueba->format('d/m/Y'),
                        'dias_vencido' => 0,
                        'fecha_realizacion' => null,
                        'realizado_por' => null,
                        'observaciones' => null,
                        'prueba_periodo_id' => null,
                        'evidencias' => [],
                    ];
                }
            }

            // Solo mostrar colaboradores que tengan al menos una etapa para gestionar/mostrar
            if (! $hasAnyActiveEtapa) {
                continue;
            }

            // Filtrado secundario por estado general del colaborador en las pruebas
            if ($filtroEstado === 'pendientes') {
                $hasPendientes = collect($etapasMap)->contains(fn ($e) => $e['estado'] === 'pendiente');
                if (! $hasPendientes) {
                    continue;
                }
            } elseif ($filtroEstado === 'destiempo') {
                $hasDestiempo = collect($etapasMap)->contains(fn ($e) => $e['estado'] === 'destiempo');
                if (! $hasDestiempo) {
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
                'id' => $colaborador->id,
                'cedula' => $colaborador->cedula,
                'nombre_completo' => $colaborador->nombre_completo,
                'cargo' => $colaborador->cargo ?? 'Sin cargo',
                'fecha_ingreso' => $fechaIngreso->format('d/m/Y'),
                'imagen' => $colaborador->imagen,
                'etapas' => $etapasMap,
            ];
        }

        return Inertia::render('gente/plan-padrinos/index', [
            'colaboradores' => $rows,
            'metrics' => $metrics,
            'filters' => [
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
            'etapa' => 'required|in:7_dias,30_dias,90_dias',
            'realizada' => 'required|boolean',
            'observaciones' => 'nullable|string|max:500',
        ]);

        $record = ColaboradorPruebaPeriodo::firstOrNew([
            'colaborador_id' => $validated['colaborador_id'],
            'etapa' => $validated['etapa'],
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

        $record = ColaboradorPruebaPeriodo::firstOrCreate(
            [
                'colaborador_id' => $request->input('colaborador_id'),
                'etapa'          => $request->input('etapa'),
            ],
            [
                'realizada'         => false,
                'fecha_realizacion' => null,
                'realizado_por_id'  => null,
            ]
        );

        $etapa = $request->input('etapa');
        $colaboradorId = $request->input('colaborador_id');
        $folderPath = "plan-padrinos/evidencias/{$etapa}/colaborador_{$colaboradorId}";

        foreach ($request->file('evidencias', []) as $archivo) {
            $path = $archivo->store($folderPath, 'public');
            $record->evidencias()->create(['path' => $path]);
        }

        return back()->with('status', 'Evidencias subidas correctamente en su respectiva carpeta.');
    }

    /**
     * Elimina una fotografía de evidencia.
     */
    public function eliminarEvidencia(ColaboradorPruebaPeriodoEvidencia $evidencia): RedirectResponse
    {
        Storage::disk('public')->delete($evidencia->path);
        $evidencia->delete();

        return back()->with('status', 'Evidencia eliminada.');
    }

    /**
     * Retorna JSON para la campana de notificaciones del header para usuarios de Seguridad.
     */
    public function alertasBell(Request $request): \Illuminate\Http\JsonResponse
    {
        $hoy = Carbon::today();

        $colaboradores = Colaborador::query()
            ->where('is_active', true)
            ->with(['pruebasPeriodo'])
            ->get();

        $alertas = [];
        $totalHoy = 0;
        $totalAtrasadas = 0;

        $etapasConfig = [
            '7_dias' => 8,
            '30_dias' => 30,
            '90_dias' => 90,
        ];

        foreach ($colaboradores as $colaborador) {
            $fechaIngreso = $colaborador->fecha_ingreso_empresa ?? $colaborador->created_at;
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->fecha_retiro_empresa;

            foreach ($etapasConfig as $etapaKey => $dias) {
                $fechaPrueba = $fechaIngreso->copy()->addDays($dias);

                // Regla de fecha de retiro
                $aplicaRetiro = is_null($fechaRetiro) || $fechaRetiro->greaterThanOrEqualTo($fechaPrueba);
                if (! $aplicaRetiro) {
                    continue;
                }

                // Verificar si ya fue realizada
                $yaRealizada = $colaborador->pruebasPeriodo->contains(
                    fn ($p) => $p->etapa === $etapaKey && $p->realizada
                );
                if ($yaRealizada) {
                    continue;
                }

                // Debe haber llegado la fecha (hoy o en el pasado)
                if ($hoy->lessThan($fechaPrueba)) {
                    continue;
                }

                $esHoy = $fechaPrueba->isSameDay($hoy);
                $diasVencido = (int) $fechaPrueba->diffInDays($hoy);

                if ($esHoy) {
                    $totalHoy++;
                    $tipo = 'hoy';
                    $mensaje = "Prueba de {$dias} días programada para hoy";
                } else {
                    $totalAtrasadas++;
                    $tipo = 'atrasada';
                    $mensaje = "Prueba de {$dias} días atrasada (hace {$diasVencido} " . ($diasVencido === 1 ? 'día' : 'días') . ')';
                }

                $alertas[] = [
                    'colaborador_id' => $colaborador->id,
                    'colaborador' => $colaborador->nombre_completo,
                    'cedula' => $colaborador->cedula,
                    'cargo' => $colaborador->cargo ?? 'Sin cargo',
                    'etapa_key' => $etapaKey,
                    'etapa_label' => "{$dias} días",
                    'fecha_programada' => $fechaPrueba->format('d/m/Y'),
                    'tipo' => $tipo,
                    'dias_vencido' => $diasVencido,
                    'mensaje' => $mensaje,
                ];
            }
        }

        // Ordenar: primero las atrasadas más críticas, luego las de hoy
        usort($alertas, function ($a, $b) {
            if ($a['tipo'] === $b['tipo']) {
                return $b['dias_vencido'] <=> $a['dias_vencido'];
            }
            return $a['tipo'] === 'atrasada' ? -1 : 1;
        });

        return response()->json([
            'total' => count($alertas),
            'total_hoy' => $totalHoy,
            'total_atrasadas' => $totalAtrasadas,
            'alertas' => $alertas,
        ]);
    }

    /**
     * Muestra la vista del submódulo Criterios del Plan Padrino (solo personal operativo).
     */
    public function criterios(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $cargoFiltro = $request->string('cargo')->trim()->toString();
        $autonomiaFiltro = $request->string('autonomia')->trim()->toString();
        $mes = $request->integer('mes') ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;

        $hoy = Carbon::today();
        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        $monthExpr = fn (string $col) => $isSqlite
            ? DB::raw("cast(strftime('%m', {$col}) as integer)")
            : DB::raw("MONTH({$col})");

        // 1. Filtrar solo colaboradores con area Operativa (case-insensitive) y activos
        $query = Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->with(['padrinoCriterio'])
            ->orderBy('apellidos')
            ->orderBy('nombres');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nombres', 'like', "%{$search}%")
                  ->orWhere('apellidos', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('cargo', 'like', "%{$search}%");
            });
        }

        if ($cargoFiltro !== '') {
            $query->where('cargo', $cargoFiltro);
        }

        $colaboradoresDb = $query->get();

        // 2. Indicadores toggle (Safety Together, Comunicación Asertiva, Habilidades, Eventos de Seguridad)
        // Indexados por colaborador_id para O(1) lookup
        $indicadoresPorColaborador = ColaboradorPadrinoIndicador::where('mes', $mes)
            ->where('anio', $anio)
            ->whereIn('colaborador_id', $colaboradoresDb->pluck('id'))
            ->get()
            ->keyBy('colaborador_id');

        // 2b. Columnas extra globales (persisten hasta eliminación) + valores del mes/año actual
        $columnasExtra = ColaboradorPadrinoColumnaExtra::orderBy('orden')->get();

        // valores mensuales: [ columna_id => [ colaborador_id => bool ] ]
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

        // 3. Conteo de ACI por colaborador en el mes/año seleccionado
        $conteoAcisPorColaborador = Aci::where($monthExpr('fecha_incidente'), $mes)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('colaborador_id')
            ->select('colaborador_id', DB::raw('count(*) as total'))
            ->groupBy('colaborador_id')
            ->pluck('total', 'colaborador_id');

        // 3. Evaluaciones OWD Ruta: preguntas con actividad exactamente "Ruta"
        $preguntasRutaRaw = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->where($monthExpr('evaluaciones_owd.fecha_evaluacion'), $mes)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->select('evaluaciones_owd.colaborador_id', 'evaluaciones_owd.qr_safety', 'evaluacion_owd_preguntas.puntuacion')
            ->get();

        // Indexar colaboradores por qr_safety para resolver los que tienen colaborador_id = null
        $colaboradoresPorQrOwd = Colaborador::whereNotNull('codigo_qr_skap')
            ->select(['id', 'codigo_qr_skap'])
            ->get()
            ->keyBy('codigo_qr_skap');

        $preguntasRutaPorColaborador = $preguntasRutaRaw->groupBy(function ($p) use ($colaboradoresPorQrOwd) {
            if ($p->colaborador_id) {
                return $p->colaborador_id;
            }
            $colab = $colaboradoresPorQrOwd->get($p->qr_safety);

            return $colab ? $colab->id : null;
        })->filter(fn ($grupo, $key) => $key !== null);

        $rows = [];
        $metrics = [
            'total_operativos' => 0,
            'autonomos' => 0,
            'en_desarrollo' => 0,
            'total_evaluados_excel' => 0,
        ];

        foreach ($colaboradoresDb as $colaborador) {
            $fechaIngreso = $colaborador->fecha_ingreso_empresa ?? $colaborador->created_at;

            // Formatear antigüedad en la empresa
            $antiguedadTexto = 'Sin fecha de ingreso';
            $diasEnEmpresa = 0;

            if ($fechaIngreso) {
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

                $antiguedadTexto = implode(', ', $parts);
                if (empty($antiguedadTexto)) {
                    $antiguedadTexto = '0 días';
                }
            }

            // Determinar Nivel de Autonomía (si está definido manualmente o derivado por antigüedad)
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

            // ── ACIS ────────────────────────────────────────────────────────────
            $aciRealizadas = (int) ($conteoAcisPorColaborador[$colaborador->id] ?? 0);
            $porcentajeAci = round(($aciRealizadas / 32) * 100, 1);

            // ── OWD Ruta (binario: 100% si cero NO OK, 0% si hay alguno, null si sin datos) ──
            $preguntasRuta = $preguntasRutaPorColaborador->get($colaborador->id, collect());
            $okRuta = $preguntasRuta->filter(fn ($p) =>
                str_contains(strtolower((string) $p->puntuacion), 'ok') &&
                ! str_contains(strtolower((string) $p->puntuacion), 'no ok') &&
                ! str_contains(strtolower((string) $p->puntuacion), 'not')
            )->count();
            $noOkRuta = $preguntasRuta->filter(fn ($p) =>
                str_contains(strtolower((string) $p->puntuacion), 'no ok') ||
                str_contains(strtolower((string) $p->puntuacion), 'nook')
            )->count();
            $totalAplicablesRuta = $okRuta + $noOkRuta;

            if ($totalAplicablesRuta > 0) {
                $porcentajeOwdRuta = $noOkRuta > 0 ? 0.0 : 100.0;
                $porcentajeOwdRutaLabel = "{$porcentajeOwdRuta}%";
            } else {
                $porcentajeOwdRuta = null;
                $porcentajeOwdRutaLabel = 'N/A';
            }

            $rows[] = [
                'id' => $colaborador->id,
                'cedula' => $colaborador->cedula,
                'codigo_qr_skap' => $colaborador->codigo_qr_skap,
                'nombre_completo' => $colaborador->nombre_completo,
                'cargo' => $colaborador->cargo ?? 'Sin cargo',
                'area' => $colaborador->area ?? 'Operativa',
                'imagen' => $colaborador->imagen,
                'fecha_ingreso' => $fechaIngreso?->format('d/m/Y') ?? 'N/R',
                'antiguedad_texto' => $antiguedadTexto,
                'dias_en_empresa' => $diasEnEmpresa,
                'nivel_autonomia' => $nivelAutonomiaActual,
                'nivel_autonomia_db' => $colaborador->nivel_autonomia,
                'autonomia_sugerida' => $autonomiaSugerida,
                'es_personalizado' => $esPersonalizado,
                'es_padrino' => (bool) $colaborador->es_padrino,
                'tipo_padrino' => $colaborador->tipo_padrino,
                // ACIS
                'aci_realizadas' => $aciRealizadas,
                'porcentaje_aci' => $porcentajeAci,
                // OWD
                'porcentaje_owd_ruta'       => $porcentajeOwdRuta,
                'porcentaje_owd_ruta_label' => $porcentajeOwdRutaLabel,
                // Indicadores toggle (default true = 100% si no existe registro)
                'safety_together'           => (bool) ($indicadoresPorColaborador[$colaborador->id]->safety_together ?? true),
                'comunicacion_asertiva'     => (bool) ($indicadoresPorColaborador[$colaborador->id]->comunicacion_asertiva ?? true),
                'habilidades'               => (bool) ($indicadoresPorColaborador[$colaborador->id]->habilidades ?? true),
                'eventos_seguridad'         => (bool) ($indicadoresPorColaborador[$colaborador->id]->eventos_seguridad ?? true),
                // Valores de columnas extra: [ columna_id => bool ]
                'columnas_extra_valores'    => $columnasExtra->mapWithKeys(function ($col) use ($colaborador, $valoresExtra) {
                    // Si no existe registro en BD → default true (100%)
                    return [$col->id => $valoresExtra[$col->id][$colaborador->id] ?? true];
                })->toArray(),
                'criterio_evaluacion' => $criterio ? [
                    'qr_safety' => $criterio->qr_safety,
                    'funcional_7_dias' => $criterio->funcional_7_dias,
                    'funcional_30_dias' => $criterio->funcional_30_dias,
                    'funcional_90_dias' => $criterio->funcional_90_dias,
                    'funcional_total' => $criterio->funcional_total,
                    'hab_tecnicas_1' => $criterio->hab_tecnicas_1,
                    'hab_tecnicas_2' => $criterio->hab_tecnicas_2,
                    'hab_tecnicas_3' => $criterio->hab_tecnicas_3,
                    'habilidades_tecnicas_total' => $criterio->habilidades_tecnicas_total,
                    'autonomia_1' => $criterio->autonomia_1,
                    'autonomia_2' => $criterio->autonomia_2,
                    'autonomia_3' => $criterio->autonomia_3,
                    'autonomia_4' => $criterio->autonomia_4,
                    'autonomia_total' => $criterio->autonomia_total,
                ] : null,
            ];
        }

        $cargosUnicos = $colaboradoresDb->pluck('cargo')->filter()->unique()->values()->all();

        return Inertia::render('gente/plan-padrinos/criterios', [
            'colaboradores' => $rows,
            'metrics' => $metrics,
            'cargos' => $cargosUnicos,
            'filters' => [
                'search'   => $search,
                'cargo'    => $cargoFiltro,
                'autonomia' => $autonomiaFiltro,
                'mes'      => $mes,
                'anio'     => $anio,
            ],
            'nivelesAutonomiaOpciones' => [
                'Nivel 0',
                'Nivel 1',
                'Nivel 2',
                'Nivel 3',
                'Nivel 4',
                'Padrino',
            ],
            'columnas_extra' => $columnasExtra->map(fn ($c) => [
                'id'     => $c->id,
                'nombre' => $c->nombre,
                'orden'  => $c->orden,
            ])->values()->toArray(),
        ]);
    }

    /**
     * Importa la evaluación de Criterios y Autonomía desde un archivo Excel cruzando por QR Safety.
     */
    public function importarCriterios(ImportarPlanPadrinoCriteriosRequest $request, PlanPadrinoCriteriosImportService $service): RedirectResponse
    {
        $resultado = $service->importar($request->file('archivo')->getRealPath());

        $mensaje = "Importación de Criterios completada: {$resultado['creados']} creados, "
            ."{$resultado['actualizados']} actualizados de {$resultado['procesados']} filas procesadas.";

        $tipo = match (true) {
            $resultado['procesados'] === 0 => 'error',
            $resultado['errores'] > 0 => 'warning',
            default => 'success',
        };

        return redirect()->route('gente.plan-padrinos.criterios')->with('status', ['message' => $mensaje, 'type' => $tipo]);
    }

    /**
     * Limpia la tabla de criterios de evaluación importados.
     */
    public function limpiarCriterios(): RedirectResponse
    {
        ColaboradorPadrinoCriterio::truncate();

        return redirect()->route('gente.plan-padrinos.criterios')->with('status', [
            'message' => 'Todas las evaluaciones de criterios importadas fueron eliminadas.',
            'type' => 'success',
        ]);
    }

    /**
     * Alterna (toggle) un indicador de Plan Padrino para un colaborador en un mes/año.
     * Los 4 campos posibles son: safety_together, comunicacion_asertiva, habilidades, eventos_seguridad.
     * Si no existe registro para ese colaborador+mes+año se crea con todos en true (100%),
     * luego se invierte el campo solicitado.
     */
    public function toggleIndicador(Request $request): RedirectResponse
    {
        $colaboradorId = $request->integer('colaborador_id');
        $mes           = $request->integer('mes');
        $anio          = $request->integer('anio');
        $campo         = $request->string('campo')->toString();

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
     * Crea una nueva columna extra global (sin mes/año).
     * La columna persiste en todos los meses hasta que el usuario la elimine.
     */
    public function crearColumnaExtra(Request $request): RedirectResponse
    {
        $nombre = $request->string('nombre')->trim()->toString();

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
     * Elimina una columna extra (cascade elimina también sus valores).
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
     * Alterna el valor mensual de una celda en una columna extra para un colaborador.
     * La columna es global pero el valor (true/false) es específico por mes/año.
     */
    public function toggleColumnaExtraValor(ColaboradorPadrinoColumnaExtra $columna, Request $request): RedirectResponse
    {
        $colaboradorId = $request->integer('colaborador_id');
        $mes           = $request->integer('mes');
        $anio          = $request->integer('anio');

        abort_unless($colaboradorId > 0 && $mes >= 1 && $mes <= 12 && $anio >= 2024, 422, 'Parámetros inválidos.');

        $valor = ColaboradorPadrinoColumnaExtraValor::firstOrCreate(
            [
                'columna_extra_id' => $columna->id,
                'colaborador_id'   => $colaboradorId,
                'mes'              => $mes,
                'anio'             => $anio,
            ],
            ['valor' => true]  // primera vez → empieza en true, luego lo invertimos
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
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="plantilla_criterios_plan_padrinos.csv"',
        ];

        $callback = function () {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8

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

            fputcsv($file, [
                'F1V2ETVY',
                'Jhon Ferney Amado',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
                '100',
            ]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Calcula una sugerencia del nivel de autonomía basado en los días en la empresa.
     */
    private function calcularAutonomiaSugerida(int $dias): string
    {
        if ($dias < 30) {
            return 'Nivel 0';
        }
        if ($dias < 90) {
            return 'Nivel 1';
        }
        if ($dias < 180) {
            return 'Nivel 2';
        }
        if ($dias < 365) {
            return 'Nivel 3';
        }
        return 'Nivel 4';
    }

    /**
     * Actualiza el nivel de autonomía de un colaborador.
     */
    public function updateAutonomia(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => 'required|exists:colaboradores,id',
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

        $colaborador = Colaborador::findOrFail($validated['colaborador_id']);
        $colaborador->tipo_padrino = $validated['tipo_padrino'] === 'Ninguno' ? null : $validated['tipo_padrino'];
        $colaborador->es_padrino   = $validated['tipo_padrino'] === 'Padrino';
        $colaborador->save();

        return back()->with('status', 'Rol de padrino actualizado.');
    }

    /**
     * Vista pública de los Padrinos: grid de tarjetas con foto, cargo y nombre.
     */
    public function padrinos(): Response
    {
        $hoy = Carbon::today();

        $padrinos = Colaborador::query()
            ->where('is_active', true)
            ->where('es_padrino', true)
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'imagen', 'mensaje_padrino', 'correo', 'celular_1'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn ($c) => [
                'id'              => $c->id,
                'cedula'          => $c->cedula,
                'nombre_completo' => $c->nombre_completo,
                'cargo'           => $c->cargo ?? 'Sin cargo',
                'imagen'          => $c->imagen,
                'mensaje_padrino' => $c->mensaje_padrino,
                'correo'          => $c->correo,
                'celular'         => $c->celular_1,
            ]);

        // Solo colaboradores SIN padrino asignado (para asignar nuevas parejas)
        $apadrinadosList = Colaborador::query()
            ->where('is_active', true)
            ->whereNull('padrino_id')
            ->orderByRaw('COALESCE(fecha_ingreso_empresa, created_at) DESC')
            ->get()
            ->map(function ($c) use ($hoy) {
                $fechaIngreso = $c->fecha_ingreso_empresa ?? $c->created_at;

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
            'padrinos' => $padrinos,
            'apadrinadosList' => $apadrinadosList,
        ]);
    }

    /**
     * Actualiza el mensaje del padrino.
     */
    public function updateMensajePadrino(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id'  => 'required|exists:colaboradores,id',
            'mensaje_padrino' => 'nullable|string|max:2000',
        ]);

        $colaborador = Colaborador::findOrFail($validated['colaborador_id']);
        $colaborador->mensaje_padrino = $validated['mensaje_padrino'];
        $colaborador->save();

        return back()->with('status', 'Mensaje actualizado.');
    }

    /**
     * Vista de los Apadrinados: empleados de reciente ingreso laboral (basados en fecha_ingreso_empresa o created_at).
     */
    public function apadrinados(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $hoy = Carbon::today();

        // Muestra colaboradores marcados como Apadrinado pero SIN padrino asignado aún.
        // Los que ya tienen padrino_id se muestran en la vista "Parejas".
        $query = Colaborador::query()
            ->where('is_active', true)
            ->where('tipo_padrino', 'Apadrinado')
            ->whereNull('padrino_id')
            ->with(['padrino.apadrinados', 'padrino.padrino', 'pruebasPeriodo.evidencias'])
            ->orderByRaw('COALESCE(fecha_ingreso_empresa, created_at) DESC');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nombres', 'like', "%{$search}%")
                  ->orWhere('apellidos', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('cargo', 'like', "%{$search}%");
            });
        }

        // El filtro estado_asignacion ya no aplica: esta vista solo muestra sin padrino asignado.

        $colaboradoresDb = $query->get();

        $apadrinados = $colaboradoresDb->map(function ($c) use ($hoy) {
            $fechaIngreso = $c->fecha_ingreso_empresa ?? $c->created_at;

            $diasEnEmpresa = 0;
            $antiguedadTexto = 'Sin fecha';

            if ($fechaIngreso) {
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

                $antiguedadTexto = implode(', ', $parts);
                if (empty($antiguedadTexto)) {
                    $antiguedadTexto = '0 días';
                }
            }

            $evidencias = $c->pruebasPeriodo->flatMap(function ($prueba) {
                return $prueba->evidencias->map(fn ($e) => [
                    'id' => $e->id,
                    'url' => '/storage/' . $e->path,
                    'etapa' => $prueba->etapa,
                    'fecha' => $e->created_at ? $e->created_at->format('d/m/Y H:i') : null,
                ]);
            })->values()->all();

            return [
                'id' => $c->id,
                'cedula' => $c->cedula,
                'nombre_completo' => $c->nombre_completo,
                'cargo' => $c->cargo ?? 'Sin cargo',
                'area' => $c->area ?? 'General',
                'imagen' => $c->imagen,
                'fecha_ingreso' => $fechaIngreso ? $fechaIngreso->format('d/m/Y') : 'N/R',
                'antiguedad_texto' => $antiguedadTexto,
                'dias_en_empresa' => $diasEnEmpresa,
                'es_padrino' => (bool) $c->es_padrino,
                'tipo_padrino' => $c->tipo_padrino,
                'padrino_id' => $c->padrino_id,
                'padrino' => $c->padrino ? [
                    'id' => $c->padrino->id,
                    'nombre_completo' => $c->padrino->nombre_completo,
                    'cargo' => $c->padrino->cargo ?? 'Sin cargo',
                    'imagen' => $c->padrino->imagen,
                    'historial' => [
                        'veces_padrino' => $c->padrino->apadrinados->count(),
                        'apadrinados_list' => $c->padrino->apadrinados->map(fn ($a) => [
                            'id' => $a->id,
                            'nombre_completo' => $a->nombre_completo,
                            'cargo' => $a->cargo ?? 'Sin cargo',
                            'imagen' => $a->imagen,
                            'fecha_ingreso' => $a->fecha_ingreso_empresa ? $a->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                        ])->values()->all(),
                        'fue_apadrinado' => $c->padrino->padrino_id !== null || $c->padrino->tipo_padrino === 'Apadrinado',
                        'padrino_guia' => $c->padrino->padrino ? [
                            'id' => $c->padrino->padrino->id,
                            'nombre_completo' => $c->padrino->padrino->nombre_completo,
                            'cargo' => $c->padrino->padrino->cargo ?? 'Sin cargo',
                            'imagen' => $c->padrino->padrino->imagen,
                        ] : null,
                        'fecha_ingreso' => $c->padrino->fecha_ingreso_empresa ? $c->padrino->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                    ],
                ] : null,
                'nivel_autonomia' => $c->nivel_autonomia ?? 'Nivel 0',
                'evidencias' => $evidencias,
            ];
        });

        // Lista de Padrinos disponibles para asignar
        $padrinosList = Colaborador::query()
            ->where('is_active', true)
            ->where('es_padrino', true)
            ->with(['apadrinados', 'padrino'])
            ->select(['id', 'nombres', 'apellidos', 'cargo', 'imagen', 'padrino_id', 'tipo_padrino', 'fecha_ingreso_empresa'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn ($p) => [
                'id'              => $p->id,
                'nombre_completo' => $p->nombre_completo,
                'cargo'           => $p->cargo ?? 'Sin cargo',
                'imagen'          => $p->imagen,
                'historial'       => [
                    'veces_padrino' => $p->apadrinados->count(),
                    'apadrinados_list' => $p->apadrinados->map(fn ($a) => [
                        'id' => $a->id,
                        'nombre_completo' => $a->nombre_completo,
                        'cargo' => $a->cargo ?? 'Sin cargo',
                        'imagen' => $a->imagen,
                        'fecha_ingreso' => $a->fecha_ingreso_empresa ? $a->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                    ])->values()->all(),
                    'fue_apadrinado' => $p->padrino_id !== null || $p->tipo_padrino === 'Apadrinado',
                    'padrino_guia' => $p->padrino ? [
                        'id' => $p->padrino->id,
                        'nombre_completo' => $p->padrino->nombre_completo,
                        'cargo' => $p->padrino->cargo ?? 'Sin cargo',
                        'imagen' => $p->padrino->imagen,
                    ] : null,
                    'fecha_ingreso' => $p->fecha_ingreso_empresa ? $p->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                ],
            ]);

        $metrics = [
            'total' => $apadrinados->count(),
            'recientes_30' => $apadrinados->where('dias_en_empresa', '<=', 30)->count(),
            'periodo_prueba_90' => $apadrinados->where('dias_en_empresa', '<=', 90)->count(),
        ];

        return Inertia::render('gente/plan-padrinos/apadrinados', [
            'apadrinados' => $apadrinados->values(),
            'padrinosList' => $padrinosList,
            'metrics' => $metrics,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    /**
     * Asigna un Padrino a un colaborador Apadrinado.
     * Registra el evento en el historial: cierra la relación anterior (si existe)
     * y abre una nueva con fecha_inicio = hoy.
     */
    public function asignarPadrino(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => 'required|exists:colaboradores,id',
            'padrino_id'     => 'nullable|exists:colaboradores,id',
        ]);

        $colaborador  = Colaborador::findOrFail($validated['colaborador_id']);
        $hoy          = Carbon::today()->toDateString();
        $padrinoAnteriorId = $colaborador->padrino_id;

        // Cerrar relación anterior en el historial si existía un padrino distinto
        if ($padrinoAnteriorId && $padrinoAnteriorId !== $validated['padrino_id']) {
            ColaboradorPadrinoHistorial::where('colaborador_id', $colaborador->id)
                ->where('padrino_id', $padrinoAnteriorId)
                ->whereNull('fecha_fin')
                ->update(['fecha_fin' => $hoy]);
        }

        // Abrir nueva relación si se asigna un padrino
        if ($validated['padrino_id'] && $validated['padrino_id'] !== $padrinoAnteriorId) {
            ColaboradorPadrinoHistorial::create([
                'colaborador_id' => $colaborador->id,
                'padrino_id'     => $validated['padrino_id'],
                'fecha_inicio'   => $hoy,
                'fecha_fin'      => null,
            ]);
        }

        $colaborador->padrino_id = $validated['padrino_id'];
        if ($validated['padrino_id']) {
            $colaborador->tipo_padrino = 'Apadrinado';
        }
        $colaborador->save();

        return back()->with('status', 'Padrino asignado correctamente.');
    }

    /**
     * Vista de Parejas: Catálogo de Padrinos y sus Apadrinados asignados.
     */
    public function parejas(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $padrinoIdFiltro = $request->integer('padrino_id') ?: null;
        $hoy = Carbon::today();

        // 1. Padrinos
        $padrinosList = Colaborador::query()
            ->where('is_active', true)
            ->where('es_padrino', true)
            ->with(['apadrinados', 'padrino'])
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'imagen', 'mensaje_padrino', 'correo', 'celular_1', 'padrino_id', 'tipo_padrino', 'fecha_ingreso_empresa'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get()
            ->map(fn ($p) => [
                'id'              => $p->id,
                'cedula'          => $p->cedula,
                'nombre_completo' => $p->nombre_completo,
                'cargo'           => $p->cargo ?? 'Sin cargo',
                'imagen'          => $p->imagen,
                'mensaje_padrino' => $p->mensaje_padrino,
                'correo'          => $p->correo,
                'celular'         => $p->celular_1,
                'historial'       => [
                    'veces_padrino' => $p->apadrinados->count(),
                    'apadrinados_list' => $p->apadrinados->map(fn ($a) => [
                        'id' => $a->id,
                        'nombre_completo' => $a->nombre_completo,
                        'cargo' => $a->cargo ?? 'Sin cargo',
                        'imagen' => $a->imagen,
                        'fecha_ingreso' => $a->fecha_ingreso_empresa ? $a->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                    ])->values()->all(),
                    'fue_apadrinado' => $p->padrino_id !== null || $p->tipo_padrino === 'Apadrinado',
                    'padrino_guia' => $p->padrino ? [
                        'id' => $p->padrino->id,
                        'nombre_completo' => $p->padrino->nombre_completo,
                        'cargo' => $p->padrino->cargo ?? 'Sin cargo',
                        'imagen' => $p->padrino->imagen,
                    ] : null,
                    'fecha_ingreso' => $p->fecha_ingreso_empresa ? $p->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                ],
            ]);

        // 2. Apadrinados con padrino ya asignado (padrino_id NOT NULL)
        $query = Colaborador::query()
            ->where('is_active', true)
            ->where('tipo_padrino', 'Apadrinado')
            ->whereNotNull('padrino_id')
            ->with(['padrino.apadrinados', 'padrino.padrino', 'pruebasPeriodo.evidencias'])
            ->orderByRaw('COALESCE(fecha_ingreso_empresa, created_at) DESC');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nombres', 'like', "%{$search}%")
                  ->orWhere('apellidos', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('cargo', 'like', "%{$search}%");
            });
        }

        if ($padrinoIdFiltro) {
            $query->where('padrino_id', $padrinoIdFiltro);
        }

        $colaboradoresDb = $query->get();

        $apadrinados = $colaboradoresDb->map(function ($c) use ($hoy) {
            $fechaIngreso = $c->fecha_ingreso_empresa ?? $c->created_at;

            $diasEnEmpresa = 0;
            $antiguedadTexto = 'Sin fecha';

            if ($fechaIngreso) {
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

                $antiguedadTexto = implode(', ', $parts);
                if (empty($antiguedadTexto)) {
                    $antiguedadTexto = '0 días';
                }
            }

            $evidencias = $c->pruebasPeriodo->flatMap(function ($prueba) {
                return $prueba->evidencias->map(fn ($e) => [
                    'id' => $e->id,
                    'url' => '/storage/' . $e->path,
                    'etapa' => $prueba->etapa,
                    'fecha' => $e->created_at ? $e->created_at->format('d/m/Y H:i') : null,
                ]);
            })->values()->all();

            return [
                'id' => $c->id,
                'cedula' => $c->cedula,
                'nombre_completo' => $c->nombre_completo,
                'cargo' => $c->cargo ?? 'Sin cargo',
                'area' => $c->area ?? 'General',
                'imagen' => $c->imagen,
                'fecha_ingreso' => $fechaIngreso ? $fechaIngreso->format('d/m/Y') : 'N/R',
                'antiguedad_texto' => $antiguedadTexto,
                'dias_en_empresa' => $diasEnEmpresa,
                'es_padrino' => (bool) $c->es_padrino,
                'tipo_padrino' => $c->tipo_padrino,
                'padrino_id' => $c->padrino_id,
                'padrino' => $c->padrino ? [
                    'id' => $c->padrino->id,
                    'nombre_completo' => $c->padrino->nombre_completo,
                    'cargo' => $c->padrino->cargo ?? 'Sin cargo',
                    'imagen' => $c->padrino->imagen,
                    'historial' => [
                        'veces_padrino' => $c->padrino->apadrinados->count(),
                        'apadrinados_list' => $c->padrino->apadrinados->map(fn ($a) => [
                            'id' => $a->id,
                            'nombre_completo' => $a->nombre_completo,
                            'cargo' => $a->cargo ?? 'Sin cargo',
                            'imagen' => $a->imagen,
                            'fecha_ingreso' => $a->fecha_ingreso_empresa ? $a->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                        ])->values()->all(),
                        'fue_apadrinado' => $c->padrino->padrino_id !== null || $c->padrino->tipo_padrino === 'Apadrinado',
                        'padrino_guia' => $c->padrino->padrino ? [
                            'id' => $c->padrino->padrino->id,
                            'nombre_completo' => $c->padrino->padrino->nombre_completo,
                            'cargo' => $c->padrino->padrino->cargo ?? 'Sin cargo',
                            'imagen' => $c->padrino->padrino->imagen,
                        ] : null,
                        'fecha_ingreso' => $c->padrino->fecha_ingreso_empresa ? $c->padrino->fecha_ingreso_empresa->format('d/m/Y') : 'N/R',
                    ],
                ] : null,
                'nivel_autonomia' => $c->nivel_autonomia ?? 'Nivel 0',
                'evidencias' => $evidencias,
            ];
        });

        $metrics = [
            'total_padrinos' => $padrinosList->count(),
            'total_apadrinados' => $apadrinados->count(),
            'parejas_activas' => $apadrinados->whereNotNull('padrino_id')->count(),
            'sin_padrino' => $apadrinados->whereNull('padrino_id')->count(),
        ];

        return Inertia::render('gente/plan-padrinos/parejas', [
            'padrinos' => $padrinosList,
            'apadrinados' => $apadrinados->values(),
            'metrics' => $metrics,
            'filters' => [
                'search' => $search,
                'padrino_id' => $padrinoIdFiltro,
            ],
        ]);
    }

}
