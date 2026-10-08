<?php

namespace App\Http\Controllers\Seguridad;

use App\Exports\Seguridad\PruebasExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seguridad\StorePruebaAlcoholemiaRequest;
use App\Models\GeovictoriaAsistencia;
use App\Models\Seguridad\Alcoholimetro;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\PruebaAlcoholemia;
use App\Models\Seguridad\PruebaAlcoholemiaRequisito;
use App\Services\Seguridad\QrCodeGenerator;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

use App\Services\Seguridad\CoberturaPlaneacionService;

class PruebaAlcoholemiaController extends Controller
{
    public function index(Request $request, CoberturaPlaneacionService $coberturaService): Response
    {
        $filtros = $this->filtrosDesdeRequest($request);


        $fechaInput = $request->string('fecha')->trim()->toString();
        $fechaConsulta = $filtros['fecha_desde'] ?: ($fechaInput ?: date('Y-m-d'));

        $cobertura = $coberturaService->obtenerResumenCobertura(
            $filtros['fecha_desde'] ?: null,
            $filtros['fecha_hasta'] ?: null
        );
        $this->agregarHorasMarcacionPendientes($cobertura);

        $pruebas = $this->filtrarPruebas($request)
            ->latest('fecha_hora')
            ->paginate(15)
            ->withQueryString();
        $this->agregarTipoRequeridoPruebas($pruebas->getCollection());

        return Inertia::render('seguridad/pruebas/index', [
            'pruebas' => $pruebas,
            'cobertura' => $cobertura,
            'fechaConsulta' => $fechaConsulta,
            'filters' => array_merge($filtros, ['fecha' => $fechaConsulta]),
        ]);
    }

    private function agregarHorasMarcacionPendientes(array &$cobertura): void
    {
        $pendientes = collect($cobertura['pendientes_pre_ruta'])
            ->concat($cobertura['pendientes_post_ruta'])
            ->concat($cobertura['pendientes_otras']);
        $fechas = $pendientes->pluck('fecha')->filter()->unique()->values();
        $cedulas = $pendientes->pluck('cedula')->filter()->map(fn ($cedula) => $this->normalizarIdentificador((string) $cedula))->unique()->values();

        if ($fechas->isEmpty() || $cedulas->isEmpty()) {
            foreach (['pendientes_pre_ruta', 'pendientes_post_ruta', 'pendientes_otras'] as $tipo) {
                $cobertura[$tipo] = array_map(
                    fn (array $item) => [
                        ...$item,
                        'fecha_geovictoria' => null,
                        'entrada_geovictoria' => null,
                        'salida_geovictoria' => null,
                    ],
                    $cobertura[$tipo]
                );
            }

            return;
        }

        $asistencias = GeovictoriaAsistencia::query()
            ->whereDate('fecha', '<=', $fechas->max())
            ->where(function ($query) use ($cedulas) {
                $query->whereIn('identificador', $cedulas)
                    ->orWhereRaw(
                        "UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(identificador), '.', ''), '-', ''), ' ', ''), '/', ''), ',', '')) IN (" . $cedulas->map(fn () => '?')->implode(',') . ')',
                        $cedulas->all()
                    );
            })
            ->orderByDesc('fecha')
            ->get(['identificador', 'fecha', 'entrada', 'salida'])
            ->groupBy(fn (GeovictoriaAsistencia $asistencia) => $this->normalizarIdentificador($asistencia->identificador));

        foreach (['pendientes_pre_ruta', 'pendientes_post_ruta', 'pendientes_otras'] as $tipo) {
            $cobertura[$tipo] = array_map(function (array $item) use ($asistencias): array {
                $cedula = $this->normalizarIdentificador((string) ($item['cedula'] ?? ''));
                $fechaPlaneada = $item['fecha'] ?? '';
                $asistencia = $asistencias->get($cedula, collect())
                    ->first(fn (GeovictoriaAsistencia $registro) => $registro->fecha->format('Y-m-d') <= $fechaPlaneada);
                $item['fecha_geovictoria'] = $asistencia?->fecha->format('Y-m-d');
                $item['entrada_geovictoria'] = $asistencia?->entrada;
                $item['salida_geovictoria'] = $asistencia?->salida;

                return $item;
            }, $cobertura[$tipo]);
        }
    }

