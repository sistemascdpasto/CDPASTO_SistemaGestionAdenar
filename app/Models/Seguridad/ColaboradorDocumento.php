<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorDocumento extends Model
{
    protected $table = 'colaborador_documentos';

    protected $fillable = [
        'colaborador_id',
        'campo',
        'path',
        'nombre_original',
        'fecha_documento',
    ];

    protected function casts(): array
    {
        return [
            'fecha_documento' => 'date:Y-m-d',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
