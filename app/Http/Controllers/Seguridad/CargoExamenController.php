<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\CargoExamen;
use App\Models\Seguridad\Examen;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CargoExamenController extends Controller
{
    public function index(Request $request): Response
    {
        $cargo = $request->string('cargo')->toString();
        $tipoEvaluacion = $request->string('tipo_evaluacion', 'ingreso')->toString();

        $seleccion = [];

        if ($cargo) {
            $seleccion = CargoExamen::where('cargo', $cargo)
                ->where('tipo_evaluacion', $tipoEvaluacion)
                ->get()
                ->keyBy('examen_id')
                ->map(fn (CargoExamen $fila) => ['obligatorio' => $fila->obligatorio]);
        }

        return Inertia::render('seguridad/examenes-medicos/matriz', [
            'cargos' => config('gente.colaboradores.cargos'),
            'examenes' => Examen::where('activo', true)->orderBy('nombre')->get(['id', 'nombre', 'categoria']),
            'filtros' => ['cargo' => $cargo, 'tipo_evaluacion' => $tipoEvaluacion],
            'seleccion' => $seleccion,
        ]);
    }

    /**
     * Reemplaza de una sola vez la matriz de un cargo+tipo de evaluación —
     * más simple y seguro que sincronizar fila por fila, y no rompe nada
     * porque las evaluaciones ya creadas copian los datos de la matriz al
     * momento de generarse, no la referencian en vivo.
     */
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'cargo' => ['required', 'string'],
            'tipo_evaluacion' => ['required', Rule::in(['ingreso', 'periodico'])],
            'examenes' => ['array'],
            'examenes.*' => ['integer', 'exists:examenes,id'],
            'obligatorios' => ['array'],
            'obligatorios.*' => ['integer', 'exists:examenes,id'],
        ]);

        DB::transaction(function () use ($data) {
            CargoExamen::where('cargo', $data['cargo'])->where('tipo_evaluacion', $data['tipo_evaluacion'])->delete();

            foreach ($data['examenes'] ?? [] as $examenId) {
                CargoExamen::create([
                    'cargo' => $data['cargo'],
                    'examen_id' => $examenId,
                    'tipo_evaluacion' => $data['tipo_evaluacion'],
                    'obligatorio' => in_array($examenId, $data['obligatorios'] ?? [], true),
                    'activo' => true,
                ]);
            }
        });

        return back()->with('status', 'Matriz actualizada correctamente.');
    }
}
