<?php

namespace App\Http\Requests\Flota;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCarretaRequest extends FormRequest
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
            'placa' => ['required', 'string', 'max:20', Rule::unique('carretas', 'placa')],
            'tipo' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ];
    }
}
