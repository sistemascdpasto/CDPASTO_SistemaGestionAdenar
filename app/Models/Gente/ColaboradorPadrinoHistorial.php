<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorPadrinoHistorial extends Model
{
    protected $table = 'colaborador_padrino_historial';

    protected $fillable = [
        'colaborador_id',
        'padrino_id',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date:Y-m-d',
            'fecha_fin'    => 'date:Y-m-d',
        ];
    }

    /** El colaborador que fue apadrinado */
    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'colaborador_id');
    }

    /** El padrino que lo guió */
    public function padrino(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'padrino_id');
    }
}
