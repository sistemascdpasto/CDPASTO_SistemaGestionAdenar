<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;

/**
 * Catálogo de columnas dinámicas del checklist de extintores.
 * Cada fila representa un campo adicional que el usuario definió
 * (ej. "Presión (bar)", "Sello OK") y aparece tanto en el checklist
 * de colocación como en el de retiro.
 */
class ExtintorColumna extends Model
{
    protected $table = 'extintor_columnas';

    protected $fillable = [
        'nombre',
        'orden',
    ];

    protected function casts(): array
    {
        return [
            'orden' => 'integer',
        ];
    }
}
