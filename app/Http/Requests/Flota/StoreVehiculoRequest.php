<?php

namespace App\Http\Requests\Flota;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVehiculoRequest extends FormRequest
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
            'placa' => ['required', 'string', 'max:20', Rule::unique('vehiculos', 'placa')],
            'truck_type' => ['nullable', 'string', 'max:100'],
            'modelo' => ['nullable', 'string', 'max:100'],
            'capacidad_pallets' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'imagen' => ['nullable', 'image', 'max:2048'],
            'fecha_vencimiento_soat' => ['nullable', 'date'],
            'fecha_vencimiento_tecnomecanica' => ['nullable', 'date'],
            'documento_soat' => ['nullable', 'array'],
            'documento_soat.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'documento_rtm' => ['nullable', 'array'],
            'documento_rtm.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'documento_codigo_qr' => ['nullable', 'array'],
            'documento_codigo_qr.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'documento_licencia_transito' => ['nullable', 'array'],
            'documento_licencia_transito.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'is_active' => ['boolean'],
        ];
    }
}
