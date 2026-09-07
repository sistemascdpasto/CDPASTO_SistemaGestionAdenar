<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Aci;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AciController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->only(['folio', 'fecha_desde', 'fecha_hasta', 'colaborador', 'tipo_riesgo']);

        $acis = Aci::query()
            ->with('colaborador:id,nombres,apellidos,cedula,centro')
            ->when($filtros['folio'] ?? null, fn ($query, $folio) => $query->where('folio', 'like', "%{$folio}%"))
            ->when($filtros['fecha_desde'] ?? null, fn ($query, $fecha) => $query->whereDate('fecha_incidente', '>=', $fecha))
            ->when($filtros['fecha_hasta'] ?? null, fn ($query, $fecha) => $query->whereDate('fecha_incidente', '<=', $fecha))
            ->when($filtros['tipo_riesgo'] ?? null, fn ($query, $tipo) => $query->where('tipo_riesgo', 'like', "%{$tipo}%"))
            ->when(
                $filtros['colaborador'] ?? null,
                fn ($query, $texto) => $query->whereHas('colaborador', function ($q) use ($texto) {
                    $q->where('nombres', 'like', "%{$texto}%")
                        ->orWhere('apellidos', 'like', "%{$texto}%")
                        ->orWhere('cedula', 'like', "%{$texto}%")
                        ->orWhere('codigo_qr_skap', 'like', "%{$texto}%");
                }),
            )
            ->latest('fecha_incidente')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('seguridad/acis/index', [
            'acis' => $acis,
            'filters' => $filtros,
        ]);
    }

    public function show(Aci $aci): Response
    {
        $aci->load(['colaborador', 'asignador', 'asignado']);

        return Inertia::render('seguridad/acis/show', [
            'aci' => $aci,
        ]);
    }
}
