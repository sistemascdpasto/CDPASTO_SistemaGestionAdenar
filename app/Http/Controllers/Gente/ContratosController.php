<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Colaborador;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class ContratosController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $estado = $request->string('estado')->trim()->toString();

        $colaboradores = Colaborador::query()
            ->select([
                'id',
                'cedula',
                'nombres',
                'apellidos',
                'cargo',
                'tipo_contrato',
                'fecha_ingreso_empresa',
                'fecha_retiro_empresa',
                'is_active',
            ])
            ->completos()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombres', 'like', "%{$search}%")
                        ->orWhere('apellidos', 'like', "%{$search}%")
                        ->orWhere('cedula', 'like', "%{$search}%");
                });
            })
            ->when($estado === 'activo', fn ($query) => $query->where('is_active', true))
            ->when($estado === 'inactivo', fn ($query) => $query->where('is_active', false))
            ->orderBy('nombres')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('gente/contratos/index', [
            'colaboradores' => $colaboradores,
            'filters' => [
                'search' => $search,
                'estado' => $estado,
            ],
        ]);
    }

    /**
     * Genera y descarga la carta de prórroga de contrato en PDF.
     * La nueva fecha de finalización se recibe como query param ?fecha=YYYY-MM-DD.
     * Si no se pasa, se usa la fecha_retiro_empresa actual del colaborador.
     */
    public function exportarProrrogaPdf(Request $request, Colaborador $colaborador): HttpResponse
    {
        $request->validate([
            'fecha' => ['nullable', 'date'],
        ]);

        $nuevaFecha = $request->input('fecha')
            ? \Illuminate\Support\Carbon::parse($request->input('fecha'))
            : $colaborador->fecha_retiro_empresa;

        $nuevaFechaFinalizacion = $nuevaFecha?->format('d/m/Y') ?? '—';
        $fechaEmision = now()->locale('es')->isoFormat('D [de] MMMM [de] YYYY');

        $pdf = Pdf::loadView('gente.prorroga-contrato-pdf', [
            'colaborador'           => $colaborador,
            'nuevaFechaFinalizacion' => $nuevaFechaFinalizacion,
            'fechaEmision'          => $fechaEmision,
        ])->setPaper('a4', 'portrait');

        $nombreArchivo = 'prorroga-contrato-' . str($colaborador->nombre_completo)->slug() . '.pdf';

        return $pdf->download($nombreArchivo);
    }
}
