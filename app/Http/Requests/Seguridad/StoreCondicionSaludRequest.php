<?php

namespace App\Http\Requests\Seguridad;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCondicionSaludRequest extends FormRequest
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
            'colaborador_id' => ['required', 'integer', Rule::exists('colaboradores', 'id')->whereNull('deleted_at')],
            'momento' => ['required', Rule::in(['ingreso', 'salida'])],
            'estado' => ['required', Rule::in(['Bueno', 'Regular', 'Malo'])],
            'observacion' => ['required_if:estado,Regular', 'required_if:estado,Malo', 'nullable', 'string', 'max:2000'],
            'fecha_hora' => ['nullable', 'date'],
        ];
    }
}
