<?php

namespace App\Http\Requests\Flota;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCarretaRequest extends FormRequest
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
            'identificacion' => [
                'required', 'string', 'max:20',
                Rule::unique('carretas', 'identificacion')->ignore($this->route('carreta')),
            ],
            'tipo' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ];
    }
}
