<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Catálogo de columnas dinámicas del checklist de extintores
 * (ej. "Presión (bar)", "Sello OK"), usadas en colocación y retiro.
 */
class ExtintorColumna extends Model
{
    protected $table = 'extintor_columnas';

    protected $fillable = ['nombre', 'orden'];

    protected function casts(): array
    {
        return ['orden' => 'integer'];
    }

    public function scopeOrdenadas(Builder $query): Builder
    {
        return $query->orderBy('orden');
    }

    /** Nombres de las columnas en orden, listos para armar el checklist. */
    public static function nombres(): array
    {
        return static::ordenadas()->pluck('nombre')->all();
    }
}