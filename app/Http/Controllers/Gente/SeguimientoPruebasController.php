<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorPruebaPeriodo;
use App\Models\Seguridad\ColaboradorPruebaPeriodoEvidencia;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

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

        // 1. Solo colaboradores activos con fecha de ingreso registrada
        $query = Colaborador::query()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNotNull('fecha_ingreso_empresa')
                  ->orWhereNotNull('contrato_fecha_desde');
            })
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
            $fechaIngreso = $colaborador->contrato_fecha_desde ?? $colaborador->fecha_ingreso_empresa;
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->contrato_fecha_hasta ?? $colaborador->fecha_retiro_empresa;

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
            'evidencias.*'   => 'required|file|mimes:jpg,jpeg,png,webp,heic|max:10240',
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

        foreach ($request->file('evidencias', []) as $archivo) {
            $path = $archivo->store('plan-padrinos/evidencias', 'public');
            $record->evidencias()->create(['path' => $path]);
        }

        return back()->with('status', 'Evidencias subidas correctamente.');
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
            ->where(function ($q) {
                $q->whereNotNull('fecha_ingreso_empresa')
                  ->orWhereNotNull('contrato_fecha_desde');
            })
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
            $fechaIngreso = $colaborador->contrato_fecha_desde ?? $colaborador->fecha_ingreso_empresa;
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->contrato_fecha_hasta ?? $colaborador->fecha_retiro_empresa;

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
}
