<?php

namespace App\Http\Controllers\Flota;

use App\Exports\Flota\ExtintorInspeccionExport;
use App\Exports\Flota\ExtintoresTablaExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Flota\GuardarExtintorRequest;
use App\Http\Requests\Flota\GuardarInspeccionRequest;
use App\Models\Flota\Extintor;
use App\Models\Flota\ExtintorAsignacion;
use App\Models\Flota\ExtintorColumna;
use App\Models\Flota\ExtintorInspeccion;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use App\Services\Flota\ExtintorService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ExtintorController extends Controller
{
    private const DIR_REFERENCIAS = 'images/extintores';

    /** Campos que mandan desde la última inspección; si no hay, se usa el extintor. */
    private const CAMPOS_VIGENTES = [
        'condicion', 'agente_impulsor', 'parte_mantenimiento',
        'senalizacion', 'demarcacion', 'funcionamiento', 'acceso',
    ];

    public function __construct(private readonly ExtintorService $service)
    {
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function flash(string $message, string $type = 'success'): array
    {
        return ['message' => $message, 'type' => $type];
    }

    /** Evita manipular registros de otro extintor cambiando el ID en la URL. */
    private function pertenece(int $extintorIdDelRegistro, Extintor $extintor): void
    {
        abort_unless($extintorIdDelRegistro === $extintor->id, 404);
    }

    private function urlPublica(?string $path): ?string
    {
        return filled($path) ? Storage::disk('public')->url($path) : null;
    }

    private function placas(): array
    {
        return Vehiculo::where('is_active', true)->orderBy('placa')->pluck('placa')->all();
    }

    private function columnas(): array
    {
        return ExtintorColumna::ordenadas()->orderBy('nombre')->pluck('nombre')->all();
    }

    private function colaboradores(): array
    {
        return Colaborador::select(['id', 'nombres', 'apellidos', 'cargo'])
            ->where('is_active', true)
            ->orderBy('nombres')
            ->get()
            ->map(fn ($c) => [
                'id'     => $c->id,
                'nombre' => trim("{$c->nombres} {$c->apellidos}"),
                'cargo'  => $c->cargo ?? '',
            ])
            ->all();
    }

    private function formatearExtintor(Extintor $e): array
    {
        $activa     = $e->asignacionActiva;
        $inspeccion = $e->ultimaInspeccion;

        $vigentes = collect(self::CAMPOS_VIGENTES)
            ->mapWithKeys(fn (string $campo) => [$campo => $inspeccion?->{$campo} ?? $e->{$campo}])
            ->all();

        return [
            'id'                      => $e->id,
            'numero_serie'            => $e->numero_serie,
            'qr_token'                => $e->qr_token ?: $e->numero_serie,
            'qr_url'                  => url("/modules/flota/extintores/{$e->id}"),
            'tipo_agente'             => $e->tipo_agente,
            'capacidad_kg'            => $e->capacidad_kg,
            'marca'                   => $e->marca,
            'fecha_fabricacion'       => $e->fecha_fabricacion?->format('Y-m-d'),
            'fecha_vencimiento'       => $e->fecha_vencimiento?->format('Y-m-d'),
            'fecha_creacion'          => $e->created_at?->format('Y-m-d'),
            'observaciones'           => $e->observaciones,
            'vencido'                 => $e->vencido,
            'ultima_inspeccion_fecha' => $inspeccion?->fecha_inspeccion?->format('Y-m-d'),
            'ultima_recarga'          => Carbon::make($e->getAttribute('inspecciones_max_fecha_recarga'))?->format('Y-m-d'),
            'placa_actual'            => $activa?->placa,
            'asignacion_activa_id'    => $activa?->id,
            'fecha_colocacion_actual' => $activa?->fecha_colocacion?->format('Y-m-d'),
            'foto_url'                => $e->foto_url,
        ] + $vigentes;
    }

    private function formatearAsignacion(ExtintorAsignacion $a): array
    {
        return [
            'id'                       => $a->id,
            'extintor_id'              => $a->extintor_id,
            'placa'                    => $a->placa,
            'fecha_colocacion'         => $a->fecha_colocacion?->format('Y-m-d'),
            'fecha_retiro'             => $a->fecha_retiro?->format('Y-m-d'),
            'activo'                   => $a->activo,
            'responsable_colocacion'   => $a->responsable_colocacion,
            'responsable_retiro'       => $a->responsable_retiro,
            'observaciones_colocacion' => $a->observaciones_colocacion,
            'observaciones_retiro'     => $a->observaciones_retiro,
            'checklist_colocacion'     => $a->checklist_colocacion ?? [],
            'checklist_retiro'         => $a->checklist_retiro ?? [],
            'coloco_nombre'            => $a->usuarioColoco?->name,
            'retiro_nombre'            => $a->usuarioRetiro?->name,
        ];
    }

    private function formatearInspeccion(ExtintorInspeccion $i): array
    {
        return $i->only([
            'id', 'extintor_id', 'tipo', 'tipo_label', 'responsable_inicio',
            'responsable_periodico', 'condicion', 'tipo_agente', 'agente_impulsor',
            'capacidad_kg', 'marca', 'parte_mantenimiento', 'senalizacion',
            'demarcacion', 'funcionamiento', 'acceso', 'observaciones_inspeccion',
            'observaciones_recarga',
        ]) + [
            'fecha_inspeccion'           => $i->fecha_inspeccion?->format('Y-m-d'),
            'partes_mantenimiento_lista' => $this->service->partesComoLista($i->parte_mantenimiento),
            'incluye_recarga'            => (bool) $i->incluye_recarga,
            'fecha_recarga'              => $i->fecha_recarga?->format('Y-m-d'),
            'fecha_proxima_recarga'      => $i->fecha_proxima_recarga?->format('Y-m-d'),
            'firma_url'                  => $this->urlPublica($i->firma_path),
            'creador_nombre'             => $i->creador?->name,
            'evidencias'                 => $i->evidencias
                ->map(fn ($e) => $e->only(['id', 'url', 'nombre_original', 'tipo_mime', 'es_pdf']))
                ->values()
                ->all(),
        ];
    }

    // ── index / show ──────────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $extintores = Extintor::with(['asignacionActiva', 'ultimaInspeccion'])
            ->withMax(['inspecciones' => fn ($q) => $q->where('incluye_recarga', true)], 'fecha_recarga')
            ->when($request->input('serie'), fn ($q, $v) => $q->where('numero_serie', 'like', '%' . addcslashes($v, '%_\\') . '%'))
            ->when($request->input('placa'), fn ($q, $v) => $q->whereHas('asignacionActiva', fn ($s) => $s->where('placa', $v)))
            ->orderBy('numero_serie')
            ->paginate(25)
            ->withQueryString()
            ->through(fn ($e) => $this->formatearExtintor($e));

        return Inertia::render('flota/extintores/index', [
            'extintores'          => $extintores,
            'placas'              => $this->placas(),
            'columnas_extra'      => $this->columnas(),
            'filters'             => $request->only(['serie', 'placa']),
            'imagenes_referencia' => $this->obtenerImagenesReferencia(),
        ]);
    }

    public function show(Extintor $extintor): Response
    {
        $extintor->load([
            'asignaciones.usuarioColoco',
            'asignaciones.usuarioRetiro',
            'inspecciones.evidencias',
            'inspecciones.creador',
            'asignacionActiva',
            'ultimaInspeccion',
        ])->loadMax(['inspecciones' => fn ($q) => $q->where('incluye_recarga', true)], 'fecha_recarga');

        $datos                   = $this->formatearExtintor($extintor);
        $datos['ultima_recarga'] = $this->service->ultimaRecarga($extintor);

        $inspecciones = $extintor->inspecciones->map(fn ($i) => $this->formatearInspeccion($i))->values()->all();
        $tipo         = $this->service->tipoSiguienteInspeccion($extintor);
        $usuario      = trim(auth()->user()?->name ?? '');

        return Inertia::render('flota/extintores/show', [
            'extintor'                => $datos,
            'asignaciones'            => $extintor->asignaciones->map(fn ($a) => $this->formatearAsignacion($a))->values(),
            'inspecciones'            => $inspecciones,
            'tiene_inspeccion_inicio' => $tipo === ExtintorInspeccion::TIPO_PERIODICA,
            'tipo_inspeccion'         => $tipo,
            'ultima_recarga'          => $datos['ultima_recarga'],
            'inspeccion_defaults'     => $this->service->defaultsInspeccion($datos, $inspecciones[0] ?? null, $tipo, $usuario),
            'partes_mantenimiento'    => $this->service->catalogoPartes(),
            'historial'               => $this->service->historial($inspecciones, $datos),
            'columnas_extra'          => $this->columnas(),
            'placas'                  => $this->placas(),
            'colaboradores'           => $this->colaboradores(),
            'usuario_nombre'          => $usuario,
        ]);
    }

    // ── CRUD extintor ─────────────────────────────────────────────────────────

    public function store(GuardarExtintorRequest $request): RedirectResponse
    {
        // qr_token lo asigna el modelo (= numero_serie) al crear.
        $extintor = Extintor::create([
            ...$request->safe()->except(['foto', 'eliminar_foto', 'qr_token']),
            'user_id' => $request->user()?->id,
        ]);

        $request->when(
            $request->hasFile('foto'),
            fn () => $this->service->cambiarFoto($extintor, $request->file('foto'))
        );

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash("Extintor {$extintor->numero_serie} registrado."));
    }

    public function update(GuardarExtintorRequest $request, Extintor $extintor): RedirectResponse
    {
        // qr_token es inmutable: los QR ya impresos siguen funcionando aunque cambie la serie.
        $extintor->update($request->safe()->except(['foto', 'eliminar_foto', 'qr_token']));

        $request->when(
            $request->boolean('eliminar_foto'),
            fn () => $this->service->cambiarFoto($extintor, null)
        );
        $request->when(
            $request->hasFile('foto'),
            fn () => $this->service->cambiarFoto($extintor, $request->file('foto'))
        );

        return back()->with('status', $this->flash('Extintor actualizado.'));
    }

    public function destroy(Extintor $extintor): RedirectResponse
    {
        $id = $extintor->id;

        $extintor->forceDelete();

        // Foto, firmas y evidencias guardadas bajo extintores/{id}
        Storage::disk('public')->deleteDirectory("extintores/{$id}");

        return redirect()->route('flota.extintores.index')
            ->with('status', $this->flash('Extintor eliminado permanentemente.'));
    }

    // ── Asignaciones ──────────────────────────────────────────────────────────

    public function asignarVehiculo(Request $request, Extintor $extintor): RedirectResponse
    {
        $data = $request->validate([
            'placa'                    => ['required', 'string', 'max:20', Rule::exists(Vehiculo::class, 'placa')],
            'fecha_colocacion'         => ['required', 'date'],
            'responsable_colocacion'   => ['nullable', 'string', 'max:120'],
            'observaciones_colocacion' => ['nullable', 'string', 'max:1000'],
            'checklist_colocacion'     => ['nullable', 'array'],
            'checklist_colocacion.*'   => ['nullable', 'string', 'max:255'],
            'desasociar_previos'       => ['nullable', 'boolean'],
        ]);

        $this->service->asignar($extintor, $data, $request->user()?->id, $request->boolean('desasociar_previos'));

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash("Extintor asignado a la placa {$data['placa']}."));
    }

    public function retirarVehiculo(Request $request, Extintor $extintor): RedirectResponse
    {
        $asignacion = $extintor->asignacionActiva;

        throw_unless($asignacion, ValidationException::withMessages([
            'fecha_retiro' => 'El extintor no tiene una asignación activa.',
        ]));

        $data = $request->validate([
            'fecha_retiro'         => ['required', 'date', 'after_or_equal:' . $asignacion->fecha_colocacion->toDateString()],
            'responsable_retiro'   => ['nullable', 'string', 'max:120'],
            'observaciones_retiro' => ['nullable', 'string', 'max:1000'],
            'checklist_retiro'     => ['nullable', 'array'],
            'checklist_retiro.*'   => ['nullable', 'string', 'max:255'],
        ]);

        $this->service->retirar($asignacion, $data, $request->user()?->id);

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash('Retiro registrado correctamente.'));
    }

    public function updateAsignacion(Request $request, Extintor $extintor, ExtintorAsignacion $asignacion): RedirectResponse
    {
        $this->pertenece($asignacion->extintor_id, $extintor);

        $data = $request->validate([
            'placa'                    => ['required', 'string', 'max:20', Rule::exists(Vehiculo::class, 'placa')],
            'fecha_colocacion'         => ['required', 'date'],
            'fecha_retiro'             => ['nullable', 'date', 'after_or_equal:fecha_colocacion'],
            'responsable_colocacion'   => ['nullable', 'string', 'max:120'],
            'responsable_retiro'       => ['nullable', 'string', 'max:120'],
            'observaciones_colocacion' => ['nullable', 'string', 'max:1000'],
            'observaciones_retiro'     => ['nullable', 'string', 'max:1000'],
        ]);

        $this->service->actualizarAsignacion($asignacion, $data);

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash('Asignación actualizada.'));
    }

    public function destroyAsignacion(Extintor $extintor, ExtintorAsignacion $asignacion): RedirectResponse
    {
        $this->pertenece($asignacion->extintor_id, $extintor);

        $asignacion->delete();

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash('Asignación eliminada.'));
    }

    // ── Columnas extra ────────────────────────────────────────────────────────

    public function agregarColumna(Request $request): RedirectResponse
    {
        $nombre = trim($request->validate(['nombre' => ['required', 'string', 'max:120']])['nombre']);

        throw_if(
            ExtintorColumna::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->exists(),
            ValidationException::withMessages(['nombre' => "La columna «{$nombre}» ya existe."])
        );

        ExtintorColumna::create([
            'nombre' => $nombre,
            'orden'  => (ExtintorColumna::max('orden') ?? 0) + 1,
        ]);

        return back()->with('status', $this->flash("Columna «{$nombre}» agregada."));
    }

    public function eliminarColumna(Request $request): RedirectResponse
    {
        $nombre = $request->validate(['nombre' => ['required', 'string', 'max:120']])['nombre'];

        ExtintorColumna::where('nombre', $nombre)->delete();

        return back()->with('status', $this->flash("Columna «{$nombre}» eliminada."));
    }

    // ── Inspecciones ──────────────────────────────────────────────────────────

    public function storeInspeccion(GuardarInspeccionRequest $request, Extintor $extintor): RedirectResponse
    {
        $editId = $request->input('_edit_id');
        $editar = $editId ? $extintor->inspecciones()->findOrFail($editId) : null;

        $this->service->guardarInspeccion($extintor, $request->validated(), [
            'editar'              => $editar,
            'user_id'             => $request->user()?->id,
            'firma'               => $request->file('firma'),
            'usar_firma_guardada' => $request->boolean('usar_firma_guardada'),
            'evidencias'          => $request->file('evidencias', []),
        ]);

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash($editar ? 'Inspección actualizada correctamente.' : 'Inspección registrada correctamente.'));
    }

    public function destroyInspeccion(Extintor $extintor, ExtintorInspeccion $inspeccion): RedirectResponse
    {
        $this->pertenece($inspeccion->extintor_id, $extintor);

        $this->service->eliminarInspeccion($inspeccion);

        return redirect()->route('flota.extintores.show', $extintor)
            ->with('status', $this->flash('Inspección eliminada.'));
    }

    public function ultimaFirmaInspeccion(Request $request): JsonResponse
    {
        return response()->json([
            'firma_url' => $this->urlPublica($this->service->ultimaFirmaPath($request->user()?->id)),
        ]);
    }

    // ── Consultas auxiliares ──────────────────────────────────────────────────

    public function siguienteSerie(): JsonResponse
    {
        return response()->json(['serie' => $this->service->siguienteSerie()]);
    }

    public function redirigirPorSerie(string $numeroSerie): RedirectResponse
    {
        // Por token (estable) y, por compatibilidad, por número de serie.
        $extintor = Extintor::where('qr_token', $numeroSerie)->orWhere('numero_serie', $numeroSerie)->first();

        return $extintor
            ? redirect()->route('flota.extintores.show', $extintor)
            : redirect()->route('flota.extintores.index')
                ->with('status', $this->flash('No existe el extintor en nuestra base de datos.', 'error'));
    }

    public function extintoresPorPlaca(string $placa): JsonResponse
    {
        $extintores = Extintor::whereHas('asignacionActiva', fn ($q) => $q->where('placa', $placa))
            ->get()
            ->map(fn ($e) => $e->only(['id', 'numero_serie', 'tipo_agente', 'capacidad_kg', 'marca', 'foto_url']))
            ->values();

        return response()->json(['extintores' => $extintores]);
    }

    // ── Imágenes de referencia ────────────────────────────────────────────────

    public function subirImagenReferencia(Request $request): RedirectResponse
    {
        $request->validate([
            'numero' => ['required', 'in:1,2'],
            // Sin SVG: se sirve desde public/ y es riesgo de XSS.
            'imagen' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:10240'],
        ]);

        $numero = (int) $request->input('numero');
        $file   = $request->file('imagen');
        $ext    = strtolower($file->guessExtension() ?: 'png');
        $dir    = public_path(self::DIR_REFERENCIAS);

        File::ensureDirectoryExists($dir);
        $this->borrarReferencia($numero);
        $file->move($dir, "extintor-referencia-{$numero}.{$ext}");

        return back()->with('status', $this->flash("Imagen de referencia {$numero} actualizada exitosamente."));
    }

    public function eliminarImagenReferencia(Request $request): RedirectResponse
    {
        $numero = (int) $request->validate(['numero' => ['required', 'in:1,2']])['numero'];

        $this->borrarReferencia($numero);

        return back()->with('status', $this->flash("Imagen de referencia {$numero} eliminada exitosamente."));
    }

    private function borrarReferencia(int $numero): void
    {
        File::delete(File::glob(public_path(self::DIR_REFERENCIAS) . "/extintor-referencia-{$numero}.*"));
    }

    private function obtenerImagenesReferencia(): array
    {
        return collect([1, 2])->mapWithKeys(function (int $num) {
            $file = File::glob(public_path(self::DIR_REFERENCIAS) . "/extintor-referencia-{$num}.*")[0] ?? null;

            return ["ref_{$num}" => $file
                ? asset(self::DIR_REFERENCIAS . '/' . basename($file)) . '?v=' . filemtime($file)
                : null];
        })->all();
    }

    // ── Foto del extintor ─────────────────────────────────────────────────────

    public function subirFoto(Request $request, Extintor $extintor): RedirectResponse
    {
        $request->validate([
            'foto' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:10240'],
        ]);

        $this->service->cambiarFoto($extintor, $request->file('foto'));

        return back()->with('status', $this->flash('Foto del extintor actualizada.'));
    }

    public function eliminarFoto(Extintor $extintor): RedirectResponse
    {
        $this->service->cambiarFoto($extintor, null);

        return back()->with('status', $this->flash('Foto del extintor eliminada.'));
    }

    // ── Exportaciones ─────────────────────────────────────────────────────────

    public function exportarExcel(Extintor $extintor): BinaryFileResponse
    {
        $extintor->load('inspecciones', 'asignacionActiva');

        return Excel::download(
            new ExtintorInspeccionExport($extintor),
            "Inspecciones_{$extintor->numero_serie}_" . now()->format('Ymd') . '.xlsx'
        );
    }

    public function exportarTabla(): BinaryFileResponse
    {
        // Mismos datos (y misma precedencia) que muestra la tabla del index.
        $extintores = Extintor::with(['asignacionActiva', 'ultimaInspeccion'])
            ->withMax(['inspecciones' => fn ($q) => $q->where('incluye_recarga', true)], 'fecha_recarga')
            ->orderBy('numero_serie')
            ->get()
            ->map(fn ($e) => (object) Arr::only($this->formatearExtintor($e), [
                'numero_serie', 'condicion', 'tipo_agente', 'agente_impulsor', 'ultima_recarga',
                'parte_mantenimiento', 'senalizacion', 'demarcacion', 'funcionamiento',
                'acceso', 'placa_actual', 'observaciones',
            ]));

        return Excel::download(new ExtintoresTablaExport($extintores), 'Extintores_' . now()->format('Ymd') . '.xlsx');
    }
}