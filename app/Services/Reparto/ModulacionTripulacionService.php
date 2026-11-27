<?php

namespace App\Services\Reparto;

use App\Models\Reparto\Modulacion;
use App\Models\Seguridad\Colaborador;
use Illuminate\Support\Collection;

class ModulacionTripulacionService
{
    /**
     * Devuelve colaboradores activos. Si se indica $centro ('UC' o 'UD') solo retorna
     * los de ese centro; sin $centro devuelve todos (uso interno / compatibilidad).
     *
     * @return array<int, array{id: int, cedula: ?string, nombres: string, apellidos: string, nombre_completo: string, cargo: string, area: ?string, centro: ?string}>
     */
    public function colaboradoresActivos(?string $centro = null): array
    {
        return Colaborador::query()
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'area', 'centro'])
            ->where('is_active', true)
            ->when($centro !== null, fn ($query) => $query->where('centro', $this->normalizarCentro($centro)))
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
                'centro' => $colaborador->centro,
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

        return array_map(function ($ruta) use ($cargosGuardados, $colaboradoresActuales) {
            if (! is_array($ruta['tripulacion'] ?? null)) {
                return $ruta;
            }

            $ruta['tripulacion'] = array_map(
                fn ($miembro) => is_array($miembro)
                    ? $this->resolverCargo($miembro, $cargosGuardados, $colaboradoresActuales)
                    : $miembro,
                $ruta['tripulacion']
            );

            return $ruta;
        }, $rutas);
    }

    /**
     * Prioridad del cargo de un miembro:
     * 1) guardado por id, 2) guardado por cédula, 3) actual del colaborador (por id o cédula).
     * Si no hay coincidencia, el miembro queda igual.
     *
     * @param  array<string, mixed>  $miembro
     * @param  array{por_id: array<string, mixed>, por_cedula: array<string, mixed>}  $cargosGuardados
     * @param  array{por_id: Collection, por_cedula: Collection}  $colaboradoresActuales
     * @return array<string, mixed>
     */
    private function resolverCargo(array $miembro, array $cargosGuardados, array $colaboradoresActuales): array
    {
        $id = $this->claveId($miembro);
        $cedula = $this->claveCedula($miembro);

        foreach ([[$cargosGuardados['por_id'], $id], [$cargosGuardados['por_cedula'], $cedula]] as [$guardados, $clave]) {
            if ($clave !== null && array_key_exists($clave, $guardados)) {
                return array_merge($miembro, ['cargo' => $guardados[$clave]]);
            }
        }

        $colaborador = $colaboradoresActuales['por_id']->get($id ?? '')
            ?? $colaboradoresActuales['por_cedula']->get($cedula ?? '');

        return $colaborador
            ? array_merge($miembro, ['cargo' => $colaborador->cargo])
            : $miembro;
    }

    /**
     * Cargo guardado de cada miembro en la planeación (gana la primera aparición).
     * La planeación ya pertenece a un único centro, así que no hay mezcla UC/UD.
     *
     * @return array{por_id: array<string, mixed>, por_cedula: array<string, mixed>}
     */
    private function cargosGuardados(Modulacion $modulacion): array
    {
        $miembros = $this->miembros(
            $modulacion->items()->orderBy('id')->get(['tripulacion'])
                ->map(fn ($item) => is_array($item->tripulacion) ? $item->tripulacion : [])
        );

        return [
            'por_id' => $this->primerCargoPorClave($miembros, 'colaborador_id', fn ($valor) => (string) $valor),
            'por_cedula' => $this->primerCargoPorClave($miembros, 'cedula', fn ($valor) => trim((string) $valor)),
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $miembros
     * @return array<string, mixed>
     */
    private function primerCargoPorClave(Collection $miembros, string $campo, callable $normalizar): array
    {
        return $miembros
            ->filter(fn (array $miembro) => ! empty($miembro[$campo]))
            ->unique(fn (array $miembro) => $normalizar($miembro[$campo]))
            ->mapWithKeys(fn (array $miembro) => [$normalizar($miembro[$campo]) => $miembro['cargo'] ?? null])
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $rutas
     * @return array{por_id: Collection, por_cedula: Collection}
     */
    private function colaboradoresDeRutas(array $rutas): array
    {
        $miembros = $this->miembros(
            collect($rutas)->map(fn ($ruta) => is_array($ruta['tripulacion'] ?? null) ? $ruta['tripulacion'] : [])
        );

        $ids = $miembros->pluck('colaborador_id')->filter()->unique()->values()->all();
        $cedulas = $miembros->pluck('cedula')->filter()
            ->map(fn ($cedula) => trim((string) $cedula))
            ->unique()->values()->all();

        if ($ids === [] && $cedulas === []) {
            return ['por_id' => collect(), 'por_cedula' => collect()];
        }

        $colaboradores = Colaborador::query()
            ->select(['id', 'cedula', 'cargo'])
            ->where(fn ($query) => $query
                ->whereIn('id', $ids)
                ->orWhereIn('cedula', $cedulas))
            ->get();

        return [
            'por_id' => $colaboradores->keyBy(fn (Colaborador $colaborador) => (string) $colaborador->id),
            'por_cedula' => $colaboradores
                ->filter(fn (Colaborador $colaborador) => filled($colaborador->cedula))
                ->keyBy(fn (Colaborador $colaborador) => trim((string) $colaborador->cedula)),
        ];
    }

    /**
     * Aplana listas de tripulaciones en una sola colección de miembros válidos (arrays).
     *
     * @param  Collection<int, array<int, mixed>>  $tripulaciones
     * @return Collection<int, array<string, mixed>>
     */
    private function miembros(Collection $tripulaciones): Collection
    {
        return $tripulaciones->flatten(1)->filter(fn($item) => is_array($item))->values();
    }

    private function claveId(array $miembro): ?string
    {
        return empty($miembro['colaborador_id']) ? null : (string) $miembro['colaborador_id'];
    }

    private function claveCedula(array $miembro): ?string
    {
        return empty($miembro['cedula']) ? null : trim((string) $miembro['cedula']);
    }

    /** Acepta "uc", " UD ", etc. y deja siempre 'UC' o 'UD' en mayúscula. */
    private function normalizarCentro(?string $centro): string
    {
        return strtoupper(trim((string) $centro));
    }
}