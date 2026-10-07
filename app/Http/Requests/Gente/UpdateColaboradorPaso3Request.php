<?php

namespace App\Http\Requests\Gente;

use App\Http\Requests\Seguridad\Concerns\ValidatesFutureDates;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateColaboradorPaso3Request extends FormRequest
{
    use ValidatesFutureDates;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $colaborador = $this->route('colaborador');

        return [
            'area' => ['nullable', Rule::in(['Administrativa', 'Operativa'])],
            'cargo' => ['nullable', Rule::in(config('seguridad.colaboradores.cargos'))],
            // Fecha en la que inicia el cargo seleccionado; requerida solo
            // cuando el cargo enviado difiere del que el colaborador ya tenía
            // guardado. Importante: se compara contra `colaborador->cargo`
            // (el valor guardado), NO contra `cargoActual` (el historial en
            // `colaborador_cargos`) — la mayoría de colaboradores reales no
            // tienen ninguna fila de historial (ej. los cargados por Excel),
            // así que comparar contra `cargoActual` (null) hacía que CUALQUIER
            // colaborador sin historial pidiera esta fecha aunque el usuario
            // no hubiera tocado el cargo, bloqueando el paso 3 para casi toda
            // la base real de datos.
            'cargo_fecha_inicio' => [
                'nullable',
                'date',
                Rule::requiredIf(fn () => $this->input('cargo') && $this->input('cargo') !== $colaborador?->cargo),
            ],

            'centro' => ['nullable', Rule::in(config('seguridad.colaboradores.centros'))],
            'centro_trabajo' => ['nullable', Rule::in(config('seguridad.colaboradores.centros_trabajo'))],
            'fecha_ingreso_empresa' => ['nullable', 'date'],
            'fecha_retiro_empresa' => ['nullable', 'date', $this->futureUnlessUnchanged($colaborador, 'fecha_retiro_empresa')],
            'motivo_retiro' => ['nullable', Rule::in(config('seguridad.colaboradores.motivos_retiro'))],
            'tipo_contrato' => ['nullable', Rule::in(config('seguridad.colaboradores.tipos_contrato'))],

            'codigo_qr_skap' => ['nullable', 'string', 'max:100'],

            'vacaciones_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'vacaciones_fecha_desde' => ['nullable', 'date', $this->futureUnlessUnchanged($colaborador, 'vacaciones_fecha_desde')],
            'vacaciones_fecha_hasta' => ['nullable', 'date', 'after_or_equal:vacaciones_fecha_desde', $this->futureUnlessUnchanged($colaborador, 'vacaciones_fecha_hasta')],
            'vacaciones_pagadas_fecha_desde' => ['nullable', 'date', $this->futureUnlessUnchanged($colaborador, 'vacaciones_pagadas_fecha_desde')],
            'vacaciones_pagadas_fecha_hasta' => ['nullable', 'date', 'after_or_equal:vacaciones_pagadas_fecha_desde', $this->futureUnlessUnchanged($colaborador, 'vacaciones_pagadas_fecha_hasta')],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $colaborador = $this->route('colaborador');
            $cargoFechaInicio = $this->input('cargo_fecha_inicio');

            if (! $colaborador || ! $this->input('cargo') || ! $cargoFechaInicio) {
                return;
            }

            $cargoActivo = $colaborador->cargoActual;

            if ($cargoActivo && $cargoActivo->cargo !== $this->input('cargo')
                && $cargoFechaInicio < $cargoActivo->fecha_inicio->toDateString()) {
                $validator->errors()->add(
                    'cargo_fecha_inicio',
                    'La fecha de inicio del nuevo cargo no puede ser anterior a la fecha de inicio del cargo actual.'
                );
            }
        });
    }
}
