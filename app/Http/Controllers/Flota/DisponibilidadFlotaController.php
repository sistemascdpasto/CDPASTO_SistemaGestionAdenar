<?php

namespace App\Http\Controllers\Flota;

use App\Exports\Flota\DisponibilidadFlotaExport;
use App\Http\Controllers\Controller;
use App\Models\Flota\ActaTaller;
use App\Models\Flota\Carreta;
use App\Models\Flota\Vehiculo;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class DisponibilidadFlotaController extends Controller
{
    public function index(): Response
    {
        [$resumenFlota, $resumenCarretas, $tabla] = $this->calcular();

        return Inertia::render('flota/disponibilidad/index', [
            'fecha' => now()->translatedFormat('d/m/Y'),
            'resumenFlota' => $resumenFlota,
            'resumenCarretas' => $resumenCarretas,
            'tabla' => $tabla,
        ]);
    }

    public function exportarExcel()
    {
        [$resumenFlota, $resumenCarretas, $tabla] = $this->calcular();

        return Excel::download(
            new DisponibilidadFlotaExport($resumenFlota, $resumenCarretas, $tabla),
            'disponibilidad-flota-'.now()->format('Y-m-d').'.xlsx',
        );
    }

    /**
     * Cruza vehículos y carretas activos contra las Actas de Taller
     * actualmente abiertas para calcular los conteos de disponibilidad y la
     * tabla de "en taller" del reporte. Un vehículo/carreta cuenta como
     * indisponible si tiene un acta con estado_acta = en_taller ahora mismo
     * (no el flag manual is_active, que no está sincronizado con las actas).
     *
     * @return array{0: array<string, int|float>, 1: array<string, int|float>, 2: Collection}
     */
    private function calcular(): array
    {
        $placasFlota = Vehiculo::where('is_active', true)->pluck('placa');
        $placasCarretas = Carreta::where('is_active', true)->pluck('placa');

        $actasAbiertas = ActaTaller::where('estado_acta', ActaTaller::ESTADO_EN_TALLER)
            ->whereIn('placa', $placasFlota->merge($placasCarretas))
            ->with('novedades')
            ->orderBy('fecha_entrega')
            ->get();

        $placasFlotaEnTaller = $actasAbiertas->whereIn('placa', $placasFlota)->pluck('placa')->unique();
        $placasCarretasEnTaller = $actasAbiertas->whereIn('placa', $placasCarretas)->pluck('placa')->unique();

        $resumenFlota = $this->resumen($placasFlota->count(), $placasFlotaEnTaller->count());
        $resumenCarretas = $this->resumen($placasCarretas->count(), $placasCarretasEnTaller->count());

        $tabla = $actasAbiertas->map(fn (ActaTaller $acta) => [
            'placa' => $acta->placa,
            'fecha_ingreso' => $acta->fecha_entrega?->format('d/m/Y'),
            'novedades' => $acta->novedades->pluck('titulo')->filter()->implode(', ') ?: ($acta->motivo_ingreso ?? '—'),
            'entrega_estimada' => $acta->fecha_estimada_solucion?->format('d/m/Y') ?? '—',
            'dias_en_taller' => $acta->fecha_entrega ? (int) $acta->fecha_entrega->diffInDays(now()) : null,
            'taller' => $acta->taller ?? '—',
        ])->values();

        return [$resumenFlota, $resumenCarretas, $tabla];
    }

    /**
     * @return array{asignada: int, indisponible: int, disponible: int, porcentaje: float}
     */
    private function resumen(int $asignada, int $indisponible): array
    {
        $disponible = $asignada - $indisponible;
        $porcentaje = $asignada > 0 ? round($disponible / $asignada * 100, 1) : 0.0;

        return [
            'asignada' => $asignada,
            'indisponible' => $indisponible,
            'disponible' => $disponible,
            'porcentaje' => $porcentaje,
        ];
    }
}
