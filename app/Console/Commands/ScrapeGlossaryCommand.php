<?php

namespace App\Console\Commands;

use App\Models\Seguridad\GlossaryTerm;
use App\Models\Seguridad\WebScrapingSource;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\DomCrawler\Crawler;

class ScrapeGlossaryCommand extends Command
{
    protected $signature = 'glossary:scrape {--source= : ID o nombre de una fuente especifica}';

    protected $description = 'Descarga y sincroniza terminos del glosario desde las fuentes web configuradas';

    /**
     * Tope de páginas por fuente (?genPag=N). El glosario de INVÍAS más
     * extenso ronda las 2-3 páginas por letra; 20 deja margen de sobra.
     */
    private const MAX_PAGINAS = 20;

    public function handle(): int
    {
        $query = WebScrapingSource::active();

        if ($sourceOption = $this->option('source')) {
            $query->where(function ($q) use ($sourceOption) {
                $q->where('id', $sourceOption)->orWhere('nombre_fuente', $sourceOption);
            });
        }

        $sources = $query->get();

        if ($sources->isEmpty()) {
            $this->warn('No hay fuentes web activas configuradas.');

            return self::SUCCESS;
        }

        $inserted = 0;
        $updated = 0;
        $errors = 0;

        foreach ($sources as $source) {
            $this->info("Procesando fuente: {$source->nombre_fuente} ({$source->url})");

            try {
                // El glosario de INVÍAS pagina con ?genPag=N (10 términos por
                // página). Se recorren las páginas hasta que una no traiga
                // términos nuevos (INVÍAS devuelve la última página si el
                // número se pasa del rango).
                $vistos = [];

                for ($pagina = 1; $pagina <= self::MAX_PAGINAS; $pagina++) {
                    $url = $this->urlPaginada($source->url, $pagina);

                    $response = Http::timeout(30)
                        ->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; AdenarGlossaryBot/1.0)'])
                        ->get($url);

                    if (! $response->successful()) {
                        if ($pagina === 1) {
                            throw new \RuntimeException("HTTP {$response->status()}");
                        }
                        break;
                    }

                    $elements = (new Crawler($response->body(), $url))->filter($source->selector_css);

                    if ($elements->count() === 0) {
                        if ($pagina === 1) {
                            $this->warn("No se encontraron elementos con el selector CSS '{$source->selector_css}'.");
                        }
                        break;
                    }

                    $nuevosEnPagina = 0;

                    $elements->each(function (Crawler $node) use ($source, &$inserted, &$updated, &$errors, &$vistos, &$nuevosEnPagina) {
                        try {
                            $nombre = trim($node->text(''));
                            $clave = mb_strtolower($nombre);

                            if ($nombre === '' || isset($vistos[$clave])) {
                                return;
                            }
                            $vistos[$clave] = true;
                            $nuevosEnPagina++;

                            $definicion = $this->definicionSiguiente($node);

                            if ($definicion === null || $definicion === '') {
                                return;
                            }

                            $existing = GlossaryTerm::withTrashed()
                                ->where('nombre', $nombre)
                                ->where('categoria', $source->categoria)
                                ->first();

                            if ($existing) {
                                if ($existing->isManual()) {
                                    return;
                                }

                                if ($existing->definicion !== $definicion) {
                                    $existing->update(['definicion' => $definicion]);
                                    $updated++;
                                }
                            } else {
                                GlossaryTerm::create([
                                    'nombre' => $nombre,
                                    'definicion' => $definicion,
                                    'representacion' => null,
                                    'categoria' => $source->categoria,
                                    'source' => 'scraped',
                                ]);
                                $inserted++;
                            }
                        } catch (\Throwable $e) {
                            $errors++;
                            Log::error("Error procesando termino de {$source->nombre_fuente}: {$e->getMessage()}");
                        }
                    });

                    if ($nuevosEnPagina === 0) {
                        break;
                    }

                    usleep(300000);
                }

                $source->update(['ultimo_scrape' => now()]);

                usleep(500000); // Pausa de 0.5s entre fuentes para no saturar el sitio
            } catch (\Throwable $e) {
                $errors++;
                $this->error("Error descargando {$source->url}: {$e->getMessage()}");
                Log::error("Error en scraping de {$source->nombre_fuente}: {$e->getMessage()}");
            }
        }

        $this->info("Scraping completado: Insertados={$inserted}, Actualizados={$updated}, Errores={$errors}");
        Log::info("Glossary scraping completed: Inserted={$inserted}, Updated={$updated}, Errors={$errors}");

        return self::SUCCESS;
    }

    /**
     * Para la página 1 usa la URL de la fuente tal cual (compatibilidad). Para
     * las siguientes agrega ?genPag=N (paginación de INVÍAS).
     */
    private function urlPaginada(string $url, int $pagina): string
    {
        if ($pagina <= 1) {
            return $url;
        }

        return rtrim($url, '/').'/?genPag='.$pagina;
    }

    private function definicionSiguiente(Crawler $node): ?string
    {
        $sibling = $node->getNode(0)?->nextSibling;

        while ($sibling !== null) {
            if ($sibling->nodeType === XML_ELEMENT_NODE) {
                $texto = preg_replace('/[\x{00A0}\s]+/u', ' ', trim($sibling->textContent));

                return trim((string) $texto);
            }
            $sibling = $sibling->nextSibling;
        }

        return null;
    }
}
