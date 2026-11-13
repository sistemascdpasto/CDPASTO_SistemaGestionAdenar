<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorDocumento;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\Gente\Preaviso;

class ColaboradorContrato extends Model
{
    protected $table = 'colaborador_contratos';

    protected $fillable = [
        'colaborador_id',
        'tipo_contrato',
        'tipo_contrato_otro',
        'cargo',
        'area',
        'fecha_inicio',
        'fecha_fin',
        'estado',
        'observaciones',
        'registrado_por',
    ];

    protected $casts = [
        'fecha_inicio' => 'date:Y-m-d',
        'fecha_fin'    => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        static::created(function (ColaboradorContrato $contrato): void {
            if ($contrato->fecha_fin) {
                Preaviso::firstOrCreate(
                    [
                        'contrato_id' => $contrato->id,
                        'prorroga_id' => null,
                    ],
                    [
                        'colaborador_id' => $contrato->colaborador_id,
                        'fecha'          => $contrato->fecha_fin,
                        'fecha_desde'    => $contrato->fecha_inicio,
                        'fecha_hasta'    => $contrato->fecha_fin,
                    ]
                );
            }
        });

        static::updated(function (ColaboradorContrato $contrato): void {
            if ($contrato->wasChanged(['fecha_inicio', 'fecha_fin']) && $contrato->fecha_fin) {
                $contrato->preavisos()->whereNull('prorroga_id')->update([
                    'fecha'       => $contrato->fecha_fin,
                    'fecha_desde' => $contrato->fecha_inicio,
                    'fecha_hasta' => $contrato->fecha_fin,
                ]);
            }
        });

        static::deleting(function (ColaboradorContrato $contrato): void {
            // 1. Eliminar preavisos y sus archivos asociados
            foreach ($contrato->preavisos as $preaviso) {
                $preaviso->delete();
            }

            // 2. Eliminar prórrogas y sus archivos asociados
            foreach ($contrato->prorrogas as $prorroga) {
                $prorroga->delete();
            }

            // 3. Eliminar documentos del contrato y sus archivos físicos
            $documentos = ColaboradorDocumento::where('contrato_id', $contrato->id)->get();
            foreach ($documentos as $doc) {
                if ($doc->path && Storage::disk('public')->exists($doc->path)) {
                    Storage::disk('public')->delete($doc->path);
                }
                $doc->delete();
            }
        });
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function prorrogas(): HasMany
    {
        return $this->hasMany(ContratoProrroga::class, 'contrato_id');
    }

    public function preavisos(): HasMany
    {
        return $this->hasMany(Preaviso::class, 'contrato_id');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(ColaboradorDocumento::class, 'contrato_id')
            ->where('campo', 'documento_contrato');
    }

    public function esAprendiz(): bool
    {
        return Str::contains(Str::upper($this->tipo_contrato.' '.$this->tipo_contrato_otro), 'APRENDIZ');
    }
}
