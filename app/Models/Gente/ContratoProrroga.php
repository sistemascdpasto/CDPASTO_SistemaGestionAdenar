<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContratoProrroga extends Model
{
    protected $table = 'contrato_prorrogas';

    protected $fillable = [
        'colaborador_id',
        'registrado_por',
        'fecha_anterior',
        'fecha_nueva',
        'tipo',
        'observaciones',
        'documento_path',
        'documento_nombre',
    ];

    protected $casts = [
        'fecha_anterior' => 'date:Y-m-d',
        'fecha_nueva' => 'date:Y-m-d',
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
