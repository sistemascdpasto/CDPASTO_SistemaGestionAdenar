<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;

class EventosTripulacion extends Model
{
    protected $table = 'eventos_tripulacion';

    protected $fillable = [
        // Campos originales
        'fecha',
        'placa',
        'doc_transporte',
        'documento',
        'nombre',
        'cargo',
        'total_eventos',

        // Temporalidad del Excel
        'anio',
        'mes',

        // Identificadores regionales
        'rr',
        'rr_pasto',

        // Indicadores de eventos
        'excesos_tiempo_ruta',
        'alertas_velocidad_curvas',

        // Adherencias (%)
        'adherencia_checklist_pre',
        'adherencia_checklist_post',

        // Indicadores de desempeño
        'rendimiento_combustible',
        'modulacion',
        'adherencia_tiempo',
        'entrega_en_rango',
        'rechazos',
        'rmd',
    ];

    protected function casts(): array
    {
        return [
            'fecha'                    => 'date:Y-m-d',
            'anio'                     => 'integer',
            'mes'                      => 'integer',
            'total_eventos'            => 'integer',
            'excesos_tiempo_ruta'      => 'integer',
            'alertas_velocidad_curvas' => 'integer',
            'rechazos'                 => 'float',      // porcentaje ej: 3.5040
            'adherencia_checklist_pre' => 'float',
            'adherencia_checklist_post'=> 'float',
            'rendimiento_combustible'  => 'float',
            'modulacion'               => 'float',
            'adherencia_tiempo'        => 'float',
            'entrega_en_rango'         => 'float',
        ];
    }
}
