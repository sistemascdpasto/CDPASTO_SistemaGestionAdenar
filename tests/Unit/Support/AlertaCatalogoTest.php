<?php

namespace Tests\Unit\Support;

use App\Enums\Role;
use App\Support\AlertaCatalogo;
use Tests\TestCase;

class AlertaCatalogoTest extends TestCase
{
    public function test_mapea_cada_tipo_existente_a_su_pilar(): void
    {
        $this->assertSame('seguridad', AlertaCatalogo::pilarDeTipo('prueba_positiva'));
        $this->assertSame('seguridad', AlertaCatalogo::pilarDeTipo('calibracion_proxima'));
        $this->assertSame('gente', AlertaCatalogo::pilarDeTipo('retiro_proximo'));
        $this->assertSame('flota', AlertaCatalogo::pilarDeTipo('vencimiento_soat'));
        $this->assertSame('flota', AlertaCatalogo::pilarDeTipo('vencimiento_tecnomecanica'));
        $this->assertSame('reparto', AlertaCatalogo::pilarDeTipo('vehiculo_detenido'));
    }

    public function test_tipo_desconocido_cae_a_seguridad(): void
    {
        $this->assertSame('seguridad', AlertaCatalogo::pilarDeTipo('algo_que_no_existe'));
    }

    public function test_cada_tipo_conocido_tiene_etiqueta_propia(): void
    {
        foreach (array_keys(AlertaCatalogo::PILAR_POR_TIPO) as $tipo) {
            $this->assertNotSame($tipo, AlertaCatalogo::labelDeTipo($tipo));
        }
    }

    public function test_roles_destinatarios_incluye_administrador_y_el_rol_del_pilar(): void
    {
        $roles = AlertaCatalogo::rolesDestinatarios('retiro_proximo');

        $this->assertContains(Role::Administrador, $roles);
        $this->assertContains(Role::Gente, $roles);
        $this->assertNotContains(Role::Seguridad, $roles);
    }

    public function test_vencimiento_flota_tambien_notifica_a_reparto(): void
    {
        $roles = AlertaCatalogo::rolesDestinatarios('vencimiento_soat');

        $this->assertContains(Role::Administrador, $roles);
        $this->assertContains(Role::Flota, $roles);
        $this->assertContains(Role::Reparto, $roles);
    }

    public function test_vehiculo_detenido_notifica_a_reparto_sin_flota(): void
    {
        $roles = AlertaCatalogo::rolesDestinatarios('vehiculo_detenido');

        $this->assertContains(Role::Administrador, $roles);
        $this->assertContains(Role::Reparto, $roles);
        $this->assertNotContains(Role::Flota, $roles);
    }
}