    private function normalizarIdentificador(string $identificador): string
    {
        return strtoupper((string) preg_replace('/[^a-zA-Z0-9]/', '', trim($identificador)));
    }

    private function agregarTipoRequeridoPruebas(Collection $pruebas): void
    {
        $colaboradorIds = $pruebas->pluck('colaborador_id')->filter()->unique()->values();
        $fechas = $pruebas->map(fn (PruebaAlcoholemia $prueba) => $prueba->fecha_hora?->toDateString())
            ->filter()
            ->unique()
            ->values();

        $requisitos = $colaboradorIds->isEmpty() || $fechas->isEmpty()
            ? collect()
            : PruebaAlcoholemiaRequisito::query()
                ->whereIn('colaborador_id', $colaboradorIds)
                ->whereIn('fecha', $fechas)
                ->get()
                ->keyBy(fn (PruebaAlcoholemiaRequisito $requisito) => $requisito->fecha->format('Y-m-d') . '_id_' . $requisito->colaborador_id);

        foreach ($pruebas as $prueba) {
            $fecha = $prueba->fecha_hora?->toDateString();
            $requisitoKey = $fecha . '_id_' . $prueba->colaborador_id;
            $prueba->setAttribute('fecha_prueba', $fecha);
            $prueba->setAttribute(
                'tipo_prueba_planeado',
                $requisitos->get($requisitoKey)?->tipo
            );
        }
    }

    public function actualizarTipoPlaneacion(
        Request $request,
        CoberturaPlaneacionService $coberturaService,
        int $colaborador,
        string $fecha
    ): RedirectResponse {
        $validated = $request->validate([
            'tipo' => ['nullable', 'in:ruta,jl,segundo_viaje,movilizador,administrativo'],
        ]);
        $planeacion = $coberturaService->resolverPlaneacionRuta($colaborador, $fecha);
        abort_unless($planeacion['pertenece_planeacion'], 404, 'El colaborador no pertenece a la planeación de esa fecha.');

        $nuevoTipo = empty($validated['tipo']) ? null : $validated['tipo'];

        if (empty($nuevoTipo)) {
            PruebaAlcoholemiaRequisito::query()
                ->where('colaborador_id', $colaborador)
                ->whereDate('fecha', $fecha)
                ->delete();
        } else {
            PruebaAlcoholemiaRequisito::query()->updateOrCreate(
                ['colaborador_id' => $colaborador, 'fecha' => $fecha],
                ['tipo' => $nuevoTipo]
            );
        }

        $tipoFinal = $nuevoTipo ?? 'pre_ruta';
        PruebaAlcoholemia::query()
            ->where('colaborador_id', $colaborador)
            ->whereDate('fecha_hora', $fecha)
            ->where('estado', 'programada')
            ->update(['tipo' => $tipoFinal]);

        return back()->with('success', 'Tipo de prueba requerido actualizado.');
    }

    public function create(Request $request): Response
    {
        $dispositivosDisponibles = Alcoholimetro::query()
            ->where('estado', 'Disponible')
            ->orderBy('codigo')
            ->get(['id', 'codigo', 'valor_min', 'valor_max']);

        // Precarga el dispositivo más frecuentemente usado en pruebas realizadas
        $dispositivoDefaultId = PruebaAlcoholemia::query()
            ->whereNotNull('alcoholimetro_id')
            ->where('estado', 'realizada')
            ->select('alcoholimetro_id', DB::raw('COUNT(*) as total'))
            ->groupBy('alcoholimetro_id')
            ->orderByDesc('total')
            ->value('alcoholimetro_id');

        // Si el más usado no está disponible actualmente, elegir el primero disponible
        if ($dispositivoDefaultId && !$dispositivosDisponibles->contains('id', $dispositivoDefaultId)) {
            $dispositivoDefaultId = $dispositivosDisponibles->first()?->id;
        }

        return Inertia::render('seguridad/pruebas/create', [
            'colaboradores' => Colaborador::query()
                ->completos()
                ->where('is_active', true)
                ->orderBy('nombres')
                ->get(['id', 'nombres', 'apellidos', 'cedula', 'turno', 'cargo']),
            'dispositivosDisponibles' => $dispositivosDisponibles,
            'dispositivoDefaultId'    => $dispositivoDefaultId,
            'preselectedColaboradorId' => $request->input('colaborador_id') ? (int) $request->input('colaborador_id') : null,
            'preselectedFecha' => $request->input('fecha') ?: null,
            'preselectedRutaAsignada' => $request->input('ruta_asignada') ?: null,
            'preselectedTipo' => in_array($request->input('tipo'), [
                'pre_ruta', 'ruta', 'post_ruta', 'jl', 'segundo_viaje', 'movilizador', 'administrativo',
            ], true)
                ? $request->input('tipo')
                : null,
        ]);
    }

