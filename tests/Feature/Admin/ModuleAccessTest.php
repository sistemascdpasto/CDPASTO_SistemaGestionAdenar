<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\UserSubmoduleAccess;
use App\Support\ModuleAccessRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ModuleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Administrador', 'Seguridad', 'Reparto', 'Gente', 'Flota', 'Colaborador'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string $rol): User
    {
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_sin_personalizar_un_usuario_conserva_acceso_completo_a_su_rol(): void
    {
        $user = $this->usuario('Reparto');

        // Ruta real de un submódulo de Reparto, sin personalización: debe
        // entrar igual que antes de esta funcionalidad.
        $this->actingAs($user)->get(route('reparto.eventos-tripulacion.index'))->assertOk();
    }

    public function test_un_usuario_personalizado_solo_entra_a_los_submodulos_otorgados(): void
    {
        $user = $this->usuario('Reparto');
        $user->update(['modulos_personalizados' => true]);
        UserSubmoduleAccess::create(['user_id' => $user->id, 'module_slug' => 'reparto', 'submodule_key' => 'eventos-tripulacion']);

        $this->actingAs($user)->get(route('reparto.eventos-tripulacion.index'))->assertOk();
        $this->actingAs($user)->get(route('reparto.indicadores.index'))->assertForbidden();
    }

    public function test_un_usuario_personalizado_sin_el_rol_sigue_bloqueado_aunque_se_le_otorgue_el_submodulo(): void
    {
        // El rol sigue siendo el piso: otorgar explícitamente un submódulo de
        // Reparto a alguien sin el rol Reparto (ni Administrador) no le da acceso.
        $user = $this->usuario('Gente');
        $user->update(['modulos_personalizados' => true]);
        UserSubmoduleAccess::create(['user_id' => $user->id, 'module_slug' => 'reparto', 'submodule_key' => 'eventos-tripulacion']);

        $this->actingAs($user)->get(route('reparto.eventos-tripulacion.index'))->assertForbidden();
    }

    public function test_administrador_siempre_tiene_acceso_sin_importar_la_personalizacion(): void
    {
        $admin = $this->usuario('Administrador');
        $admin->update(['modulos_personalizados' => true]);
        // Sin ninguna fila en user_submodule_access: un usuario normal personalizado
        // sin filas quedaría sin acceso a nada, pero Administrador siempre pasa.

        $this->actingAs($admin)->get(route('reparto.eventos-tripulacion.index'))->assertOk();
        $this->actingAs($admin)->get(route('seguridad.dispositivos.index'))->assertOk();
    }

    public function test_la_ruta_generica_de_submodulo_tambien_respeta_la_personalizacion(): void
    {
        // /modules/gente/plan-padrinos se sirve desde la ruta comodín genérica
        // (routes/web.php), no desde un archivo de rutas por módulo.
        $user = $this->usuario('Gente');
        $user->update(['modulos_personalizados' => true]);
        UserSubmoduleAccess::create(['user_id' => $user->id, 'module_slug' => 'gente', 'submodule_key' => 'colaboradores']);

        $this->actingAs($user)->get('/modules/gente/plan-padrinos')->assertForbidden();

        UserSubmoduleAccess::create(['user_id' => $user->id, 'module_slug' => 'gente', 'submodule_key' => 'plan-padrinos']);
        $this->actingAs($user)->get('/modules/gente/plan-padrinos')->assertOk();
    }

    public function test_el_panel_de_administrador_guarda_la_personalizacion_al_crear_un_usuario(): void
    {
        $admin = $this->usuario('Administrador');

        $this->actingAs($admin)->post(route('admin.users.store'), [
            'first_name' => 'Ana',
            'last_name' => 'Ruiz',
            'identification_number' => '900111222',
            'email' => '',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'roles' => ['Reparto'],
            'is_active' => true,
            'modulos_personalizados' => true,
            'submodulos' => ['reparto' => ['eventos-tripulacion', 'revision-aleatoria']],
        ])->assertRedirect(route('admin.users.index'));

        $creado = User::where('identification_number', '900111222')->firstOrFail();
        $this->assertTrue($creado->modulos_personalizados);
        $this->assertEqualsCanonicalizing(
            ['eventos-tripulacion', 'revision-aleatoria'],
            $creado->submoduleAccess()->where('module_slug', 'reparto')->pluck('submodule_key')->all(),
        );
    }

    public function test_el_panel_rechaza_un_submodulo_que_no_existe_en_el_catalogo(): void
    {
        $admin = $this->usuario('Administrador');

        $this->actingAs($admin)->post(route('admin.users.store'), [
            'first_name' => 'Ana',
            'last_name' => 'Ruiz',
            'identification_number' => '900111333',
            'email' => '',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'roles' => ['Reparto'],
            'is_active' => true,
            'modulos_personalizados' => true,
            'submodulos' => ['reparto' => ['no-existe']],
        ])->assertSessionHasErrors('submodulos');

        $this->assertSame(0, User::where('identification_number', '900111333')->count());
    }

    public function test_apagar_la_personalizacion_limpia_los_submodulos_otorgados(): void
    {
        $admin = $this->usuario('Administrador');
        $user = $this->usuario('Reparto');
        $user->update(['modulos_personalizados' => true]);
        UserSubmoduleAccess::create(['user_id' => $user->id, 'module_slug' => 'reparto', 'submodule_key' => 'eventos-tripulacion']);

        $this->actingAs($admin)->put(route('admin.users.update', $user), [
            'first_name' => 'Ana',
            'last_name' => 'Ruiz',
            'identification_number' => $user->identification_number,
            'email' => '',
            'roles' => ['Reparto'],
            'is_active' => true,
            'modulos_personalizados' => false,
            'submodulos' => [],
        ])->assertRedirect(route('admin.users.index'));

        $user->refresh();
        $this->assertFalse($user->modulos_personalizados);
        $this->assertSame(0, $user->submoduleAccess()->count());
    }

    public function test_el_catalogo_de_submodulos_coincide_con_las_cantidades_esperadas(): void
    {
        $registro = ModuleAccessRegistry::all();

        $this->assertCount(24, $registro['seguridad']);
        $this->assertCount(14, $registro['reparto']);
        $this->assertCount(9, $registro['gente']);
        $this->assertCount(7, $registro['flota']);
    }
}
