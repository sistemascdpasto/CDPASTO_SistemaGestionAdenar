<?php

namespace App\Services\Notificaciones;

use App\Models\Flota\Varada;
use App\Models\Flota\Vehiculo;
use App\Models\Gente\Sac;
use App\Models\Reparto\CincoPorque;
use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\CondicionSalud;
use App\Models\Seguridad\EvaluacionMedica;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Arma la lista de notificaciones de la campana del header según los roles del
 * usuario. Cada grupo trae un conteo, hasta 8 ítems recientes y un enlace a la
 * pantalla donde se gestionan. El Administrador ve todos los grupos.
 */
class NotificacionesService
{
    private const MAX_ITEMS = 8;

    public function paraUsuario(User $user): array
    {
        $es = fn (string $rol) => $user->hasRole('Administrador') || $user->hasRole($rol);

        $constructores = [];

        if ($es('Gente') || $es('Seguridad')) {
            $constructores[] = fn () => $this->pruebasPeriodo();
        }
        if ($es('Gente')) {
            $constructores[] = fn () => $this->sacSinResolver();
        }
        if ($es('Seguridad')) {
            $constructores[] = fn () => $this->alertasSeguridad();
            $constructores[] = fn () => $this->condicionesSaludConNovedad();
            $constructores[] = fn () => $this->examenesPorVencer();
        }
        if ($es('Flota')) {
            $constructores[] = fn () => $this->documentosVehiculos();
            $constructores[] = fn () => $this->varadasAbiertas();
        }
        if ($es('Reparto')) {
            $constructores[] = fn () => $this->cincoPorquesSinPlan();
        }

        $grupos = array_values(array_filter(array_map(fn ($c) => $c(), $constructores)));

        return [
            'total' => array_sum(array_column($grupos, 'total')),
            'grupos' => $grupos,
        ];
    }

    // ── Grupos ───────────────────────────────────────────────────────────────

    private function pruebasPeriodo(): ?array
    {
        $hoy = Carbon::today();
        $etapas = ['7_dias' => 8, '30_dias' => 30, '90_dias' => 90];

        $colaboradores = Colaborador::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNotNull('fecha_ingreso_empresa')->orWhereNotNull('contrato_fecha_desde'))
            ->with('pruebasPeriodo:id,colaborador_id,etapa,realizada')
            ->get();

        $items = [];
        foreach ($colaboradores as $colaborador) {
            $ingreso = $colaborador->contrato_fecha_desde ?? $colaborador->fecha_ingreso_empresa;
            if (! $ingreso) {
                continue;
            }
            $retiro = $colaborador->contrato_fecha_hasta ?? $colaborador->fecha_retiro_empresa;

            foreach ($etapas as $etapa => $dias) {
                $fechaPrueba = $ingreso->copy()->addDays($dias);
                if ($retiro && $retiro->lt($fechaPrueba)) {
                    continue;
                }
                if ($hoy->lt($fechaPrueba)) {
                    continue;
                }
                if ($colaborador->pruebasPeriodo->contains(fn ($p) => $p->etapa === $etapa && $p->realizada)) {
                    continue;
                }

                $atrasoDias = (int) $fechaPrueba->diffInDays($hoy);
                $items[] = [
                    'titulo' => $colaborador->nombre_completo,
                    'detalle' => $atrasoDias === 0
                        ? "Prueba de {$dias} días programada para hoy"
                        : "Prueba de {$dias} días atrasada ".($atrasoDias === 1 ? 'hace 1 día' : "hace {$atrasoDias} días"),
                    'fecha' => $fechaPrueba->format('d/m/Y'),
                    'url' => '/modules/gente/plan-padrinos',
                    'critico' => $atrasoDias > 0,
                    'orden' => $atrasoDias > 0 ? -$atrasoDias : 1,
                ];
            }
        }

