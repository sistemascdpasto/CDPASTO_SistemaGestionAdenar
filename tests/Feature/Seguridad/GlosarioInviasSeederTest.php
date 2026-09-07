<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\GlossaryTerm;
use Database\Seeders\GlosarioInviasSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlosarioInviasSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_carga_el_glosario_completo_de_invias_desde_el_json_versionado(): void
    {
        $enArchivo = count(json_decode((string) file_get_contents(database_path('data/glosario_invias.json')), true));

        $this->seed(GlosarioInviasSeeder::class);

        $this->assertGreaterThan(100, $enArchivo, 'El JSON del glosario luce incompleto.');
        $this->assertSame($enArchivo, GlossaryTerm::where('categoria', GlosarioInviasSeeder::CATEGORIA)->count());
        $this->assertDatabaseHas('glossary_terms', ['nombre' => 'Autopista', 'source' => 'scraped']);
    }

    public function test_no_pisa_los_terminos_editados_a_mano(): void
    {
        GlossaryTerm::create([
            'nombre' => 'Autopista',
            'categoria' => GlosarioInviasSeeder::CATEGORIA,
            'definicion' => 'Definición corregida por el equipo de Seguridad.',
            'source' => 'manual',
        ]);

        $this->seed(GlosarioInviasSeeder::class);

        $this->assertSame(
            'Definición corregida por el equipo de Seguridad.',
            GlossaryTerm::where('nombre', 'Autopista')->value('definicion')
        );
    }

    public function test_es_idempotente(): void
    {
        $this->seed(GlosarioInviasSeeder::class);
        $primera = GlossaryTerm::count();

        $this->seed(GlosarioInviasSeeder::class);

        $this->assertSame($primera, GlossaryTerm::count());
    }
}
