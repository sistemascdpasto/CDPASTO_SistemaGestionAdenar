<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Catálogo de productos (SKU) de la compañía, importado desde el archivo de
 * referencia que carga el área comercial — ver database/seeders/ProductoSeeder.
 */
class Producto extends Model
{
    protected $fillable = [
        'sku',
        'descripcion',
        'tipo',
        'hl_unidad',
    ];

    protected function casts(): array
    {
        return [
            'hl_unidad' => 'float',
        ];
    }
}
