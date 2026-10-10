<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ColaboradorEppPerfil extends Model
{
    protected $table = 'colaborador_epp_perfiles';

    protected $fillable = [
        'colaborador_id',
        'talla_calzado',
        'talla_camisa',
        'talla_pantalon',
        'talla_otros',
        'compromiso_firmado_en',
        'compromiso_firma_path',
    ];

    protected $appends = ['compromiso_firma_url'];

    protected function casts(): array
    {
        return [
            'compromiso_firmado_en' => 'datetime',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function getCompromisoFirmaUrlAttribute(): ?string
    {
        return $this->compromiso_firma_path ? Storage::disk('public')->url($this->compromiso_firma_path) : null;
    }
}
