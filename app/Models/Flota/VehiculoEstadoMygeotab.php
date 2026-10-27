<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;

class VehiculoEstadoMygeotab extends Model
{
    protected $table = 'vehiculo_estado_mygeotab';

    protected $fillable = [
        'placa',
        'mygeotab_device_id',
        'detenido',
        'velocidad',
        'latitud',
        'longitud',
        'ultima_posicion_en',
        'detenido_desde',
        'notificado_en',
    ];

    protected function casts(): array
    {
        return [
            'detenido' => 'boolean',
            'velocidad' => 'decimal:2',
            'latitud' => 'decimal:7',
            'longitud' => 'decimal:7',
            'ultima_posicion_en' => 'datetime',
            'detenido_desde' => 'datetime',
            'notificado_en' => 'datetime',
        ];
    }
}
