<?php

namespace App\Models\Seguridad;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EvaluacionOwdImportacion extends Model
{
    protected $table = 'evaluacion_owd_importaciones';

    protected $fillable = [
        'nombre_archivo',
        'usuario_id',
        'registros_leidos',
        'evaluaciones_identificadas',
        'registros_nuevos',
        'registros_duplicados',
        'registros_sin_coincidencia_qr',
        'registros_error',
        'columnas_nuevas_detectadas',
        'qrs_sin_coincidencia',
    ];

    protected function casts(): array
    {
        return [
            'registros_leidos' => 'integer',
            'evaluaciones_identificadas' => 'integer',
            'registros_nuevos' => 'integer',
            'registros_duplicados' => 'integer',
            'registros_sin_coincidencia_qr' => 'integer',
            'registros_error' => 'integer',
            'columnas_nuevas_detectadas' => 'array',
            'qrs_sin_coincidencia' => 'array',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
