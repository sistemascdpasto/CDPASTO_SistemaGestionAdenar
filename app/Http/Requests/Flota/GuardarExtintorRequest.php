<?php

namespace App\Http\Requests\Flota;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GuardarExtintorRequest extends FormRequest
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
        // En edición, el extintor viene como parámetro de ruta {extintor}.
        $ignoreId = $this->route('extintor')?->id;

        return [
            'numero_serie'        => [
                'required', 'string', 'max:80',
                Rule::unique('extintores', 'numero_serie')->ignore($ignoreId)->whereNull('deleted_at'),
            ],
            'tipo_agente'         => ['nullable', 'string', 'max:80'],
            'capacidad_kg'        => ['nullable', 'numeric', 'min:0'],
            'marca'               => ['nullable', 'string', 'max:80'],
            'fecha_fabricacion'   => ['nullable', 'date'],
            'fecha_vencimiento'   => ['nullable', 'date'],
            'observaciones'       => ['nullable', 'string', 'max:1000'],
            'condicion'           => ['nullable', 'in:buena,mala'],
            'agente_impulsor'     => ['nullable', 'in:directa,indirecta'],
            'parte_mantenimiento' => ['nullable', 'string', 'max:255'],
            'senalizacion'        => ['nullable', 'string', 'max:255'],
            'demarcacion'         => ['nullable', 'in:buena,mala,N/A'],
            'funcionamiento'      => ['nullable', 'string', 'max:255'],
            'acceso'              => ['nullable', 'string', 'max:255'],
            'foto'                => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:10240'],
            'eliminar_foto'       => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'numero_serie.required' => 'El número de serie es obligatorio.',
            'numero_serie.unique'   => 'Ya existe un extintor con ese número de serie.',
            'foto.image'            => 'El archivo debe ser una imagen.',
            'foto.max'              => 'La imagen no puede superar 10 MB.',
        ];
    }
}
