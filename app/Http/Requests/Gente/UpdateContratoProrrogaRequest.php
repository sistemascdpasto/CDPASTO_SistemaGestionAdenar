<?php

namespace App\Http\Requests\Gente;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateContratoProrrogaRequest extends FormRequest
{
    public function authorize(): bool
    {
        $colaborador = $this->route('colaborador');
        $prorroga = $this->route('prorroga');

        return $colaborador instanceof Colaborador
            && $prorroga instanceof ContratoProrroga
            && $prorroga->colaborador_id === $colaborador->id;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tipo' => ['required', Rule::in(['prorroga', 'finalizacion'])],
            'fecha_anterior' => ['required', 'date'],
            'fecha_nueva' => ['required', 'date'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ];
    }
}
