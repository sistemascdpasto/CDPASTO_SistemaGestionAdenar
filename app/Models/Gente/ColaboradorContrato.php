<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorContrato extends Model
{
    protected $table = 'colaborador_contratos';

    protected $fillable = [
        'colaborador_id',
        'tipo_contrato',
        'tipo_contrato_otro',
        'fecha_inicio',
        'fecha_fin',
        'estado',
        'observaciones',
        'registrado_por',
    ];

    protected $casts = [
        'fecha_inicio' => 'date:Y-m-d',
        'fecha_fin'    => 'date:Y-m-d',
    ];

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