    public function store(StorePruebaAlcoholemiaRequest $request): RedirectResponse
    {
        $esProgramacion = $request->boolean('es_programacion');

        $prueba = PruebaAlcoholemia::create([
            'colaborador_id' => $request->input('colaborador_id'),
            'tipo' => $request->input('tipo'),
            'alcoholimetro_id' => $esProgramacion ? null : $request->input('alcoholimetro_id'),
            'resultado' => $esProgramacion ? null : $request->input('resultado'),
            'consentimiento_aceptado' => ! $esProgramacion && $request->boolean('consentimiento_aceptado'),
            'consentimiento_en' => $esProgramacion ? null : Carbon::now(),
            'evidencia_path' => null,
            'firma_path' => $request->file('firma')?->store('firmas', 'public'),
            'observaciones' => $request->input('observaciones'),
            'responsable_id' => $request->user()->id,
            'fecha_hora' => $esProgramacion ? $request->date('programada_en') : ($request->filled('fecha_hora') ? Carbon::parse($request->input('fecha_hora')) : Carbon::now()),
            'programada_en' => $esProgramacion ? $request->date('programada_en') : null,
            'estado' => $esProgramacion ? 'programada' : 'realizada',
        ]);

        // Guardar evidencias principales
        foreach ($request->file('evidencia', []) as $archivo) {
            $prueba->evidencias()->create(['path' => $archivo->store('evidencias', 'public')]);
        }

        // Guardar evidencias adicionales
        foreach ($request->file('evidencias', []) as $archivo) {
            $prueba->evidencias()->create(['path' => $archivo->store('evidencias', 'public')]);
        }

        return to_route('seguridad.pruebas.index')->with(
            'status',
            $esProgramacion ? 'Prueba programada correctamente.' : 'Prueba registrada correctamente.'
        );
    }

    public function edit(PruebaAlcoholemia $prueba): Response
    {
        $dispositivosDisponibles = Alcoholimetro::query()
            ->where(function ($query) use ($prueba) {
                $query->where('estado', 'Disponible');

                if ($prueba->alcoholimetro_id !== null) {
                    $query->orWhere('id', $prueba->alcoholimetro_id);
                }
            })
            ->orderBy('codigo')
            ->get(['id', 'codigo', 'valor_min', 'valor_max']);

        $pruebaData = $prueba->load(['colaborador', 'alcoholimetro', 'responsable'])->toArray();

        // Formatear fecha_hora para input datetime-local
        if ($prueba->fecha_hora) {
            $pruebaData['fecha_hora'] = $prueba->fecha_hora->format('Y-m-d\TH:i');
        }

        // Agregar rutas de evidencias con /storage/
        if ($prueba->evidencia_path) {
            $pruebaData['evidencia_path'] = '/storage/'.$prueba->evidencia_path;
        }
        $pruebaData['evidencias_paths'] = $prueba->evidencias()->pluck('path')->map(fn ($path) => '/storage/'.$path)->toArray();

        return Inertia::render('seguridad/pruebas/create', [
            'colaboradores' => Colaborador::query()
                ->completos()
                ->where('is_active', true)
                ->orderBy('nombres')
                ->get(['id', 'nombres', 'apellidos', 'cedula', 'turno', 'cargo']),
            'dispositivosDisponibles' => $dispositivosDisponibles,
            'prueba' => $pruebaData,
        ]);
    }

