<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ModulacionMunicipio extends Model
{
    protected $table = 'modulacion_municipios';

    protected $fillable = [
        'codigo_dane',
        'nombre',
        'nombre_normalizado',
        'origen',
    ];

    public function barrios(): HasMany
    {
        return $this->hasMany(ModulacionBarrio::class, 'municipio_id');
    }
}
