<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AsignacionConductor extends Model
{
    protected $table = 'asignacion_conductores';

    protected $fillable = [
        'colaborador_id',
        'cedula',
        'criticidad_matriz_rutas',
        'apto_rutas_criticas',
        'programar_rutas',
        'rutas_cd',
        'observaciones',
    ];

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
