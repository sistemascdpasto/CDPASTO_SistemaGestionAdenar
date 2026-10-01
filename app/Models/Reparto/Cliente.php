<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;

class Cliente extends Model
{
    protected $table = 'reparto_clientes';

    protected $fillable = [
        'codigo_cliente',
        'cliente',
        'propietario',
        'identificacion',
        'longitud',
        'latitud',
        'barrio',
        'direccion',
        'departamento',
        'municipio',
        'actividad_economica',
        'telefonos',
        'correo_electronico',
    ];

    protected $casts = [
        'longitud' => 'float',
        'latitud'  => 'float',
    ];
}
