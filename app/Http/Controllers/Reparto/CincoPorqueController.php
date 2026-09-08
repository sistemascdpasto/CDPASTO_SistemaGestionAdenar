<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reparto\StoreCincoPorqueRequest;
use App\Models\Flota\Vehiculo;
use App\Models\Reparto\CincoPorque;
use App\Services\Reparto\CincoPorquesIaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class CincoPorqueController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('cinco-porques/create', [
            'ejecutor' => $request->user()->name,
            'vehiculos' => Vehiculo::query()
                ->where('is_active', true)
                ->orderBy('placa')
                ->get(['id', 'placa'])
                ->map(fn (Vehiculo $v) => ['id' => $v->id, 'placa' => $v->placa]),
            'rutinaFija' => config('cinco_porques.rutinas')[0],
            'indicadores' => config('cinco_porques.indicadores'),
        ]);
    }

    public function store(StoreCincoPorqueRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $vehiculo = ! empty($data['vehiculo_id'])
            ? Vehiculo::find($data['vehiculo_id'])
            : null;

        CincoPorque::create([
            ...$data,
            'user_id' => $request->user()->id,
            'colaborador_id' => $request->user()->colaborador?->id,
            'vehiculo_id' => $vehiculo?->id,
            'ia_sugerencias' => filled($data['ia_sugerencias'] ?? null)
                ? json_decode($data['ia_sugerencias'], true)
                : null,
        ]);

        return to_route('cinco-porques.historial')
            ->with('status', 'Análisis 5 Por Qué guardado correctamente.');
    }

    public function historial(Request $request): Response
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Reparto', 'Administrador']);

        $filtros = [
            'indicador' => $request->string('indicador')->toString(),
            'desde' => $request->date('desde')?->toDateString(),
            'hasta' => $request->date('hasta')?->toDateString(),
        ];

        $registros = CincoPorque::query()
            ->with(['colaborador:id,nombres,apellidos', 'user:id,name', 'vehiculo:id,placa'])
            ->when(! $puedeVerTodos, fn ($q) => $q->where('user_id', $request->user()->id))
            ->when($filtros['indicador'] !== '', fn ($q) => $q->where('indicador', $filtros['indicador']))
            ->when($filtros['desde'], fn ($q) => $q->whereDate('fecha', '>=', $filtros['desde']))
            ->when($filtros['hasta'], fn ($q) => $q->whereDate('fecha', '<=', $filtros['hasta']))
            ->latest('fecha')
            ->latest('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (CincoPorque $registro) => [
                'id' => $registro->id,
                'fecha' => $registro->fecha?->toDateString(),
                'ejecutor' => $registro->colaborador
                    ? trim("{$registro->colaborador->nombres} {$registro->colaborador->apellidos}")
                    : $registro->user?->name,
                'placa' => $registro->vehiculo?->placa,
                'rutina' => $registro->rutina,
                'indicador' => $registro->indicador,
                'problema' => $registro->problema,
                'creado' => $registro->created_at?->toIso8601String(),
            ]);

        return Inertia::render('cinco-porques/historial', [
            'registros' => $registros,
            'filtros' => $filtros,
            'indicadores' => config('cinco_porques.indicadores'),
            'puedeVerTodos' => $puedeVerTodos,
        ]);
    }

    public function show(Request $request, CincoPorque $cincoPorque): Response
    {
        $puedeVerTodos = $request->user()->hasAnyRole(['Reparto', 'Administrador']);

        abort_unless($puedeVerTodos || $cincoPorque->user_id === $request->user()->id, 403);

        $cincoPorque->load(['colaborador:id,nombres,apellidos', 'user:id,name', 'vehiculo:id,placa']);

        return Inertia::render('cinco-porques/show', [
            'registro' => [
                'id' => $cincoPorque->id,
                'fecha' => $cincoPorque->fecha?->toDateString(),
                'ejecutor' => $cincoPorque->colaborador
                    ? trim("{$cincoPorque->colaborador->nombres} {$cincoPorque->colaborador->apellidos}")
                    : $cincoPorque->user?->name,
                'placa' => $cincoPorque->vehiculo?->placa,
                'rutina' => $cincoPorque->rutina,
                'indicador' => $cincoPorque->indicador,
                'problema' => $cincoPorque->problema,
                'porques' => $cincoPorque->porquesArray(),
                'causa_raiz' => $cincoPorque->causa_raiz,
                'plan_accion' => $cincoPorque->plan_accion,
                'creado' => $cincoPorque->created_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Endpoint JSON que consume el asistente de IA:
     *  - con menos de 5 "por qué" definidos: devuelve las opciones del siguiente nivel.
     *  - con 5 "por qué": devuelve la conclusión (causa raíz + plan de acción).
     */
    public function analizarIa(Request $request, CincoPorquesIaService $ia): JsonResponse
    {
        $validado = $request->validate([
            'problema' => ['required', 'string', 'max:2000'],
            'rutina' => ['required', 'string', Rule::in(config('cinco_porques.rutinas'))],
            'indicador' => ['required', 'string', Rule::in(config('cinco_porques.indicadores'))],
            'seleccionados' => ['present', 'array', 'max:5'],
            'seleccionados.*' => ['required', 'string', 'max:1000'],
        ]);

        $seleccionados = array_values($validado['seleccionados']);

        try {
            if (count($seleccionados) >= 5) {
                return response()->json([
                    'tipo' => 'conclusion',
                    ...$ia->conclusion($validado['problema'], $validado['rutina'], $validado['indicador'], array_slice($seleccionados, 0, 5)),
                ]);
            }

            return response()->json([
                'tipo' => 'opciones',
                'nivel' => count($seleccionados) + 1,
                'opciones' => $ia->opcionesSiguienteNivel($validado['problema'], $validado['rutina'], $validado['indicador'], $seleccionados),
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}
