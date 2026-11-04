<?php

namespace App\Http\Requests\Gente;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProrrogarContratoRequest extends FormRequest
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
            'fecha_inicio_prorroga' => ['nullable', 'date'],
            'fecha_retiro_empresa' => ['required', 'date'],
            'tipo' => ['nullable', 'in:prorroga,finalizacion'],
            'observaciones' => ['nullable', 'string', 'max:500'],
            'documento' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png'],
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->input('tipo', 'prorroga') !== 'prorroga' || $validator->errors()->has('fecha_retiro_empresa')) {
                    return;
                }

                $colaborador = $this->route('colaborador');
                $cantidadProrrogas = $colaborador instanceof Colaborador
                    ? $colaborador->prorrogas()->where('tipo', 'prorroga')->count()
                    : 0;
                $numeroProrroga = $cantidadProrrogas + 1;
                $esProrrogaAnual = ContratoProrroga::esProrrogaAnual($numeroProrroga);

                if (! $this->filled('fecha_inicio_prorroga')) {
                    if ($esProrrogaAnual) {
                        $validator->errors()->add(
                            'fecha_inicio_prorroga',
                            'La prórroga anual requiere una fecha de inicio.',
                        );
                    }

                    return;
                }

                if ($validator->errors()->has('fecha_inicio_prorroga')) {
                    return;
                }

                $fechaInicio = $this->date('fecha_inicio_prorroga')?->startOfDay();
                $fechaFin = $this->date('fecha_retiro_empresa')?->startOfDay();

                if (! $fechaInicio || ! $fechaFin) {
                    return;
                }

                if (
                    $colaborador instanceof Colaborador
                    && $colaborador->fecha_retiro_empresa
                    && $fechaInicio->lessThanOrEqualTo($colaborador->fecha_retiro_empresa->startOfDay())
                ) {
                    $validator->errors()->add(
                        'fecha_inicio_prorroga',
                        'La fecha de inicio debe ser posterior al vencimiento del contrato actual.',
                    );
                }

                if ($fechaFin->lessThan($fechaInicio)) {
                    $validator->errors()->add(
                        'fecha_retiro_empresa',
                        'La fecha de finalización debe ser igual o posterior al inicio de la prórroga.',
                    );
                }

                if ($esProrrogaAnual && ! $fechaFin->equalTo(ContratoProrroga::fechaFinAnual($fechaInicio))) {
                    $validator->errors()->add(
                        'fecha_retiro_empresa',
                        'Después de las primeras tres prórrogas, la vigencia debe ser anual y finalizar el día anterior al aniversario de inicio.',
                    );
                }
            },
        ];
    }
}
