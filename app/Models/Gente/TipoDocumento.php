<?php

namespace App\Models\Gente;

use Illuminate\Database\Eloquent\Model;

class TipoDocumento extends Model
{
    protected $table = 'tipos_documento';

    protected $fillable = [
        'nombre',
        'es_personalizado',
    ];

    protected $casts = [
        'es_personalizado' => 'boolean',
    ];
}
