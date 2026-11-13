<?php

namespace App\Services\Reparto;

use App\Models\Reparto\Modulacion;
use App\Models\Seguridad\Colaborador;

class ModulacionTripulacionService
{
    /**
     * @return array<int, array{id: int, cedula: ?string, nombres: string, apellidos: string, nombre_completo: string, cargo: string, area: ?string}>
     */
    public function colaboradoresActivos(): array
    {
        return Colaborador::query()
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'area'])
            ->where('is_active', true)
            ->orderBy('nombres')
            ->get()
            ->map(fn (Colaborador $colaborador) => [
                'id' => $colaborador->id,
                'cedula' => $colaborador->cedula,
                'nombres' => $colaborador->nombres,
                'apellidos' => $colaborador->apellidos,
                'nombre_completo' => trim("{$colaborador->nombres} {$colaborador->apellidos}"),
                'cargo' => $colaborador->cargo ?? '',
                'area' => $colaborador->area,
            ])
            ->all();
    }

    /**
     * Existing assignments retain their saved cargo snapshot. New assignments
     * take the collaborator's current cargo from the personnel record.
     *
     * @param  array<int, array<string, mixed>>  $rutas
     * @return array<int, array<string, mixed>>
     */
    public function preservarCargosGuardados(array $rutas, Modulacion $modulacion): array
    {
        $cargosGuardados = $this->cargosGuardados($modulacion);
        $colaboradoresActuales = $this->colaboradoresDeRutas($rutas);

        foreach ($rutas as &$ruta) {
            if (! is_array($ruta['tripulacion'] ?? null)) {
                continue;
            }

            foreach ($ruta['tripulacion'] as &$miembro) {
                if (! is_array($miembro)) {
                    continue;
                }

                $id = ! empty($miembro['colaborador_id']) ? (string) $miembro['colaborador_id'] : null;
                $cedula = ! empty($miembro['cedula']) ? trim((string) $miembro['cedula']) : null;

                if ($id !== null && array_key_exists($id, $cargosGuardados['por_id'])) {
                    $miembro['cargo'] = $cargosGuardados['por_id'][$id];
                    continue;
                }
                if ($cedula !== null && array_key_exists($cedula, $cargosGuardados['por_cedula'])) {
                    $miembro['cargo'] = $cargosGuardados['por_cedula'][$cedula];
                    continue;
                }

                $colaborador = $id !== null ? $colaboradoresActuales['por_id']->get($id) : null;
                $colaborador ??= $cedula !== null ? $colaboradoresActuales['por_cedula']->get($cedula) : null;

                if ($colaborador) {
                    $miembro['cargo'] = $colaborador->cargo;
                }
            }
            unset($miembro);
        }
        unset($ruta);

        return $rutas;
    }

    /**
     * @return array{por_id: array<string, mixed>, por_cedula: array<string, mixed>}
     */
    private function cargosGuardados(Modulacion $modulacion): array
    {
        $porId = [];
        $porCedula = [];

        foreach ($modulacion->items()->orderBy('id')->get(['tripulacion']) as $item) {
            foreach (is_array($item->tripulacion) ? $item->tripulacion : [] as $miembro) {
                if (! is_array($miembro)) {
                    continue;
                }

                $cargo = $miembro['cargo'] ?? null;
                if (! empty($miembro['colaborador_id'])) {
                    $id = (string) $miembro['colaborador_id'];
                    if (! array_key_exists($id, $porId)) {
                        $porId[$id] = $cargo;
                    }
                }
                if (! empty($miembro['cedula'])) {
                    $cedula = trim((string) $miembro['cedula']);
                    if (! array_key_exists($cedula, $porCedula)) {
                        $porCedula[$cedula] = $cargo;
                    }
                }
            }
        }

        return ['por_id' => $porId, 'por_cedula' => $porCedula];
    }

    /**
     * @param  array<int, array<string, mixed>>  $rutas
     * @return array{por_id: \Illuminate\Support\Collection, por_cedula: \Illuminate\Support\Collection}
     */
    private function colaboradoresDeRutas(array $rutas): array
    {
        $ids = [];
        $cedulas = [];

        foreach ($rutas as $ruta) {
            foreach ($ruta['tripulacion'] ?? [] as $miembro) {
                if (! empty($miembro['colaborador_id'])) {
                    $ids[] = $miembro['colaborador_id'];
                }
                if (! empty($miembro['cedula'])) {
                    $cedulas[] = trim((string) $miembro['cedula']);
                }
            }
        }

        $ids = array_values(array_unique($ids));
        $cedulas = array_values(array_unique($cedulas));
        if ($ids === [] && $cedulas === []) {
            return ['por_id' => collect(), 'por_cedula' => collect()];
        }

        $query = Colaborador::query()->select(['id', 'cedula', 'cargo']);
        if ($ids !== [] && $cedulas !== []) {
            $query->where(fn ($query) => $query
                ->whereIn('id', $ids)
                ->orWhereIn('cedula', $cedulas));
        } elseif ($ids !== []) {
            $query->whereIn('id', $ids);
        } else {
            $query->whereIn('cedula', $cedulas);
        }

        $colaboradores = $query->get();

        return [
            'por_id' => $colaboradores->keyBy(fn (Colaborador $colaborador) => (string) $colaborador->id),
            'por_cedula' => $colaboradores
                ->filter(fn (Colaborador $colaborador) => filled($colaborador->cedula))
                ->keyBy(fn (Colaborador $colaborador) => trim((string) $colaborador->cedula)),
        ];
    }
}
