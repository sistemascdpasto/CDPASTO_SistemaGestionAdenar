<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\GlossaryTerm;
use App\Models\Seguridad\WebScrapingSource;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GlossaryScrapeCommandTest extends TestCase
{
    use RefreshDatabase;

    private function paginaHtml(array $terminos): string
    {
        $bloques = collect($terminos)
            ->map(fn ($t, $i) => '<h2 id="a'.($i + 100).'">'.$t[0].'</h2><div class="termino"><p>'.$t[1].'</p></div>')
            ->implode('');

        return "<html><body>{$bloques}</body></html>";
    }

    public function test_recorre_todas_las_paginas_de_una_fuente(): void
    {
        WebScrapingSource::create([
            'nombre_fuente' => 'INVÍAS Glosario - c',
            'url' => 'https://www.invias.gov.co/glosario/c',
            'selector_css' => 'h2[id^="a"]',
            'categoria' => 'GLOSARIO TÉCNICO INVÍAS',
            'activo' => true,
        ]);

        Http::fake([
            'https://www.invias.gov.co/glosario/c' => Http::response($this->paginaHtml([
                ['Calzada', 'Zona de la vía destinada a la circulación de vehículos.'],
                ['Carril', 'Parte de la calzada destinada a una fila de vehículos.'],
            ])),
            'https://www.invias.gov.co/glosario/c/?genPag=2' => Http::response($this->paginaHtml([
                ['Cuneta', 'Zanja lateral de la vía para recoger aguas lluvias.'],
            ])),
            // INVÍAS repite la última página si te pasas del rango.
            'https://www.invias.gov.co/glosario/c/?genPag=3' => Http::response($this->paginaHtml([
                ['Cuneta', 'Zanja lateral de la vía para recoger aguas lluvias.'],
            ])),
        ]);

        $this->artisan('glossary:scrape')->assertSuccessful();

        $this->assertSame(3, GlossaryTerm::where('categoria', 'GLOSARIO TÉCNICO INVÍAS')->count());
        $this->assertDatabaseHas('glossary_terms', ['nombre' => 'Cuneta', 'source' => 'scraped']);
    }

    public function test_un_403_en_la_primera_pagina_no_tumba_el_comando(): void
    {
        WebScrapingSource::create([
            'nombre_fuente' => 'INVÍAS Glosario - a',
            'url' => 'https://www.invias.gov.co/glosario/a',
            'selector_css' => 'h2[id^="a"]',
            'categoria' => 'GLOSARIO TÉCNICO INVÍAS',
            'activo' => true,
        ]);

        Http::fake(['https://www.invias.gov.co/*' => Http::response('forbidden', 403)]);

        $this->artisan('glossary:scrape')->assertSuccessful();

        $this->assertSame(0, GlossaryTerm::count());
    }
}
