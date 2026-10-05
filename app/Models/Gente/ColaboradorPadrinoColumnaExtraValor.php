<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorPadrinoColumnaExtraValor extends Model
{
    protected $table = 'colaborador_padrino_columnas_extra_valores';

    // mes/anio aquí: el valor de cada celda es mensual
    protected $fillable = ['columna_extra_id', 'colaborador_id', 'mes', 'anio', 'valor'];

    protected function casts(): array
    {
        return [
            'valor' => 'boolean',
            'mes'   => 'integer',
            'anio'  => 'integer',
        ];
    }

    public function columnaExtra(): BelongsTo
    {
        return $this->belongsTo(ColaboradorPadrinoColumnaExtra::class, 'columna_extra_id');
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
