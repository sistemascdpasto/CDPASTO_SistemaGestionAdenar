<?php

namespace App\Models\Seguridad;

use App\Models\User;
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
        'tipo_contrato',
        'contrato_fecha_desde',
        'contrato_fecha_hasta',
        'vacaciones_aplica',
        'vacaciones_fecha_desde',
        'vacaciones_fecha_hasta',
        'vacaciones_pagadas_fecha_desde',
        'vacaciones_pagadas_fecha_hasta',

        // Paso 4 — plan padrino (toggle; el archivo vive en colaborador_documentos)
        'es_padrino',
        'tipo_padrino',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
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
        ];
    }

    public function scopeCompletos(Builder $query): Builder
    {
        return $query->where('estado_registro', 'completo');
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

    public function pruebasAlcoholemia(): HasMany
    {
        return $this->hasMany(PruebaAlcoholemia::class);
    }

    public function alertas(): HasMany
    {
        return $this->hasMany(Alerta::class);
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(ColaboradorDocumento::class);
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
