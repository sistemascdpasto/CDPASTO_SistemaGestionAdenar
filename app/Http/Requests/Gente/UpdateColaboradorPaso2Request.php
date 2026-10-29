<?php

namespace App\Http\Requests\Gente;

use App\Http\Requests\Gente\Concerns\ValidatesColaboradorDocumentos;
use App\Support\Seguridad\ColaboradorDocumentoCampos;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateColaboradorPaso2Request extends FormRequest
{
    use ValidatesColaboradorDocumentos;

    public function authorize(): bool
    {
        return true;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(fn () => $this->logArchivosDocumentoRechazados($validator, ColaboradorDocumentoCampos::paso2()));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'ha_trabajado_antes' => ['nullable', Rule::in(['si', 'no'])],
            'cargo_anterior' => ['nullable', 'string', 'max:100'],
            'fecha_ultima_laboral' => ['nullable', 'date'],
            'motivo_retiro' => ['nullable', Rule::in(config('seguridad.colaboradores.motivos_retiro'))],
            'motivo_retiro_observaciones' => ['nullable', 'string', 'max:2000'],

            'tiene_experiencia' => ['nullable', Rule::in(['si', 'no'])],
            'anios_experiencia' => ['nullable', 'integer', 'min:0', 'max:100'],

            'manejo_defensivo_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'conduccion_carga_pesada_aplica' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'experiencia_terreno_plano' => ['nullable', Rule::in(['si', 'no'])],
            'experiencia_terreno_montanoso' => ['nullable', Rule::in(['si', 'no'])],

            ...$this->documentoRules(ColaboradorDocumentoCampos::paso2()),
        ];
    }
}
