<?php

namespace App\Http\Requests\Seguridad;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAlcoholimetroRequest extends FormRequest
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
            'codigo' => [
                'required', 'string', 'max:50',
                Rule::unique('alcoholimetros', 'codigo')->ignore($this->route('dispositivo'))->whereNull('deleted_at'),
            ],
            'marca' => ['nullable', 'string', 'max:100'],
            'modelo' => ['nullable', 'string', 'max:100'],
            'fecha_calibracion' => ['nullable', 'date'],
            'fecha_vencimiento_certificado' => ['nullable', 'date'],
            'imagenes' => ['nullable', 'array'],
            'imagenes.*' => ['image', 'max:2048'],
            'deleted_imagenes_indices' => ['nullable', 'array'],
            'deleted_imagenes_indices.*' => ['integer'],
            'valor_min' => ['required', 'numeric', 'min:0'],
            'valor_max' => ['required', 'numeric', 'gt:valor_min'],
            'estado' => ['required', Rule::in(['Disponible', 'En uso', 'En mantenimiento', 'Fuera de servicio'])],
        ];
    }
}
