<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\EvaluacionMedica;
use App\Models\Seguridad\EvaluacionRecomendacion;
use App\Models\Seguridad\RecomendacionSeguimiento;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecomendacionSeguimientoController extends Controller
{
    public function store(Request $request, EvaluacionMedica $evaluacion, EvaluacionRecomendacion $evaluacionRecomendacion): RedirectResponse
    {
        $data = $request->validate([
            'fecha_seguimiento' => ['required', 'date'],
            'estado_seguimiento' => ['required', Rule::in(config('gente.examenes_medicos.recomendaciones.estados_seguimiento'))],
            'observacion' => ['nullable', 'string', 'max:2000'],
            'fecha_proximo_seguimiento' => ['nullable', 'date'],
            'carta_recomendacion_entregada' => ['nullable', 'boolean'],
        ]);

        $soportePaths = [];
        if ($request->hasFile('soporte')) {
            $files = $request->file('soporte');
            $fileArray = is_array($files) ? $files : [$files];
            foreach ($fileArray as $file) {
                if ($file && $file->isValid()) {
                    $originalName = $file->getClientOriginalName();
                    $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $originalName);
                    $soportePaths[] = $file->storeAs('recomendaciones-seguimientos', $safeName, 'public');
                }
            }
        }

        $soportePath = match(count($soportePaths)) {
            0 => null,
            1 => $soportePaths[0],
            default => json_encode($soportePaths),
        };

        $evaluacionRecomendacion->seguimientos()->create([
            'fecha_seguimiento' => $data['fecha_seguimiento'],
            'estado_seguimiento' => $data['estado_seguimiento'],
            'observacion' => $data['observacion'] ?? null,
            'responsable_id' => $request->user()?->id,
            'fecha_proximo_seguimiento' => !empty($data['fecha_proximo_seguimiento']) ? $data['fecha_proximo_seguimiento'] : null,
            'carta_recomendacion_entregada' => $request->boolean('carta_recomendacion_entregada'),
            'soporte_path' => $soportePath,
        ]);

        $evaluacionRecomendacion->update([
            'observacion' => $data['observacion'] ?? null,
            'soporte_path' => $soportePath,
        ]);

        return back()->with('status', 'Seguimiento registrado.');
    }

    public function update(Request $request, EvaluacionMedica $evaluacion, EvaluacionRecomendacion $evaluacionRecomendacion, RecomendacionSeguimiento $seguimiento): RedirectResponse
    {
        $data = $request->validate([
            'fecha_seguimiento' => ['required', 'date'],
            'estado_seguimiento' => ['required', Rule::in(config('gente.examenes_medicos.recomendaciones.estados_seguimiento'))],
            'observacion' => ['nullable', 'string', 'max:2000'],
            'fecha_proximo_seguimiento' => ['nullable', 'date'],
            'carta_recomendacion_entregada' => ['nullable', 'boolean'],
        ]);

        $updateData = [
            'fecha_seguimiento' => $data['fecha_seguimiento'],
            'estado_seguimiento' => $data['estado_seguimiento'],
            'observacion' => $data['observacion'] ?? null,
            'responsable_id' => $request->user()?->id,
            'fecha_proximo_seguimiento' => !empty($data['fecha_proximo_seguimiento']) ? $data['fecha_proximo_seguimiento'] : null,
            'carta_recomendacion_entregada' => $request->boolean('carta_recomendacion_entregada'),
        ];

        if ($request->hasFile('soporte')) {
            $soportePaths = [];
            $files = $request->file('soporte');
            $fileArray = is_array($files) ? $files : [$files];
            foreach ($fileArray as $file) {
                if ($file && $file->isValid()) {
                    $originalName = $file->getClientOriginalName();
                    $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $originalName);
                    $soportePaths[] = $file->storeAs('recomendaciones-seguimientos', $safeName, 'public');
                }
            }
            $kept = $this->parseSoportePaths($request->input('existing_soporte_path'));
            $allPaths = array_merge($kept, $soportePaths);
            $updateData['soporte_path'] = match(count($allPaths)) {
                0 => null,
                1 => $allPaths[0],
                default => json_encode(array_values($allPaths)),
            };
        } elseif ($request->has('existing_soporte_path') || array_key_exists('existing_soporte_path', $request->all())) {
            $kept = $this->parseSoportePaths($request->input('existing_soporte_path'));
            $updateData['soporte_path'] = match(count($kept)) {
                0 => null,
                1 => $kept[0],
                default => json_encode(array_values($kept)),
            };
        }

        $seguimiento->update($updateData);

        $evaluacionRecomendacion->update([
            'observacion' => $data['observacion'] ?? null,
            'soporte_path' => $updateData['soporte_path'] ?? null,
        ]);

        return back()->with('status', 'Seguimiento actualizado.');
    }

    private function parseSoportePaths(mixed $input): array
    {
        if (empty($input)) return [];
        if (is_array($input)) return array_values(array_filter($input));
        $trimmed = trim((string) $input);
        if (empty($trimmed) || $trimmed === 'null' || $trimmed === 'undefined') return [];
        if (str_starts_with($trimmed, '[')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) return array_values(array_filter($decoded));
        }
        return [$trimmed];
    }

    public function destroy(EvaluacionMedica $evaluacion, EvaluacionRecomendacion $evaluacionRecomendacion, RecomendacionSeguimiento $seguimiento): RedirectResponse
    {
        $seguimiento->delete();

        $remainingCount = $evaluacionRecomendacion->seguimientos()->count();
        if ($remainingCount === 0) {
            $evaluacionRecomendacion->delete();
            return back()->with('status', 'Recomendación eliminada.');
        }

        $latestSeg = $evaluacionRecomendacion->seguimientos()->latest('id')->first();
        $evaluacionRecomendacion->update([
            'observacion' => $latestSeg?->observacion ?? null,
            'soporte_path' => $latestSeg?->soporte_path ?? null,
        ]);

        return back()->with('status', 'Seguimiento eliminado.');
    }
}
