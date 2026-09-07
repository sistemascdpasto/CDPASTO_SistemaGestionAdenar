<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\EvaluacionOwd;
use App\Models\Seguridad\EvaluacionOwdImportacion;
use Inertia\Inertia;
use Inertia\Response;

class EvaluacionOwdImportacionController extends Controller
{
    public function index(): Response
    {
        $importaciones = EvaluacionOwdImportacion::with('usuario:id,name')
            ->latest()
            ->paginate(20);

        // QRs sin coincidencia: evaluaciones_owd donde colaborador_id es NULL
        // Se agrupan por qr_safety para no repetir el mismo QR mil veces
        $sinCoincidencia = EvaluacionOwd::whereNull('colaborador_id')
            ->whereNotNull('qr_safety')
            ->select(['qr_safety', 'evaluado', 'agencia', 'fecha_evaluacion'])
            ->orderBy('qr_safety')
            ->get()
            ->groupBy('qr_safety')
            ->map(fn ($filas) => [
                'qr'       => $filas->first()->qr_safety,
                'evaluado' => $filas->first()->evaluado,
                'agencia'  => $filas->first()->agencia,
                'total_filas' => $filas->count(),
                'ultima_fecha' => $filas->max('fecha_evaluacion'),
            ])
            ->values();

        return Inertia::render('seguridad/evaluaciones-owd/importaciones', [
            'importaciones'    => $importaciones,
            'sin_coincidencia' => $sinCoincidencia,
        ]);
    }
}
