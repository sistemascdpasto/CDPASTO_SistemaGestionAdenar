<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ActaTallerNovedad extends Model
{
    protected $table = 'actas_taller_novedades';

    const PRIORIDAD_ALTA  = 'alta';
    const PRIORIDAD_MEDIA = 'media';
    const PRIORIDAD_BAJA  = 'baja';

    const ESTADO_PENDIENTE   = 'pendiente';
    const ESTADO_EN_REVISION = 'en_revision';
    const ESTADO_SOLUCIONADO = 'solucionado';

    protected $fillable = [
        'acta_taller_id',
        'titulo',
        'descripcion',
        'categoria',
        'prioridad',
        'estado',
        'responsable',
        'fecha_reporte',
        'fecha_solucion',
        'orden',
    ];

    protected function casts(): array
    {
        return [
            'fecha_reporte'  => 'date',
            'fecha_solucion' => 'date',
            'orden'          => 'integer',
        ];
    }

    public function acta(): BelongsTo
    {
        return $this->belongsTo(ActaTaller::class, 'acta_taller_id');
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(ActaTallerEvidencia::class, 'novedad_id')->orderBy('orden');
    }
}
