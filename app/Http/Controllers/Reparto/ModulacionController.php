<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Flota\Vehiculo;
use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\Reparto\ModulacionNovedad;
use App\Models\Seguridad\Colaborador;
use App\Services\Reparto\ModulacionUbicacionesService;
use App\Services\Reparto\ModulacionTripulacionService;
use App\Services\Seguridad\ColaboradorCatalogoService;
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
    /* ======================================================================
     |  UBICACIONES
     * ====================================================================== */

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

    /* ======================================================================
     |  HELPERS DE CENTRO (UC / UD) — toda la separación vive aquí
     * ====================================================================== */

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
        // Columna centro en modulaciones (migración defensiva — separa UC y UD)
        if (Schema::hasTable('modulaciones') && ! Schema::hasColumn('modulaciones', 'centro')) {
            Schema::table('modulaciones', function (Blueprint $table) {
                $table->string('centro', 10)->nullable()->after('fecha');
            });
        }
    }

    /** Normaliza y valida que un centro sea 'UC' o 'UD'. Devuelve null si no es válido. */
    private function normalizarCentro(?string $centro): ?string
    {
        $c = strtoupper(trim((string) $centro));
        return in_array($c, ['UC', 'UD'], true) ? $c : null;
    }

    /** Agrupa la condición "es fijo" (fijo OR fijo_rescate OR fijo_taller) para no romper otros where. */
    private function condicionFijo($q): void
    {
        $q->where(function ($w) {
            $w->where('fijo', true)
                ->orWhere('fijo_rescate', true)
                ->orWhere('fijo_taller', true);
        });
    }

    /** Última fecha anterior a $fecha con colaboradores fijos, SOLO del centro indicado. */
    private function ultimaFechaConFijos(string $fecha, string $centro): ?string
    {
        return Modulacion::whereHas('novedades', fn ($q) => $this->condicionFijo($q))
            ->where('centro', $centro)
            ->whereDate('fecha', '<', $fecha)
            ->orderByDesc('fecha')
            ->value('fecha');
    }

    /** Fijos de la última planeación anterior del MISMO centro (array listo para el front). */
    private function fijosInicialesDelCentro(string $fecha, ?string $centro): array
    {
        if (! $centro) {
            return [];
        }

        $ultimaFechaFijos = $this->ultimaFechaConFijos($fecha, $centro);
        if (! $ultimaFechaFijos) {
            return [];
        }

        return ModulacionNovedad::whereHas('modulacion', function ($q) use ($ultimaFechaFijos, $centro) {
                $q->whereDate('fecha', $ultimaFechaFijos)->where('centro', $centro);
            })
            ->where(fn ($q) => $this->condicionFijo($q))
            ->get(['colaborador_id', 'cedula', 'nombres', 'cargo', 'observaciones', 'fijo', 'fijo_rescate', 'fijo_taller', 'permiso', 'no_asitio', 'incapacidad', 'vacaciones'])
            ->toArray();
    }

    /** Copia a la planeación existente los fijos de la última planeación del mismo centro. */
    private function sincronizarFijosAnteriores(Modulacion $modulacion, string $fecha, string $centro): void
    {
        $ultimaFecha = $this->ultimaFechaConFijos($fecha, $centro);
        if (! $ultimaFecha) {
            return;
        }

        $ultimaModulacion = Modulacion::with('novedades')
            ->whereDate('fecha', $ultimaFecha)
            ->where('centro', $centro)
            ->first();

        if (! $ultimaModulacion) {
            return;
        }

        $fijosAnteriores = $ultimaModulacion->novedades
            ->filter(fn ($n) => $n->fijo || $n->fijo_rescate || $n->fijo_taller);

        foreach ($fijosAnteriores as $fijo) {
            $existe = $modulacion->novedades()
                ->where(function ($q) use ($fijo) {
                    if ($fijo->colaborador_id) {
                        $q->where('colaborador_id', $fijo->colaborador_id);
                    } else {
                        $q->where('cedula', $fijo->cedula);
                    }
                })
                ->exists();

            if (! $existe) {
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

        $modulacion->load('novedades');
    }

    /** Planeación exacta de (fecha, centro). Nunca mezcla centros.
     *  Para planeaciones antiguas (centro = null) busca por las placas de la flota del centro. */
    private function buscarModulacion(string $fecha, ?string $centro): ?Modulacion
    {
        if (! $centro) {
            return null;
        }

        // Búsqueda principal: planeación ya migrada con centro explícito
        $modulacion = Modulacion::with(['items', 'novedades'])
            ->whereDate('fecha', $fecha)
            ->where('centro', $centro)
            ->first();

        if ($modulacion) {
            return $modulacion;
        }

        // Respaldo legacy: planeación sin centro que tenga al menos una placa del centro solicitado
        $placasDelCentro = Vehiculo::where('centro', $centro)
            ->pluck('placa')
            ->map(fn($p) => strtoupper(trim((string) $p)))
            ->filter()
            ->values()
            ->toArray();

        if (empty($placasDelCentro)) {
            return null;
        }

        $legacy = Modulacion::with(['items', 'novedades'])
            ->whereDate('fecha', $fecha)
            ->whereNull('centro')
            ->whereHas('items', fn($q) => $q->whereIn(DB::raw('UPPER(placa)'), $placasDelCentro))
            ->first();

        // Si encontró una planeación legacy, se migra su centro en background para las próximas consultas
        if ($legacy) {
            $legacy->updateQuietly(['centro' => $centro]);
            $legacy->centro = $centro;
        }

        return $legacy;
    }

    /** Colaboradores activos únicamente del centro; sin centro no se devuelve nada. */
    private function colaboradoresDelCentro(ModulacionTripulacionService $tripulacion, ?string $centro)
    {
        return $centro ? $tripulacion->colaboradoresActivos($centro) : [];
    }

    /* ======================================================================
     |  VISTAS / CONSULTAS
     * ====================================================================== */

    public function index(
        Request $request,
        ColaboradorCatalogoService $catalogos,
        ModulacionTripulacionService $tripulacion,
    ): Response
    {
        $this->ensureFijoColumnExists();

        $fecha  = $request->input('fecha', date('Y-m-d'));
        $centro = $this->normalizarCentro($request->input('centro'));

        // ── Planeación del centro y fecha exactos ────────────────────────────
        $modulacion = $this->buscarModulacion($fecha, $centro);

        // Si ya existe, se pre-cargan los fijos del mismo centro
        if ($modulacion && $centro) {
            $this->sincronizarFijosAnteriores($modulacion, $fecha, $centro);
        }

        // Fijos iniciales cuando no existe planeación todavía para este (fecha, centro)
        $fijosIniciales = $modulacion ? [] : $this->fijosInicialesDelCentro($fecha, $centro);

        // Solo vehículos del centro activo (sin centro no se listan vehículos)
        $vehiculos = $centro
            ? Vehiculo::where('is_active', true)
                ->where('centro', $centro)
                ->orderBy('placa')
                ->get(['placa', 'centro'])
                ->map(fn ($v) => ['placa' => $v->placa, 'centro' => $v->centro])
                ->values()
            : collect();

        return Inertia::render('reparto/modulacion/index', [
            'fecha'          => $fecha,
            'centro'         => $centro,
            'modulacion'     => $modulacion,
            'fijosIniciales' => $fijosIniciales,
            'colaboradores'  => $this->colaboradoresDelCentro($tripulacion, $centro),
            'cargosCatalogo' => $catalogos->cargos(),
            'vehiculos'      => $vehiculos,
            'currentUser'    => $request->user()?->name ?? 'Usuario',
            'readOnly'       => $request->boolean('readOnly', false),
            'exportExcel'    => $request->boolean('exportExcel', false),
            'isAdmin'        => $request->user()?->hasRole('Administrador') ?? false,
        ]);
    }

    public function checkFecha(
        Request $request,
        ColaboradorCatalogoService $catalogos,
        ModulacionTripulacionService $tripulacion,
    )
    {
        $this->ensureFijoColumnExists();
        $fecha  = trim((string) $request->input('fecha', date('Y-m-d')));
        $centro = $this->normalizarCentro($request->input('centro'));

        // Planeación exacta del (fecha, centro) — nunca mezclar
        $modulacion = $this->buscarModulacion($fecha, $centro);

        // Fijos iniciales filtrados por centro cuando no hay planeación todavía
        $fijosIniciales = $modulacion ? [] : $this->fijosInicialesDelCentro($fecha, $centro);

        $vehiculos = $centro
            ? Vehiculo::where('is_active', true)
                ->where('centro', $centro)
                ->orderBy('placa')
                ->get(['placa', 'centro'])
                ->map(fn ($v) => ['placa' => $v->placa, 'centro' => $v->centro])
                ->values()
            : collect();

        return response()->json([
            'exists'         => (bool) $modulacion,
            'modulacion'     => $modulacion,
            'fijosIniciales' => $fijosIniciales,
            'cargosCatalogo' => $catalogos->cargos(),
            'colaboradores'  => $this->colaboradoresDelCentro($tripulacion, $centro),
            'vehiculos'      => $vehiculos,
        ]);
    }

    public function historial(Request $request): Response
    {
        $fechaDesde = $request->input('fecha_desde', '');
        $fechaHasta = $request->input('fecha_hasta', '');
        $placa = $request->input('placa', '');
        $centro = $request->input('centro', '');
        $docTransporte = $request->input('doc_transporte', '');
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

        // Filtro por documento de transporte
        if ($docTransporte) {
            $query->whereHas('items', function ($q) use ($docTransporte) {
                $q->where('doc_tras', 'like', '%' . $docTransporte . '%');
            });
        }

        // Filtro por centro (UC o UD): se usa la columna `centro` de la planeación.
        // Para planeaciones antiguas sin centro (null) se mantiene el respaldo por placas de la flota.
        $centroNormalizado = $this->normalizarCentro((string) $centro);
        if ($centroNormalizado) {
            $placasCentro = Vehiculo::where('centro', $centroNormalizado)
                ->pluck('placa')
                ->map(fn ($p) => strtoupper(trim((string) $p)))
                ->filter()
                ->unique()
                ->values()
                ->toArray();

            $query->where(function ($q) use ($centroNormalizado, $placasCentro) {
                $q->where('centro', $centroNormalizado)
                    ->orWhere(function ($legacy) use ($placasCentro) {
                        $legacy->whereNull('centro')
                            ->whereHas('items', function ($i) use ($placasCentro) {
                                $i->whereIn(DB::raw('UPPER(placa)'), $placasCentro);
                            });
                    });
            });
        }

        $planeaciones = $query->paginate($perPage)->withQueryString();

        // Enriquecer cada modulación con resumen de placas y colaboradores,
        // e inferir el centro de las planeaciones legacy (centro = null)
        $placasPorCentro = [];
        if ($centroNormalizado) {
            $placasPorCentro[$centroNormalizado] = Vehiculo::where('centro', $centroNormalizado)
                ->pluck('placa')
                ->map(fn($p) => strtoupper(trim((string) $p)))
                ->flip()
                ->all();
        }

        $planeaciones->getCollection()->transform(function (Modulacion $mod) use ($placasPorCentro) {
            $items = $mod->items;

            // Inferir centro para planeaciones legacy (centro null): si tiene al menos una placa del centro buscado
            $centroEfectivo = $mod->centro;
            if (! $centroEfectivo && ! empty($placasPorCentro)) {
                foreach ($placasPorCentro as $c => $placasFlip) {
                    $tienePlacaDeCentro = $items->contains(
                        fn($item) => isset($placasFlip[strtoupper(trim((string) $item->placa))])
                    );
                    if ($tienePlacaDeCentro) {
                        $centroEfectivo = $c;
                        // Migrar en background para próximas consultas
                        $mod->updateQuietly(['centro' => $centroEfectivo]);
                        break;
                    }
                }
            }
            $placas = $items->pluck('placa')->filter()->unique()->values();
            $totalTripulantes = $items->sum(function ($item) {
                return count($item->tripulacion ?? []);
            });

            $rutasDetalle = $items->map(function ($item) {
                $docTras = trim((string)($item->doc_tras ?? ''));

                $tripulacion = is_array($item->tripulacion) ? $item->tripulacion : [];
                $responsableRuta = collect($tripulacion)->first(
                    fn ($miembro) => is_array($miembro)
                        && str_contains(mb_strtoupper(trim((string)($miembro['cargo'] ?? ''))), 'RESPONSABLE DE REPARTO')
                );
                $responsable = trim((string)($responsableRuta['nombres'] ?? ''));

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
                'centro'                      => $centroEfectivo,
                'ud_programado_por'           => $mod->ud_programado_por,
                'despachado_por_nombre'       => $mod->despachado_por_nombre,
                'total_rutas'                 => $mod->items_count,
                'total_tripulantes'           => $totalTripulantes,
                'total_novedades'             => $mod->novedades->count(),
                'placas'                      => $placas,
                'rutas_detalle'               => $rutasDetalle,
            ];
        });

        // Placas disponibles para el filtro: se limitan al centro seleccionado si hay uno
        $placasModulacion = ModulacionItem::select('placa')
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->when($centroNormalizado, function ($q) use ($centroNormalizado) {
                $q->whereIn('modulacion_id', Modulacion::select('id')->where('centro', $centroNormalizado));
            })
            ->distinct()
            ->pluck('placa');

        $placasFlota = Vehiculo::select('placa')
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->when($centroNormalizado, fn ($q) => $q->where('centro', $centroNormalizado))
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
                'fecha_desde'    => $fechaDesde,
                'fecha_hasta'    => $fechaHasta,
                'placa'          => $placa,
                'centro'         => $centro,
                'doc_transporte' => $docTransporte,
            ],
        ]);
    }

    /* ======================================================================
     |  GUARDADO (storeBatch y storeBatchApi comparten TODA la lógica)
     * ====================================================================== */

    /** Reglas de validación comunes para guardar una planeación. */
    private function reglasPlaneacion(): array
    {
        return [
            'fecha'                                    => 'required|string|max:255',
            'centro'                                   => 'required|string|in:UC,UD',
            'modulacion_id'                            => 'nullable|integer|exists:modulaciones,id',
            'ud_programado_por'                        => 'nullable|string|max:255',
            'despachado_por_colaborador_id'            => 'nullable|exists:colaboradores,id',
            'despachado_por_nombre'                    => 'nullable|string|max:255',
            'rutas'                                    => 'required|array|min:1',
            'rutas.*.placa'                            => 'required|string|max:50',
            'rutas.*.placa_adicional'                  => 'nullable|string|max:50',
            'rutas.*.doc_tras'                         => 'nullable|string|max:100',
            'rutas.*.ud'                               => 'nullable|string|max:100',
            'rutas.*.cargo'                            => 'nullable|string|max:100',
            'rutas.*.reunion'                          => 'nullable|string|max:255',
            'rutas.*.tripulacion'                      => 'nullable|array',
            'rutas.*.tripulacion.*.colaborador_id'     => 'nullable',
            'rutas.*.tripulacion.*.cedula'             => 'nullable|string',
            'rutas.*.tripulacion.*.nombres'            => 'nullable|string',
            'rutas.*.tripulacion.*.cargo'              => 'nullable|string',
            'rutas.*.viajes'                           => 'nullable|array',
            'rutas.*.viajes.*.lugares'                 => 'nullable|string|max:255',
            'rutas.*.viajes.*.barrio'                  => 'nullable|string|max:200',
            'rutas.*.viajes.*.destinos'                => 'nullable|array',
            'rutas.*.viajes.*.destinos.*.lugares'      => 'required|string|max:255',
            'rutas.*.viajes.*.destinos.*.barrio'       => 'nullable|string|max:200',
            'rutas.*.viajes.*.cliente'                 => 'nullable|string|max:255',
            'rutas.*.viajes.*.peso'                    => 'nullable|string|max:100',
            'novedades'                                => 'nullable|array',
            'novedades.*.id'                           => 'nullable|integer',
            'novedades.*.colaborador_id'               => 'nullable|integer',
            'novedades.*.cedula'                       => 'nullable|string|max:50',
            'novedades.*.nombres'                      => 'nullable|string|max:255',
            'novedades.*.cargo'                        => 'nullable|string|max:100',
            'novedades.*.observaciones'                => 'nullable|string',
            'novedades.*.fijo'                         => 'nullable|boolean',
            'novedades.*.fijo_rescate'                 => 'nullable|boolean',
            'novedades.*.fijo_taller'                  => 'nullable|boolean',
            'novedades.*.permiso'                      => 'nullable|boolean',
            'novedades.*.no_asitio'                    => 'nullable|boolean',
            'novedades.*.incapacidad'                  => 'nullable|boolean',
            'novedades.*.vacaciones'                   => 'nullable|boolean',
        ];
    }

    private function mensajesPlaneacion(): array
    {
        return [
            'centro.required' => 'Debe seleccionar el centro (UC o UD) antes de guardar la planeación.',
            'centro.in'       => 'El centro debe ser UC o UD.',
        ];
    }

    /** Normaliza el centro del request ANTES de validar (acepta "uc", " UD ", etc.). */
    private function prepararCentroDelRequest(Request $request): void
    {
        $request->merge(['centro' => $this->normalizarCentro($request->input('centro'))]);
    }

    /**
     * Valida las reglas de negocio de una planeación respecto a su centro.
     * Devuelve el mensaje de error o null si todo está correcto.
     */
    private function validarReglasDePlaneacion(array $validated, string $centro): ?string
    {
        // ── La planeación que se edita debe ser del mismo centro ──────────────
        if (!empty($validated['modulacion_id'])) {
            $existente = Modulacion::find($validated['modulacion_id']);
            if ($existente && $existente->centro && $existente->centro !== $centro) {
                return 'La planeación seleccionada pertenece al centro ' . $existente->centro
                    . ' y no puede modificarse desde el centro ' . $centro . '.';
            }
        }

        // ── Ninguna placa puede pertenecer a otro centro ──────────────────────
        $placasEnviadas = [];
        foreach ($validated['rutas'] as $r) {
            $placasEnviadas[] = strtoupper(trim((string) $r['placa']));
            if (!empty($r['placa_adicional'])) {
                $placasEnviadas[] = strtoupper(trim((string) $r['placa_adicional']));
            }
        }
        $placasAjenas = Vehiculo::whereIn('placa', array_unique($placasEnviadas))
            ->whereNotNull('centro')
            ->where('centro', '!=', $centro)
            ->pluck('placa')
            ->toArray();

        if (!empty($placasAjenas)) {
            return 'Las siguientes placas no pertenecen al centro ' . $centro . ' y no pueden incluirse: ' . implode(', ', $placasAjenas) . '.';
        }

        // ── Colaboradores duplicados entre rutas (los fijos pueden repetirse) ─
        $fijosIds     = [];
        $fijosCedulas = [];
        foreach ($validated['novedades'] ?? [] as $nov) {
            $esFijo = !empty($nov['fijo_rescate']) || !empty($nov['fijo_taller']) || !empty($nov['fijo']);
            if (!$esFijo) continue;
            if (!empty($nov['colaborador_id'])) $fijosIds[]     = (string) $nov['colaborador_id'];
            if (!empty($nov['cedula']))          $fijosCedulas[] = trim($nov['cedula']);
        }
        if (!empty($validated['modulacion_id'])) {
            $fijosBD = ModulacionNovedad::where('modulacion_id', $validated['modulacion_id'])
                ->where('fijo', true)
                ->get(['colaborador_id', 'cedula']);
            foreach ($fijosBD as $f) {
                if ($f->colaborador_id) $fijosIds[]     = (string) $f->colaborador_id;
                if ($f->cedula)         $fijosCedulas[] = trim($f->cedula);
            }
        }
        $fijosIds     = array_unique($fijosIds);
        $fijosCedulas = array_unique($fijosCedulas);

        $assignedCollaboratorIds = [];
        $assignedCedulas = [];
        foreach ($validated['rutas'] as $ruta) {
            foreach ($ruta['tripulacion'] ?? [] as $miembro) {
                $colId = !empty($miembro['colaborador_id']) ? (string) $miembro['colaborador_id'] : null;
                $ced   = !empty($miembro['cedula']) ? trim($miembro['cedula']) : null;
                $nom   = $miembro['nombres'] ?? 'Colaborador';

                if ($colId && in_array($colId, $assignedCollaboratorIds, true) && !in_array($colId, $fijosIds, true)) {
                    return "El colaborador '{$nom}' ya se encuentra programado en otra ruta para la fecha {$validated['fecha']}.";
                }
                if ($ced && in_array($ced, $assignedCedulas, true) && !in_array($ced, $fijosCedulas, true)) {
                    return "El colaborador con cédula '{$ced}' ({$nom}) ya se encuentra programado en otra ruta para la fecha {$validated['fecha']}.";
                }
                if ($colId) $assignedCollaboratorIds[] = $colId;
                if ($ced)   $assignedCedulas[]         = $ced;
            }
        }

        return null;
    }

    /**
     * Crea o actualiza la planeación (fecha, centro) con sus rutas y novedades.
     * Todo dentro de una transacción para no dejar datos a medias.
     */
    private function persistirPlaneacion(
        Request $request,
        array $validated,
        string $centro,
        ModulacionUbicacionesService $ubicaciones,
        ModulacionTripulacionService $tripulacionService,
    ): Modulacion
    {
        $ubicaciones->guardarUbicacionesDeRutas($validated['rutas']);

        return DB::transaction(function () use ($request, $validated, $centro, $tripulacionService): Modulacion {
            // ── Obtener o crear la planeación por (fecha, centro) — nunca mezclar ─
            if (!empty($validated['modulacion_id'])) {
                $modulacion = Modulacion::findOrFail($validated['modulacion_id']);
                $modulacion->update([
                    'fecha'                         => $validated['fecha'],
                    'centro'                        => $centro,
                    'ud_programado_por'             => $validated['ud_programado_por'] ?? $modulacion->ud_programado_por,
                    'despachado_por_colaborador_id' => $validated['despachado_por_colaborador_id'] ?? $modulacion->despachado_por_colaborador_id,
                    'despachado_por_nombre'         => $validated['despachado_por_nombre'] ?? $modulacion->despachado_por_nombre,
                ]);
            } else {
                $modulacion = Modulacion::firstOrCreate(
                    ['fecha' => $validated['fecha'], 'centro' => $centro],
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

            // Reemplazar solo los items de esta modulación (ya separada por centro — seguro borrar todos)
            $validated['rutas'] = $tripulacionService->preservarCargosGuardados($validated['rutas'], $modulacion);
            $modulacion->items()->delete();

            foreach ($validated['rutas'] as $ruta) {
                // Normalizar cargos de la tripulación a MAYÚSCULAS antes de persistir
                $tripulacion = array_map(function ($miembro) {
                    if (is_array($miembro) && isset($miembro['cargo'])) {
                        $miembro['cargo'] = mb_strtoupper(trim((string) $miembro['cargo']), 'UTF-8');
                    }
                    return $miembro;
                }, $ruta['tripulacion'] ?? []);
                $firstMember = $tripulacion[0] ?? null;
                $cargoRuta = is_array($firstMember) && array_key_exists('cargo', $firstMember)
                    ? $firstMember['cargo']
                    : (isset($ruta['cargo']) ? mb_strtoupper(trim((string) $ruta['cargo']), 'UTF-8') : null);

                $modulacion->items()->create([
                    'placa'           => $ruta['placa'],
                    'placa_adicional' => !empty($ruta['placa_adicional']) ? strtoupper(trim($ruta['placa_adicional'])) : null,
                    'doc_tras'        => $ruta['doc_tras'] ?? null,
                    'ud'              => $ruta['ud'] ?? null,
                    'cargo'           => $cargoRuta,
                    'colaborador_id'  => $firstMember['colaborador_id'] ?? null,
                    'cedula'          => $firstMember['cedula'] ?? null,
                    'nombres'         => $firstMember['nombres'] ?? null,
                    'reunion'         => $ruta['reunion'] ?? null,
                    'tripulacion'     => $tripulacion,
                    'viajes'          => $ruta['viajes'] ?? [],
                ]);
            }

            // Actualizar novedades si fueron enviadas en el lote
            foreach ($validated['novedades'] ?? [] as $novItem) {
                $fijoRescate = !empty($novItem['fijo_rescate']);
                $fijoTaller  = !empty($novItem['fijo_taller']);
                $fijoDirecto = !empty($novItem['fijo']);
                $campos = [
                    'fijo_rescate'  => $fijoRescate,
                    'fijo_taller'   => $fijoTaller,
                    'fijo'          => $fijoDirecto || $fijoRescate || $fijoTaller,
                    'permiso'       => !empty($novItem['permiso']),
                    'no_asitio'     => !empty($novItem['no_asitio']),
                    'incapacidad'   => !empty($novItem['incapacidad']),
                    'vacaciones'    => !empty($novItem['vacaciones']),
                    'observaciones' => $novItem['observaciones'] ?? null,
                ];

                if (!empty($novItem['id'])) {
                    // Solo se puede tocar una novedad de ESTA planeación (evita afectar al otro centro)
                    ModulacionNovedad::where('id', $novItem['id'])
                        ->where('modulacion_id', $modulacion->id)
                        ->update($campos);
                } else {
                    ModulacionNovedad::create(array_merge($campos, [
                        'modulacion_id'  => $modulacion->id,
                        'colaborador_id' => $novItem['colaborador_id'] ?? null,
                        'cedula'         => $novItem['cedula'] ?? null,
                        'nombres'        => $novItem['nombres'] ?? null,
                        'cargo'          => $novItem['cargo'] ?? null,
                    ]));
                }
            }

            return $modulacion;
        });
    }

    public function storeBatch(
        Request $request,
        ModulacionUbicacionesService $ubicaciones,
        ModulacionTripulacionService $tripulacionService,
    ): RedirectResponse
    {
        $this->ensureFijoColumnExists();
        $this->prepararCentroDelRequest($request);

        $validated = $request->validate(array_merge($this->reglasPlaneacion(), [
            'read_only' => 'nullable|boolean',
            'readOnly'  => 'nullable|boolean',
        ]), $this->mensajesPlaneacion());

        $centro = $validated['centro'];

        if ($error = $this->validarReglasDePlaneacion($validated, $centro)) {
            return redirect()->back()->withErrors(['rutas' => $error]);
        }

        $modulacion = $this->persistirPlaneacion($request, $validated, $centro, $ubicaciones, $tripulacionService);

        $readOnly = $request->has('read_only')
            ? $request->boolean('read_only')
            : ($request->has('readOnly') ? $request->boolean('readOnly') : true);

        $redirectParams = ['fecha' => $modulacion->fecha, 'centro' => $centro];
        if ($readOnly) {
            $redirectParams['readOnly'] = 'true';
        }

        return redirect()
            ->route('reparto.modulacion.index', $redirectParams)
            ->with('success', 'Planeación de ruta guardada exitosamente.');
    }

    /**
     * Guardar la planeación de ruta vía AJAX (auto-guardado).
     *
     * Reutiliza la misma lógica de storeBatch pero devuelve JSON
     * para que el frontend pueda guardar cada viaje sin recargar la página,
     * evitando pérdida de datos si se recarga el navegador.
     */
    public function storeBatchApi(
        Request $request,
        ModulacionUbicacionesService $ubicaciones,
        ModulacionTripulacionService $tripulacionService,
    ): JsonResponse
    {
        $this->ensureFijoColumnExists();
        $this->prepararCentroDelRequest($request);

        $validated = $request->validate($this->reglasPlaneacion(), $this->mensajesPlaneacion());

        $centro = $validated['centro'];

        if ($error = $this->validarReglasDePlaneacion($validated, $centro)) {
            return response()->json(['message' => $error], 422);
        }

        $modulacion = $this->persistirPlaneacion($request, $validated, $centro, $ubicaciones, $tripulacionService);
        $modulacion->load(['items', 'novedades']);

        return response()->json([
            'success'       => true,
            'message'       => 'Planeación guardada exitosamente.',
            'modulacion_id' => $modulacion->id,
            'modulacion'    => $modulacion,
        ]);
    }

    /* ======================================================================
     |  ELIMINACIONES
     * ====================================================================== */

    public function destroyItem(Request $request, int $id): RedirectResponse
    {
        // Se valida y arma el redirect ANTES de borrar, conservando el centro de la planeación
        $redirect = $this->redirectAfterDeletion($request, $this->centroDeItem($id));

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
        $redirect = $this->redirectAfterDeletion($request, $this->centroDeItem($id));

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

    /** Centro (UC/UD) de la planeación a la que pertenece un item. */
    private function centroDeItem(int $itemId): ?string
    {
        $modulacionId = ModulacionItem::whereKey($itemId)->value('modulacion_id');

        return $modulacionId
            ? $this->normalizarCentro(Modulacion::whereKey($modulacionId)->value('centro'))
            : null;
    }

    /**
     * Redirect posterior a un borrado. Siempre conserva el centro:
     * primero el enviado por el front (return_centro), luego el de la planeación.
     */
    private function redirectAfterDeletion(Request $request, ?string $centroModulacion = null): RedirectResponse
    {
        $validated = $request->validate([
            'return_fecha' => ['nullable', 'date_format:Y-m-d'],
            'return_read_only' => ['nullable', 'boolean'],
            'return_centro' => ['nullable', 'string', 'max:10'],
        ]);

        if (empty($validated['return_fecha'])) {
            return redirect()->back();
        }

        $parameters = ['fecha' => $validated['return_fecha']];

        $centro = $this->normalizarCentro($validated['return_centro'] ?? null) ?? $centroModulacion;
        if ($centro) {
            $parameters['centro'] = $centro;
        }
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

    /* ======================================================================
     |  NOVEDADES
     * ====================================================================== */

    public function storeNovedad(Request $request): RedirectResponse
    {
        $this->ensureFijoColumnExists();
        $this->prepararCentroDelRequest($request);

        $validated = $request->validate([
            'fecha' => 'required|string',
            'centro' => 'required|string|in:UC,UD',
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
        ], $this->mensajesPlaneacion());

        $centro = $validated['centro'];

        // La novedad se asocia a la planeación (fecha, centro) — nunca a la de otro centro
        $modulacion = Modulacion::firstOrCreate(
            ['fecha' => $validated['fecha'], 'centro' => $centro],
            ['ud_programado_por' => $request->user()?->name, 'user_id' => $request->user()?->id]
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
        $novedad = ModulacionNovedad::with('modulacion')->findOrFail($id);

        // Si era fijo, quitar el fijo en cascada en TODAS las planeaciones del mismo centro
        // para que sincronizarFijosAnteriores no lo vuelva a propagar
        if ($novedad->fijo || $novedad->fijo_rescate || $novedad->fijo_taller) {
            $centro = $novedad->modulacion?->centro;

            $queryFijosAnteriores = ModulacionNovedad::whereHas('modulacion', function ($q) use ($centro) {
                    if ($centro) {
                        $q->where('centro', $centro);
                    }
                })
                ->where('id', '!=', $id)
                ->where(function ($q) use ($novedad) {
                    if ($novedad->colaborador_id) {
                        $q->where('colaborador_id', $novedad->colaborador_id);
                    } else {
                        $q->where('cedula', $novedad->cedula);
                    }
                })
                ->where(fn ($q) => $q->where('fijo', true)->orWhere('fijo_rescate', true)->orWhere('fijo_taller', true));

            $queryFijosAnteriores->update([
                'fijo'         => false,
                'fijo_rescate' => false,
                'fijo_taller'  => false,
            ]);
        }

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

    /* ======================================================================
     |  ÚLTIMA RUTA POR PLACA
     * ====================================================================== */

    /**
     * Devuelve los datos de la última ruta registrada para una placa (fecha anterior disponible),
     * excluyendo la fecha actual y SOLO dentro del centro indicado.
     */
    public function ultimaRutaPlaca(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'placa'  => 'required|string|max:50',
            'fecha'  => 'nullable|string|max:20',
            'centro' => 'nullable|string|max:10',
        ]);

        $placa       = strtoupper(trim($validated['placa']));
        $fechaActual = $validated['fecha'] ?? date('Y-m-d');
        $centro      = $this->normalizarCentro($validated['centro'] ?? null);

        // Sin centro válido no se busca: evitaría traer datos del otro centro
        if (! $centro) {
            return response()->json(['found' => false]);
        }

        $item = ModulacionItem::join('modulaciones', 'modulaciones.id', '=', 'modulacion_items.modulacion_id')
            ->whereNull('modulaciones.deleted_at')
            ->whereDate('modulaciones.fecha', '<', $fechaActual)
            ->where('modulaciones.centro', $centro)
            ->where('modulacion_items.placa', $placa)
            ->orderByDesc('modulaciones.fecha')
            ->select('modulacion_items.*', 'modulaciones.fecha as fecha_modulacion')
            ->first();

        if (! $item) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found'           => true,
            'fecha_origen'    => $item->fecha_modulacion,
            'doc_tras'        => $item->doc_tras,
            'cargo'           => $item->cargo,
            'placa_adicional' => $item->placa_adicional,
            'tripulacion'     => is_string($item->tripulacion) ? json_decode($item->tripulacion, true) ?? [] : ($item->tripulacion ?? []),
            'viajes'          => is_string($item->viajes) ? json_decode($item->viajes, true) ?? [] : ($item->viajes ?? []),
        ]);
    }
}