    public function update(StorePruebaAlcoholemiaRequest $request, PruebaAlcoholemia $prueba): RedirectResponse
    {
        $esProgramacion = $request->boolean('es_programacion');

        $prueba->fill([
            'colaborador_id' => $request->input('colaborador_id'),
            'tipo' => $request->input('tipo'),
            'alcoholimetro_id' => $esProgramacion ? null : $request->input('alcoholimetro_id'),
            'resultado' => $esProgramacion ? null : $request->input('resultado'),
            'consentimiento_aceptado' => ! $esProgramacion && $request->boolean('consentimiento_aceptado'),
            'consentimiento_en' => $esProgramacion ? null : ($prueba->consentimiento_en ?? Carbon::now()),
            'observaciones' => $request->input('observaciones'),
            'fecha_hora' => $esProgramacion ? $request->date('programada_en') : ($request->filled('fecha_hora') ? Carbon::parse($request->input('fecha_hora')) : ($prueba->fecha_hora ?? Carbon::now())),
            'programada_en' => $esProgramacion ? $request->date('programada_en') : null,
            'estado' => $esProgramacion ? 'programada' : 'realizada',
        ]);

        // Eliminar evidencias marcadas para eliminaciÃ³n
        $deletedIndices = $request->input('deleted_evidencias_indices', []);
        if (! empty($deletedIndices)) {
            $evidencias = $prueba->evidencias()->get();
            foreach ($deletedIndices as $index) {
                if (isset($evidencias[$index])) {
                    $evidencia = $evidencias[$index];
                    // Eliminar archivo del almacenamiento
                    Storage::disk('public')->delete($evidencia->path);
                    // Eliminar registro de BD
                    $evidencia->delete();
                }
            }
        }

        // Agregar nuevas evidencias principales
        if ($request->file('evidencia')) {
            foreach ($request->file('evidencia', []) as $archivo) {
                $prueba->evidencias()->create(['path' => $archivo->store('evidencias', 'public')]);
            }
        }

        // Agregar nuevas evidencias adicionales
        if ($request->file('evidencias')) {
            foreach ($request->file('evidencias', []) as $archivo) {
                $prueba->evidencias()->create(['path' => $archivo->store('evidencias', 'public')]);
            }
        }

        if ($request->file('firma')) {
            $prueba->firma_path = $request->file('firma')->store('firmas', 'public');
        }

        $prueba->save();

        return to_route('seguridad.pruebas.index')->with(
            'status',
            $esProgramacion ? 'Prueba programada actualizada correctamente.' : 'Prueba actualizada correctamente.'
        );
    }

    public function show(PruebaAlcoholemia $prueba, QrCodeGenerator $qrCodeGenerator): Response
    {
        $prueba->load(['colaborador', 'alcoholimetro', 'responsable:id,name', 'evidencias']);

        $qrSvg = $prueba->qr_token
            ? $qrCodeGenerator->generateSvg(route('seguridad.verificacion', [$prueba->id, $prueba->qr_token]))
            : null;

        return Inertia::render('seguridad/pruebas/show', [
            'prueba' => [
                ...$prueba->toArray(),
                'evaluacion' => $prueba->evaluacion(),
            ],
            'qrSvg' => $qrSvg,
            'ubicacion' => config('app.ubicacion_pruebas', 'Pasto, Nariño · Colombia'),
        ]);
    }

    public function calendario(Request $request): Response
    {
        $mes = $request->string('mes')->trim()->toString();
        $inicioMes = $mes !== '' ? Carbon::createFromFormat('Y-m', $mes)->startOfMonth() : Carbon::now()->startOfMonth();

        $pruebas = PruebaAlcoholemia::query()
            ->with('colaborador:id,nombres,apellidos')
            ->where('estado', 'programada')
            ->whereBetween('programada_en', [$inicioMes->clone()->startOfDay(), $inicioMes->clone()->endOfMonth()->endOfDay()])
            ->orderBy('programada_en')
            ->get()
            ->groupBy(fn (PruebaAlcoholemia $prueba) => $prueba->programada_en->toDateString())
            ->map(fn ($grupo) => $grupo->map(fn (PruebaAlcoholemia $prueba) => [
                'id' => $prueba->id,
                'hora' => $prueba->programada_en->format('H:i'),
                'tipo' => $prueba->tipo,
                'colaborador' => $prueba->colaborador?->nombre_completo,
            ]));

        return Inertia::render('seguridad/pruebas/calendario', [
            'mes' => $inicioMes->format('Y-m'),
            'pruebasPorDia' => $pruebas,
        ]);
    }

