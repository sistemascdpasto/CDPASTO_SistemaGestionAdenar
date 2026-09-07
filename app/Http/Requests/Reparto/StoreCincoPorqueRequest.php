<?php

namespace App\Http\Requests\Reparto;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCincoPorqueRequest extends FormRequest
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
            'fecha' => ['required', 'date'],
            'vehiculo_id' => ['nullable', 'integer', Rule::exists('vehiculos', 'id')],
            'rutina' => ['required', 'string', Rule::in(config('cinco_porques.rutinas'))],
            'indicador' => ['required', 'string', Rule::in(config('cinco_porques.indicadores'))],
            'problema' => ['required', 'string', 'max:2000'],
            'porque_1' => ['required', 'string', 'max:1000'],
            'porque_2' => ['required', 'string', 'max:1000'],
            'porque_3' => ['required', 'string', 'max:1000'],
            'porque_4' => ['required', 'string', 'max:1000'],
            'porque_5' => ['required', 'string', 'max:1000'],
            'causa_raiz' => ['required', 'string', 'max:2000'],
            'plan_accion' => ['required', 'string', 'max:4000'],
            'ia_sugerencias' => ['nullable', 'string', 'json', 'max:20000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'porque_1.required' => 'Completa el ¿Por qué? 1.',
            'porque_2.required' => 'Completa el ¿Por qué? 2.',
            'porque_3.required' => 'Completa el ¿Por qué? 3.',
            'porque_4.required' => 'Completa el ¿Por qué? 4.',
            'porque_5.required' => 'Completa el ¿Por qué? 5.',
            'causa_raiz.required' => 'La causa raíz es obligatoria.',
            'plan_accion.required' => 'El plan de acción es obligatorio.',
        ];
    }
}
