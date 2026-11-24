<?php

namespace App\Http\Requests\Flota;

use App\Models\Flota\ExtintorInspeccion;
use Illuminate\Foundation\Http\FormRequest;

class GuardarInspeccionRequest extends FormRequest
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
        /** @var \App\Models\Flota\Extintor $extintor */
        $extintor = $this->route('extintor');

        // Fecha de la última recarga del extintor (para validar que no retroceda)
        $ultimaRecarga = $extintor?->inspecciones()
            ->where('incluye_recarga', true)
            ->whereNotNull('fecha_recarga')
            ->max('fecha_recarga');

        $reglasRecarga = $this->boolean('incluye_recarga')
            ? [
                'fecha_recarga'         => array_filter([
                    'nullable', 'date',
                    $ultimaRecarga ? "after_or_equal:{$ultimaRecarga}" : null,
                ]),
                'fecha_proxima_recarga' => ['nullable', 'date', 'after:fecha_recarga'],
                'observaciones_recarga' => ['nullable', 'string', 'max:2000'],
            ]
            : [
                'fecha_recarga'         => ['nullable', 'date'],
                'fecha_proxima_recarga' => ['nullable', 'date'],
                'observaciones_recarga' => ['nullable', 'string', 'max:2000'],
            ];

        return array_merge([
            // ── Identificación ────────────────────────────────────────────────
            'tipo'                     => ['required', 'in:' . ExtintorInspeccion::TIPO_INICIO . ',' . ExtintorInspeccion::TIPO_PERIODICA],
            'fecha_inspeccion'         => ['required', 'date'],
            'responsable_inicio'       => ['nullable', 'string', 'max:120'],
            'responsable_periodico'    => ['nullable', 'string', 'max:120'],

            // ── Checklist de condiciones ──────────────────────────────────────
            'condicion'                => ['nullable', 'in:buena,mala'],
            'tipo_agente'              => ['nullable', 'string', 'max:80'],
            'agente_impulsor'          => ['nullable', 'in:directa,indirecta'],
            'capacidad_kg'             => ['nullable', 'numeric', 'min:0'],
            'marca'                    => ['nullable', 'string', 'max:80'],
            'parte_mantenimiento'      => ['nullable', 'string', 'max:255'],
            'senalizacion'             => ['nullable', 'string', 'max:255'],
            'demarcacion'              => ['nullable', 'in:buena,mala,N/A'],
            'funcionamiento'           => ['nullable', 'string', 'max:255'],
            'acceso'                   => ['nullable', 'string', 'max:255'],
            'observaciones_inspeccion' => ['nullable', 'string', 'max:2000'],

            // ── Recarga ───────────────────────────────────────────────────────
            'incluye_recarga'          => ['nullable', 'boolean'],

            // ── Firma ─────────────────────────────────────────────────────────
            'usar_firma_guardada'      => ['nullable', 'boolean'],
            'firma'                    => ['nullable', 'file', 'image', 'max:2048'],

            // ── Evidencias ────────────────────────────────────────────────────
            'evidencias'               => ['nullable', 'array', 'max:20'],
            'evidencias.*'             => ['file', 'mimes:jpg,jpeg,png,gif,webp,pdf', 'max:10240'],

            // ── Vehículo ──────────────────────────────────────────────────────
            'registra_vehiculo'        => ['nullable', 'boolean'],
            'nueva_placa'              => ['nullable', 'string', 'max:20'],
            'desasociar_previos_insp'  => ['nullable', 'boolean'],
            'observaciones_vehiculo'   => ['nullable', 'string', 'max:1000'],
        ], $reglasRecarga);
    }

    public function messages(): array
    {
        return [
            'tipo.required'                => 'El tipo de inspección es obligatorio.',
            'tipo.in'                      => 'El tipo debe ser "inicio" o "periodica".',
            'fecha_inspeccion.required'    => 'La fecha de inspección es obligatoria.',
            'fecha_recarga.after_or_equal' => 'La fecha de recarga no puede ser anterior a la última recarga registrada.',
            'fecha_proxima_recarga.after'  => 'La próxima recarga debe ser posterior a la fecha de recarga realizada.',
            'firma.image'                  => 'La firma debe ser un archivo de imagen.',
            'firma.max'                    => 'La firma no puede superar 2 MB.',
            'evidencias.max'               => 'Se permiten como máximo 20 evidencias por inspección.',
            'evidencias.*.mimes'           => 'Las evidencias deben ser imágenes (jpg, png, gif, webp) o PDF.',
            'evidencias.*.max'             => 'Cada evidencia no puede superar 10 MB.',
        ];
    }
}
