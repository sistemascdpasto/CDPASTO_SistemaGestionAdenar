<?php

namespace App\Http\Controllers\Flota;

use App\Exports\Flota\ExtintorInspeccionExport;
use App\Exports\Flota\ExtintoresTablaExport;
use App\Http\Controllers\Controller;
use App\Models\Flota\Extintor;
use App\Models\Flota\ExtintorAsignacion;
use App\Models\Flota\ExtintorColumna;
use App\Models\Flota\ExtintorInspeccion;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ExtintorController extends Controller
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private function placas(): array
    {
        return Vehiculo::where('is_active', true)
            ->orderBy('placa')
            ->pluck('placa')
            ->toArray();
    }

    private function columnas(): array
    {
        return ExtintorColumna::orderBy('orden')->orderBy('nombre')->pluck('nombre')->toArray();
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
            ->toArray();
    }

    private function formatearExtintor(Extintor $e): array
    {
        $activa     = $e->asignacionActiva;
        $inspeccion = $e->ultimaInspeccion;
        return [
            'id'                  => $e->id,
            'numero_serie'        => $e->numero_serie,
            'qr_token'            => $e->numero_serie,
            'qr_url'              => url("/modules/flota/extintores/{$e->id}"),
            'tipo_agente'         => $e->tipo_agente,
            'capacidad_kg'        => $e->capacidad_kg,
            'marca'               => $e->marca,
            'fecha_fabricacion'   => $e->fecha_fabricacion?->format('Y-m-d'),
            'fecha_vencimiento'   => $e->fecha_vencimiento?->format('Y-m-d'),
            'fecha_creacion'      => $e->created_at?->format('Y-m-d'),
            'observaciones'       => $e->observaciones,
            'vencido'             => $e->vencido,
            'condicion'           => $e->condicion ?? $inspeccion?->condicion,
            'agente_impulsor'     => $e->agente_impulsor ?? $inspeccion?->agente_impulsor,
            'parte_mantenimiento' => $e->parte_mantenimiento ?? $inspeccion?->parte_mantenimiento,
            'senalizacion'        => $e->senalizacion ?? $inspeccion?->senalizacion,
            'demarcacion'         => $e->demarcacion ?? $inspeccion?->demarcacion,
            'funcionamiento'      => $e->funcionamiento ?? $inspeccion?->funcionamiento,
            'acceso'              => $e->acceso ?? $inspeccion?->acceso,
            'ultima_inspeccion_fecha' => $inspeccion?->fecha_inspeccion?->format('Y-m-d'),
            'ultima_recarga'      => $e->inspecciones_max_fecha_recarga
                ? \Carbon\Carbon::parse($e->inspecciones_max_fecha_recarga)->format('Y-m-d')
                : null,
            'placa_actual'        => $activa?->placa,
            'asignacion_activa_id' => $activa?->id,
            'fecha_colocacion_actual' => $activa?->fecha_colocacion?->format('Y-m-d'),
            'foto_url'            => $e->foto_url,
        ];
    }

    private function formatearAsignacion(ExtintorAsignacion $a): array
    {
        return [
            'id'                      => $a->id,
            'extintor_id'             => $a->extintor_id,
            'placa'                   => $a->placa,
            'fecha_colocacion'        => $a->fecha_colocacion?->format('Y-m-d'),
            'fecha_retiro'            => $a->fecha_retiro?->format('Y-m-d'),
            'activo'                  => $a->activo,
            'responsable_colocacion'  => $a->responsable_colocacion,
            'responsable_retiro'      => $a->responsable_retiro,
            'observaciones_colocacion' => $a->observaciones_colocacion,
            'observaciones_retiro'    => $a->observaciones_retiro,
            'checklist_colocacion'    => $a->checklist_colocacion ?? [],
            'checklist_retiro'        => $a->checklist_retiro ?? [],
            'coloco_nombre'           => $a->usuarioColoco?->name,
            'retiro_nombre'           => $a->usuarioRetiro?->name,
        ];
    }

    // ── index ─────────────────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $extintores = Extintor::with(['asignacionActiva', 'ultimaInspeccion'])
            ->withMax(['inspecciones' => fn ($q) => $q->where('incluye_recarga', true)], 'fecha_recarga')
            ->when($request->input('serie'), fn ($q, $v) => $q->where('numero_serie', 'like', "%{$v}%"))
            ->when($request->input('placa'), function ($q, $v) {
                $q->whereHas('asignacionActiva', fn ($s) => $s->where('placa', $v));
            })
            ->orderBy('numero_serie')
            ->paginate(25)
            ->through(fn ($e) => $this->formatearExtintor($e));

        return Inertia::render('flota/extintores/index', [
            'extintores'          => $extintores,
            'placas'              => $this->placas(),
            'columnas_extra'      => $this->columnas(),
            'filters'             => $request->only(['serie', 'placa']),
            'imagenes_referencia' => $this->obtenerImagenesReferencia(),
        ]);
    }

    // ── show (historial de un extintor) ───────────────────────────────────────

    public function show(Extintor $extintor): Response
    {
        $extintor->load([
            'asignaciones.usuarioColoco',
            'asignaciones.usuarioRetiro',
            'inspecciones.evidencias',
            'inspecciones.creador',
        ]);

        return Inertia::render('flota/extintores/show', [
            'extintor'               => $this->formatearExtintor($extintor),
            'asignaciones'           => $extintor->asignaciones->map(fn ($a) => $this->formatearAsignacion($a))->values(),
            'inspecciones'           => $extintor->inspecciones->map(fn ($i) => $this->formatearInspeccion($i))->values(),
            'tiene_inspeccion_inicio' => $extintor->inspecciones->contains('tipo', ExtintorInspeccion::TIPO_INICIO),
            'columnas_extra'         => $this->columnas(),
            'placas'                 => $this->placas(),
            'colaboradores'          => $this->colaboradores(),
            'usuario_nombre'         => trim(auth()->user()?->name ?? ''),
        ]);
    }

    private function validarExtintor(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'numero_serie'        => ['required', 'string', 'max:80',
                \Illuminate\Validation\Rule::unique('extintores', 'numero_serie')->ignore($ignoreId)],
            'tipo_agente'         => ['nullable', 'string', 'max:80'],
            'capacidad_kg'        => ['nullable', 'numeric', 'min:0'],
            'marca'               => ['nullable', 'string', 'max:80'],
            'fecha_fabricacion'   => ['nullable', 'date'],
            'fecha_vencimiento'   => ['nullable', 'date'],
            'observaciones'       => ['nullable', 'string', 'max:1000'],
            'condicion'           => ['nullable', 'in:buena,mala'],
            'agente_impulsor'     => ['nullable', 'in:directa,indirecta'],
            'parte_mantenimiento' => ['nullable', 'string', 'max:255'],
            'senalizacion'        => ['nullable', 'string', 'max:255'],
            'demarcacion'         => ['nullable', 'in:buena,mala,N/A'],
            'funcionamiento'      => ['nullable', 'string', 'max:255'],
            'acceso'              => ['nullable', 'string', 'max:255'],
            'foto'                => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:10240'],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validarExtintor($request);
        unset($data['foto']);

        $extintor = Extintor::create([
            ...$data,
            'qr_token' => $data['numero_serie'],
            'user_id'  => $request->user()?->id,
        ]);

        if ($request->hasFile('foto')) {
            $path = $request->file('foto')->store("extintores/{$extintor->id}", 'public');
            $extintor->update(['foto_path' => $path]);
        }

        return redirect()->route('flota.extintores.index')
            ->with('status', ['message' => "Extintor {$data['numero_serie']} registrado.", 'type' => 'success']);
    }

    // ── update (editar datos del extintor) ────────────────────────────────────

    public function update(Request $request, Extintor $extintor): RedirectResponse
    {
        $data = $this->validarExtintor($request, $extintor->id);
        unset($data['foto']);
        $data['qr_token'] = $data['numero_serie'];

        if ($request->hasFile('foto')) {
            if ($extintor->foto_path) {
                Storage::disk('public')->delete($extintor->foto_path);
            }
            $data['foto_path'] = $request->file('foto')->store("extintores/{$extintor->id}", 'public');
        }

        $extintor->update($data);

        return redirect()->back()
            ->with('status', ['message' => 'Extintor actualizado.', 'type' => 'success']);
    }

    // ── destroy ───────────────────────────────────────────────────────────────

    public function destroy(Extintor $extintor): RedirectResponse
    {
        $extintor->delete();

        return redirect()->route('flota.extintores.index')
            ->with('status', ['message' => 'Extintor eliminado.', 'type' => 'success']);
    }

    // ── asignarVehiculo (colocar en un vehículo) ──────────────────────────────

    public function asignarVehiculo(Request $request, Extintor $extintor): RedirectResponse
    {
        // No se puede asignar si ya tiene una asignación activa
        if ($extintor->asignacionActiva) {
            return back()->withErrors(['placa' => 'El extintor ya está asignado a la placa ' . $extintor->asignacionActiva->placa . '. Retíralo primero.']);
        }

        $data = $request->validate([
            'placa'                    => ['required', 'string', 'max:20'],
            'fecha_colocacion'         => ['required', 'date'],
            'responsable_colocacion'   => ['nullable', 'string', 'max:120'],
            'observaciones_colocacion' => ['nullable', 'string', 'max:1000'],
            'checklist_colocacion'     => ['nullable', 'array'],
            'checklist_colocacion.*'   => ['nullable', 'string', 'max:255'],
        ]);

        ExtintorAsignacion::create([
            'extintor_id'              => $extintor->id,
            'placa'                    => $data['placa'],
            'fecha_colocacion'         => $data['fecha_colocacion'],
            'responsable_colocacion'   => $data['responsable_colocacion'] ?? null,
            'observaciones_colocacion' => $data['observaciones_colocacion'] ?? null,
            'checklist_colocacion'     => $data['checklist_colocacion'] ?? null,
            'user_coloco'              => $request->user()?->id,
        ]);

        return redirect()->route('flota.extintores.show', $extintor->id)
            ->with('status', ['message' => "Extintor asignado a la placa {$data['placa']}.", 'type' => 'success']);
    }

    // ── retirarVehiculo (registrar retiro) ────────────────────────────────────

    public function retirarVehiculo(Request $request, Extintor $extintor): RedirectResponse
    {
        $asignacion = $extintor->asignacionActiva;

        if (! $asignacion) {
            return back()->withErrors(['fecha_retiro' => 'El extintor no tiene una asignación activa.']);
        }

        $data = $request->validate([
            'fecha_retiro'            => ['required', 'date', 'after_or_equal:' . $asignacion->fecha_colocacion->toDateString()],
            'responsable_retiro'      => ['nullable', 'string', 'max:120'],
            'observaciones_retiro'    => ['nullable', 'string', 'max:1000'],
            'checklist_retiro'        => ['nullable', 'array'],
            'checklist_retiro.*'      => ['nullable', 'string', 'max:255'],
        ]);

        $asignacion->update([
            'fecha_retiro'         => $data['fecha_retiro'],
            'responsable_retiro'   => $data['responsable_retiro'] ?? null,
            'observaciones_retiro' => $data['observaciones_retiro'] ?? null,
            'checklist_retiro'     => $data['checklist_retiro'] ?? null,
            'user_retiro'          => $request->user()?->id,
        ]);

        return redirect()->route('flota.extintores.show', $extintor->id)
            ->with('status', ['message' => 'Retiro registrado correctamente.', 'type' => 'success']);
    }

    // ── updateAsignacion ──────────────────────────────────────────────────────

    public function updateAsignacion(Request $request, Extintor $extintor, ExtintorAsignacion $asignacion): RedirectResponse
    {
        $data = $request->validate([
            'placa'                    => ['required', 'string', 'max:20'],
            'fecha_colocacion'         => ['required', 'date'],
            'fecha_retiro'             => ['nullable', 'date'],
            'responsable_colocacion'   => ['nullable', 'string', 'max:120'],
            'responsable_retiro'       => ['nullable', 'string', 'max:120'],
            'observaciones_colocacion' => ['nullable', 'string', 'max:1000'],
            'observaciones_retiro'     => ['nullable', 'string', 'max:1000'],
        ]);

        $asignacion->update($data);

        return redirect()->route('flota.extintores.show', $extintor->id)
            ->with('status', ['message' => 'Asignación actualizada.', 'type' => 'success']);
    }

    // ── destroyAsignacion ─────────────────────────────────────────────────────

    public function destroyAsignacion(Extintor $extintor, ExtintorAsignacion $asignacion): RedirectResponse
    {
        $asignacion->delete();

        return redirect()->route('flota.extintores.show', $extintor->id)
            ->with('status', ['message' => 'Asignación eliminada.', 'type' => 'success']);
    }

    // ── agregarColumna ────────────────────────────────────────────────────────

    public function agregarColumna(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:120'],
        ]);

        $nombre = trim($data['nombre']);
        $existe = ExtintorColumna::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->exists();

        if (! $existe) {
            ExtintorColumna::create([
                'nombre' => $nombre,
                'orden'  => (ExtintorColumna::max('orden') ?? 0) + 1,
            ]);
        }

        return back()->with('status', ['message' => "Columna «{$nombre}» agregada.", 'type' => 'success']);
    }

    // ── eliminarColumna ───────────────────────────────────────────────────────

    public function eliminarColumna(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:120'],
        ]);

        ExtintorColumna::where('nombre', $data['nombre'])->delete();

        return back()->with('status', ['message' => "Columna «{$data['nombre']}» eliminada.", 'type' => 'success']);
    }

    // ── Helpers: formato inspección ───────────────────────────────────────────

    private function formatearInspeccion(ExtintorInspeccion $i): array
    {
        return [
            'id'                       => $i->id,
            'extintor_id'              => $i->extintor_id,
            'tipo'                     => $i->tipo,
            'tipo_label'               => $i->tipo_label,
            'fecha_inspeccion'         => $i->fecha_inspeccion?->format('Y-m-d'),
            'responsable_inicio'       => $i->responsable_inicio,
            'responsable_periodico'    => $i->responsable_periodico,
            // Checklist / datos del extintor al momento de la inspección
            'condicion'               => $i->condicion,
            'tipo_agente'             => $i->tipo_agente,
            'agente_impulsor'         => $i->agente_impulsor,
            'capacidad_kg'            => $i->capacidad_kg,
            'marca'                   => $i->marca,
            'parte_mantenimiento'     => $i->parte_mantenimiento,
            'senalizacion'            => $i->senalizacion,
            'demarcacion'             => $i->demarcacion,
            'funcionamiento'          => $i->funcionamiento,
            'acceso'                  => $i->acceso,
            'observaciones_inspeccion' => $i->observaciones_inspeccion,
            'incluye_recarga'          => (bool) $i->incluye_recarga,
            'fecha_recarga'            => $i->fecha_recarga?->format('Y-m-d'),
            'fecha_proxima_recarga'    => $i->fecha_proxima_recarga?->format('Y-m-d'),
            'observaciones_recarga'    => $i->observaciones_recarga,
            'firma_url'                => $i->firma_path
                ? Storage::disk('public')->url($i->firma_path)
                : null,
            'creador_nombre'           => $i->creador?->name,
            'evidencias'               => $i->evidencias->map(fn ($e) => [
                'id'              => $e->id,
                'url'             => $e->url,
                'nombre_original' => $e->nombre_original,
                'tipo_mime'       => $e->tipo_mime,
                'es_pdf'          => $e->es_pdf,
            ])->values()->toArray(),
        ];
    }

    // ── storeInspeccion ───────────────────────────────────────────────────────

    public function storeInspeccion(Request $request, Extintor $extintor): RedirectResponse
    {
        $data = $request->validate([
            'tipo'                     => ['required', 'in:inicio,periodica'],
            'fecha_inspeccion'         => ['required', 'date'],
            'responsable_inicio'       => ['nullable', 'string', 'max:120'],
            'responsable_periodico'    => ['nullable', 'string', 'max:120'],
            'condicion'                => ['nullable', 'in:buena,mala'],
            'tipo_agente'              => ['nullable', 'string', 'max:80'],
            'agente_impulsor'          => ['nullable', 'in:directa,indirecta'],
            'capacidad_kg'             => ['nullable', 'numeric', 'min:0'],
            'marca'                    => ['nullable', 'string', 'max:80'],
            'parte_mantenimiento'      => ['nullable', 'string', 'max:255'],
            'senalizacion'             => ['nullable', 'string', 'max:255'],
            'demarcacion'              => ['nullable', 'in:buena,mala,N/A'],
            'funcionamiento'           => ['nullable', 'string', 'max:255'],
            'acceso'                   => ['nullable', 'string', 'max:255'],
            'observaciones_inspeccion' => ['nullable', 'string', 'max:2000'],
            'incluye_recarga'          => ['nullable', 'boolean'],
            'fecha_recarga'            => ['nullable', 'date', function ($attr, $value, $fail) use ($extintor) {
                if (!$value) return;
                $ultimaRecarga = $extintor->inspecciones()
                    ->where('incluye_recarga', true)
                    ->whereNotNull('fecha_recarga')
                    ->max('fecha_recarga');
                if ($ultimaRecarga && $value < $ultimaRecarga) {
                    $fail('La fecha de recarga no puede ser anterior a la última recarga registrada ('.
                        \Carbon\Carbon::parse($ultimaRecarga)->format('d/m/Y').').');
                }
            }],
            'fecha_proxima_recarga'    => ['nullable', 'date'],
            'observaciones_recarga'    => ['nullable', 'string', 'max:2000'],
            'registra_vehiculo'        => ['nullable', 'boolean'],
            'nueva_placa'              => ['nullable', 'string', 'max:20'],
            'observaciones_vehiculo'   => ['nullable', 'string', 'max:1000'],
            'usar_firma_guardada'      => ['nullable', 'boolean'],
            'firma'                    => ['nullable', 'file', 'image', 'max:2048'],
            'evidencias'               => ['nullable', 'array', 'max:20'],
            'evidencias.*'             => ['file', 'mimes:jpg,jpeg,png,gif,webp,pdf', 'max:10240'],
        ]);

        $incluyeRecarga   = filter_var($request->input('incluye_recarga'), FILTER_VALIDATE_BOOLEAN);
        $registraVehiculo = filter_var($request->input('registra_vehiculo'), FILTER_VALIDATE_BOOLEAN);

        $editId = $request->input('_edit_id');
        $editInspeccion = $editId ? ExtintorInspeccion::where('extintor_id', $extintor->id)->find($editId) : null;

        $inspeccionData = [
            'extintor_id'              => $extintor->id,
            'tipo'                     => $data['tipo'],
            'fecha_inspeccion'         => $data['fecha_inspeccion'],
            'responsable_inicio'       => $data['responsable_inicio'] ?? null,
            'responsable_periodico'    => $data['responsable_periodico'] ?? null,
            'condicion'                => $data['condicion'] ?? null,
            'tipo_agente'              => $data['tipo_agente'] ?? null,
            'agente_impulsor'          => $data['agente_impulsor'] ?? null,
            'capacidad_kg'             => $data['capacidad_kg'] ?? null,
            'marca'                    => $data['marca'] ?? null,
            'parte_mantenimiento'      => $data['parte_mantenimiento'] ?? null,
            'senalizacion'             => $data['senalizacion'] ?? null,
            'demarcacion'              => $data['demarcacion'] ?? null,
            'funcionamiento'           => $data['funcionamiento'] ?? null,
            'acceso'                   => $data['acceso'] ?? null,
            'observaciones_inspeccion' => $data['observaciones_inspeccion'] ?? null,
            'incluye_recarga'          => $incluyeRecarga,
            'fecha_recarga'            => $incluyeRecarga ? ($data['fecha_recarga'] ?? null) : null,
            'fecha_proxima_recarga'    => $incluyeRecarga ? ($data['fecha_proxima_recarga'] ?? null) : null,
            'observaciones_recarga'    => $incluyeRecarga ? ($data['observaciones_recarga'] ?? null) : null,
        ];

        if ($request->hasFile('firma')) {
            $inspeccionData['firma_path'] = $request->file('firma')->store('extintores/firmas', 'public');
        } elseif (filter_var($request->input('usar_firma_guardada'), FILTER_VALIDATE_BOOLEAN)) {
            $ultima = ExtintorInspeccion::where('user_id', $request->user()?->id)
                ->whereNotNull('firma_path')
                ->latest()
                ->value('firma_path');
            if ($ultima && Storage::disk('public')->exists($ultima)) {
                $ext = pathinfo($ultima, PATHINFO_EXTENSION) ?: 'png';
                $nuevoPath = 'extintores/firmas/' . \Illuminate\Support\Str::random(40) . '.' . $ext;
                Storage::disk('public')->copy($ultima, $nuevoPath);
                $inspeccionData['firma_path'] = $nuevoPath;
            }
        }

        if ($editInspeccion) {
            $editInspeccion->update($inspeccionData);
            $inspeccion = $editInspeccion;
        } else {
            $inspeccionData['user_id'] = $request->user()?->id;
            $inspeccion = ExtintorInspeccion::create($inspeccionData);
        }

        // Actualizar extintor con los datos más recientes de la inspección
        $extintorFields = [
            'condicion', 'tipo_agente', 'agente_impulsor',
            'parte_mantenimiento', 'senalizacion', 'demarcacion',
            'funcionamiento', 'acceso',
        ];
        $extintorUpdate = [];
        foreach ($extintorFields as $field) {
            if (array_key_exists($field, $data)) {
                $extintorUpdate[$field] = $data[$field];
            }
        }
        if (array_key_exists('observaciones_inspeccion', $data)) {
            $extintorUpdate['observaciones'] = $data['observaciones_inspeccion'];
        }

        // Guardar evidencias
        foreach ($request->file('evidencias', []) as $orden => $file) {
            $path = $file->store("extintores/{$extintor->id}/inspecciones/{$inspeccion->id}", 'public');
            $inspeccion->evidencias()->create([
                'path'            => $path,
                'nombre_original' => $file->getClientOriginalName(),
                'tipo_mime'       => $file->getMimeType(),
                'orden'           => $orden,
            ]);
        }

        // Actualizar próxima recarga y datos del extintor
        if ($incluyeRecarga && ! empty($data['fecha_proxima_recarga'])) {
            $extintorUpdate['fecha_vencimiento'] = $data['fecha_proxima_recarga'];
        }

        if (! empty($extintorUpdate)) {
            $extintor->update($extintorUpdate);
        }

        // Gestión del vehículo: cerrar asignación activa y/o abrir una nueva
        if ($registraVehiculo) {
            $asignacionActiva = $extintor->asignacionActiva;

            // Si hay asignación activa, la cerramos (registramos retiro)
            if ($asignacionActiva) {
                $asignacionActiva->update([
                    'fecha_retiro'         => $data['fecha_inspeccion'],
                    'observaciones_retiro' => $data['observaciones_vehiculo'] ?? null,
                    'user_retiro'          => $request->user()?->id,
                ]);
            }

            // Si indicaron una nueva placa, abrimos nueva asignación
            if (! empty($data['nueva_placa'])) {
                ExtintorAsignacion::create([
                    'extintor_id'              => $extintor->id,
                    'placa'                    => $data['nueva_placa'],
                    'fecha_colocacion'         => $data['fecha_inspeccion'],
                    'observaciones_colocacion' => $data['observaciones_vehiculo'] ?? null,
                    'user_coloco'              => $request->user()?->id,
                ]);
            }
        }

        return redirect()->route('flota.extintores.show', $extintor->id)
            ->with('status', ['message' => 'Inspección registrada correctamente.', 'type' => 'success']);
    }

    // ── ultimaFirmaInspeccion ─────────────────────────────────────────────────

    /**
     * Devuelve la URL de la última firma registrada por el usuario logueado
     * en cualquier inspección de extintores, para precargarla en el FirmaPad.
     */
    public function ultimaFirmaInspeccion(Request $request): \Illuminate\Http\JsonResponse
    {
        $ultima = ExtintorInspeccion::where('user_id', $request->user()?->id)
            ->whereNotNull('firma_path')
            ->latest()
            ->value('firma_path');

        return response()->json([
            'firma_url' => $ultima ? Storage::disk('public')->url($ultima) : null,
        ]);
    }

    // ── destroyInspeccion ─────────────────────────────────────────────────────

    public function destroyInspeccion(Extintor $extintor, ExtintorInspeccion $inspeccion): RedirectResponse
    {
        // Eliminar archivos del storage
        foreach ($inspeccion->evidencias as $evidencia) {
            Storage::disk('public')->delete($evidencia->path);
        }

        $inspeccion->delete();

        return redirect()->route('flota.extintores.show', $extintor->id)
            ->with('status', ['message' => 'Inspección eliminada.', 'type' => 'success']);
    }

    // ── Imágenes de referencia ───────────────────────────────────────────────

    public function subirImagenReferencia(Request $request): RedirectResponse
    {
        $request->validate([
            'numero' => ['required', 'in:1,2'],
            'imagen' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,gif,svg', 'max:10240'],
        ]);

        $numero = (int) $request->input('numero');
        $file = $request->file('imagen');
        $extension = strtolower($file->getClientOriginalExtension() ?: 'png');
        $destinationDir = public_path('images/extintores');

        if (!file_exists($destinationDir)) {
            mkdir($destinationDir, 0755, true);
        }

        // Eliminar versiones previas de esta referencia
        foreach (glob("{$destinationDir}/extintor-referencia-{$numero}.*") as $oldFile) {
            @unlink($oldFile);
        }

        $filename = "extintor-referencia-{$numero}.{$extension}";
        $file->move($destinationDir, $filename);

        return back()->with('status', [
            'message' => "Imagen de referencia {$numero} actualizada exitosamente.",
            'type'    => 'success',
        ]);
    }

    public function eliminarImagenReferencia(Request $request): RedirectResponse
    {
        $request->validate([
            'numero' => ['required', 'in:1,2'],
        ]);

        $numero = (int) $request->input('numero');
        $destinationDir = public_path('images/extintores');

        foreach (glob("{$destinationDir}/extintor-referencia-{$numero}.*") as $oldFile) {
            @unlink($oldFile);
        }

        return back()->with('status', [
            'message' => "Imagen de referencia {$numero} eliminada exitosamente.",
            'type'    => 'success',
        ]);
    }

    private function obtenerImagenesReferencia(): array
    {
        $imagenes = [
            'ref_1' => null,
            'ref_2' => null,
        ];

        $destinationDir = public_path('images/extintores');
        foreach ([1, 2] as $num) {
            $matches = glob("{$destinationDir}/extintor-referencia-{$num}.*");
            if (!empty($matches)) {
                $file = $matches[0];
                $filename = basename($file);
                $imagenes["ref_{$num}"] = asset("images/extintores/{$filename}") . '?v=' . filemtime($file);
            }
        }

        return $imagenes;
    }

    // ── Foto del extintor ─────────────────────────────────────────────────────

    public function subirFoto(Request $request, Extintor $extintor): RedirectResponse
    {
        $request->validate([
            'foto' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:10240'],
        ]);

        if ($extintor->foto_path) {
            Storage::disk('public')->delete($extintor->foto_path);
        }

        $path = $request->file('foto')->store("extintores/{$extintor->id}", 'public');
        $extintor->update(['foto_path' => $path]);

        return back()->with('status', [
            'message' => 'Foto del extintor actualizada.',
            'type'    => 'success',
        ]);
    }

    public function eliminarFoto(Extintor $extintor): RedirectResponse
    {
        if ($extintor->foto_path) {
            Storage::disk('public')->delete($extintor->foto_path);
            $extintor->update(['foto_path' => null]);
        }

        foreach (glob(storage_path("app/public/extintores/{$extintor->id}/foto.*")) as $f) {
            @unlink($f);
        }

        return back()->with('status', [
            'message' => 'Foto del extintor eliminada.',
            'type'    => 'success',
        ]);
    }

    // ── Exportar Excel de inspecciones ────────────────────────────────────────

    public function exportarExcel(Extintor $extintor): BinaryFileResponse
    {
        $extintor->load('inspecciones', 'asignacionActiva');

        $nombre = 'Inspecciones_'.$extintor->numero_serie.'_'.now()->format('Ymd').'.xlsx';

        return Excel::download(new ExtintorInspeccionExport($extintor), $nombre);
    }

    // ── Exportar Excel tabla general de extintores ────────────────────────────

    public function exportarTabla(): BinaryFileResponse
    {
        $extintores = Extintor::with('asignacionActiva')
            ->orderBy('numero_serie')
            ->get()
            ->map(function ($e) {
                return (object) [
                    'numero_serie'        => $e->numero_serie,
                    'condicion'           => $e->condicion,
                    'tipo_agente'         => $e->tipo_agente,
                    'agente_impulsor'     => $e->agente_impulsor,
                    'ultima_recarga'      => $e->ultima_recarga,
                    'parte_mantenimiento' => $e->parte_mantenimiento,
                    'senalizacion'        => $e->senalizacion,
                    'demarcacion'         => $e->demarcacion,
                    'funcionamiento'      => $e->funcionamiento,
                    'acceso'              => $e->acceso,
                    'placa_actual'        => $e->asignacionActiva?->placa,
                    'observaciones'       => $e->observaciones,
                ];
            });

        $nombre = 'Extintores_'.now()->format('Ymd').'.xlsx';

        return Excel::download(new ExtintoresTablaExport($extintores), $nombre);
    }
}
