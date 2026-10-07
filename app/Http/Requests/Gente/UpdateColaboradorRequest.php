<?php

namespace App\Http\Requests\Gente;

use App\Http\Requests\Gente\Concerns\ValidatesColaboradorDocumentos;
use App\Http\Requests\Seguridad\Concerns\ValidatesFutureDates;
use App\Support\Seguridad\ColaboradorDocumentoCampos;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateColaboradorRequest extends FormRequest
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
            'user_id' => [
                'nullable', 'integer', Rule::exists('users', 'id'),
                Rule::unique('colaboradores', 'user_id')->ignore($this->route('colaborador')),
            ],
            'cedula' => [
                'required', 'string', 'max:30',
                Rule::unique('colaboradores', 'cedula')->ignore($this->route('colaborador')),
            ],
            'nombres' => ['required', 'string', 'max:100'],
            'apellidos' => ['required', 'string', 'max:100'],
            'turno' => ['nullable', Rule::in(['manana', 'tarde', 'noche'])],
            'imagen' => ['nullable', 'image', 'max:2048'],

            // Paso 1
            'tipo_documento' => ['nullable', Rule::in([...config('seguridad.colaboradores.tipos_documento'), 'Otro'])],
            'tipo_documento_otro_label' => ['nullable', 'required_if:tipo_documento,Otro', 'string', 'max:100'],
            'expedido_en' => ['nullable', 'string', 'max:100'],
            'sexo' => ['nullable', Rule::in(['femenino', 'masculino'])],
            'fecha_nacimiento' => ['nullable', 'date'],
            'ciudad_residencia' => ['nullable', 'string', 'max:100'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'estrato' => ['nullable', Rule::in(['1', '2', '3', '4', '5', '6'])],
            'celular_1' => ['nullable', 'digits_between:1,10'],
            'celular_2' => ['nullable', 'digits_between:1,10'],
            'correo' => ['nullable', 'email', 'max:255'],
            'estado_civil' => ['nullable', Rule::in(['soltero', 'union_libre', 'casado', 'divorciado', 'viudo'])],
            'discapacidad' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'discapacidad_tipo' => ['nullable', 'required_if:discapacidad,aplica', 'string', 'max:150'],
            'discapacidad_observaciones' => ['nullable', 'required_if:discapacidad,aplica', 'string', 'max:2000'],
            'victima_conflicto' => ['nullable', Rule::in(['si', 'no'])],
            'victima_conflicto_observaciones' => ['nullable', 'required_if:victima_conflicto,si', 'string', 'max:2000'],
            'libreta_militar' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'runt_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'eps' => ['nullable', 'string', 'max:100'],
            'eps_otro' => ['nullable', 'required_if:eps,Otro', 'string', 'max:100'],
            'afp' => ['nullable', 'string', 'max:100'],
            'afp_otro' => ['nullable', 'required_if:afp,Otro', 'string', 'max:100'],
            'arl' => ['nullable', 'string', 'max:100'],
            'arl_otro' => ['nullable', 'required_if:arl,Otro', 'string', 'max:100'],
            'sena_especialidad' => ['nullable', 'string', 'max:150'],
            'sena_numero_grupo' => ['nullable', 'integer'],
            'sena_institucion' => ['nullable', 'string', 'max:150'],
            'sena_nit' => ['nullable', 'string', 'max:30'],
            'sena_centro_formacion' => ['nullable', 'string', 'max:150'],

            // Paso 2
            'ha_trabajado_antes' => ['nullable', Rule::in(['si', 'no'])],
            'cargo_anterior' => ['nullable', 'string', 'max:100'],
            'fecha_ultima_laboral' => ['nullable', 'date'],
            'tiene_experiencia' => ['nullable', Rule::in(['si', 'no'])],
            'anios_experiencia' => ['nullable', 'integer', 'min:0', 'max:100'],
            'manejo_defensivo_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'conduccion_carga_pesada_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'experiencia_terreno_plano' => ['nullable', Rule::in(['si', 'no'])],
            'experiencia_terreno_montanoso' => ['nullable', Rule::in(['si', 'no'])],

            // Paso 3 (el historial de cargos lo gestiona CargoHistorialService)
            'area' => ['nullable', Rule::in(['Administrativa', 'Operativa'])],
            'cargo' => ['nullable', Rule::in(config('seguridad.colaboradores.cargos'))],
            'cargo_fecha_inicio' => [
                'nullable',
                'date',
                Rule::requiredIf(fn () => $this->input('cargo') && $this->input('cargo') !== $colaborador?->cargoActual?->cargo),
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

            // Paso 4
            'licencia_conduccion_categorias' => ['nullable', 'array'],
            'licencia_conduccion_categorias.*' => [Rule::in(config('seguridad.colaboradores.licencia_conduccion_categorias'))],
            'es_padrino' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'tipo_padrino' => ['nullable', 'required_if:es_padrino,aplica', Rule::in(['padrino', 'plan_padrino_personal_nuevo'])],

            'is_active' => ['boolean'],

            ...$this->documentoRules(ColaboradorDocumentoCampos::todas()),
        ];
    }
}
