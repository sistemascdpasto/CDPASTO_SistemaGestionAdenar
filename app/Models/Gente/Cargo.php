<?php

namespace App\Models\Gente;

use Illuminate\Database\Eloquent\Model;

class Cargo extends Model
{
    protected $table = 'cargos';

    protected $fillable = [
        'nombre',
        'perfil',
        'valor_cvd',
    ];

    protected $casts = [
        'valor_cvd' => 'integer',
    ];
}
