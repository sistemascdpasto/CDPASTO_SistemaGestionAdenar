<?php

namespace App\Http\Requests\Gente;

use Illuminate\Foundation\Http\FormRequest;

class UpdateContratoColaboradorRequest extends FormRequest
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
            'fecha_ingreso_empresa' => ['nullable', 'date'],
            'fecha_retiro_empresa' => ['nullable', 'date'],
            'cargo' => ['nullable', 'string', 'max:100'],
            'tipo_contrato' => ['nullable', 'string', 'max:100'],
        ];
    }
}
