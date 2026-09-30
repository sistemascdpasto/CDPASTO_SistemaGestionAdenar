<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreGeovictoriaAsistenciasRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La autorizacion real la hace el middleware EnsureGeovictoriaApiToken
        // sobre la ruta (token compartido, no un usuario autenticado).
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'registros' => ['required', 'array', 'min:1'],
            'registros.*.identificador' => ['required', 'string', 'max:50'],
            'registros.*.fecha' => ['required', 'date'],
            'registros.*.apellidos' => ['nullable', 'string', 'max:150'],
            'registros.*.nombres' => ['nullable', 'string', 'max:150'],
            'registros.*.cargo' => ['nullable', 'string', 'max:100'],
            'registros.*.grupo' => ['nullable', 'string', 'max:100'],
            'registros.*.permiso' => ['nullable', 'string', 'max:100'],
            'registros.*.turno' => ['nullable', 'string', 'max:100'],
            'registros.*.entrada' => ['nullable', 'string', 'max:10'],
            'registros.*.salida_descanso' => ['nullable', 'string', 'max:10'],
            'registros.*.ingreso_descanso' => ['nullable', 'string', 'max:10'],
            'registros.*.salida' => ['nullable', 'string', 'max:10'],
            'registros.*.horas_trabajadas' => ['nullable', 'string', 'max:10'],
            'registros.*.hea' => ['nullable', 'string', 'max:10'],
            'registros.*.hec' => ['nullable', 'string', 'max:10'],
            'registros.*.hnt' => ['nullable', 'string', 'max:10'],
            'registros.*.exceso_jornada' => ['required', 'boolean'],
            'registros.*.horas_descanso_previo' => ['nullable', 'string', 'max:40'],
            'registros.*.descanso_no_efectivo' => ['required', 'boolean'],
            'registros.*.hora_minima_entrada' => ['nullable', 'date_format:Y-m-d H:i'],
        ];
    }
}
