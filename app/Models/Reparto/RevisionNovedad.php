<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RevisionNovedad extends Model
{
    protected $table = 'revision_novedades';

    protected $fillable = [
        'revision_id',
        'sku',
        'producto',
        'cantidad_revisada',
        'cantidad_novedad',
        'causal_id',
        'causal_especificacion',
        'observacion',
    ];

    public function revision(): BelongsTo
    {
        return $this->belongsTo(RevisionAleatoria::class, 'revision_id');
    }

    public function causal(): BelongsTo
    {
        return $this->belongsTo(RevisionCausal::class, 'causal_id');
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(RevisionNovedadEvidencia::class, 'novedad_id')->orderBy('orden');
    }
}
