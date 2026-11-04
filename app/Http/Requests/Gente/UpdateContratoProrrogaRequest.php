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
            'tipo' => ['required', Rule::in(['prorroga'])],
            'fecha_anterior' => ['required', 'date'],
            'fecha_inicio' => ['nullable', 'date'],
            'fecha_nueva' => ['required', 'date'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (\Illuminate\Validation\Validator $validator): void {
                if ($this->input('tipo') !== 'prorroga') {
                    return;
                }

                if (
                    $validator->errors()->has('fecha_inicio')
                    || $validator->errors()->has('fecha_anterior')
                    || $validator->errors()->has('fecha_nueva')
                ) {
                    return;
                }

                $fechaInicio = $this->filled('fecha_inicio') ? $this->date('fecha_inicio')?->startOfDay() : null;
                $fechaAnterior = $this->date('fecha_anterior')?->startOfDay();
                $fechaFin = $this->date('fecha_nueva')?->startOfDay();

                if ($fechaInicio && $fechaAnterior && $fechaInicio->lessThanOrEqualTo($fechaAnterior)) {
                    $validator->errors()->add('fecha_inicio', 'El inicio de la prórroga debe ser posterior a la fecha anterior.');
                }

                if ($fechaInicio && $fechaFin && $fechaFin->lessThan($fechaInicio)) {
                    $validator->errors()->add('fecha_nueva', 'La fecha nueva debe ser igual o posterior al inicio de la prórroga.');
                }

                $this->validarInicioAnual($validator, $fechaInicio, $fechaFin);
            },
        ];
    }

    private function validarInicioAnual(
        \Illuminate\Validation\Validator $validator,
        ?\Illuminate\Support\Carbon $fechaInicio,
        ?\Illuminate\Support\Carbon $fechaFin,
    ): void {
        $colaborador = $this->route('colaborador');
        $prorroga = $this->route('prorroga');

        if (! $colaborador instanceof Colaborador || ! $prorroga instanceof ContratoProrroga) {
            return;
        }

        $idsOrdenados = $colaborador->prorrogas()
            ->where('tipo', 'prorroga')
            ->orderBy('fecha_anterior')
            ->orderBy('id')
            ->pluck('id');
        $numeroProrroga = $idsOrdenados->search($prorroga->id);

        if ($numeroProrroga === false || ! ContratoProrroga::esProrrogaAnual($numeroProrroga + 1)) {
            return;
        }

        if (! $fechaInicio) {
            $validator->errors()->add('fecha_inicio', 'La prórroga anual requiere una fecha de inicio.');

            return;
        }

        if ($fechaFin && ! $fechaFin->equalTo(ContratoProrroga::fechaFinAnual($fechaInicio))) {
            $validator->errors()->add(
                'fecha_nueva',
                'Después de las primeras tres prórrogas, la vigencia debe ser anual y finalizar el día anterior al aniversario de inicio.',
            );
        }
    }
}
