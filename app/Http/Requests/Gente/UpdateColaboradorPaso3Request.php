<?php

namespace App\Http\Requests\Gente;

use App\Http\Requests\Gente\Concerns\ValidatesCargoHistorial;
use App\Http\Requests\Gente\Concerns\ValidatesColaboradorDocumentos;
use App\Http\Requests\Seguridad\Concerns\ValidatesFutureDates;
use App\Models\Seguridad\Colaborador;
use App\Support\Seguridad\ColaboradorDocumentoCampos;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateColaboradorPaso3Request extends FormRequest
{
    use ValidatesColaboradorDocumentos;
    use ValidatesFutureDates;
    use ValidatesCargoHistorial;

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
            'cargo' => [
                'nullable',
                Rule::requiredIf(fn () => $this->cambiaEstado() || $this->boolean('registrar_cargo_inicial')),
                'string',
                'max:100',
            ],
            'perfil_nombre' => ['nullable', 'string', 'max:150'],
            'perfil' => ['nullable', 'string'],
            'guardar_historial_cargo' => ['nullable', Rule::in(['si', 'no'])],
            'registrar_cargo_inicial' => ['nullable', 'boolean'],
            'cargo_fecha_inicio' => [
                'nullable',
                Rule::requiredIf(fn () => $this->cambiaEstado() || $this->boolean('registrar_cargo_inicial')),
                'date',
            ],

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
            'es_nuevo_contrato' => ['nullable', 'boolean', Rule::requiredIf(fn () => $this->cambiaEstado())],
            'nuevo_tipo_contrato' => [
                'nullable',
                Rule::requiredIf(fn () => $this->cambiaEstado() || $this->route('colaborador')?->esReingreso()),
                'string',
                'max:100',
            ],
            'nuevo_tipo_contrato_otro' => [
                'nullable',
                Rule::requiredIf(fn () => $this->input('nuevo_tipo_contrato') === 'Otro'),
                'string',
                'max:100',
            ],
            'nuevo_cargo' => ['nullable', Rule::requiredIf(fn () => $this->cambiaEstado()), 'string', 'max:100'],
            'nuevo_area' => ['nullable', Rule::in(['Administrativa', 'Operativa'])],
            'nuevo_fecha_inicio' => [
                'nullable',
                'required_if:es_nuevo_contrato,1',
                Rule::requiredIf(fn () => $this->cambiaEstado() || $this->route('colaborador')?->esReingreso()),
                'date',
            ],
            'nuevo_fecha_fin' => ['nullable', Rule::requiredIf(fn () => $this->cambiaEstado()), 'date', 'after_or_equal:nuevo_fecha_inicio'],
            'contratos_editados' => ['nullable', 'json'],
            'cargos_editados' => ['nullable', 'json'],
            'is_active' => ['nullable', 'boolean'],

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

        $validator->after(fn (Validator $v) => $this->validarFechaInicioCargo(
            $v,
            $this->cambiaEstado() || $this->boolean('registrar_cargo_inicial'),
        ));
    }

    private function cambiaEstado(): bool
    {
        $colaborador = $this->route('colaborador');

        return $colaborador instanceof Colaborador
            && $this->has('is_active')
            && $this->boolean('is_active') !== (bool) $colaborador->is_active;
    }
}
