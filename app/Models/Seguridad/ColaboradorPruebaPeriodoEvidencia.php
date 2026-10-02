<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorPruebaPeriodoEvidencia extends Model
{
    protected $table = 'colaborador_prueba_periodo_evidencias';

    protected $fillable = [
        'colaborador_prueba_periodo_id',
        'path',
    ];

    public function pruebaPeriodo(): BelongsTo
    {
        return $this->belongsTo(ColaboradorPruebaPeriodo::class, 'colaborador_prueba_periodo_id');
    }
}
