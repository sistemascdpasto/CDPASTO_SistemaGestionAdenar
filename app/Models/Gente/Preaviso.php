<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Preaviso extends Model
{
    protected $table = 'preavisos';

    protected $fillable = [
        'colaborador_id',
        'contrato_id',
        'prorroga_id',
        'fecha',
        'fecha_desde',
        'fecha_hasta',
        'documento_path',
        'documento_nombre',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'fecha_desde' => 'date:Y-m-d',
        'fecha_hasta' => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        static::deleting(function (Preaviso $preaviso): void {
            if ($preaviso->documento_path && Storage::disk('public')->exists($preaviso->documento_path)) {
                Storage::disk('public')->delete($preaviso->documento_path);
            }
        });
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function contrato(): BelongsTo
    {
        return $this->belongsTo(ColaboradorContrato::class, 'contrato_id');
    }

    public function prorroga(): BelongsTo
    {
        return $this->belongsTo(ContratoProrroga::class, 'prorroga_id');
    }
}