        return $this->grupo('pruebas_periodo', 'Pruebas de Período', 'calendar-clock', '#B45309', $items, [
            'label' => 'Gestionar en Seguimiento de Pruebas',
            'url' => '/modules/gente/plan-padrinos',
        ]);
    }

    private function sacSinResolver(): ?array
    {
        $registros = Sac::query()
            ->whereNull('fecha_resuelto')
            ->orderByDesc('fecha')
            ->limit(self::MAX_ITEMS)
            ->get(['id', 'numero_caso_estandar', 'nombre_cuenta', 'motivo_queja', 'fecha']);
        $total = Sac::query()->whereNull('fecha_resuelto')->count();

        $items = $registros->map(fn (Sac $s) => [
            'titulo' => $s->nombre_cuenta ?: ('Caso '.($s->numero_caso_estandar ?: $s->id)),
            'detalle' => $s->motivo_queja ?: 'SAC sin resolver',
            'fecha' => optional($s->fecha)->format('d/m/Y'),
            'url' => '/modules/gente/sac',
        ])->all();

        return $this->grupo('sac', 'SAC sin resolver', 'file-warning', '#E3A11E', $items, [
            'label' => 'Ver SAC',
            'url' => '/modules/gente/sac',
        ], $total);
    }

    private function alertasSeguridad(): ?array
    {
        $alertas = Alerta::query()
            ->with(['colaborador:id,nombres,apellidos', 'alcoholimetro:id,codigo'])
            ->where('atendida', false)
            ->latest()
            ->limit(self::MAX_ITEMS)
            ->get();
        $total = Alerta::query()->where('atendida', false)->count();

        $labels = [
            'prueba_positiva' => 'Prueba positiva',
            'salud_mala' => 'Salud: Malo',
            'no_apto' => 'No apto',
            'calibracion_proxima' => 'Calibración próxima',
            'certificado_vencido' => 'Certificado vencido',
            'contrato_proximo_vencer' => 'Contrato por vencer',
        ];

        $items = $alertas->map(fn (Alerta $a) => [
            'titulo' => $labels[$a->tipo] ?? $a->tipo,
            'detalle' => $a->mensaje,
            'fecha' => $a->created_at?->diffForHumans(),
            'url' => '/modules/seguridad/alertas',
            'critico' => in_array($a->tipo, ['prueba_positiva', 'no_apto', 'salud_mala'], true),
        ])->all();

        return $this->grupo('alertas_seguridad', 'Alertas de Seguridad', 'shield-alert', '#D4102A', $items, [
            'label' => 'Ver todas las alertas de seguridad',
            'url' => '/modules/seguridad/alertas',
        ], $total);
    }

    private function condicionesSaludConNovedad(): ?array
    {
        $desde = Carbon::today()->subDays(7)->startOfDay();

        $registros = CondicionSalud::query()
            ->with('colaborador:id,nombres,apellidos')
            ->whereIn('estado', ['Regular', 'Malo'])
            ->where('fecha_hora', '>=', $desde)
            ->latest('fecha_hora')
            ->limit(self::MAX_ITEMS)
            ->get();
        $total = CondicionSalud::query()
            ->whereIn('estado', ['Regular', 'Malo'])
            ->where('fecha_hora', '>=', $desde)
            ->count();

        $items = $registros->map(fn (CondicionSalud $c) => [
            'titulo' => $c->colaborador?->nombre_completo ?? 'Colaborador',
            'detalle' => "Condición de salud: {$c->estado}".($c->observacion ? " · {$c->observacion}" : ''),
            'fecha' => $c->fecha_hora?->format('d/m/Y H:i'),
            'url' => '/modules/seguridad/condiciones-salud',
            'critico' => $c->estado === 'Malo',
        ])->all();

        return $this->grupo('condiciones_salud', 'Condiciones de salud con novedad', 'heart-pulse', '#DB2777', $items, [
            'label' => 'Ver historial de condiciones de salud',
            'url' => '/modules/seguridad/condiciones-salud',
        ], $total);
    }

    private function examenesPorVencer(): ?array
    {
        $limite = Carbon::today()->addDays(30);

        $evals = EvaluacionMedica::query()
            ->with('colaborador:id,nombres,apellidos')
            ->whereNotNull('proximo_examen_fecha')
            ->whereDate('proximo_examen_fecha', '<=', $limite)
            ->orderBy('proximo_examen_fecha')
            ->limit(self::MAX_ITEMS)
            ->get();
        $total = EvaluacionMedica::query()
            ->whereNotNull('proximo_examen_fecha')
            ->whereDate('proximo_examen_fecha', '<=', $limite)
            ->count();

        $hoy = Carbon::today();
        $items = $evals->map(function (EvaluacionMedica $e) use ($hoy) {
            $vencido = $e->proximo_examen_fecha->lt($hoy);

            return [
                'titulo' => $e->colaborador?->nombre_completo ?? 'Colaborador',
                'detalle' => $vencido ? 'Examen médico vencido' : 'Examen médico próximo a vencer',
                'fecha' => $e->proximo_examen_fecha->format('d/m/Y'),
                'url' => '/modules/seguridad/examenes-medicos',
                'critico' => $vencido,
            ];
        })->all();

        return $this->grupo('examenes_medicos', 'Exámenes médicos por vencer', 'stethoscope', '#7C3AED', $items, [
            'label' => 'Ver bandeja de exámenes médicos',
            'url' => '/modules/seguridad/examenes-medicos',
        ], $total);
    }

    private function documentosVehiculos(): ?array
    {
        $hoy = Carbon::today();
        $limiteSoat = $hoy->copy()->addDays((int) config('flota.dias_alerta_soat', 15));
        $limiteTecno = $hoy->copy()->addDays((int) config('flota.dias_alerta_tecnomecanica', 30));

        $vehiculos = Vehiculo::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q
                ->whereNotNull('fecha_vencimiento_soat')
                ->orWhereNotNull('fecha_vencimiento_tecnomecanica'))
            ->get(['id', 'placa', 'fecha_vencimiento_soat', 'fecha_vencimiento_tecnomecanica']);

        $items = [];
        foreach ($vehiculos as $v) {
            foreach ([
                ['SOAT', $v->fecha_vencimiento_soat, $limiteSoat],
                ['Tecnomecánica', $v->fecha_vencimiento_tecnomecanica, $limiteTecno],
            ] as [$doc, $fecha, $limite]) {
                if (! $fecha || $fecha->gt($limite)) {
                    continue;
                }
                $vencido = $fecha->lt($hoy);
                $items[] = [
                    'titulo' => "{$v->placa} — {$doc}",
                    'detalle' => $vencido ? "{$doc} vencido" : "{$doc} por vencer",
                    'fecha' => $fecha->format('d/m/Y'),
                    'url' => '/modules/flota/vehiculos',
                    'critico' => $vencido,
                    'orden' => $fecha->timestamp,
                ];
            }
        }

        usort($items, fn ($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));

        return $this->grupo('documentos_flota', 'Documentos de vehículos', 'truck', '#2B6CB0', $items, [
            'label' => 'Ver documentación de flota',
            'url' => '/modules/flota/vehiculos',
        ]);
    }

    private function varadasAbiertas(): ?array
    {
        $abiertas = Varada::query()
            ->whereNull('fecha_solucion')
            ->latest('fecha_reportada')
            ->limit(self::MAX_ITEMS)
            ->get(['id', 'placa', 'sistema', 'tipo_falla', 'fecha_reportada']);
        $total = Varada::query()->whereNull('fecha_solucion')->count();

        $items = $abiertas->map(fn (Varada $v) => [
            'titulo' => $v->placa ?: 'Varada',
            'detalle' => trim(collect([$v->sistema, $v->tipo_falla])->filter()->implode(' · ')) ?: 'Varada sin resolver',
            'fecha' => $v->fecha_reportada?->format('d/m/Y H:i'),
            'url' => '/modules/flota/varadas',
            'critico' => true,
        ])->all();

        return $this->grupo('varadas', 'Varadas abiertas', 'wrench', '#B45309', $items, [
            'label' => 'Ver control de varadas',
            'url' => '/modules/flota/varadas',
        ], $total);
    }

    private function cincoPorquesSinPlan(): ?array
    {
        $query = fn () => CincoPorque::query()
            ->where(fn ($q) => $q->whereNull('plan_accion')->orWhere('plan_accion', ''));

        $registros = $query()
            ->with('user:id,name')
            ->latest('fecha')
            ->limit(self::MAX_ITEMS)
            ->get(['id', 'user_id', 'fecha', 'indicador', 'problema']);

        $items = $registros->map(fn (CincoPorque $c) => [
            'titulo' => $c->indicador ?: 'Análisis 5 Por Qué',
            'detalle' => $c->problema ? mb_strimwidth($c->problema, 0, 90, '…') : 'Sin plan de acción',
            'fecha' => optional($c->fecha)->format('d/m/Y'),
            'url' => '/cinco-porques/'.$c->id,
        ])->all();

        return $this->grupo('cinco_porques', '5 Por Qué sin plan de acción', 'list-checks', '#D4102A', $items, [
            'label' => 'Ver historial de 5 Por Qué',
            'url' => '/cinco-porques/historial',
        ], $query()->count());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array{label: string, url: string}  $verTodos
     */
    private function grupo(string $key, string $titulo, string $icono, string $color, array $items, array $verTodos, ?int $total = null): ?array
    {
        if (count($items) === 0) {
            return null;
        }

        usort($items, fn ($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));

        return [
            'key' => $key,
            'titulo' => $titulo,
            'icono' => $icono,
            'color' => $color,
            'total' => $total ?? count($items),
            'items' => array_map(fn ($i) => collect($i)->except('orden')->all(), array_slice($items, 0, self::MAX_ITEMS)),
            'ver_todos' => $verTodos,
        ];
    }
}
