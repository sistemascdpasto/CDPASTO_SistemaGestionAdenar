<?php

namespace App\Models\Seguridad;

use App\Models\Flota\CombustibleVoucher;
use App\Models\Gente\ColaboradorContrato;
use App\Models\Gente\ColaboradorPadrinoCriterio;
use App\Models\Gente\ContratoProrroga;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Colaborador extends Model
{
    use SoftDeletes;

    protected $table = 'colaboradores';

    protected $fillable = [
        'user_id',
        'cedula',
        'nombres',
        'apellidos',
        'cargo',
        'turno',
        'area',
        'imagen',

        // Información básica adicional
        'expedido_en',
        'sexo',
        'fecha_nacimiento',
        'ciudad_residencia',
        'direccion',
        'estrato',
        'celular_1',
        'celular_2',
        'correo',
        'estado_civil',
        'estado_civil_otro',

        // Información personal
        'nombre_pareja',
        'hijos',

        // Contactos de emergencia
        'emergencia_parentezco_1',
        'emergencia_nombre_1',
        'emergencia_telefono_1',
        'emergencia_parentezco_2',
        'emergencia_nombre_2',
        'emergencia_telefono_2',

        // Condiciones particulares
        'discapacidad',
        'victima_conflicto',
        'libreta_militar',

        // Antecedentes en la empresa
        'ha_trabajado_antes',
        'cargo_anterior',
        'fecha_ultima_laboral',

        // Experiencia
        'tiene_experiencia',
        'area_experiencia',
        'cargo_experiencia',
        'anios_experiencia',

        // QR SKAP
        'codigo_qr_skap',

        // Documentos (legacy: columna de un solo archivo; los tipos de
        // documento nuevos no tienen columna propia, viven solo en
        // colaborador_documentos)
        'documento_cedula',
        'documento_licencia_conduccion',
        'documento_carnet_manejo_defensivo',
        'documento_certificado_manejo_defensivo',
        'documento_carnet_ingreso_cd',
        'documento_simit',
        'documento_examen_medico_ocupacional',
        'documento_recordatorio_vehiculo_licencia_conduccion',

        'is_active',

        // Wizard (HU01)
        'estado_registro',
        'wizard_step',

        // Paso 1 — identificación y condiciones particulares
        'tipo_documento',
        'tipo_documento_otro_label',
        'discapacidad_tipo',
        'discapacidad_observaciones',
        'victima_conflicto_observaciones',
        'runt_aplica',

        // Paso 1 — seguridad social
        'eps',
        'eps_otro',
        'afp',
        'afp_otro',
        'arl',
        'arl_otro',

        // Paso 1 — información aprendiz SENA
        'sena_especialidad',
        'sena_numero_grupo',
        'sena_institucion',
        'sena_nit',
        'sena_centro_formacion',

        // Paso 2 — requisitos del cargo
        'manejo_defensivo_aplica',
        'conduccion_carga_pesada_aplica',
        'experiencia_terreno_plano',
        'experiencia_terreno_montanoso',

        // Paso 3 — información del puesto de trabajo
        'centro',
        'centro_trabajo',
        'fecha_ingreso_empresa',
        'fecha_retiro_empresa',
        'motivo_retiro',
        'motivo_retiro_observaciones',
        'tipo_contrato',
        'tipo_contrato_otro',
        'contrato_fecha_desde',
        'contrato_fecha_hasta',
        'vacaciones_aplica',
        'vacaciones_fecha_desde',
        'vacaciones_fecha_hasta',
        'vacaciones_pagadas_fecha_desde',
        'vacaciones_pagadas_fecha_hasta',

        // Paso 4 — licencia de conducción
        'licencia_conduccion_categorias',
        'fecha_licencia',
        'fecha_vencimiento_licencia',
        'restricciones_licencia',

        // Paso 4 — plan padrino (toggle; el archivo vive en colaborador_documentos)
        'es_padrino',
        'tipo_padrino',
        'padrino_id',
        'mensaje_padrino',
        'nivel_autonomia',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'hijos' => 'array',
            'licencia_conduccion_categorias' => 'array',
            'fecha_nacimiento' => 'date:Y-m-d',
            'fecha_ultima_laboral' => 'date:Y-m-d',
            'anios_experiencia' => 'integer',
            'wizard_step' => 'integer',
            'sena_numero_grupo' => 'integer',
            'fecha_ingreso_empresa' => 'date:Y-m-d',
            'fecha_retiro_empresa' => 'date:Y-m-d',
            'contrato_fecha_desde' => 'date:Y-m-d',
            'contrato_fecha_hasta' => 'date:Y-m-d',
            'vacaciones_fecha_desde' => 'date:Y-m-d',
            'vacaciones_fecha_hasta' => 'date:Y-m-d',
            'vacaciones_pagadas_fecha_desde' => 'date:Y-m-d',
            'vacaciones_pagadas_fecha_hasta' => 'date:Y-m-d',
            'fecha_licencia' => 'date:Y-m-d',
            'fecha_vencimiento_licencia' => 'date:Y-m-d',
        ];
    }

    public function scopeCompletos(Builder $query): Builder
    {
        return $query->where('estado_registro', 'completo');
    }

    public function prorrogas(): HasMany
    {
        return $this->hasMany(ContratoProrroga::class)->orderByDesc('created_at');
    }

    public function contratos(): HasMany
    {
        return $this->hasMany(ColaboradorContrato::class)->orderBy('fecha_inicio');
    }

    public function scopeSinFinalizacionConfirmada(Builder $query): Builder
    {
        return $query->where(function (Builder $query): void {
            $query->where('is_active', true)
                ->orWhereDoesntHave('prorrogas', fn (Builder $prorrogas) => $prorrogas->where('tipo', 'finalizacion'));
        });
    }

    public function tieneFinalizacionConfirmada(): bool
    {
        $finalizacion = $this->prorrogas()
            ->where('tipo', 'finalizacion')
            ->orderByDesc('id')
            ->first(['contrato_id', 'created_at']);

        if (! $finalizacion || $this->is_active) {
            return false;
        }

        return $finalizacion->contrato_id
            ? ! $this->contratos()->where('id', '>', $finalizacion->contrato_id)->exists()
            : ! $this->contratos()->where('created_at', '>', $finalizacion->created_at)->exists();
    }

    public function esReingreso(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        $finalizacion = $this->prorrogas()
            ->where('tipo', 'finalizacion')
            ->orderByDesc('id')
            ->first(['contrato_id', 'created_at']);

        if (! $finalizacion) {
            return false;
        }

        return $finalizacion->contrato_id
            ? ! $this->contratos()->where('id', '>', $finalizacion->contrato_id)->exists()
            : ! $this->contratos()->where('created_at', '>', $finalizacion->created_at)->exists();
    }

    public function condicionesSalud(): HasMany
    {
        return $this->hasMany(CondicionSalud::class);
    }

    public function cargos(): HasMany
    {
        return $this->hasMany(ColaboradorCargo::class);
    }

    /**
     * Última fila ACTIVA del historial de cargos. `colaboradores.cargo` se
     * mantiene sincronizado con esto (ver CargoHistorialService), pero esta
     * relación es la fuente de verdad histórica.
     */
    public function cargoActual(): HasOne
    {
        return $this->hasOne(ColaboradorCargo::class)
            ->where('estado', 'ACTIVO')
            ->latestOfMany('fecha_inicio');
    }

    /**
     * Regla única del historial de cargos: determina a qué periodo del
     * contrato pertenece una fecha de inicio de cargo.
     *
     *  - ['tipo' => 'prorroga', 'prorroga' => ContratoProrroga] si la fecha
     *    cae dentro de una prórroga registrada [fecha_anterior, fecha_nueva].
     *  - ['tipo' => 'contrato_inicial', 'prorroga' => null] si la fecha está
     *    dentro del contrato base [fecha_ingreso_empresa, fecha_retiro_empresa].
     *  - null si la fecha está fuera de las fechas estipuladas (no pertenece
     *    al contrato ni a ninguna prórroga).
     *
     * La validación del cambio de cargo y la vista de contratos usan esta
     * misma regla, de modo que "fecha válida" e "indicador de a qué periodo
     * pertenece" nunca se desincronizan.
     *
     * @return array{tipo: string, prorroga: ?ContratoProrroga}|null
     */
    public function periodoCargoParaFecha(string|\DateTimeInterface $fecha): ?array
    {
        $fecha = Carbon::parse($fecha)->startOfDay();

        foreach ($this->prorrogas as $prorroga) {
            if ($prorroga->tipo !== 'prorroga') {
                continue;
            }

            $desde = $prorroga->fecha_anterior?->startOfDay();
            $hasta = $prorroga->fecha_nueva?->startOfDay();

            if ($desde && $hasta && $fecha >= $desde && $fecha <= $hasta) {
                return ['tipo' => 'prorroga', 'prorroga' => $prorroga];
            }
        }

        $ingreso = $this->fecha_ingreso_empresa?->startOfDay();
        $retiro = $this->fecha_retiro_empresa?->startOfDay();

        if (($ingreso === null || $fecha >= $ingreso) && ($retiro === null || $fecha <= $retiro)) {
            return ['tipo' => 'contrato_inicial', 'prorroga' => null];
        }

        return null;
    }

    public function pruebasAlcoholemia(): HasMany
    {
        return $this->hasMany(PruebaAlcoholemia::class);
    }

    public function alertas(): HasMany
    {
        return $this->hasMany(Alerta::class);
    }

    public function combustibleVouchers(): HasMany
    {
        return $this->hasMany(CombustibleVoucher::class);
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(ColaboradorDocumento::class);
    }

    public function activacionHistorial(): HasMany
    {
        return $this->hasMany(ColaboradorActivacionHistorial::class, 'colaborador_id');
    }

    public function llamadosAtencion(): HasMany
    {
        return $this->hasMany(ColaboradorLlamadoAtencion::class);
    }

    public function entrenamientos(): HasMany
    {
        return $this->hasMany(ColaboradorEntrenamiento::class);
    }

    public function pruebasPeriodo(): HasMany
    {
        return $this->hasMany(ColaboradorPruebaPeriodo::class);
    }

    public function padrinoCriterio(): HasOne
    {
        return $this->hasOne(ColaboradorPadrinoCriterio::class);
    }

    public function padrino(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'padrino_id');
    }

    public function apadrinados(): HasMany
    {
        return $this->hasMany(Colaborador::class, 'padrino_id');
    }

    public function acisReportados(): HasMany
    {
        return $this->hasMany(Aci::class);
    }

    public function evaluacionesMedicas(): HasMany
    {
        return $this->hasMany(EvaluacionMedica::class);
    }

    public function evaluacionesOwd(): HasMany
    {
        return $this->hasMany(EvaluacionOwd::class);
    }

    public function evaluacionesOwdEvaluador(): HasMany
    {
        return $this->hasMany(EvaluacionOwd::class, 'evaluador_colaborador_id');
    }

    public function encuestasMorbilidad(): HasMany
    {
        return $this->hasMany(EncuestaMorbilidad::class);
    }

    public function eppPerfil(): HasOne
    {
        return $this->hasOne(ColaboradorEppPerfil::class);
    }

    public function eppEntregas(): HasMany
    {
        return $this->hasMany(EppEntrega::class)->orderByDesc('fecha_entrega');
    }

    public function asignacionConductor(): HasOne
    {
        return $this->hasOne(AsignacionConductor::class);
    }

    public function getEstadoSkapAttribute(): string
    {
        if (! $this->codigo_qr_skap) {
            return 'Sin asignar';
        }

        return $this->is_active ? 'Activo' : 'Inactivo';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getNombreCompletoAttribute(): string
    {
        return trim("{$this->nombres} {$this->apellidos}");
    }

    public function getEdadAttribute(): ?int
    {
        return $this->fecha_nacimiento?->age;
    }
}
