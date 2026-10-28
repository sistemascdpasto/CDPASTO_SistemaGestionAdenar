<?php

namespace App\Support;

use App\Enums\Role;

/**
 * Fuente de verdad única para el tipo de una Alerta: antes del `pilar` de
 * qué tipo era y qué etiqueta mostrar vivían duplicados (y a veces
 * desincronizados) en AlertaGenerada, NotificacionesService y la página de
 * React de Seguridad. Agregar un tipo nuevo ahora es agregarlo aquí.
 */
class AlertaCatalogo
{
    public const PILAR_POR_TIPO = [
        'prueba_positiva' => 'seguridad',
        'salud_mala' => 'seguridad',
        'no_apto' => 'seguridad',
        'calibracion_proxima' => 'seguridad',
        'certificado_vencido' => 'seguridad',
        'retiro_proximo' => 'gente',
        'vencimiento_soat' => 'flota',
        'vencimiento_tecnomecanica' => 'flota',
        'vehiculo_detenido' => 'reparto',
    ];

    public const LABEL_POR_TIPO = [
        'prueba_positiva' => 'Prueba de alcoholemia positiva',
        'salud_mala' => 'Estado de salud: Malo',
        'no_apto' => 'Colaborador No Apto para laborar',
        'calibracion_proxima' => 'Calibración de alcoholímetro próxima',
        'certificado_vencido' => 'Certificado de alcoholímetro por vencer',
        'retiro_proximo' => 'Contrato próximo a vencer',
        'vencimiento_soat' => 'SOAT próximo a vencer',
        'vencimiento_tecnomecanica' => 'Revisión tecnicomecánica próxima a vencer',
        'vehiculo_detenido' => 'Vehículo detenido en ruta',
    ];

    public const PILARES = ['seguridad', 'gente', 'flota', 'reparto'];

    /**
     * Roles que deben enterarse de un tipo de alerta ADEMÁS del rol del
     * pilar dueño y de Administrador (que siempre se agrega). Ej.: los
     * vencimientos de documentos de Flota ya se le avisaban también a
     * Reparto (son quienes manejan el vehículo) desde antes de esta
     * unificación — se preserva ese destinatario extra aquí en vez de
     * hardcodearlo de nuevo en el notificador.
     *
     * @var array<string, array<Role>>
     */
    public const ROLES_EXTRA_POR_TIPO = [
        'vencimiento_soat' => [Role::Reparto],
        'vencimiento_tecnomecanica' => [Role::Reparto],
    ];

    public static function pilarDeTipo(string $tipo): string
    {
        return self::PILAR_POR_TIPO[$tipo] ?? 'seguridad';
    }

    public static function labelDeTipo(string $tipo): string
    {
        return self::LABEL_POR_TIPO[$tipo] ?? $tipo;
    }

    public static function rolDePilar(string $pilar): ?Role
    {
        return Role::forModuleSlug($pilar);
    }

    public static function nombrePilar(string $pilar): string
    {
        return self::rolDePilar($pilar)?->value ?? ucfirst($pilar);
    }

    /**
     * Todos los roles que deben recibir el correo de un tipo de alerta:
     * Administrador + el rol del pilar dueño + los roles extra del tipo.
     *
     * @return array<Role>
     */
    public static function rolesDestinatarios(string $tipo): array
    {
        $roles = array_filter([
            Role::Administrador,
            self::rolDePilar(self::pilarDeTipo($tipo)),
            ...(self::ROLES_EXTRA_POR_TIPO[$tipo] ?? []),
        ]);

        return array_values(array_unique($roles, SORT_REGULAR));
    }
}
