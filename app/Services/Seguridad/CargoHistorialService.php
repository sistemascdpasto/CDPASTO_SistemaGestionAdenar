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
    public function asignar(Colaborador $colaborador, string $cargo, string $fechaInicio): void
    {
        $fechaInicio = Carbon::parse($fechaInicio)->startOfDay();

        $cargoActivo = $colaborador->cargos()
            ->where('estado', 'ACTIVO')
            ->latest('fecha_inicio')
            ->first();

        if ($cargoActivo && $cargoActivo->cargo === $cargo) {
            return;
        }

        DB::transaction(function () use ($colaborador, $cargo, $fechaInicio, $cargoActivo) {
            if ($cargoActivo) {
                $cargoActivo->update([
                    'fecha_fin' => $fechaInicio->copy()->subDay(),
                    'estado' => 'INACTIVO',
                ]);
            }

            $colaborador->cargos()->create([
                'cargo' => $cargo,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => null,
                'estado' => 'ACTIVO',
            ]);

            $colaborador->update(['cargo' => $cargo]);
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
     *
     * @return string|null  Mensaje informativo (Escenario B) o null.
     */
    public function registrarCambio(Colaborador $colaborador, ?string $cargo, ?string $fechaInicio): ?string
    {
        if (! $cargo) {
            return null;
        }

        $cargoActualNombre = $colaborador->cargoActual?->cargo ?? $colaborador->cargo;

        if (! empty($fechaInicio)) {
            if ($cargo === $cargoActualNombre) {
                return 'El cargo seleccionado es el mismo que el cargo actual; no se registró un cambio en el historial.';
            }

            $this->asignar($colaborador, $cargo, $fechaInicio);

            return null;
        }

        $this->actualizarSinHistorial($colaborador, $cargo);

        return null;
    }
}
