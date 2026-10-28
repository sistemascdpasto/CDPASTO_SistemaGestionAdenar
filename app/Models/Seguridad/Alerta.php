<?php

namespace App\Models\Seguridad;

use App\Models\User;
use App\Support\AlertaCatalogo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alerta extends Model
{
    protected $table = 'alertas';

    protected $fillable = [
        'tipo',
        'pilar',
        'colaborador_id',
        'alcoholimetro_id',
        'prueba_alcoholemia_id',
        'mensaje',
        'contexto',
        'atendida',
        'atendida_por',
        'atendida_en',
    ];

    protected function casts(): array
    {
        return [
            'contexto' => 'array',
            'atendida' => 'boolean',
            'atendida_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Así los call sites existentes (Seguridad, Gente) no tienen que
        // pasar 'pilar' explícito: se deriva de 'tipo' vía el catálogo único.
        static::creating(function (Alerta $alerta) {
            $alerta->pilar ??= AlertaCatalogo::pilarDeTipo($alerta->tipo);
        });
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function alcoholimetro(): BelongsTo
    {
        return $this->belongsTo(Alcoholimetro::class);
    }

    public function pruebaAlcoholemia(): BelongsTo
    {
        return $this->belongsTo(PruebaAlcoholemia::class);
    }

    public function atendidaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'atendida_por');
    }
}
