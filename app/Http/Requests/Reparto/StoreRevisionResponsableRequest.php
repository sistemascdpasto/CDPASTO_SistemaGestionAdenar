<?php

namespace App\Http\Requests\Reparto;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRevisionResponsableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'colaborador_id' => [
                'required', 'integer',
                Rule::exists('colaboradores', 'id'),
                Rule::unique('revision_responsables', 'colaborador_id'),
            ],
        ];
    }
}
