<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\MedicionTiempoInventario;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class MedicionTiempoInventarioController extends Controller
{
    /**
     * Mostrar el formulario para crear una nueva medición de tiempo.
     * Si el usuario ya tiene un inventario iniciado hoy (sin hora_fin),
     * lo redirige directamente al formulario de finalización.
     */
    public function create(Request $request): Response|RedirectResponse
    {
        $esColaborador = $request->user()->hasRole('Colaborador')
            && !$request->user()->hasAnyRole(['Administrador', 'Reparto']);

        // ¿Tiene un inventario en curso hoy?
        $enCurso = MedicionTiempoInventario::where('user_id', $request->user()->id)
            ->whereNull('hora_fin')
            ->whereDate('fecha_medicion', today())
            ->latest()
            ->first();

        if ($enCurso) {
            return redirect()->route('reparto.medicion-tiempos-inventario.edit', $enCurso->id)
                ->with('status', 'Ya tienes un inventario iniciado hoy. Aquí puedes finalizarlo.');
        }

        $vehiculos = Vehiculo::where('is_active', true)
            ->orderBy('placa')
            ->get(['id', 'placa', 'modelo']);

        $colaboradores = Colaborador::where('is_active', true)
            ->orderBy('nombres')
            ->get(['id', 'cedula', 'nombres', 'apellidos']);

        return Inertia::render('reparto/medicion-tiempos-inventario/create', [
            'vehiculos'    => $vehiculos,
            'colaboradores'=> $colaboradores,
            'esColaborador'=> $esColaborador,
        ]);
    }

    /**
     * Almacenar una nueva medición — registra hora_inicio automáticamente (botón Iniciar).
     */
    public function store(Request $request): RedirectResponse
    {
        $esColaborador = $request->user()->hasRole('Colaborador')
            && !$request->user()->hasAnyRole(['Administrador', 'Reparto']);

        // Evitar duplicados: si ya hay uno en curso hoy, redirigir a finalizarlo
        $enCurso = MedicionTiempoInventario::where('user_id', $request->user()->id)
            ->whereNull('hora_fin')
            ->whereDate('fecha_medicion', today())
            ->latest()
            ->first();

        if ($enCurso) {
            return redirect()->route('reparto.medicion-tiempos-inventario.edit', $enCurso->id)
                ->with('status', 'Ya tienes un inventario iniciado hoy. Aquí puedes finalizarlo.');
        }

        $validated = $request->validate([
            'fecha_medicion' => 'required|date',
            'vehiculo_id'    => 'required|exists:vehiculos,id',
            'colaborador_id' => 'required|exists:colaboradores,id',
        ], [
            'vehiculo_id.required'    => 'La placa del vehículo es obligatoria.',
            'colaborador_id.required' => 'El colaborador es obligatorio.',
        ]);

        // La hora de inicio es exactamente el momento en que se pulsa "Iniciar"
        $validated['hora_inicio']     = now()->format('H:i');
        $validated['tipo_inventario'] = 'inicio';
        $validated['user_id']         = $request->user()->id;
        $validated['creado_por']      = $request->user()->name;

        $registro = MedicionTiempoInventario::create($validated);

        // Los colaboradores no tienen acceso al listado; se redirigen al formulario de finalización.
        if ($esColaborador) {
            return redirect()->route('reparto.medicion-tiempos-inventario.edit', $registro->id)
                ->with('status', 'Inventario iniciado. Hora de inicio registrada. Cuando termines, pulsa Finalizar.');
        }

        return to_route('reparto.medicion-tiempos-inventario.index')
            ->with('status', 'Inventario iniciado. Hora de inicio registrada correctamente.');
    }

    /**
     * Mostrar el listado de mediciones de tiempo
     */
    public function index(Request $request): Response
    {
        // Los administradores y el rol Reparto ven todos los registros.
        // Los colaboradores solo ven los registros que ellos mismos crearon.
        $puedeVerTodos = $request->user()->hasAnyRole(['Administrador', 'Reparto']);
        $esColaborador = $request->user()->hasRole('Colaborador') && !$puedeVerTodos;

        $filtros = [
            'fecha_desde' => $request->string('fecha_desde')->toString(),
            'fecha_hasta' => $request->string('fecha_hasta')->toString(),
            'placa' => $request->string('placa')->toString(),
            'colaborador' => $request->string('colaborador')->toString(),
        ];

        // ── Query base reutilizable para indicadores y gráficas ──────────────
        $baseQuery = MedicionTiempoInventario::query()
            ->when($esColaborador, fn ($q) => $q->where('user_id', $request->user()->id))
            ->when($filtros['fecha_desde'], fn ($q) => $q->whereDate('fecha_medicion', '>=', $filtros['fecha_desde']))
            ->when($filtros['fecha_hasta'], fn ($q) => $q->whereDate('fecha_medicion', '<=', $filtros['fecha_hasta']))
            ->when($filtros['placa'], fn ($q) => $q->whereHas('vehiculo', function ($q) use ($filtros) {
                $q->where('placa', 'like', "%{$filtros['placa']}%");
            }))
            ->when($filtros['colaborador'], fn ($q) => $q->whereHas('colaborador', function ($q) use ($filtros) {
                $q->where('cedula', 'like', "%{$filtros['colaborador']}%")
                  ->orWhere('nombres', 'like', "%{$filtros['colaborador']}%")
                  ->orWhere('apellidos', 'like', "%{$filtros['colaborador']}%");
            }));

        // ── Tabla paginada ────────────────────────────────────────────────────
        $query = (clone $baseQuery)
            ->with(['user:id,name', 'colaborador:id,nombres,apellidos', 'vehiculo:id,placa'])
            ->latest('fecha_medicion')
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (MedicionTiempoInventario $registro) => [
                'id' => $registro->id,
                'fecha_medicion' => $registro->fecha_medicion?->toDateString(),
                'hora_inicio' => $registro->hora_inicio?->format('H:i'),
                'hora_fin' => $registro->hora_fin?->format('H:i'),
                'duracion_minutos' => $registro->duracion_minutos,
                'tipo_inventario' => $registro->tipo_inventario,
                'creado_por' => $registro->creado_por,
                'fecha_creacion' => $registro->fecha_creacion?->toIso8601String(),
                'usuario' => $registro->user?->name,
                'colaborador_info' => $registro->colaborador
                    ? trim("{$registro->colaborador->nombres} {$registro->colaborador->apellidos}")
                    : null,
                'vehiculo_info' => $registro->vehiculo?->placa,
            ]);

        // ── Indicadores globales ──────────────────────────────────────────────
        $statsRaw = (clone $baseQuery)
            ->whereNotNull('duracion_minutos')
            ->selectRaw('
                COUNT(*) as total,
                ROUND(AVG(duracion_minutos), 1) as promedio,
                MIN(duracion_minutos) as minimo,
                MAX(duracion_minutos) as maximo,
                SUM(duracion_minutos) as suma
            ')
            ->first();

        $totalRegistros    = (clone $baseQuery)->count();
        $conDuracion       = (int) ($statsRaw->total ?? 0);
        $vehiculosUnicos   = (clone $baseQuery)->distinct('vehiculo_id')->whereNotNull('vehiculo_id')->count('vehiculo_id');
        $colaboradoresUnic = (clone $baseQuery)->distinct('colaborador_id')->whereNotNull('colaborador_id')->count('colaborador_id');

        $indicadores = [
            'total_registros'      => $totalRegistros,
            'con_duracion'         => $conDuracion,
            'promedio_minutos'     => $conDuracion > 0 ? (float) $statsRaw->promedio : null,
            'minimo_minutos'       => $conDuracion > 0 ? (int) $statsRaw->minimo : null,
            'maximo_minutos'       => $conDuracion > 0 ? (int) $statsRaw->maximo : null,
            'suma_minutos'         => $conDuracion > 0 ? (int) $statsRaw->suma : 0,
            'vehiculos_unicos'     => $vehiculosUnicos,
            'colaboradores_unicos' => $colaboradoresUnic,
        ];

        // ── Totales por día ───────────────────────────────────────────────────
        $porDiaRaw = (clone $baseQuery)
            ->whereNotNull('duracion_minutos')
            ->whereNotNull('fecha_medicion')
            ->selectRaw("
                DATE(fecha_medicion) as dia,
                COUNT(*) as cantidad,
                ROUND(AVG(duracion_minutos), 1) as promedio,
                MIN(duracion_minutos) as minimo,
                MAX(duracion_minutos) as maximo
            ")
            ->groupBy('dia')
            ->orderBy('dia')
            ->limit(60)
            ->get();

        $porDia = [
            'dias'     => $porDiaRaw->pluck('dia')->toArray(),
            'promedio' => $porDiaRaw->pluck('promedio')->map(fn ($v) => (float) $v)->toArray(),
            'cantidad' => $porDiaRaw->pluck('cantidad')->map(fn ($v) => (int) $v)->toArray(),
            'minimo'   => $porDiaRaw->pluck('minimo')->map(fn ($v) => (int) $v)->toArray(),
            'maximo'   => $porDiaRaw->pluck('maximo')->map(fn ($v) => (int) $v)->toArray(),
        ];

        // ── Totales por mes ───────────────────────────────────────────────────
        $mesesNombres = [
            1=>'Ene',2=>'Feb',3=>'Mar',4=>'Abr',5=>'May',6=>'Jun',
            7=>'Jul',8=>'Ago',9=>'Sep',10=>'Oct',11=>'Nov',12=>'Dic',
        ];

        $porMesRaw = (clone $baseQuery)
            ->whereNotNull('duracion_minutos')
            ->whereNotNull('fecha_medicion')
            ->selectRaw("
                YEAR(fecha_medicion) as anio,
                MONTH(fecha_medicion) as mes_num,
                COUNT(*) as cantidad,
                ROUND(AVG(duracion_minutos), 1) as promedio,
                MIN(duracion_minutos) as minimo,
                MAX(duracion_minutos) as maximo
            ")
            ->groupByRaw('YEAR(fecha_medicion), MONTH(fecha_medicion)')
            ->orderByRaw('YEAR(fecha_medicion), MONTH(fecha_medicion)')
            ->limit(24)
            ->get();

        $porMes = [
            'meses'    => $porMesRaw->map(fn ($r) => ($mesesNombres[(int)$r->mes_num] ?? "M{$r->mes_num}") . ' ' . $r->anio)->toArray(),
            'promedio' => $porMesRaw->pluck('promedio')->map(fn ($v) => (float) $v)->toArray(),
            'cantidad' => $porMesRaw->pluck('cantidad')->map(fn ($v) => (int) $v)->toArray(),
            'minimo'   => $porMesRaw->pluck('minimo')->map(fn ($v) => (int) $v)->toArray(),
            'maximo'   => $porMesRaw->pluck('maximo')->map(fn ($v) => (int) $v)->toArray(),
        ];

        return Inertia::render('reparto/medicion-tiempos-inventario/index', [
            'registros'       => $query,
            'filtros'         => $filtros,
            'puedeVerTodos'   => $puedeVerTodos,
            'esColaborador'   => $esColaborador,
            'registroEnCurso' => null,
            'indicadores'     => $indicadores,
            'por_dia'         => $porDia,
            'por_mes'         => $porMes,
        ]);
    }

    /**
     * Mostrar los detalles de una medición específica
     */
    public function show(Request $request, MedicionTiempoInventario $medicionTiempoInventario): Response
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $medicionTiempoInventario->load(['user:id,name', 'colaborador:id,nombres,apellidos,cedula', 'vehiculo:id,placa,modelo']);

        return Inertia::render('reparto/medicion-tiempos-inventario/show', [
            'registro' => [
                'id' => $medicionTiempoInventario->id,
                'fecha_medicion' => $medicionTiempoInventario->fecha_medicion?->toDateString(),
                'hora_inicio' => $medicionTiempoInventario->hora_inicio?->format('H:i'),
                'hora_fin' => $medicionTiempoInventario->hora_fin?->format('H:i'),
                'duracion_minutos' => $medicionTiempoInventario->duracion_minutos,
                'tipo_inventario' => $medicionTiempoInventario->tipo_inventario,
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
        $puedeVerTodos = $request->user()->hasAnyRole(['Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $vehiculos = Vehiculo::where('is_active', true)
            ->orderBy('placa')
            ->get(['id', 'placa', 'modelo']);

        $colaboradores = Colaborador::where('is_active', true)
            ->orderBy('nombres')
            ->get(['id', 'cedula', 'nombres', 'apellidos']);

        return Inertia::render('reparto/medicion-tiempos-inventario/edit', [
            'registro' => [
                'id' => $medicionTiempoInventario->id,
                'fecha_medicion' => $medicionTiempoInventario->fecha_medicion?->toDateString(),
                'hora_inicio' => $medicionTiempoInventario->hora_inicio?->format('H:i'),
                'hora_fin' => $medicionTiempoInventario->hora_fin?->format('H:i'),
                'tipo_inventario' => $medicionTiempoInventario->tipo_inventario,
                'vehiculo_id' => $medicionTiempoInventario->vehiculo_id,
                'colaborador_id' => $medicionTiempoInventario->colaborador_id,
            ],
            'vehiculos'     => $vehiculos,
            'colaboradores' => $colaboradores,
            'esColaborador' => $request->user()->hasRole('Colaborador')
                               && !$request->user()->hasAnyRole(['Administrador', 'Reparto']),
        ]);
    }

    /**
     * Actualizar una medición existente.
     * Si viene accion=finalizar registra hora_fin=now() y calcula duración.
     */
    public function update(Request $request, MedicionTiempoInventario $medicionTiempoInventario): RedirectResponse
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $esColaborador = $request->user()->hasRole('Colaborador')
            && !$request->user()->hasAnyRole(['Administrador', 'Reparto']);

        // ── Finalizar inventario ──────────────────────────────────────────────
        if ($request->input('accion') === 'finalizar') {
            $ahora   = now();
            $horaFin = $ahora->format('H:i');

            $duracion = null;
            $horaInicio = $medicionTiempoInventario->hora_inicio;
            if ($horaInicio) {
                $inicio  = \Carbon\Carbon::parse($horaInicio);
                $fin     = \Carbon\Carbon::parse($horaFin);
                $duracion = (int) $inicio->diffInMinutes($fin);
            }

            $medicionTiempoInventario->update([
                'hora_fin'        => $horaFin,
                'fecha_medicion'  => $ahora->toDateString(),   // fecha real de cierre
                'tipo_inventario' => 'finalizacion',
                'duracion_minutos'=> $duracion,
            ]);

            if ($esColaborador) {
                return to_route('reparto.medicion-tiempos-inventario.create')
                    ->with('status', "Inventario finalizado a las {$horaFin}. Duración: {$duracion} minutos. ¡Listo!");
            }

            return to_route('reparto.medicion-tiempos-inventario.index')
                ->with('status', 'Inventario finalizado. Hora de finalización registrada correctamente.');
        }

        // ── Edición general (campos básicos + horas) ─────────────────────────
        $validated = $request->validate([
            'fecha_medicion' => 'required|date',
            'vehiculo_id'    => 'required|exists:vehiculos,id',
            'colaborador_id' => 'required|exists:colaboradores,id',
            'hora_inicio'    => 'nullable|date_format:H:i',
            'hora_fin'       => 'nullable|date_format:H:i',
        ], [
            'vehiculo_id.required'    => 'La placa del vehículo es obligatoria.',
            'colaborador_id.required' => 'El colaborador es obligatorio.',
            'hora_inicio.date_format' => 'La hora de inicio debe tener formato HH:MM.',
            'hora_fin.date_format'    => 'La hora de fin debe tener formato HH:MM.',
        ]);

        // Recalcular duración si se tienen ambas horas
        if (!empty($validated['hora_inicio']) && !empty($validated['hora_fin'])) {
            $inicio  = \Carbon\Carbon::parse($validated['hora_inicio']);
            $fin     = \Carbon\Carbon::parse($validated['hora_fin']);
            $validated['duracion_minutos'] = (int) $inicio->diffInMinutes($fin);
        }

        $medicionTiempoInventario->update($validated);

        return to_route('reparto.medicion-tiempos-inventario.index')
            ->with('status', 'Medición actualizada correctamente.');
    }

    /**
     * Eliminar una medición
     */
    public function destroy(Request $request, MedicionTiempoInventario $medicionTiempoInventario): RedirectResponse
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Administrador', 'Reparto']);

        abort_unless($puedeVerTodos || $medicionTiempoInventario->user_id === $request->user()->id, 403);

        $medicionTiempoInventario->delete();

        return to_route('reparto.medicion-tiempos-inventario.index')
            ->with('status', 'Medición de tiempo eliminada correctamente.');
    }

    /**
     * Exportar registros a CSV con todos los campos, respetando los filtros activos.
     */
    public function exportar(Request $request): StreamedResponse
    {
        $filtros = [
            'fecha_desde' => $request->string('fecha_desde')->toString(),
            'fecha_hasta' => $request->string('fecha_hasta')->toString(),
            'placa'       => $request->string('placa')->toString(),
            'colaborador' => $request->string('colaborador')->toString(),
        ];

        $query = MedicionTiempoInventario::query()
            ->with(['user:id,name', 'colaborador:id,cedula,nombres,apellidos', 'vehiculo:id,placa,modelo'])
            ->when($filtros['fecha_desde'], fn ($q) => $q->whereDate('fecha_medicion', '>=', $filtros['fecha_desde']))
            ->when($filtros['fecha_hasta'], fn ($q) => $q->whereDate('fecha_medicion', '<=', $filtros['fecha_hasta']))
            ->when($filtros['placa'], fn ($q) => $q->whereHas('vehiculo', fn ($q2) => $q2->where('placa', 'like', "%{$filtros['placa']}%")))
            ->when($filtros['colaborador'], fn ($q) => $q->whereHas('colaborador', fn ($q2) => $q2
                ->where('cedula', 'like', "%{$filtros['colaborador']}%")
                ->orWhere('nombres', 'like', "%{$filtros['colaborador']}%")
                ->orWhere('apellidos', 'like', "%{$filtros['colaborador']}%")
            ))
            ->orderBy('fecha_medicion', 'desc')
            ->orderBy('created_at', 'desc');

        $filename = 'medicion_tiempos_inventario_' . now()->format('Y-m-d_H-i') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'no-cache, no-store, must-revalidate',
        ];

        $callback = function () use ($query) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($file, [
                'ID',
                'FECHA MEDICIÓN',
                'HORA INICIO',
                'HORA FIN',
                'DURACIÓN (min)',
                'TIPO INVENTARIO',
                'PLACA VEHÍCULO',
                'MODELO VEHÍCULO',
                'CÉDULA COLABORADOR',
                'NOMBRE COLABORADOR',
                'REGISTRADO POR',
                'FECHA REGISTRO',
            ]);

            $query->chunk(500, function ($registros) use ($file) {
                foreach ($registros as $r) {
                    $horaInicio = $r->hora_inicio instanceof \DateTimeInterface
                        ? $r->hora_inicio->format('H:i')
                        : (string) ($r->hora_inicio ?? '');
                    $horaFin = $r->hora_fin instanceof \DateTimeInterface
                        ? $r->hora_fin->format('H:i')
                        : (string) ($r->hora_fin ?? '');
                    $fechaMedicion = $r->fecha_medicion instanceof \DateTimeInterface
                        ? $r->fecha_medicion->format('Y-m-d')
                        : (string) ($r->fecha_medicion ?? '');
                    $nombreColaborador = $r->colaborador
                        ? trim("{$r->colaborador->nombres} {$r->colaborador->apellidos}")
                        : '';

                    fputcsv($file, [
                        $r->id,
                        $fechaMedicion,
                        $horaInicio,
                        $horaFin,
                        $r->duracion_minutos ?? '',
                        $r->tipo_inventario ?? '',
                        $r->vehiculo?->placa ?? '',
                        $r->vehiculo?->modelo ?? '',
                        $r->colaborador?->cedula ?? '',
                        $nombreColaborador,
                        $r->user?->name ?? $r->creado_por ?? '',
                        $r->created_at?->format('Y-m-d H:i') ?? '',
                    ]);
                }
            });

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
