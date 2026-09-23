<?php

namespace App\Http\Requests\Reparto;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRevisionCausalRequest extends FormRequest
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
            'nombre' => ['required', 'string', 'max:100', Rule::unique('revision_causales', 'nombre')->ignore($this->route('revisionCausal'))],
            'requiere_especificacion' => ['boolean'],
            'is_active' => ['boolean'],
        ];
    }
}
