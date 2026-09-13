<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAndSeoTest extends TestCase
{
    use RefreshDatabase;

    public function test_security_headers_are_present_on_every_response(): void
    {
        $response = $this->get(route('home'));

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');
    }

    public function test_home_page_is_not_marked_noindex(): void
    {
        $response = $this->get(route('home'));

        $response->assertHeaderMissing('X-Robots-Tag');
    }

    public function test_internal_pages_are_marked_noindex(): void
    {
        $response = $this->get(route('login'));

        $response->assertHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    public function test_robots_txt_blocks_everything_except_home(): void
    {
        // robots.txt es un archivo estático servido por el servidor web, no
        // por el router de Laravel: el kernel de test no lo sirve como una
        // request real, así que se verifica su contenido directamente.
        $contenido = file_get_contents(public_path('robots.txt'));

        $this->assertStringContainsString('Disallow: /', $contenido);
        $this->assertStringContainsString('Allow: /$', $contenido);
    }

    /**
     * Regresión del incidente del 2026-09-14: ForceHttps registrado con
     * prepend() GLOBAL corría antes que TrustProxies, así que nunca veía el
     * X-Forwarded-Proto que manda Railway (TLS terminado en su borde) y
     * redirigía a https en bucle infinito. Este test simula exactamente esa
     * cabecera para detectar si el orden vuelve a romperse.
     */
    public function test_no_redirige_en_bucle_cuando_el_proxy_ya_termino_https(): void
    {
        $this->app['env'] = 'production';

        $response = $this->withHeaders(['X-Forwarded-Proto' => 'https'])
            ->get(route('home'), ['REMOTE_ADDR' => '10.0.0.5']);

        $response->assertOk();
    }

    public function test_redirige_una_sola_vez_a_https_sin_el_proxy_header(): void
    {
        $this->app['env'] = 'production';

        $response = $this->get(route('home'));

        $response->assertRedirect();
        $this->assertStringStartsWith('https://', $response->headers->get('Location'));
    }
}
