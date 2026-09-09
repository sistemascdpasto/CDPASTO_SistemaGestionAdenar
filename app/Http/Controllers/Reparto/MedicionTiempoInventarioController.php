<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\MedicionTiempoInventario;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class MedicionTiempoInventarioController extends Controller
{
    /**
     * Mostrar el formulario para crear una nueva medición de tiempo
     */
    public function create(): Response
    {
        $vehiculos = Vehiculo::where('estado', 'activo')
            ->orderBy('placa')
            ->get(['id', 'placa', 'modelo']);

        $colaboradores = Colaborador::where('estado', 'activo')
            ->orderBy('nombres')
            ->get(['id', 'cedula', 'nombres', 'apellidos']);

        return Inertia::render('reparto/medicion-tiempos-inventario/create', [
            'vehiculos' => $vehiculos,
            'colaboradores' => $colaboradores,
        ]);
    }

    /**
     * Almacenar una nueva medición de tiempo
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'fecha_medicion' => 'required|date',
            'placa_vehiculo' => 'required|string|max:20',
            'centro' => 'nullable|string|max:100',
            'regional' => 'nullable|string|max:100',
            'cedula_colaborador' => 'nullable|string|max:20',
            'nombre_colaborador' => 'nullable|string|max:100',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
            'tipo_inventario' => 'nullable|string|max:50',
            'estado' => 'required|string|max:50',
            'observaciones' => 'nullable|string',
            'vehiculo_id' => 'nullable|exists:vehiculos,id',
            'colaborador_id' => 'nullable|exists:colaboradores,id',
        ]);

        // Calcular duración si se proporcionaron horas
        if (!empty($validated['hora_inicio']) && !empty($validated['hora_fin'])) {
            $inicio = \Carbon\Carbon::parse($validated['hora_inicio']);
            $fin = \Carbon\Carbon::parse($validated['hora_fin']);
            $validated['duracion_minutos'] = $inicio->diffInMinutes($fin);
        }

        $validated['user_id'] = $request->user()->id;
        $validated['creado_por'] = $request->user()->name;

        MedicionTiempoInventario::create($validated);

        return to_route('reparto.medicion-tiempos-inventario.index')
            ->with('status', 'Medición de tiempo registrada correctamente.');
    }

    /**
     * Mostrar el listado de mediciones de tiempo
     */
    public function index(Request $request): Response
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Colaborador', 'Administrador', 'Reparto']);

        $filtros = [
            'fecha_desde' => $request->string('fecha_desde')->toString(),
            'fecha_hasta' => $request->string('fecha_hasta')->toString(),
            'placa' => $request->string('placa')->toString(),
            'colaborador' => $request->string('colaborador')->toString(),
        ];

        $query = MedicionTiempoInventario::query()
            ->with(['user:id,name', 'colaborador:id,nombres,apellidos', 'vehiculo:id,placa'])
            ->when(!$puedeVerTodos, fn ($q) => $q->where('user_id', $request->user()->id))
            ->when($filtros['fecha_desde'], fn ($q) => $q->whereDate('fecha_medicion', '>=', $filtros['fecha_desde']))
            ->when($filtros['fecha_hasta'], fn ($q) => $q->whereDate('fecha_medicion', '<=', $filtros['fecha_hasta']))
            ->when($filtros['placa'], fn ($q) => $q->where('placa_vehiculo', 'like', "%{$filtros['placa']}%"))
            ->when($filtros['colaborador'], fn ($q) => $q->where('nombre_colaborador', 'like', "%{$filtros['colaborador']}%"))
            ->latest('fecha_medicion')
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (MedicionTiempoInventario $registro) => [
                'id' => $registro->id,
                'fecha_medicion' => $registro->fecha_medicion?->toDateString(),
                'placa_vehiculo' => $registro->placa_vehiculo,
                'centro' => $registro->centro,
                'regional' => $registro->regional,
                'cedula_colaborador' => $registro->cedula_colaborador,
                'nombre_colaborador' => $registro->nombre_colaborador,
                'hora_inicio' => $registro->hora_inicio?->format('H:i'),
                'hora_fin' => $registro->hora_fin?->format('H:i'),
                'duracion_minutos' => $registro->duracion_minutos,
                'tipo_inventario' => $registro->tipo_inventario,
                'estado' => $registro->estado,
                'observaciones' => $registro->observaciones,
                'creado_por' => $registro->creado_por,
                'fecha_creacion' => $registro->fecha_creacion?->toIso8601String(),
                'usuario' => $registro->user?->name,
                'colaborador_info' => $registro->colaborador
                    ? trim("{$registro->colaborador->nombres} {$registro->colaborador->apellidos}")
                    : null,
                'vehiculo_info' => $registro->vehiculo?->placa,
            ]);

        return Inertia::render('reparto/medicion-tiempos-inventario/index', [
            'registros' => $query,
            'filtros' => $filtros,
            'puedeVerTodos' => $puedeVerTodos,
        ])->name('reparto.medicion-tiempos-inventario.index');
    }

    /**
     * Mostrar los detalles de una medición específica
     */
    public function show(Request $request, MedicionTiempoInventario $medicionTiempoInventario): Response
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Colaborador', 'Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $medicionTiempoInventario->load(['user:id,name', 'colaborador:id,nombres,apellidos,cedula', 'vehiculo:id,placa,modelo']);

        return Inertia::render('reparto/medicion-tiempos-inventario/show', [
            'registro' => [
                'id' => $medicionTiempoInventario->id,
                'fecha_medicion' => $medicionTiempoInventario->fecha_medicion?->toDateString(),
                'placa_vehiculo' => $medicionTiempoInventario->placa_vehiculo,
                'centro' => $medicionTiempoInventario->centro,
                'regional' => $medicionTiempoInventario->regional,
                'cedula_colaborador' => $medicionTiempoInventario->cedula_colaborador,
                'nombre_colaborador' => $medicionTiempoInventario->nombre_colaborador,
                'hora_inicio' => $medicionTiempoInventario->hora_inicio?->format('H:i'),
                'hora_fin' => $medicionTiempoInventario->hora_fin?->format('H:i'),
                'duracion_minutos' => $medicionTiempoInventario->duracion_minutos,
                'tipo_inventario' => $medicionTiempoInventario->tipo_inventario,
                'estado' => $medicionTiempoInventario->estado,
                'observaciones' => $medicionTiempoInventario->observaciones,
                'creado_por' => $medicionTiempoInventario->creado_por,
                'fecha_creacion' => $medicionTiempoInventario->fecha_creacion?->toIso8601String(),
                'usuario' => $medicionTiempoInventario->user?->name,
                'colaborador_info' => $medicionTiempoInventario->colaborador
                    ? [
                        'nombre_completo' => trim("{$medicionTiempoInventario->colaborador->nombres} {$medicionTiempoInventario->colaborador->apellidos}"),
                        'cedula' => $medicionTiempoInventario->colaborador->cedula,
                    ]
                    : null,
                'vehiculo_info' => $medicionTiempoInventario->vehiculo
                    ? [
                        'placa' => $medicionTiempoInventario->vehiculo->placa,
                        'modelo' => $medicionTiempoInventario->vehiculo->modelo,
                    ]
                    : null,
            ],
        ]);
    }

    /**
     * Mostrar el formulario para editar una medición
     */
    public function edit(Request $request, MedicionTiempoInventario $medicionTiempoInventario): Response
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Colaborador', 'Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $vehiculos = Vehiculo::where('estado', 'activo')
            ->orderBy('placa')
            ->get(['id', 'placa', 'modelo']);

        $colaboradores = Colaborador::where('estado', 'activo')
            ->orderBy('nombres')
            ->get(['id', 'cedula', 'nombres', 'apellidos']);

        return Inertia::render('reparto/medicion-tiempos-inventario/edit', [
            'registro' => [
                'id' => $medicionTiempoInventario->id,
                'fecha_medicion' => $medicionTiempoInventario->fecha_medicion?->toDateString(),
                'placa_vehiculo' => $medicionTiempoInventario->placa_vehiculo,
                'centro' => $medicionTiempoInventario->centro,
                'regional' => $medicionTiempoInventario->regional,
                'cedula_colaborador' => $medicionTiempoInventario->cedula_colaborador,
                'nombre_colaborador' => $medicionTiempoInventario->nombre_colaborador,
                'hora_inicio' => $medicionTiempoInventario->hora_inicio?->format('H:i'),
                'hora_fin' => $medicionTiempoInventario->hora_fin?->format('H:i'),
                'tipo_inventario' => $medicionTiempoInventario->tipo_inventario,
                'estado' => $medicionTiempoInventario->estado,
                'observaciones' => $medicionTiempoInventario->observaciones,
                'vehiculo_id' => $medicionTiempoInventario->vehiculo_id,
                'colaborador_id' => $medicionTiempoInventario->colaborador_id,
            ],
            'vehiculos' => $vehiculos,
            'colaboradores' => $colaboradores,
        ]);
    }

    /**
     * Actualizar una medición existente
     */
    public function update(Request $request, MedicionTiempoInventario $medicionTiempoInventario): RedirectResponse
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Colaborador', 'Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'fecha_medicion' => 'required|date',
            'placa_vehiculo' => 'required|string|max:20',
            'centro' => 'nullable|string|max:100',
            'regional' => 'nullable|string|max:100',
            'cedula_colaborador' => 'nullable|string|max:20',
            'nombre_colaborador' => 'nullable|string|max:100',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
            'tipo_inventario' => 'nullable|string|max:50',
            'estado' => 'required|string|max:50',
            'observaciones' => 'nullable|string',
            'vehiculo_id' => 'nullable|exists:vehiculos,id',
            'colaborador_id' => 'nullable|exists:colaboradores,id',
        ]);

        // Calcular duración si se proporcionaron horas
        if (!empty($validated['hora_inicio']) && !empty($validated['hora_fin'])) {
            $inicio = \Carbon\Carbon::parse($validated['hora_inicio']);
            $fin = \Carbon\Carbon::parse($validated['hora_fin']);
            $validated['duracion_minutos'] = $inicio->diffInMinutes($fin);
        }

        $medicionTiempoInventario->update($validated);

        return to_route('reparto.medicion-tiempos-inventario.index')
            ->with('status', 'Medición de tiempo actualizada correctamente.');
    }

    /**
     * Eliminar una medición
     */
    public function destroy(Request $request, MedicionTiempoInventario $medicionTiempoInventario): RedirectResponse
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Colaborador', 'Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $medicionTiempoInventario->delete();

        return to_route('reparto.medicion-tiempos-inventario.index')
            ->with('status', 'Medición de tiempo eliminada correctamente.');
    }
}