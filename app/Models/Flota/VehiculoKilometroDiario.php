<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;

class VehiculoKilometroDiario extends Model
{
    protected $table = 'vehiculo_kilometros_diarios';

    protected $fillable = [
        'fecha',
        'placa',
        'mygeotab_device_id',
        'distancia_km',
        'odometro_fin',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date:Y-m-d',
            'distancia_km' => 'decimal:2',
            'odometro_fin' => 'decimal:2',
        ];
    }
}
