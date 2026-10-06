<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DpoAcademy extends Model
{
    use HasFactory;

    protected $table = 'dpo_academy';

    protected $fillable = [
        'colaborador_id',
        'mes',
        'anio',
        'region',
        'centro',
        'negocio',
        'qr_safety',
        'nombre',
        'cargo',
        'coronita',
        'calificacion',
        'status',
    ];

    protected $casts = [
        'mes' => 'integer',
        'anio' => 'integer',
        'calificacion' => 'float',
    ];

    protected static function booted(): void
    {
        static::creating(function (DpoAcademy $model) {
            if (empty($model->mes)) {
                $model->mes = (int) now()->month;
            }
            if (empty($model->anio)) {
                $model->anio = (int) now()->year;
            }
        });
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'colaborador_id');
    }
}
