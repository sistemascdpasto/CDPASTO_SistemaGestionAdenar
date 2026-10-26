<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Flota\Vehiculo;
use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\Reparto\ModulacionNovedad;
use App\Models\Seguridad\Colaborador;
use App\Services\Reparto\ModulacionUbicacionesService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class ModulacionController extends Controller
{
    public function departamentos(ModulacionUbicacionesService $ubicaciones): JsonResponse
    {
        return $this->responderUbicaciones(fn () => $ubicaciones->departamentos());
    }

    public function municipios(ModulacionUbicacionesService $ubicaciones): JsonResponse
    {
        return $this->responderUbicaciones(fn () => $ubicaciones->municipios());
    }

    public function registrarMunicipio(Request $request, ModulacionUbicacionesService $ubicaciones): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:100'],
        ]);

        return response()->json([
            'data' => $ubicaciones->registrarMunicipio($validated['nombre']),
        ]);
    }

    public function barrios(Request $request, ModulacionUbicacionesService $ubicaciones): JsonResponse
    {
        $validated = $request->validate([
            'municipio_id' => ['required', 'string', 'max:200'],
        ]);

        return $this->responderUbicaciones(
            fn () => $ubicaciones->barrios($validated['municipio_id']),
            incluirSobreData: false
        );
    }

    public function registrarBarrio(Request $request, ModulacionUbicacionesService $ubicaciones): JsonResponse
    {
        $validated = $request->validate([
            'municipio_id' => ['required', 'string', 'max:200'],
            'nombre' => ['required', 'string', 'max:200'],
        ]);

        return response()->json([
            'data' => $ubicaciones->registrarBarrio($validated['municipio_id'], $validated['nombre']),
        ]);
    }

    private function responderUbicaciones(callable $consulta, bool $incluirSobreData = true): JsonResponse
    {
        try {
            $resultado = $consulta();

            return response()->json($incluirSobreData ? ['data' => $resultado] : $resultado);
        } catch (ConnectionException|RequestException|RuntimeException $exception) {
            Log::warning('Falló la consulta de ubicaciones de modulación.', [
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'No fue posible cargar las ubicaciones geográficas. Intente nuevamente.',
            ], 502);
        }
    }

    private function ensureFijoColumnExists(): void
    {
        if (Schema::hasTable('modulacion_novedades') && ! Schema::hasColumn('modulacion_novedades', 'fijo')) {
            Schema::table('modulacion_novedades', function (Blueprint $table) {
                $table->boolean('fijo')->default(false)->after('cargo');
            });
        }
        // Columna placa_adicional en modulacion_items (migración defensiva)
        if (Schema::hasTable('modulacion_items') && ! Schema::hasColumn('modulacion_items', 'placa_adicional')) {
            Schema::table('modulacion_items', function (Blueprint $table) {
                $table->string('placa_adicional')->nullable()->after('placa');
            });
        }
    }

    public function index(Request $request): Response
    {
        $this->ensureFijoColumnExists();

        $fecha = $request->input('fecha', date('Y-m-d'));

        $modulacion = Modulacion::with(['items', 'novedades'])
            ->whereDate('fecha', $fecha)
            ->orderByDesc('id')
            ->first();

        // Pre-cargar colaboradores fijos (fijo = true, fijo_rescate o fijo_taller) si no existen aún en esta planeación
        if ($modulacion) {
            $ultimaFecha = Modulacion::whereHas('novedades', function ($q) {
                    $q->where('fijo', true)->orWhere('fijo_rescate', true)->orWhere('fijo_taller', true);
                })
                ->where('fecha', '<', $fecha)
                ->orderByDesc('fecha')
                ->value('fecha');

            if ($ultimaFecha) {
                $ultimaModulacion = Modulacion::with('novedades')
                    ->where('fecha', $ultimaFecha)
                    ->first();

                if ($ultimaModulacion) {
                    $fijosAnteriores = $ultimaModulacion->novedades
                        ->filter(fn($n) => $n->fijo || $n->fijo_rescate || $n->fijo_taller);

                    foreach ($fijosAnteriores as $fijo) {
                        // Verificar si este colaborador ya existe en la planeación actual
                        $existe = $modulacion->novedades()
                            ->where(function ($q) use ($fijo) {
                                if ($fijo->colaborador_id) {
                                    $q->where('colaborador_id', $fijo->colaborador_id);
                                } else {
                                    $q->where('cedula', $fijo->cedula);
                                }
                            })
                            ->exists();

                        // Si no existe, crear la novedad con los fijos
                        if (!$existe) {
                            $modulacion->novedades()->create([
                                'colaborador_id' => $fijo->colaborador_id,
                                'cedula'         => $fijo->cedula,
                                'nombres'        => $fijo->nombres,
                                'cargo'          => $fijo->cargo,
                                'fijo'           => true,
                                'fijo_rescate'   => $fijo->fijo_rescate ?? false,
                                'fijo_taller'    => $fijo->fijo_taller ?? false,
                                'observaciones'  => $fijo->observaciones ?? null,
                                'permiso'        => $fijo->permiso ?? false,
                                'no_asitio'      => $fijo->no_asitio ?? false,
                                'incapacidad'    => $fijo->incapacidad ?? false,
                                'vacaciones'     => $fijo->vacaciones ?? false,
                            ]);
                        }
                    }
                    // Recargar novedades
                    $modulacion->load('novedades');
                }
            }
        } elseif (!$modulacion) {
            // No hay planeación para esta fecha — buscar fijos de la última planeación anterior
            // para mostrarlos pre-cargados en "Agregar Colaboradores"
        }

        // Fijos para precarga cuando no hay modulacion aún
        $fijosIniciales = [];
        if (!$modulacion) {
            $ultimaFechaFijos = Modulacion::whereHas('novedades', function ($q) {
                    $q->where('fijo', true)->orWhere('fijo_rescate', true)->orWhere('fijo_taller', true);
                })
                ->where('fecha', '<', $fecha)
                ->orderByDesc('fecha')
                ->value('fecha');

            if ($ultimaFechaFijos) {
                $fijosIniciales = ModulacionNovedad::whereHas('modulacion', function ($q) use ($ultimaFechaFijos) {
                        $q->where('fecha', $ultimaFechaFijos);
                    })
                    ->where(function ($q) {
                        $q->where('fijo', true)->orWhere('fijo_rescate', true)->orWhere('fijo_taller', true);
                    })
                    ->get(['colaborador_id', 'cedula', 'nombres', 'cargo', 'observaciones', 'fijo', 'fijo_rescate', 'fijo_taller', 'permiso', 'no_asitio', 'incapacidad', 'vacaciones'])
                    ->toArray();
            }
        }

        $colaboradores = Colaborador::select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'area'])
            ->where('is_active', true)
            ->orderBy('nombres')
            ->get()
            ->map(function ($c) {
                return [
                    'id' => $c->id,
                    'cedula' => $c->cedula,
                    'nombres' => $c->nombres,
                    'apellidos' => $c->apellidos,
                    'nombre_completo' => trim("{$c->nombres} {$c->apellidos}"),
                    'cargo' => $c->cargo ?? '',
                    'area' => $c->area,
                ];
            });

        $vehiculos = Vehiculo::where('is_active', true)
            ->orderBy('placa')
            ->pluck('placa');

        $currentUser = $request->user()?->name ?? '';
        $readOnly = $request->boolean('readOnly', false);

        return Inertia::render('reparto/modulacion/index', [
            'fecha'          => $fecha,
            'modulacion'     => $modulacion,
            'fijosIniciales' => $fijosIniciales,
            'colaboradores'  => $colaboradores,
            'vehiculos'      => $vehiculos,
            'currentUser'    => $request->user()?->name ?? 'Usuario',
            'readOnly'       => $request->boolean('readOnly', false),
            'exportExcel'    => $request->boolean('exportExcel', false),
            'isAdmin'        => $request->user()?->hasRole('Administrador') ?? false,
        ]);
    }

    public function checkFecha(Request $request)
    {
        $this->ensureFijoColumnExists();
        $fecha = trim((string)$request->input('fecha', date('Y-m-d')));

        $modulacion = Modulacion::with(['items', 'novedades'])
            ->whereDate('fecha', $fecha)
            ->orderByDesc('id')
            ->first();

        $fijosIniciales = [];
        if (!$modulacion) {
            $ultimaFechaFijos = Modulacion::whereHas('novedades', function ($q) {
                    $q->where('fijo', true)->orWhere('fijo_rescate', true)->orWhere('fijo_taller', true);
                })
                ->whereDate('fecha', '<', $fecha)
                ->orderByDesc('fecha')
                ->value('fecha');

            if ($ultimaFechaFijos) {
                $fijosIniciales = ModulacionNovedad::whereHas('modulacion', function ($q) use ($ultimaFechaFijos) {
                        $q->whereDate('fecha', $ultimaFechaFijos);
                    })
                    ->where(function ($q) {
                        $q->where('fijo', true)->orWhere('fijo_rescate', true)->orWhere('fijo_taller', true);
                    })
                    ->get(['colaborador_id', 'cedula', 'nombres', 'cargo', 'observaciones', 'fijo', 'fijo_rescate', 'fijo_taller', 'permiso', 'no_asitio', 'incapacidad', 'vacaciones'])
                    ->toArray();
            }
        }

        return response()->json([
            'exists'         => (bool)$modulacion,
            'modulacion'     => $modulacion,
            'fijosIniciales' => $fijosIniciales,
        ]);
    }

    public function historial(Request $request): Response
    {
        $fechaDesde = $request->input('fecha_desde', '');
        $fechaHasta = $request->input('fecha_hasta', '');
        $placa = $request->input('placa', '');
        $perPage = 20;

        $query = Modulacion::withCount('items')
            ->with(['items', 'novedades'])
            ->orderBy('fecha', 'desc');

        // Filtro por fecha desde
        if ($fechaDesde) {
            $query->whereDate('fecha', '>=', $fechaDesde);
        }

        // Filtro por fecha hasta
        if ($fechaHasta) {
            $query->whereDate('fecha', '<=', $fechaHasta);
        }

        // Filtro por placa (busca en items)
        if ($placa) {
            $query->whereHas('items', function ($q) use ($placa) {
                $q->where('placa', strtoupper($placa));
            });
        }

        $planeaciones = $query->paginate($perPage)->withQueryString();

        // Enriquecer cada modulación con resumen de placas y colaboradores
        $planeaciones->getCollection()->transform(function (Modulacion $mod) {
            $items = $mod->items;
            $placas = $items->pluck('placa')->filter()->unique()->values();
            $totalTripulantes = $items->sum(function ($item) {
                return count($item->tripulacion ?? []);
            });

            $rutasDetalle = $items->map(function ($item) {
                $docTras = trim((string)($item->doc_tras ?? ''));

                $responsable = '';
                $tripulacion = is_array($item->tripulacion) ? $item->tripulacion : [];

                foreach ($tripulacion as $m) {
                    $cargo = strtoupper((string)($m['cargo'] ?? ''));
                    if (str_contains($cargo, 'RESPONSABLE')) {
                        $responsable = trim((string)($m['nombres'] ?? ''));
                        break;
                    }
                }
                if ($responsable === '') {
                    foreach ($tripulacion as $m) {
                        $cargo = strtoupper((string)($m['cargo'] ?? ''));
                        if (str_contains($cargo, 'CONDUCTOR')) {
                            $responsable = trim((string)($m['nombres'] ?? ''));
                            break;
                        }
                    }
                }
                if ($responsable === '') {
                    $responsable = trim((string)($item->nombres ?? ($tripulacion[0]['nombres'] ?? '')));
                }

                $destinosList = [];
                $viajes = is_array($item->viajes) ? $item->viajes : [];
                foreach ($viajes as $v) {
                    if (!empty($v['destinos']) && is_array($v['destinos'])) {
                        foreach ($v['destinos'] as $d) {
                            $destinosList[] = [
                                'barrio'    => trim((string)($d['barrio'] ?? '')),
                                'municipio' => trim((string)($d['lugares'] ?? '')),
                            ];
                        }
                    } else {
                        $destinosList[] = [
                            'barrio'    => trim((string)($v['barrio'] ?? '')),
                            'municipio' => trim((string)($v['lugares'] ?? '')),
                        ];
                    }
                }

                $municipiosList = array_values(array_filter(array_unique(array_map(fn($d) => $d['municipio'], $destinosList))));
                $barriosList = array_values(array_filter(array_unique(array_map(fn($d) => $d['barrio'], $destinosList))));

                $municipioStr = implode(', ', $municipiosList);
                $barrioStr = implode(', ', $barriosList);

                $destinoCompleto = '';
                if (!empty($municipiosList) && !empty($barriosList)) {
                    $destinoCompleto = implode(', ', $municipiosList) . ' - ' . implode(', ', $barriosList);
                } elseif (!empty($barriosList)) {
                    $destinoCompleto = implode(', ', $barriosList);
                } elseif (!empty($municipiosList)) {
                    $destinoCompleto = implode(', ', $municipiosList);
                }

                $clientes = [];
                foreach ($viajes as $v) {
                    $c = trim((string)($v['cliente'] ?? ''));
                    if ($c !== '') {
                        $clientes[] = $c;
                    }
                }
                $clienteStr = implode(', ', array_unique($clientes));

                $pesos = [];
                foreach ($viajes as $v) {
                    $p = trim((string)($v['peso'] ?? ''));
                    if ($p !== '') {
                        $pesos[] = $p;
                    }
                }
                $pesoStr = implode(', ', array_unique($pesos));

                return [
                    'id'          => $item->id,
                    'placa'       => $item->placa,
                    'doc_tras'    => $docTras,
                    'responsable' => $responsable,
                    'destino'     => $destinoCompleto,
                    'municipio'   => $municipioStr,
                    'barrio'      => $barrioStr,
                    'destinos'    => $destinosList,
                    'cliente'     => $clienteStr,
                    'peso'        => $pesoStr,
                ];
            })->values();

            return [
                'id'                          => $mod->id,
                'fecha'                       => $mod->fecha,
                'ud_programado_por'           => $mod->ud_programado_por,
                'despachado_por_nombre'       => $mod->despachado_por_nombre,
                'total_rutas'                 => $mod->items_count,
                'total_tripulantes'           => $totalTripulantes,
                'total_novedades'             => $mod->novedades->count(),
                'placas'                      => $placas,
                'rutas_detalle'               => $rutasDetalle,
            ];
        });

        $placasModulacion = ModulacionItem::select('placa')
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->distinct()
            ->pluck('placa');

        $placasFlota = \App\Models\Flota\Vehiculo::select('placa')
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->distinct()
            ->pluck('placa');

        $placasDisponibles = $placasModulacion
            ->concat($placasFlota)
            ->map(fn($p) => strtoupper(trim((string)$p)))
            ->filter()
            ->unique()
            ->sort()
            ->values();

        return Inertia::render('reparto/modulacion/historial', [
            'planeaciones'       => $planeaciones,
            'placas_disponibles' => $placasDisponibles,
            'filters'            => [
                'fecha_desde' => $fechaDesde,
                'fecha_hasta' => $fechaHasta,
                'placa'       => $placa,
            ],
        ]);
    }

    public function storeBatch(Request $request, ModulacionUbicacionesService $ubicaciones): RedirectResponse
    {
        $this->ensureFijoColumnExists();

        $validated = $request->validate([
            'fecha' => 'required|string|max:255',
            'modulacion_id' => 'nullable|integer|exists:modulaciones,id',
            'ud_programado_por' => 'nullable|string|max:255',
            'despachado_por_colaborador_id' => 'nullable|exists:colaboradores,id',
            'despachado_por_nombre' => 'nullable|string|max:255',
            'read_only' => 'nullable|boolean',
            'readOnly' => 'nullable|boolean',
            'rutas' => 'required|array|min:1',
            'rutas.*.placa' => 'required|string|max:50',
            'rutas.*.placa_adicional' => 'nullable|string|max:50',
            'rutas.*.doc_tras' => 'nullable|string|max:100',
            'rutas.*.ud' => 'nullable|string|max:100',
            'rutas.*.cargo' => 'nullable|string|max:100',
            'rutas.*.reunion' => 'nullable|string|max:255',
            'rutas.*.tripulacion' => 'nullable|array',
            'rutas.*.tripulacion.*.colaborador_id' => 'nullable',
            'rutas.*.tripulacion.*.cedula' => 'nullable|string',
            'rutas.*.tripulacion.*.nombres' => 'nullable|string',
            'rutas.*.tripulacion.*.cargo' => 'nullable|string',
            'rutas.*.viajes' => 'nullable|array',
            'rutas.*.viajes.*.lugares' => 'nullable|string|max:255',
            'rutas.*.viajes.*.barrio' => 'nullable|string|max:200',
            'rutas.*.viajes.*.destinos' => 'nullable|array',
            'rutas.*.viajes.*.destinos.*.lugares' => 'required|string|max:255',
            'rutas.*.viajes.*.destinos.*.barrio' => 'nullable|string|max:200',
            'rutas.*.viajes.*.cliente' => 'nullable|string|max:255',
            'rutas.*.viajes.*.peso' => 'nullable|string|max:100',
            'novedades' => 'nullable|array',
            'novedades.*.id' => 'nullable|integer',
            'novedades.*.colaborador_id' => 'nullable|integer',
            'novedades.*.cedula' => 'nullable|string|max:50',
            'novedades.*.nombres' => 'nullable|string|max:255',
            'novedades.*.cargo' => 'nullable|string|max:100',
            'novedades.*.observaciones' => 'nullable|string',
            'novedades.*.fijo' => 'nullable|boolean',
            'novedades.*.fijo_rescate' => 'nullable|boolean',
            'novedades.*.fijo_taller' => 'nullable|boolean',
            'novedades.*.permiso' => 'nullable|boolean',
            'novedades.*.no_asitio' => 'nullable|boolean',
            'novedades.*.incapacidad' => 'nullable|boolean',
            'novedades.*.vacaciones' => 'nullable|boolean',
        ]);

        // Verificar que ningún colaborador esté asignado a más de una ruta en la misma fecha
        // Construir conjunto de colaboradores fijos desde el payload (incluye nuevos pendientes)
        $fijosIds    = [];
        $fijosCedulas = [];
        foreach ($validated['novedades'] ?? [] as $nov) {
            $esFijo = !empty($nov['fijo_rescate']) || !empty($nov['fijo_taller']) || !empty($nov['fijo']);
            if (!$esFijo) continue;
            if (!empty($nov['colaborador_id'])) $fijosIds[]    = (string) $nov['colaborador_id'];
            if (!empty($nov['cedula']))          $fijosCedulas[] = trim($nov['cedula']);
        }
        // También incluir fijos que ya existan en BD para la misma modulacion_id
        if (!empty($validated['modulacion_id'])) {
            $fijosBD = ModulacionNovedad::where('modulacion_id', $validated['modulacion_id'])
                ->where('fijo', true)
                ->get(['colaborador_id', 'cedula']);
            foreach ($fijosBD as $f) {
                if ($f->colaborador_id) $fijosIds[]    = (string) $f->colaborador_id;
                if ($f->cedula)         $fijosCedulas[] = trim($f->cedula);
            }
        }
        $fijosIds    = array_unique($fijosIds);
        $fijosCedulas = array_unique($fijosCedulas);

        $assignedCollaboratorIds = [];
        $assignedCedulas = [];

        foreach ($validated['rutas'] as $rIdx => $ruta) {
            $tripulacion = $ruta['tripulacion'] ?? [];
            foreach ($tripulacion as $miembro) {
                $colId = !empty($miembro['colaborador_id']) ? (string)$miembro['colaborador_id'] : null;
                $ced   = !empty($miembro['cedula']) ? trim($miembro['cedula']) : null;
                $nom   = $miembro['nombres'] ?? 'Colaborador';

                // Verificar duplicado solo si NO es fijo
                if ($colId && in_array($colId, $assignedCollaboratorIds, true)) {
                    if (!in_array($colId, $fijosIds, true)) {
                        return redirect()->back()->withErrors([
                            'rutas' => "El colaborador '{$nom}' ya se encuentra programado en otra ruta para la fecha {$validated['fecha']}.",
                        ]);
                    }
                }
                if ($ced && in_array($ced, $assignedCedulas, true)) {
                    if (!in_array($ced, $fijosCedulas, true)) {
                        return redirect()->back()->withErrors([
                            'rutas' => "El colaborador con cédula '{$ced}' ({$nom}) ya se encuentra programado en otra ruta para la fecha {$validated['fecha']}.",
                        ]);
                    }
                }

                if ($colId) $assignedCollaboratorIds[] = $colId;
                if ($ced)   $assignedCedulas[]         = $ced;
            }
        }

        $ubicaciones->guardarUbicacionesDeRutas($validated['rutas']);

        // Obtener o crear la planeación
        // Si viene modulacion_id, actualizar esa planeación (incluyendo su fecha si cambió)
        if (!empty($validated['modulacion_id'])) {
            $modulacion = Modulacion::findOrFail($validated['modulacion_id']);
            $modulacion->update([
                'fecha'                        => $validated['fecha'],
                'ud_programado_por'            => $validated['ud_programado_por'] ?? $modulacion->ud_programado_por,
                'despachado_por_colaborador_id'=> $validated['despachado_por_colaborador_id'] ?? $modulacion->despachado_por_colaborador_id,
                'despachado_por_nombre'        => $validated['despachado_por_nombre'] ?? $modulacion->despachado_por_nombre,
            ]);
        } else {
            $modulacion = Modulacion::firstOrCreate(
                ['fecha' => $validated['fecha']],
                [
                    'ud_programado_por'             => $validated['ud_programado_por'] ?? null,
                    'despachado_por_colaborador_id' => $validated['despachado_por_colaborador_id'] ?? null,
                    'despachado_por_nombre'         => $validated['despachado_por_nombre'] ?? null,
                    'user_id'                       => $request->user()?->id,
                ]
            );
            $modulacion->update([
                'ud_programado_por'             => $validated['ud_programado_por'] ?? $modulacion->ud_programado_por,
                'despachado_por_colaborador_id' => $validated['despachado_por_colaborador_id'] ?? $modulacion->despachado_por_colaborador_id,
                'despachado_por_nombre'         => $validated['despachado_por_nombre'] ?? $modulacion->despachado_por_nombre,
            ]);
        }

        // Reemplazar o guardar rutas de modulación
        $modulacion->items()->delete();

        foreach ($validated['rutas'] as $ruta) {
            $tripulacion = $ruta['tripulacion'] ?? [];
            $firstMember = $tripulacion[0] ?? null;

            $modulacion->items()->create([
                'placa' => $ruta['placa'],
                'placa_adicional' => !empty($ruta['placa_adicional']) ? strtoupper(trim($ruta['placa_adicional'])) : null,
                'doc_tras' => $ruta['doc_tras'] ?? null,
                'ud' => $ruta['ud'] ?? null,
                'cargo' => $ruta['cargo'] ?? ($firstMember['cargo'] ?? null),
                'colaborador_id' => $firstMember['colaborador_id'] ?? null,
                'cedula' => $firstMember['cedula'] ?? null,
                'nombres' => $firstMember['nombres'] ?? null,
                'reunion' => $ruta['reunion'] ?? null,
                'tripulacion' => $tripulacion,
                'viajes' => $ruta['viajes'] ?? [],
            ]);
        }

        // Actualizar novedades si fueron enviadas en el lote
        if (!empty($validated['novedades'])) {
            foreach ($validated['novedades'] as $novItem) {
                $fijoRescate = !empty($novItem['fijo_rescate']);
                $fijoTaller  = !empty($novItem['fijo_taller']);
                $fijoDirecto = !empty($novItem['fijo']);
                $campos = [
                    'fijo_rescate' => $fijoRescate,
                    'fijo_taller'  => $fijoTaller,
                    'fijo'         => $fijoDirecto || $fijoRescate || $fijoTaller,
                    'permiso'      => !empty($novItem['permiso']),
                    'no_asitio'    => !empty($novItem['no_asitio']),
                    'incapacidad'  => !empty($novItem['incapacidad']),
                    'vacaciones'   => !empty($novItem['vacaciones']),
                    'observaciones' => $novItem['observaciones'] ?? null,
                ];

                if (!empty($novItem['id'])) {
                    // Novedad existente → actualizar checkboxes y observaciones
                    ModulacionNovedad::where('id', $novItem['id'])->update($campos);
                } else {
                    // Novedad nueva (pendiente) → crear en BD
                    ModulacionNovedad::create(array_merge($campos, [
                        'modulacion_id' => $modulacion->id,
                        'colaborador_id' => $novItem['colaborador_id'] ?? null,
                        'cedula'        => $novItem['cedula'] ?? null,
                        'nombres'       => $novItem['nombres'] ?? null,
                        'cargo'         => $novItem['cargo'] ?? null,
                    ]));
                }
            }
        }

        $readOnly = $request->has('read_only')
            ? $request->boolean('read_only')
            : ($request->has('readOnly') ? $request->boolean('readOnly') : true);

        $redirectParams = ['fecha' => $modulacion->fecha];
        if ($readOnly) {
            $redirectParams['readOnly'] = 'true';
        }

        return redirect()
            ->route('reparto.modulacion.index', $redirectParams)
            ->with('success', 'Planeación de ruta guardada exitosamente.');
    }

    public function destroyItem(Request $request, int $id): RedirectResponse
    {
        $redirect = $this->redirectAfterDeletion($request);

        $resultado = DB::transaction(function () use ($id): array {
            $item = ModulacionItem::findOrFail($id);
            $modulacion = Modulacion::query()
                ->lockForUpdate()
                ->findOrFail($item->modulacion_id);

            $item->delete();

            if (! $modulacion->items()->exists()) {
                $modulacion->novedades()->delete();
                $modulacion->forceDelete();

                return ['planeacionEliminada' => true, 'rutaEliminada' => true];
            }

            return ['planeacionEliminada' => false, 'rutaEliminada' => true];
        });

        return $redirect->with(
            'success',
            $resultado['planeacionEliminada']
                ? 'Planeación eliminada porque no tiene rutas.'
                : 'Ruta eliminada de la modulación.'
        );
    }

    public function destroyViaje(Request $request, int $id, int $viajeIndex): RedirectResponse
    {
        $redirect = $this->redirectAfterDeletion($request);

        $resultado = DB::transaction(function () use ($id, $viajeIndex): array {
            $item = ModulacionItem::query()->lockForUpdate()->findOrFail($id);
            $modulacion = Modulacion::query()
                ->lockForUpdate()
                ->findOrFail($item->modulacion_id);
            $viajes = $item->viajes ?? [];

            abort_unless(array_key_exists($viajeIndex, $viajes), 404, 'El viaje solicitado no existe.');

            array_splice($viajes, $viajeIndex, 1);
            if ($viajes !== []) {
                $item->update(['viajes' => array_values($viajes)]);

                return ['rutaEliminada' => false, 'planeacionEliminada' => false];
            }

            $item->delete();
            if ($modulacion->items()->exists()) {
                return ['rutaEliminada' => true, 'planeacionEliminada' => false];
            }

            $modulacion->novedades()->delete();
            $modulacion->forceDelete();

            return ['rutaEliminada' => true, 'planeacionEliminada' => true];
        });

        return $redirect->with(
            'success',
            $resultado['planeacionEliminada']
                ? 'Planeación eliminada porque no tiene rutas.'
                : ($resultado['rutaEliminada']
                    ? 'Ruta eliminada porque ya no tenía viajes.'
                    : 'Viaje eliminado de la ruta.')
        );
    }

    private function redirectAfterDeletion(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'return_fecha' => ['nullable', 'date_format:Y-m-d'],
            'return_read_only' => ['nullable', 'boolean'],
        ]);

        if (empty($validated['return_fecha'])) {
            return redirect()->back();
        }

        $parameters = ['fecha' => $validated['return_fecha']];
        if ($request->boolean('return_read_only')) {
            $parameters['readOnly'] = 'true';
        }

        return redirect()->route('reparto.modulacion.index', $parameters);
    }

    public function destroyModulacion(int $id): RedirectResponse
    {
        DB::transaction(function () use ($id): void {
            $modulacion = Modulacion::query()->lockForUpdate()->findOrFail($id);
            $modulacion->items()->delete();
            $modulacion->novedades()->delete();
            $modulacion->forceDelete();
        });

        return redirect()->route('reparto.modulacion.historial')
            ->with('success', 'Planeación de ruta eliminada exitosamente.');
    }

    /**
     * Guardar la planeación de ruta vía AJAX (auto-guardado).
     *
     * Reutiliza la misma lógica de storeBatch pero devuelve JSON
     * para que el frontend pueda guardar cada viaje sin recargar la página,
     * evitando pérdida de datos si se recarga el navegador.
     */
    public function storeBatchApi(Request $request, ModulacionUbicacionesService $ubicaciones): JsonResponse
    {
        $this->ensureFijoColumnExists();

        $validated = $request->validate([
            'fecha' => 'required|string|max:255',
            'modulacion_id' => 'nullable|integer|exists:modulaciones,id',
            'ud_programado_por' => 'nullable|string|max:255',
            'despachado_por_colaborador_id' => 'nullable|exists:colaboradores,id',
            'despachado_por_nombre' => 'nullable|string|max:255',
            'rutas' => 'required|array|min:1',
            'rutas.*.placa' => 'required|string|max:50',
            'rutas.*.placa_adicional' => 'nullable|string|max:50',
            'rutas.*.doc_tras' => 'nullable|string|max:100',
            'rutas.*.ud' => 'nullable|string|max:100',
            'rutas.*.cargo' => 'nullable|string|max:100',
            'rutas.*.reunion' => 'nullable|string|max:255',
            'rutas.*.tripulacion' => 'nullable|array',
            'rutas.*.tripulacion.*.colaborador_id' => 'nullable',
            'rutas.*.tripulacion.*.cedula' => 'nullable|string',
            'rutas.*.tripulacion.*.nombres' => 'nullable|string',
            'rutas.*.tripulacion.*.cargo' => 'nullable|string',
            'rutas.*.viajes' => 'nullable|array',
            'rutas.*.viajes.*.lugares' => 'nullable|string|max:255',
            'rutas.*.viajes.*.barrio' => 'nullable|string|max:200',
            'rutas.*.viajes.*.destinos' => 'nullable|array',
            'rutas.*.viajes.*.destinos.*.lugares' => 'required|string|max:255',
            'rutas.*.viajes.*.destinos.*.barrio' => 'nullable|string|max:200',
            'rutas.*.viajes.*.cliente' => 'nullable|string|max:255',
            'rutas.*.viajes.*.peso' => 'nullable|string|max:100',
            'novedades' => 'nullable|array',
            'novedades.*.id' => 'nullable|integer',
            'novedades.*.colaborador_id' => 'nullable|integer',
            'novedades.*.cedula' => 'nullable|string|max:50',
            'novedades.*.nombres' => 'nullable|string|max:255',
            'novedades.*.cargo' => 'nullable|string|max:100',
            'novedades.*.observaciones' => 'nullable|string',
            'novedades.*.fijo' => 'nullable|boolean',
            'novedades.*.fijo_rescate' => 'nullable|boolean',
            'novedades.*.fijo_taller' => 'nullable|boolean',
            'novedades.*.permiso' => 'nullable|boolean',
            'novedades.*.no_asitio' => 'nullable|boolean',
            'novedades.*.incapacidad' => 'nullable|boolean',
            'novedades.*.vacaciones' => 'nullable|boolean',
        ]);

        // Verificar duplicados de colaboradores (misma lógica que storeBatch)
        $fijosIds = [];
        $fijosCedulas = [];
        foreach ($validated['novedades'] ?? [] as $nov) {
            $esFijo = !empty($nov['fijo_rescate']) || !empty($nov['fijo_taller']) || !empty($nov['fijo']);
            if (!$esFijo) continue;
            if (!empty($nov['colaborador_id'])) $fijosIds[] = (string) $nov['colaborador_id'];
            if (!empty($nov['cedula'])) $fijosCedulas[] = trim($nov['cedula']);
        }
        if (!empty($validated['modulacion_id'])) {
            $fijosBD = ModulacionNovedad::where('modulacion_id', $validated['modulacion_id'])
                ->where('fijo', true)
                ->get(['colaborador_id', 'cedula']);
            foreach ($fijosBD as $f) {
                if ($f->colaborador_id) $fijosIds[] = (string) $f->colaborador_id;
                if ($f->cedula) $fijosCedulas[] = trim($f->cedula);
            }
        }
        $fijosIds = array_unique($fijosIds);
        $fijosCedulas = array_unique($fijosCedulas);

        $assignedCollaboratorIds = [];
        $assignedCedulas = [];
        foreach ($validated['rutas'] as $ruta) {
            foreach ($ruta['tripulacion'] ?? [] as $miembro) {
                $colId = !empty($miembro['colaborador_id']) ? (string)$miembro['colaborador_id'] : null;
                $ced = !empty($miembro['cedula']) ? trim($miembro['cedula']) : null;
                $nom = $miembro['nombres'] ?? 'Colaborador';

                if ($colId && in_array($colId, $assignedCollaboratorIds, true)) {
                    if (!in_array($colId, $fijosIds, true)) {
                        return response()->json([
                            'message' => "El colaborador '{$nom}' ya se encuentra programado en otra ruta para la fecha {$validated['fecha']}.",
                        ], 422);
                    }
                }
                if ($ced && in_array($ced, $assignedCedulas, true)) {
                    if (!in_array($ced, $fijosCedulas, true)) {
                        return response()->json([
                            'message' => "El colaborador con cédula '{$ced}' ({$nom}) ya se encuentra programado en otra ruta para la fecha {$validated['fecha']}.",
                        ], 422);
                    }
                }
                if ($colId) $assignedCollaboratorIds[] = $colId;
                if ($ced) $assignedCedulas[] = $ced;
            }
        }

        $ubicaciones->guardarUbicacionesDeRutas($validated['rutas']);

        // Obtener o crear la planeación
        if (!empty($validated['modulacion_id'])) {
            $modulacion = Modulacion::findOrFail($validated['modulacion_id']);
            $modulacion->update([
                'fecha' => $validated['fecha'],
                'ud_programado_por' => $validated['ud_programado_por'] ?? $modulacion->ud_programado_por,
                'despachado_por_colaborador_id' => $validated['despachado_por_colaborador_id'] ?? $modulacion->despachado_por_colaborador_id,
                'despachado_por_nombre' => $validated['despachado_por_nombre'] ?? $modulacion->despachado_por_nombre,
            ]);
        } else {
            $modulacion = Modulacion::firstOrCreate(
                ['fecha' => $validated['fecha']],
                [
                    'ud_programado_por' => $validated['ud_programado_por'] ?? null,
                    'despachado_por_colaborador_id' => $validated['despachado_por_colaborador_id'] ?? null,
                    'despachado_por_nombre' => $validated['despachado_por_nombre'] ?? null,
                    'user_id' => $request->user()?->id,
                ]
            );
            $modulacion->update([
                'ud_programado_por' => $validated['ud_programado_por'] ?? $modulacion->ud_programado_por,
                'despachado_por_colaborador_id' => $validated['despachado_por_colaborador_id'] ?? $modulacion->despachado_por_colaborador_id,
                'despachado_por_nombre' => $validated['despachado_por_nombre'] ?? $modulacion->despachado_por_nombre,
            ]);
        }

        // Reemplazar items
        $modulacion->items()->delete();
        foreach ($validated['rutas'] as $ruta) {
            $tripulacion = $ruta['tripulacion'] ?? [];
            $firstMember = $tripulacion[0] ?? null;

            $modulacion->items()->create([
                'placa' => $ruta['placa'],
                'placa_adicional' => !empty($ruta['placa_adicional']) ? strtoupper(trim($ruta['placa_adicional'])) : null,
                'doc_tras' => $ruta['doc_tras'] ?? null,
                'ud' => $ruta['ud'] ?? null,
                'cargo' => $ruta['cargo'] ?? ($firstMember['cargo'] ?? null),
                'colaborador_id' => $firstMember['colaborador_id'] ?? null,
                'cedula' => $firstMember['cedula'] ?? null,
                'nombres' => $firstMember['nombres'] ?? null,
                'reunion' => $ruta['reunion'] ?? null,
                'tripulacion' => $tripulacion,
                'viajes' => $ruta['viajes'] ?? [],
            ]);
        }

        // Actualizar novedades
        if (!empty($validated['novedades'])) {
            foreach ($validated['novedades'] as $novItem) {
                $fijoRescate = !empty($novItem['fijo_rescate']);
                $fijoTaller = !empty($novItem['fijo_taller']);
                $fijoDirecto = !empty($novItem['fijo']);
                $campos = [
                    'fijo_rescate' => $fijoRescate,
                    'fijo_taller' => $fijoTaller,
                    'fijo' => $fijoDirecto || $fijoRescate || $fijoTaller,
                    'permiso' => !empty($novItem['permiso']),
                    'no_asitio' => !empty($novItem['no_asitio']),
                    'incapacidad' => !empty($novItem['incapacidad']),
                    'vacaciones' => !empty($novItem['vacaciones']),
                    'observaciones' => $novItem['observaciones'] ?? null,
                ];

                if (!empty($novItem['id'])) {
                    ModulacionNovedad::where('id', $novItem['id'])->update($campos);
                } else {
                    ModulacionNovedad::create(array_merge($campos, [
                        'modulacion_id' => $modulacion->id,
                        'colaborador_id' => $novItem['colaborador_id'] ?? null,
                        'cedula' => $novItem['cedula'] ?? null,
                        'nombres' => $novItem['nombres'] ?? null,
                        'cargo' => $novItem['cargo'] ?? null,
                    ]));
                }
            }
        }

        // Recargar la modulación con items y novedades para devolver datos frescos
        $modulacion->load(['items', 'novedades']);

        return response()->json([
            'success' => true,
            'message' => 'Planeación guardada exitosamente.',
            'modulacion_id' => $modulacion->id,
            'modulacion' => $modulacion,
        ]);
    }

    public function storeNovedad(Request $request): RedirectResponse
    {
        $this->ensureFijoColumnExists();

        $validated = $request->validate([
            'fecha' => 'required|string',
            'colaborador_id' => 'nullable',
            'cedula' => 'nullable|string|max:100',
            'nombres' => 'nullable|string|max:255',
            'cargo' => 'nullable|string|max:100',
            'fijo' => 'nullable|boolean',
            'fijo_rescate' => 'nullable|boolean',
            'fijo_taller' => 'nullable|boolean',
            'permiso' => 'nullable|boolean',
            'incapacidad' => 'nullable|boolean',
            'vacaciones' => 'nullable|boolean',
        ]);

        $modulacion = Modulacion::firstOrCreate(
            ['fecha' => $validated['fecha']],
            ['ud_programado_por' => $request->user()?->name]
        );

        $modulacion->novedades()->create([
            'colaborador_id' => !empty($validated['colaborador_id']) ? (int)$validated['colaborador_id'] : null,
            'cedula' => $validated['cedula'] ?? null,
            'nombres' => $validated['nombres'] ?? null,
            'cargo' => $validated['cargo'] ?? null,
            'fijo'        => !empty($validated['fijo']) || !empty($validated['fijo_rescate']) || !empty($validated['fijo_taller']),
            'fijo_rescate' => !empty($validated['fijo_rescate']),
            'fijo_taller'  => !empty($validated['fijo_taller']),
            'permiso' => !empty($validated['permiso']),
            'incapacidad' => !empty($validated['incapacidad']),
            'vacaciones' => !empty($validated['vacaciones']),
        ]);

        return redirect()->back()->with('success', 'Novedad agregada exitosamente.');
    }

    public function destroyNovedad(int $id): mixed
    {
        $novedad = ModulacionNovedad::findOrFail($id);
        $novedad->delete();

        if (request()->expectsJson()) {
            return response()->json(['success' => true, 'message' => 'Novedad eliminada.']);
        }

        return redirect()->back()->with('success', 'Novedad eliminada.');
    }

    public function updateNovedad(Request $request, int $id): RedirectResponse
    {
        $this->ensureFijoColumnExists();

        $novedad = ModulacionNovedad::findOrFail($id);

        $validated = $request->validate([
            'fijo' => 'boolean',
            'permiso' => 'boolean',
            'no_asitio' => 'boolean',
            'incapacidad' => 'boolean',
            'vacaciones' => 'boolean',
            'observaciones' => 'nullable|string',
        ]);

        $novedad->update($validated);

        return redirect()->back()->with('success', 'Novedad de colaborador actualizada.');
    }

    /**
     * Devuelve los datos de la �ltima ruta registrada para una placa (d�a anterior o fecha anterior disponible),
     * excluyendo la fecha actual para no sobreescribir datos ya ingresados hoy.
     */
    public function ultimaRutaPlaca(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'placa'  => 'required|string|max:50',
            'fecha'  => 'nullable|string|max:20',
        ]);

        $placa       = strtoupper(trim($validated['placa']));
        $fechaActual = $validated['fecha'] ?? date('Y-m-d');

        // Buscar el ModulacionItem m�s reciente para esta placa antes de la fecha actual
        $item = ModulacionItem::join('modulaciones', 'modulaciones.id', '=', 'modulacion_items.modulacion_id')
            ->whereNull('modulaciones.deleted_at')
            ->whereDate('modulaciones.fecha', '<', $fechaActual)
            ->where('modulacion_items.placa', $placa)
            ->orderByDesc('modulaciones.fecha')
            ->select('modulacion_items.*', 'modulaciones.fecha as fecha_modulacion')
            ->first();

        if (! $item) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found'        => true,
            'fecha_origen' => $item->fecha_modulacion,
            'doc_tras'     => $item->doc_tras,
            'cargo'        => $item->cargo,
            'placa_adicional' => $item->placa_adicional,
            'tripulacion'  => is_string($item->tripulacion) ? json_decode($item->tripulacion, true) ?? [] : ($item->tripulacion ?? []),
            'viajes'       => is_string($item->viajes) ? json_decode($item->viajes, true) ?? [] : ($item->viajes ?? []),
        ]);
    }
}