    public function exportarPdf(Request $request)
    {
        ini_set('memory_limit', '512M');
        set_time_limit(180);

        $pruebas = $this->filtrarPruebas($request)->latest('fecha_hora')->get();

        return Pdf::loadView('seguridad.pruebas-pdf', ['pruebas' => $pruebas])
            ->setPaper('a4', 'landscape')
            ->download('pruebas-alcoholemia-'.now()->format('Y-m-d').'.pdf');
    }

    public function exportarExcel(Request $request)
    {
        ini_set('memory_limit', '512M');
        set_time_limit(180);

        $pruebas = $this->filtrarPruebas($request)->latest('fecha_hora')->get();

        return Excel::download(new PruebasExport($pruebas), 'pruebas-alcoholemia-'.now()->format('Y-m-d').'.xlsx');
    }

    /**
     * HU025: filtros compartidos por el listado y ambas exportaciones (HU026).
     */
    private function filtrarPruebas(Request $request): Builder
    {
        $filtros = $this->filtrosDesdeRequest($request);

        return PruebaAlcoholemia::query()
            ->with(['colaborador:id,nombres,apellidos,cedula', 'alcoholimetro:id,codigo', 'responsable:id,name', 'evidencias'])
            ->when($filtros['estado'] !== '', fn ($query) => $query->where('estado', $filtros['estado']))
            ->when($filtros['tipo'] !== '', fn ($query) => $query->where('tipo', $filtros['tipo']))
            ->when($filtros['origen_planeacion'] === 'planeadas', fn ($query) => $query->where('pertenece_planeacion', true))
            ->when($filtros['origen_planeacion'] === 'adicionales', fn ($query) => $query->where('pertenece_planeacion', false))
            ->when($filtros['fecha_desde'] !== '', fn ($query) => $query->whereDate('fecha_hora', '>=', $filtros['fecha_desde']))
            ->when($filtros['fecha_hasta'] !== '', fn ($query) => $query->whereDate('fecha_hora', '<=', $filtros['fecha_hasta']))
            ->when($filtros['colaborador'] !== '', function ($query) use ($filtros) {
                $query->whereHas('colaborador', function ($query) use ($filtros) {
                    $query->where('nombres', 'like', "%{$filtros['colaborador']}%")
                        ->orWhere('apellidos', 'like', "%{$filtros['colaborador']}%")
                        ->orWhere('cedula', 'like', "%{$filtros['colaborador']}%");
                });
            })
            ->when($filtros['resultado'] === 'positivo', fn ($query) => $query->where('es_positivo', true))
            ->when($filtros['resultado'] === 'negativo', fn ($query) => $query->where('es_positivo', false)->where('estado', 'realizada'));
    }

    /**
     * Devuelve la URL de la última firma registrada para un colaborador.
     * GET /modules/seguridad/pruebas/ultima-firma/{colaborador}
     */
    public function ultimaFirma(Colaborador $colaborador): JsonResponse
    {
        $ultima = PruebaAlcoholemia::query()
            ->where('colaborador_id', $colaborador->id)
            ->whereNotNull('firma_path')
            ->latest('fecha_hora')
            ->first(['firma_path']);

        return response()->json([
            'firma_url' => $ultima ? '/storage/' . $ultima->firma_path : null,
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function filtrosDesdeRequest(Request $request): array
    {
        return [
            'estado' => $request->string('estado')->trim()->toString(),
            'tipo' => $request->string('tipo')->trim()->toString(),
            'origen_planeacion' => $request->string('origen_planeacion')->trim()->toString(),
            'fecha_desde' => $request->string('fecha_desde')->trim()->toString(),
            'fecha_hasta' => $request->string('fecha_hasta')->trim()->toString(),
            'colaborador' => $request->string('colaborador')->trim()->toString(),
            'resultado' => $request->string('resultado')->trim()->toString(),
        ];
    }
}
