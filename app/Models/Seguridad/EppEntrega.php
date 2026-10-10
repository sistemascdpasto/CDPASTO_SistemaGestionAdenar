<?php

namespace App\Models\Seguridad;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class EppEntrega extends Model
{
    protected $table = 'epp_entregas';

    /**
     * Columna booleana => etiqueta, en el mismo orden del formato en papel
     * (PAS-BAV-SST-FR-005). Única fuente de verdad: la usan el controlador,
     * el servicio de estado y la vista del PDF, para que ningún lugar se
     * desincronice con el resto si algún día se agrega/quita un ítem.
     */
    public const ITEMS = [
        'guantes' => 'Guantes',
        'gafas' => 'Gafas',
        'casco' => 'Casco',
        'protector_auditivo' => 'Protector auditivo',
        'proteccion_respiratoria' => 'Protección respiratoria',
        'calzado' => 'Calzado',
        'camisa' => 'Camisa',
        'pantalon' => 'Pantalón',
        'otros' => 'Otros',
    ];

    protected $fillable = [
        'colaborador_id',
        'fecha_entrega',
        'guantes',
        'gafas',
        'casco',
        'protector_auditivo',
        'proteccion_respiratoria',
        'calzado',
        'camisa',
        'pantalon',
        'otros',
        'otros_cual',
        'firma_path',
        'foto_path',
        'observaciones',
        'registrado_por_id',
    ];

    protected $appends = ['firma_url', 'foto_url'];

    protected function casts(): array
    {
        return [
            'fecha_entrega' => 'date:Y-m-d',
            'guantes' => 'boolean',
            'gafas' => 'boolean',
            'casco' => 'boolean',
            'protector_auditivo' => 'boolean',
            'proteccion_respiratoria' => 'boolean',
            'calzado' => 'boolean',
            'camisa' => 'boolean',
            'pantalon' => 'boolean',
            'otros' => 'boolean',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por_id');
    }

    public function getFirmaUrlAttribute(): ?string
    {
        return $this->firma_path ? Storage::disk('public')->url($this->firma_path) : null;
    }

    public function getFotoUrlAttribute(): ?string
    {
        return $this->foto_path ? Storage::disk('public')->url($this->foto_path) : null;
    }
}
