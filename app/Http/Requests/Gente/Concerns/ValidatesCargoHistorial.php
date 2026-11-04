<?php

namespace App\Http\Requests\Gente\Concerns;

use Illuminate\Contracts\Validation\Validator;

/**
 * Lógica única de validación del cambio de cargo, compartida por todos los
 * Form Requests que pueden recibir `cargo` + `cargo_fecha_inicio` (el wizard
 * del paso 3 y la edición completa del colaborador).
 *
 * Reglas:
 *  - Sin fecha (Escenario A): no hay nada que validar del historial; el
 *    controlador solo edita el cargo.
 *  - Fecha puesta pero el cargo es el mismo (Escenario B): no bloquea; el
 *    controlador informa al usuario y avanza sin error.
 *  - Cargo cambiado + fecha (Escenario C): la fecha no puede ser anterior a la
 *    fecha de inicio del cargo actual y debe pertenecer al periodo del
 *    contrato o a una prórroga registrada (regla central del modelo).
 */
trait ValidatesCargoHistorial
{
    protected function validarFechaInicioCargo(Validator $validator): void
    {
        $colaborador = $this->route('colaborador');
        $cargo = $this->input('cargo');
        $cargoFechaInicio = $this->input('cargo_fecha_inicio');

        // Sin fecha = "solo está editando" (Escenario A).
        if (! $colaborador || ! $cargo || empty($cargoFechaInicio)) {
            return;
        }

        $cargoActualNombre = $colaborador->cargoActual?->cargo ?? $colaborador->cargo;

        // Mismo cargo + fecha (Escenario B): no bloquea.
        if ($cargo === $cargoActualNombre) {
            return;
        }

        // Cargo cambiado + fecha (Escenario C): coherencia con el historial.
        $cargoActivo = $colaborador->cargoActual;

        if ($cargoActivo && $cargoFechaInicio < $cargoActivo->fecha_inicio->toDateString()) {
            $validator->errors()->add(
                'cargo_fecha_inicio',
                'La fecha de inicio del nuevo cargo no puede ser anterior a la fecha de inicio del cargo actual.'
            );
        }

        // Regla de contrato/prórroga: la fecha debe pertenecer al periodo del
        // contrato o a una prórroga registrada (ver Colaborador::periodoCargoParaFecha).
        if ($colaborador->periodoCargoParaFecha($cargoFechaInicio) === null) {
            $tieneProrrogas = $colaborador->prorrogas->contains(fn ($p) => $p->tipo === 'prorroga');

            $validator->errors()->add(
                'cargo_fecha_inicio',
                $tieneProrrogas
                    ? 'La fecha no está dentro de las fechas estipuladas del contrato ni de las prórrogas registradas.'
                    : 'No existe una prórroga, por lo tanto no puede guardar esa fecha porque no está dentro de las fechas estipuladas.'
            );
        }
    }
}
