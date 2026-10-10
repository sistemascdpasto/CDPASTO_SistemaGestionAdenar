<?php

namespace App\Http\Controllers\Colaborador;

use App\Http\Controllers\Controller;
use App\Models\GeovictoriaAsistencia;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IncidenciaGeovictoriaController extends Controller
{
    public function index(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);
        $cedula = trim((string) ($colaborador->cedula ?? ''));

        $base = fn () => GeovictoriaAsistencia::query()
            ->where('identificador', $cedula)
            ->where(fn ($q) => $q->where('exceso_jornada', true)->orWhere('descanso_no_efectivo', true));

        $incidencias = $base()
            ->orderByDesc('fecha')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (GeovictoriaAsistencia $r) => [
                'id' => $r->id,
                'fecha' => $r->fecha->format('Y-m-d'),
                'exceso_jornada' => $r->exceso_jornada,
                'descanso_no_efectivo' => $r->descanso_no_efectivo,
                'turno' => $r->turno,
                'entrada' => $r->entrada,
                'salida' => $r->salida,
                'horas_trabajadas' => $r->horas_trabajadas,
                'horas_descanso_previo' => $r->horas_descanso_previo,
            ]);

        $hace30 = now()->subDays(30)->toDateString();

        return Inertia::render('colaborador/mis-incidencias-geovictoria/index', [
            'incidencias' => $incidencias,
            'resumen' => [
                'total_exceso_jornada' => $base()->where('exceso_jornada', true)->count(),
                'total_descanso_no_efectivo' => $base()->where('descanso_no_efectivo', true)->count(),
                'recientes_30_dias' => $base()->whereDate('fecha', '>=', $hace30)->count(),
                'ultima_fecha' => $base()->max('fecha'),
            ],
        ]);
    }

    private function colaboradorDeOFallar(Request $request): Colaborador
    {
        return $request->user()->colaborador ?? abort(
            403,
            'Tu cuenta todavía no está vinculada a un registro de colaborador. Contacta a un administrador.'
        );
    }
}
