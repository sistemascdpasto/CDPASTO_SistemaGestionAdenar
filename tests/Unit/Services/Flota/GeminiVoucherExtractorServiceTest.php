<?php

namespace Tests\Unit\Services\Flota;

use App\Services\Flota\GeminiVoucherExtractorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GeminiVoucherExtractorServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gemini.api_key' => 'clave-de-prueba']);
    }

    /**
     * Una foto de cámara nativa sin comprimir (ej. 3000x2000) causó un 500
     * real en producción: tardaba más de los 30s de max_execution_time de
     * PHP en subirse/procesarse por Gemini, y ese timeout es un fatal NO
     * capturable por try/catch. El servicio debe redimensionarla antes de
     * mandarla, para que la petición sea rápida sin importar la foto
     * original que suba el colaborador.
     */
    public function test_redimensiona_una_imagen_grande_antes_de_mandarla_a_gemini(): void
    {
        Storage::fake('public');

        $origen = imagecreatetruecolor(3000, 2000);
        imagefill($origen, 0, 0, imagecolorallocate($origen, 255, 255, 255));
        ob_start();
        imagejpeg($origen, null, 90);
        $jpegGrande = ob_get_clean();
        imagedestroy($origen);

        $this->assertGreaterThan(1600, imagesx(imagecreatefromstring($jpegGrande)));

        Storage::disk('public')->put('flota/combustible/vouchers/1/voucher.jpg', $jpegGrande);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [[
                        'text' => json_encode(['confianza' => 'alta']),
                    ]]],
                ]],
            ]),
        ]);

        app(GeminiVoucherExtractorService::class)->extraer('flota/combustible/vouchers/1/voucher.jpg');

        Http::assertSent(function ($request) {
            $base64 = $request['contents'][0]['parts'][1]['inline_data']['data'];
            $imagen = imagecreatefromstring(base64_decode($base64));

            return max(imagesx($imagen), imagesy($imagen)) <= 1600;
        });
    }

    public function test_no_falla_si_la_imagen_no_se_puede_decodificar_con_gd(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('flota/combustible/vouchers/1/voucher.heic', 'no-es-una-imagen-valida');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [[
                        'text' => json_encode(['confianza' => 'baja']),
                    ]]],
                ]],
            ]),
        ]);

        $resultado = app(GeminiVoucherExtractorService::class)->extraer('flota/combustible/vouchers/1/voucher.heic');

        $this->assertSame('baja', $resultado['confianza']);
    }
}
