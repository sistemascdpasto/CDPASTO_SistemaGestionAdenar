<?php

namespace App\Models\Gente;

use Illuminate\Database\Eloquent\Model;

class PerfilCargo extends Model
{
    protected $table = 'perfiles_cargos';

    protected $fillable = [
        'nombre',
        'observaciones',
    ];
}
