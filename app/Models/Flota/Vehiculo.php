<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehiculo extends Model
{
    use SoftDeletes;

    protected $table = 'vehiculos';

    protected $fillable = [
        'placa',
        'truck_type',
        'modelo',
        'capacidad_pallets',
        'imagen',
        'is_active',
        'fecha_vencimiento_soat',
        'fecha_vencimiento_tecnomecanica',
        'soat_alerta_enviada_para',
        'tecnomecanica_alerta_enviada_para',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'capacidad_pallets' => 'integer',
            'fecha_vencimiento_soat' => 'date:Y-m-d',
            'fecha_vencimiento_tecnomecanica' => 'date:Y-m-d',
            'soat_alerta_enviada_para' => 'date:Y-m-d',
            'tecnomecanica_alerta_enviada_para' => 'date:Y-m-d',
        ];
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(VehiculoDocumento::class);
    }
}
