<?php

namespace App\Models\Reparto;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Modulacion extends Model
{
    use SoftDeletes;

    protected $table = 'modulaciones';

    protected $fillable = [
        'fecha',
        'centro',
        'ud_programado_por',
        'despachado_por_colaborador_id',
        'despachado_por_nombre',
        'user_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function despachadoPor(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'despachado_por_colaborador_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ModulacionItem::class);
    }

    public function novedades(): HasMany
    {
        return $this->hasMany(ModulacionNovedad::class);
    }
}
