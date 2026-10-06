<?php

namespace App\Models\Reparto;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sac extends Model
{
    use HasFactory;

    protected $table = 'sac';

    protected $fillable = [
        'anio',
        'numero_caso_estandar',
        'nombre_cuenta',
        'nombre_contacto',
        'fecha',
        'descripcion',
        'fecha_resuelto',
        'comentario',
        'aplica',
        'mes',
        'subcategoria',
        'motivo_queja',
        'placa',
        'responsable',
        'colaborador_id',
        'documento_transporte',
        'plan_accion',
        'tiempo_cierre_caso',
        'porcentaje_si_no',
        'cumplimiento_cierre',
        'ytd',
        'hora',
    ];

    protected function casts(): array
    {
        return [
            'fecha'          => 'date:Y-m-d',
            'fecha_resuelto' => 'date:Y-m-d',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'colaborador_id');
    }
}
