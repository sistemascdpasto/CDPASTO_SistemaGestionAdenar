<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;

class RevisionCausal extends Model
{
    protected $table = 'revision_causales';

    protected $fillable = [
        'nombre',
        'requiere_especificacion',
        'is_active',
        'orden',
    ];

    protected function casts(): array
    {
        return [
            'requiere_especificacion' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
