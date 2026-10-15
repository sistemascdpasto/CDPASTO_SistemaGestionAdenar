<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Imágenes para los PDF generados con dompdf.
 *
 * Incrustar la foto original (2-5 MB de una cámara de celular) por cada fila de un reporte
 * llevaba el HTML a cientos de MB y agotaba la memoria («Allowed memory size … exhausted» en el
 * reporte de pruebas de alcoholemia). En el PDF se ven de unos pocos milímetros, así que aquí
 * se incrusta una miniatura JPEG pequeña, generada una sola vez y guardada en caché.
 */
class ImagenPdf
{
    private const CARPETA_CACHE = 'miniaturas-pdf';

    /**
     * Data URI de una miniatura (ancho máximo en píxeles) de una imagen del disco público.
     */
    public static function miniatura(?string $ruta, int $anchoMaximo = 160): ?string
    {
        $publico = Storage::disk('public');

        if (! $ruta || ! $publico->exists($ruta)) {
            return null;
        }

        $cache = Storage::disk('local');
        $archivoCache = self::CARPETA_CACHE.'/'.md5($ruta.'|'.$publico->lastModified($ruta).'|'.$anchoMaximo).'.jpg';

        if (! $cache->exists($archivoCache)) {
            $jpeg = self::reducir($publico->path($ruta), $anchoMaximo);

            if ($jpeg === null) {
                return null;
            }

            $cache->put($archivoCache, $jpeg);
        }

        return 'data:image/jpeg;base64,'.base64_encode($cache->get($archivoCache));
    }

    private static function reducir(string $rutaCompleta, int $anchoMaximo): ?string
    {
        try {
            $info = @getimagesize($rutaCompleta);

            if (! $info) {
                return null;
            }

            $origen = match ($info[2]) {
                IMAGETYPE_JPEG => @imagecreatefromjpeg($rutaCompleta),
                IMAGETYPE_PNG => @imagecreatefrompng($rutaCompleta),
                IMAGETYPE_WEBP => @imagecreatefromwebp($rutaCompleta),
                IMAGETYPE_GIF => @imagecreatefromgif($rutaCompleta),
                default => false,
            };

            if (! $origen) {
                return null;
            }

            [$ancho, $alto] = [imagesx($origen), imagesy($origen)];
            $nuevoAncho = min($anchoMaximo, $ancho);
            $nuevoAlto = max(1, (int) round($alto * $nuevoAncho / $ancho));

            // Fondo blanco: las firmas son PNG transparentes y en JPEG quedarían negras.
            $destino = imagecreatetruecolor($nuevoAncho, $nuevoAlto);
            imagefill($destino, 0, 0, imagecolorallocate($destino, 255, 255, 255));
            imagecopyresampled($destino, $origen, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);
            imagedestroy($origen);

            ob_start();
            imagejpeg($destino, null, 75);
            imagedestroy($destino);

            return ob_get_clean() ?: null;
        } catch (Throwable) {
            return null;
        }
    }
}
