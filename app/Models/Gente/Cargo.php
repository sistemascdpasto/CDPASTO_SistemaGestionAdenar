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

    /** El nombre del cargo siempre se guarda en MAYÚSCULAS. */
    protected function setNombreAttribute(string $value): void
    {
        $this->attributes['nombre'] = mb_strtoupper(trim($value), 'UTF-8');
    }
}
