<?php

namespace App\Http\Requests\Seguridad;

use App\Models\Seguridad\Alcoholimetro;
use App\Models\Seguridad\PruebaAlcoholemia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePruebaAlcoholemiaRequest extends FormRequest
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
        $pruebaActual = $this->route('prueba');
        $alcoholimetroActualId = $pruebaActual?->alcoholimetro_id;

        return [
            'colaborador_id' => ['required', 'integer', Rule::exists('colaboradores', 'id')->whereNull('deleted_at')],
            'tipo' => ['required', Rule::in(['pre_ruta', 'ruta', 'post_ruta', 'jl', 'segundo_viaje'])],
            'es_programacion' => ['boolean'],
            'programada_en' => [
                'required_if:es_programacion,1', 'nullable', 'date',
                function ($attribute, $value, $fail) use ($pruebaActual) {
                    if (! $value) {
                        return;
                    }

                    $sinCambios = $pruebaActual?->programada_en && Carbon::parse($value)->equalTo($pruebaActual->programada_en);

                    if (! $sinCambios && Carbon::parse($value)->isPast()) {
                        $fail('La fecha programada debe ser posterior al momento actual.');
                    }
                },
            ],
            'alcoholimetro_id' => [
                'required_unless:es_programacion,1', 'nullable', 'integer',
                Rule::exists('alcoholimetros', 'id')->where(function ($query) use ($alcoholimetroActualId) {
                    $query->where('estado', 'Disponible');

                    if ($alcoholimetroActualId) {
                        $query->orWhere('id', $alcoholimetroActualId);
                    }
                }),
            ],
            'resultado' => ['required_unless:es_programacion,1', 'nullable', 'numeric'],
            // 'accepted' es una regla implícita que siempre corre si el campo
            // está presente, incluso si 'required_unless' no lo exige — al
            // programar, el checkbox de consentimiento sigue viajando en el
            // formulario (Inertia manda booleans como '1'/'0'), así que sin
            // este Rule::when() un "0" tumbaba la validación aunque se
            // estuviera programando la prueba en vez de registrarla.
            'consentimiento_aceptado' => [
                'required_unless:es_programacion,1',
                Rule::when(! $this->boolean('es_programacion'), ['accepted']),
            ],
            'evidencia' => ['nullable', 'array'],
            'evidencia.*' => ['image', 'max:5120'],
            'evidencias' => ['nullable', 'array'],
            'evidencias.*' => ['mimes:pdf', 'max:5120'],
            'firma' => ['nullable', 'image', 'max:2048'],
            'observaciones' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->boolean('es_programacion') || ! $this->filled(['alcoholimetro_id', 'resultado'])) {
                return;
            }

            $alcoholimetro = Alcoholimetro::find($this->input('alcoholimetro_id'));

            if ($alcoholimetro && (
                (float) $this->input('resultado') < (float) $alcoholimetro->valor_min
                || (float) $this->input('resultado') > (float) $alcoholimetro->valor_max
            )) {
                $validator->errors()->add(
                    'resultado',
                    "El resultado debe estar entre {$alcoholimetro->valor_min} y {$alcoholimetro->valor_max} para este dispositivo."
                );
            }

            $prueba = $this->route('prueba');
            $fechaHora = $prueba?->fecha_hora ?? Carbon::now();
            $horas = (int) config('seguridad.intervalo_minimo_horas');
            $ignorarId = $this->route('prueba')?->id;

            if (PruebaAlcoholemia::existeConflictoDeIntervalo((int) $this->input('colaborador_id'), $this->input('tipo'), $fechaHora, $ignorarId)) {
                $tipoLabel = (new PruebaAlcoholemia(['tipo' => $this->input('tipo')]))->tipoLabel();
                $validator->errors()->add(
                    'tipo',
                    "Este colaborador ya tiene una prueba de tipo \"{$tipoLabel}\" registrada en las últimas {$horas} horas."
                );
            }
        });
    }
}
