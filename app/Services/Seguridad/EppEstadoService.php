<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EppEntrega;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Calcula el estado de dotación/EPP de cada colaborador en vivo, nunca por
 * un job programado: las tareas con cron no corren en producción en este
 * proyecto (ver NotificacionesService, que sigue el mismo principio). El
 * ciclo de renovación es fijo en 4 meses para todos los ítems.
 */
class EppEstadoService
{
    private const MESES_VENCIMIENTO = 4;
    private const MESES_PROXIMO = 3;

    /**
     * Última fecha de entrega de cada ítem (null si nunca se entregó) y su
     * estado: 'al_dia' | 'proximo' | 'vencido'.
     *
     * @return array<string, array{fecha: ?string, estado: string}>
     */
    public function estadoPorItem(Colaborador $colaborador): array
    {
        $entregas = $colaborador->relationLoaded('eppEntregas')
            ? $colaborador->eppEntregas
            : $colaborador->eppEntregas()->get();

        $resultado = [];
        foreach (array_keys(EppEntrega::ITEMS) as $item) {
            $ultima = $entregas->filter(fn (EppEntrega $e) => $e->$item)->sortByDesc('fecha_entrega')->first();
            $resultado[$item] = [
                'fecha' => $ultima?->fecha_entrega->format('Y-m-d'),
                'estado' => $this->clasificar($ultima?->fecha_entrega),
            ];
        }

        return $resultado;
    }

    /**
     * Resumen de un colaborador: el peor estado entre todos sus ítems (un
     * solo vencido ya lo marca como "vencido" en general).
     */
    public function resumenColaborador(Colaborador $colaborador): string
    {
        $estados = array_column($this->estadoPorItem($colaborador), 'estado');

        if (in_array('vencido', $estados, true)) {
            return 'vencido';
        }
        if (in_array('proximo', $estados, true)) {
            return 'proximo';
        }

        return 'al_dia';
    }

    private function clasificar(?Carbon $fecha): string
    {
        if (! $fecha) {
            return 'vencido';
        }

        if ($fecha->lte(now()->subMonths(self::MESES_VENCIMIENTO))) {
            return 'vencido';
        }
        if ($fecha->lte(now()->subMonths(self::MESES_PROXIMO))) {
            return 'proximo';
        }

        return 'al_dia';
    }

    /**
     * Colaboradores activos con al menos un ítem vencido o próximo a
     * vencer — para la campana de notificaciones. Trae sus entregas de una
     * sola vez (evita N+1) en vez de una consulta por colaborador.
     *
     * @return Collection<int, array{colaborador: Colaborador, estado: string}>
     */
    public function colaboradoresConAlerta(): Collection
    {
        return Colaborador::query()
            ->where('is_active', true)
            ->with('eppEntregas')
            ->get()
            ->map(fn (Colaborador $c) => ['colaborador' => $c, 'estado' => $this->resumenColaborador($c)])
            ->filter(fn (array $r) => $r['estado'] !== 'al_dia')
            ->values();
    }
}
