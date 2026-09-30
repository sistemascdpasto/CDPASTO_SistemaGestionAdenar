<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GeovictoriaAsistencia extends Model
{
    protected $fillable = [
        'identificador',
        'fecha',
        'apellidos',
        'nombres',
        'cargo',
        'grupo',
        'permiso',
        'turno',
        'entrada',
        'salida_descanso',
        'ingreso_descanso',
        'salida',
        'horas_trabajadas',
        'hea',
        'hec',
        'hnt',
        'exceso_jornada',
        'horas_descanso_previo',
        'descanso_no_efectivo',
        'hora_minima_entrada',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'exceso_jornada' => 'boolean',
        'descanso_no_efectivo' => 'boolean',
        'hora_minima_entrada' => 'datetime:Y-m-d H:i',
    ];
}
