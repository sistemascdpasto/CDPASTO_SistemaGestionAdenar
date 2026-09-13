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
}
