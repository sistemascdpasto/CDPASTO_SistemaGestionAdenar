<?php

namespace App\Http\Requests\Gente;

use App\Http\Requests\Gente\Concerns\ValidatesColaboradorDocumentos;
use App\Support\Seguridad\ColaboradorDocumentoCampos;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateColaboradorPaso4Request extends FormRequest
{
    use ValidatesColaboradorDocumentos;

    public function authorize(): bool
    {
        return true;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(fn () => $this->logArchivosDocumentoRechazados($validator, ColaboradorDocumentoCampos::paso4()));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'licencia_conduccion_categorias' => ['nullable', 'array'],
            'licencia_conduccion_categorias.*' => [Rule::in(config('seguridad.colaboradores.licencia_conduccion_categorias'))],

            'fecha_licencia'            => ['nullable', 'date'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'restricciones_licencia'     => ['nullable', 'string', 'max:500'],

            'es_padrino' => ['nullable', Rule::in(['no_aplica', 'aplica'])],
            'tipo_padrino' => ['nullable', 'required_if:es_padrino,aplica', Rule::in(['padrino', 'plan_padrino_personal_nuevo'])],

            ...$this->documentoRules(ColaboradorDocumentoCampos::paso4()),
        ];
    }
}
