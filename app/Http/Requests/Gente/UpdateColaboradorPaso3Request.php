<?php

namespace App\Http\Requests\Gente;

use App\Http\Requests\Gente\Concerns\ValidatesColaboradorDocumentos;
use App\Http\Requests\Seguridad\Concerns\ValidatesFutureDates;
use App\Support\Seguridad\ColaboradorDocumentoCampos;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateColaboradorPaso3Request extends FormRequest
{
    use ValidatesColaboradorDocumentos;
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
            'cargo' => ['nullable', 'string', 'max:100'],
            'guardar_historial_cargo' => ['nullable', Rule::in(['si', 'no'])],
            'cargo_fecha_inicio' => ['nullable', 'date'],

            'sena_especialidad' => ['nullable', 'string', 'max:150'],
            'sena_numero_grupo' => ['nullable', 'integer'],
            'sena_institucion' => ['nullable', 'string', 'max:150'],
            'sena_nit' => ['nullable', 'string', 'max:30'],
            'sena_centro_formacion' => ['nullable', 'string', 'max:150'],

            'centro' => ['nullable', Rule::in(config('seguridad.colaboradores.centros'))],
            'centro_trabajo' => ['nullable', Rule::in(config('seguridad.colaboradores.centros_trabajo'))],
            'fecha_ingreso_empresa' => ['nullable', 'date'],
            'fecha_retiro_empresa' => ['nullable', 'date'],
            'motivo_retiro' => ['nullable', Rule::in(config('seguridad.colaboradores.motivos_retiro'))],
            'motivo_retiro_observaciones' => ['nullable', 'string', 'max:2000'],
            'tipo_contrato' => ['nullable', 'string', 'max:100'],
            'tipo_contrato_otro' => ['nullable', 'string', 'max:100'],

            'codigo_qr_skap' => ['nullable', 'string', 'max:100'],

            'vacaciones_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'vacaciones_fecha_desde' => ['nullable', 'date', $this->futureUnlessUnchanged($colaborador, 'vacaciones_fecha_desde')],
            'vacaciones_fecha_hasta' => ['nullable', 'date', 'after_or_equal:vacaciones_fecha_desde', $this->futureUnlessUnchanged($colaborador, 'vacaciones_fecha_hasta')],
            'vacaciones_pagadas_fecha_desde' => ['nullable', 'date', $this->futureUnlessUnchanged($colaborador, 'vacaciones_pagadas_fecha_desde')],
            'vacaciones_pagadas_fecha_hasta' => ['nullable', 'date', 'after_or_equal:vacaciones_pagadas_fecha_desde', $this->futureUnlessUnchanged($colaborador, 'vacaciones_pagadas_fecha_hasta')],

            ...$this->documentoRules(ColaboradorDocumentoCampos::paso3()),
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(fn () => $this->logArchivosDocumentoRechazados($validator, ColaboradorDocumentoCampos::paso3()));

        $validator->after(function (Validator $validator) {
            $colaborador = $this->route('colaborador');
            $cargoFechaInicio = $this->input('cargo_fecha_inicio');
            $guardarHistorial = $this->input('guardar_historial_cargo') === 'si'
                || (! $this->has('guardar_historial_cargo') && ! empty($cargoFechaInicio));

            if (! $colaborador || ! $this->input('cargo') || ! $cargoFechaInicio || ! $guardarHistorial) {
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
