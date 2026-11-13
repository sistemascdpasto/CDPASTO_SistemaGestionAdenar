<?php

namespace App\Models\Gente;

use Illuminate\Database\Eloquent\Model;

class Cargo extends Model
{
    protected $table = 'cargos';

    protected $fillable = [
        'nombre',
        'perfil',
    ];
}
