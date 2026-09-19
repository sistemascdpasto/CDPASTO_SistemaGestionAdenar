<?php

namespace App\Http\Requests\Seguridad;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAlcoholimetroRequest extends FormRequest
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
            'codigo' => ['required', 'string', 'max:50', Rule::unique('alcoholimetros', 'codigo')->whereNull('deleted_at')],
            'marca' => ['nullable', 'string', 'max:100'],
            'modelo' => ['nullable', 'string', 'max:100'],
            'fecha_calibracion' => ['nullable', 'date'],
            'fecha_vencimiento_certificado' => ['nullable', 'date'],
            'imagenes' => ['nullable'],
            'imagenes.*' => ['image', 'max:5120'],
            'documentos' => ['nullable'],
            'documentos.*' => ['file', 'mimes:pdf,xlsx,xls,xlsm,csv', 'max:10240'],
            'mantenimientos' => ['nullable', 'array'],
            'mantenimientos.*.fecha' => ['required_with:mantenimientos', 'date'],
            'mantenimientos.*.descripcion' => ['required_with:mantenimientos', 'string', 'max:1000'],
            'valor_min' => ['required', 'numeric', 'min:0'],
            'valor_max' => ['required', 'numeric', 'gt:valor_min'],
            'estado' => ['required', Rule::in(['Disponible', 'En uso', 'En mantenimiento', 'Fuera de servicio'])],
        ];
    }
}
