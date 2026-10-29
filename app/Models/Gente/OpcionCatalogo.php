<?php

namespace App\Models\Gente;

use Illuminate\Database\Eloquent\Model;

class OpcionCatalogo extends Model
{
    protected $table = 'opciones_catalogo';

    protected $fillable = [
        'categoria',
        'nombre',
        'es_personalizado',
    ];

    protected $casts = [
        'es_personalizado' => 'boolean',
    ];

    /**
     * Devuelve todas las opciones de una categoría, ordenadas:
     * primero las base (no personalizadas) y luego las personalizadas.
     */
    public static function opcionesDe(string $categoria): array
    {
        return static::where('categoria', $categoria)
            ->orderBy('es_personalizado')
            ->orderBy('nombre')
            ->pluck('nombre')
            ->all();
    }
}
