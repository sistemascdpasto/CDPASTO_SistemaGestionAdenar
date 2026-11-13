<?php

namespace App\Http\Requests\Gente;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use App\Services\Gente\ContratoVigenciaService;
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
            'contrato_id' => ['nullable', 'integer', 'exists:colaborador_contratos,id'],
            'crear_nuevo_contrato' => ['nullable', 'boolean'],
            'nuevo_contrato_tipo' => ['nullable', 'string', 'max:255'],
            'nuevo_contrato_inicio' => ['nullable', 'date'],
            'nuevo_contrato_fin' => ['nullable', 'date'],
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
                $contratoVigencia = app(ContratoVigenciaService::class);
                $contratoId = $this->input('contrato_id');
                $contratoObjetivo = ($contratoId && $colaborador instanceof Colaborador)
                    ? $colaborador->contratos()->find($contratoId)
                    : null;

                $contratoActual = $colaborador instanceof Colaborador
                    ? $contratoVigencia->contratoActual($colaborador)
                    : null;

                $contratoEvaluar = $contratoObjetivo ?? $contratoActual;

                $cantidadProrrogas = ($colaborador instanceof Colaborador && $contratoEvaluar)
                    ? $contratoVigencia->cantidadProrrogas($colaborador, $contratoEvaluar)
                    : 0;
                $esAprendiz = $colaborador instanceof Colaborador
                    && $contratoVigencia->esAprendiz($colaborador, $contratoEvaluar);
                $numeroProrroga = $cantidadProrrogas + 1;
                $esProrrogaAnual = ! $esAprendiz && ContratoProrroga::esProrrogaAnual($numeroProrroga);

                // No contract exists and not creating a new historical contract -> reject prórroga
                if (! $this->boolean('crear_nuevo_contrato')) {
                    if (! $colaborador->contratos()->exists()) {
                        $validator->errors()->add('contrato_id', 'No es posible crear una prórroga porque el colaborador no tiene contratos asociados.');
                        return;
                    }
                }

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

                $esParaContratoActual = ! $contratoObjetivo || ($contratoActual && $contratoObjetivo->id === $contratoActual->id);

                if ($this->boolean('crear_nuevo_contrato')) {
                    // Contrato histórico nuevo: no se compara contra el contrato actual
                } elseif ($esParaContratoActual) {
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
                } elseif ($contratoObjetivo) {
                    $ultimaProrrogaObj = $contratoObjetivo->prorrogas()
                        ->where('tipo', 'prorroga')
                        ->orderByDesc('fecha_nueva')
                        ->orderByDesc('id')
                        ->first();
                    $finSecuencia = $ultimaProrrogaObj?->fecha_nueva ?? $contratoObjetivo->fecha_fin;
                    if ($finSecuencia && $fechaInicio->lessThanOrEqualTo(\Illuminate\Support\Carbon::parse($finSecuencia)->startOfDay())) {
                        $validator->errors()->add(
                            'fecha_inicio_prorroga',
                            'La fecha de inicio debe ser posterior a la fecha final del contrato seleccionado (' . \Illuminate\Support\Carbon::parse($finSecuencia)->format('d/m/Y') . ').',
                        );
                    }
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
