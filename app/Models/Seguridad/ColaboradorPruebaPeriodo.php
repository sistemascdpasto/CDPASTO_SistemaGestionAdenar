<?php

namespace App\Models\Seguridad;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ColaboradorPruebaPeriodo extends Model
{
    protected $table = 'colaborador_pruebas_periodo';

    protected $fillable = [
        'colaborador_id',
        'etapa',
        'realizada',
        'fecha_realizacion',
        'realizado_por_id',
        'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'realizada' => 'boolean',
            'fecha_realizacion' => 'datetime',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function realizadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'realizado_por_id');
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(ColaboradorPruebaPeriodoEvidencia::class, 'colaborador_prueba_periodo_id');
    }
}
