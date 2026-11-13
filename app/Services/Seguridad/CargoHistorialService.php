<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Único responsable de mutar el historial de cargos de un colaborador
 * (tabla colaborador_cargos) y de mantener sincronizada la columna
 * desnormalizada colaboradores.cargo. Ningún otro código debe escribir
 * directamente en colaboradores.cargo.
 */
class CargoHistorialService
{
    /**
     * Asigna un nuevo cargo a partir de la fecha de inicio indicada. Si ya
     * existe un cargo ACTIVO, se cierra (fecha_fin = fecha_inicio - 1 día,
     * estado = INACTIVO) sin eliminarlo, y se crea el nuevo registro ACTIVO.
     */
    public function asignar(
        Colaborador $colaborador,
        string $cargo,
        string $fechaInicio,
        ?string $area = null,
        ?string $perfil = null,
        bool $forzarNuevoRegistro = false,
        ?string $perfilNombre = null,
    ): void
    {
        $fechaInicio = Carbon::parse($fechaInicio)->startOfDay();

        $cargoActivo = $colaborador->cargos()
            ->where('estado', 'ACTIVO')
            ->latest('fecha_inicio')
            ->first();

        if (! $forzarNuevoRegistro && $cargoActivo && $cargoActivo->cargo === $cargo && ($area === null || $cargoActivo->area === $area)) {
            return;
        }

        DB::transaction(function () use ($colaborador, $cargo, $fechaInicio, $cargoActivo, $area, $perfil, $perfilNombre) {
            if ($cargoActivo) {
                $cargoActivo->update([
                    'fecha_fin' => $fechaInicio->copy()->subDay(),
                    'estado' => 'INACTIVO',
                ]);
            }

            $colaborador->cargos()->create([
                'cargo' => $cargo,
                'area' => $area ?? $colaborador->area,
                'perfil_nombre' => $perfilNombre,
                'perfil' => $perfil,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => null,
                'estado' => 'ACTIVO',
            ]);

            $colaborador->update([
                'cargo' => $cargo,
                ...($area !== null ? ['area' => $area] : []),
            ]);
        });
    }

    /**
     * Actualiza el cargo del colaborador sin generar un nuevo registro
     * en el historial (corrige o actualiza el cargo activo actual si existe).
     */
    public function actualizarSinHistorial(Colaborador $colaborador, string $cargo): void
    {
        DB::transaction(function () use ($colaborador, $cargo) {
            $cargoActivo = $colaborador->cargos()
                ->where('estado', 'ACTIVO')
                ->latest('fecha_inicio')
                ->first();

            if ($cargoActivo && $cargoActivo->cargo !== $cargo) {
                $cargoActivo->update(['cargo' => $cargo]);
            }

            $colaborador->update(['cargo' => $cargo]);
        });
    }

    /**
     * Aplica las reglas del historial de cargos al guardar el cambio de cargo.
     * Centraliza los tres escenarios para que controlador y reglas queden
     * desacoplados de la lógica de negocio:
     *
     *  - Escenario A (sin fecha): solo edita el cargo, sin historial.
     *  - Escenario B (fecha puesta pero el cargo es el mismo): no registra
     *    historial; devuelve un mensaje informativo para mostrar al usuario.
     *    No genera error.
     *  - Escenario C (cargo cambiado + fecha): la validación del request ya
     *    garantizó que la fecha pertenece al contrato o a una prórroga, así
     *    que se asigna el nuevo cargo cerrando el anterior.
     *  - Registro inicial explícito: crea el historial para un cargo legado
     *    que existe en colaboradores.cargo pero aún no tiene filas de historial.
     *
     * @return string|null  Mensaje informativo (Escenario B) o null.
     */
    public function registrarCambio(
        Colaborador $colaborador,
        ?string $cargo,
        ?string $fechaInicio,
        ?string $area = null,
        ?string $perfil = null,
        bool $registrarCargoInicial = false,
        ?string $perfilNombre = null,
    ): ?string
    {
        if ($registrarCargoInicial && ! $colaborador->cargos()->exists()) {
            if (! $cargo || ! $fechaInicio) {
                throw new \InvalidArgumentException('El cargo y la fecha de inicio son obligatorios para registrar el historial inicial.');
            }

            $this->asignar($colaborador, $cargo, $fechaInicio, $area, $perfil, true, $perfilNombre);

            return null;
        }

        if (! $cargo) {
            return null;
        }

        $cargoActualNombre = $colaborador->cargoActual?->cargo ?? $colaborador->cargo;

        if (! empty($fechaInicio)) {
            if ($cargo === $cargoActualNombre && ($area === null || $colaborador->area === $area)) {
                return 'El cargo y área seleccionados son los mismos actuales; no se registró un cambio en el historial.';
            }

            $this->asignar($colaborador, $cargo, $fechaInicio, $area, $perfil, false, $perfilNombre);

            return null;
        }

        $this->actualizarSinHistorial($colaborador, $cargo);
        if ($area !== null) {
            $colaborador->update(['area' => $area]);
        }

        return null;
    }
}
