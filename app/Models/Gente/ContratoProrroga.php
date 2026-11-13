<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorDocumento;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use App\Models\Gente\Preaviso;

class ContratoProrroga extends Model
{
    public const MAX_PRORROGAS_INICIALES = 3;

    protected $table = 'contrato_prorrogas';

    protected $fillable = [
        'colaborador_id',
        'contrato_id',
        'registrado_por',
        'fecha_anterior',
        'fecha_inicio',
        'fecha_nueva',
        'tipo',
        'observaciones',
        'documento_path',
        'documento_nombre',
    ];

    protected $casts = [
        'fecha_anterior' => 'date:Y-m-d',
        'fecha_inicio' => 'date:Y-m-d',
        'fecha_nueva' => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        static::created(function (ContratoProrroga $prorroga): void {
            if ($prorroga->tipo === 'prorroga' && $prorroga->fecha_nueva) {
                $contratoId = $prorroga->contrato_id;
                if (! $contratoId) {
                    $contratoId = $prorroga->colaborador?->contratos()
                        ->orderByDesc('fecha_inicio')
                        ->orderByDesc('id')
                        ->value('id');
                }

                if ($contratoId) {
                    Preaviso::firstOrCreate(
                        ['prorroga_id' => $prorroga->id],
                        [
                            'colaborador_id' => $prorroga->colaborador_id,
                            'contrato_id'    => $contratoId,
                            'fecha'          => $prorroga->fecha_nueva,
                            'fecha_desde'    => $prorroga->fechaInicioEfectiva(),
                            'fecha_hasta'    => $prorroga->fecha_nueva,
                        ]
                    );
                }
            }
        });

        static::updated(function (ContratoProrroga $prorroga): void {
            if ($prorroga->wasChanged(['fecha_nueva', 'fecha_inicio', 'fecha_anterior']) && $prorroga->fecha_nueva) {
                $prorroga->preaviso()->update([
                    'fecha'       => $prorroga->fecha_nueva,
                    'fecha_desde' => $prorroga->fechaInicioEfectiva(),
                    'fecha_hasta' => $prorroga->fecha_nueva,
                ]);
            }
        });

        static::deleting(function (ContratoProrroga $prorroga): void {
            // 1. Eliminar archivo físico de la prórroga
            if ($prorroga->documento_path && Storage::disk('public')->exists($prorroga->documento_path)) {
                Storage::disk('public')->delete($prorroga->documento_path);
            }

            // 2. Eliminar preaviso asociado (y su archivo físico mediante Preaviso::deleting)
            $prorroga->preaviso?->delete();

            // 3. Eliminar preaviso en colaborador_documentos si existiera para esta prórroga
            if ($prorroga->fecha_nueva) {
                $docPreaviso = ColaboradorDocumento::where('colaborador_id', $prorroga->colaborador_id)
                    ->where('campo', 'documento_preaviso_terminacion')
                    ->whereDate('fecha_documento', $prorroga->fecha_nueva)
                    ->first();

                if ($docPreaviso) {
                    if ($docPreaviso->path && Storage::disk('public')->exists($docPreaviso->path)) {
                        Storage::disk('public')->delete($docPreaviso->path);
                    }
                    $docPreaviso->delete();
                }
            }
        });
    }

    public function fechaInicioEfectiva(): ?Carbon
    {
        if ($this->tipo !== 'prorroga') {
            return null;
        }

        return $this->fecha_inicio ?? $this->fecha_anterior?->copy()->addDay();
    }

    public static function esProrrogaAnual(int $numero): bool
    {
        return $numero > self::MAX_PRORROGAS_INICIALES;
    }

    public static function fechaFinAnual(Carbon $fechaInicio): Carbon
    {
        return $fechaInicio->copy()->addYearNoOverflow()->subDay();
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function contrato(): BelongsTo
    {
        return $this->belongsTo(ColaboradorContrato::class, 'contrato_id');
    }

    public function preaviso(): HasOne
    {
        return $this->hasOne(Preaviso::class, 'prorroga_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
