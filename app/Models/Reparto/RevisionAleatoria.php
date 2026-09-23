<?php

namespace App\Models\Reparto;

use App\Models\Flota\Vehiculo;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RevisionAleatoria extends Model
{
    const RESULTADO_SIN_NOVEDADES = 'sin_novedades';

    const RESULTADO_CON_NOVEDADES = 'con_novedades';

    protected $table = 'revisiones_aleatorias';

    protected $fillable = [
        'fecha',
        'vehiculo_id',
        'vehiculo_seleccionado_en',
        'responsable_id',
        'responsable_seleccionado_en',
        'resultado',
        'finalizada_en',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date:Y-m-d',
            'vehiculo_seleccionado_en' => 'datetime',
            'responsable_seleccionado_en' => 'datetime',
            'finalizada_en' => 'datetime',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(RevisionResponsable::class, 'responsable_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function novedades(): HasMany
    {
        return $this->hasMany(RevisionNovedad::class, 'revision_id');
    }
}
