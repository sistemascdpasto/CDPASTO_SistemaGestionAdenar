<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;

class PruebaAlcoholemiaRequisito extends Model
{
    protected $table = 'pruebas_alcoholemia_requisitos';

    protected $fillable = [
        'colaborador_id',
        'fecha',
        'tipo',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date:Y-m-d',
        ];
    }
}
