<?php

namespace App\Console\Commands;

use App\Models\Seguridad\PruebaEvidencia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Sobreimprime la marca de agua (VER#, fecha/hora, ubicación) en las
 * fotografías de evidencia de pruebas de alcoholemia que aún no han sido
 * procesadas.
 *
 * Uso:
 *   php artisan fotos              — procesa todas las pendientes
 *   php artisan fotos --dry-run    — solo informa cuántas serían procesadas
 *   php artisan fotos --id=42      — procesa solo la evidencia con ese id
 */
class MarcarFotosEvidencia extends Command
{
    protected $signature = 'fotos
                            {--dry-run : Solo muestra cuántas fotografías serían procesadas, sin modificar nada}
                            {--id=    : Procesa únicamente la evidencia con este ID}';

    protected $description = 'Sobreimprime fecha, hora, ubicación y número de verificación en fotografías de evidencia existentes';

    /** Columna que marca si ya fue procesada (se agrega via migración si no existe) */
    private const MARCA_COLUMN = 'marca_agua_ok';

    /** Fuente TTF embebida en GD (5 = fuente bitmap 9px, suficiente sin TTF externo) */
    private const FONT_SIZE = 5;

    public function handle(): int
    {
        $dryRun   = $this->option('dry-run');
        $soloId   = $this->option('id') ? (int) $this->option('id') : null;
        $ubicacion = config('app.ubicacion_pruebas', 'Pasto, Nariño · Colombia');

        // ── Verificar que la columna marca_agua_ok exista ─────────────────
        if (! $this->columnaExiste()) {
            $this->error('La columna "marca_agua_ok" no existe en prueba_evidencias.');
            $this->line('Ejecuta primero: php artisan migrate');
            return self::FAILURE;
        }

        // ── Construir query ───────────────────────────────────────────────
        $query = PruebaEvidencia::query()
            ->with('pruebaAlcoholemia:id,fecha_hora')
            ->whereNotNull('path')
            ->where('path', 'not like', '%.pdf')
            ->where('path', 'not like', '%.PDF')
            ->where(self::MARCA_COLUMN, false);

        if ($soloId) {
            $query->where('id', $soloId);
        }

        $total = $query->count();

        if ($total === 0) {
            $this->info('No hay fotografías pendientes de procesar.');
            return self::SUCCESS;
        }

        $this->info("Fotografías pendientes: {$total}");

        if ($dryRun) {
            $this->line('Modo dry-run — no se modificará ningún archivo.');
            // Listar las primeras 20 para revisión
            $query->limit(20)->get()->each(function ($e) {
                $fecha = $e->pruebaAlcoholemia?->fecha_hora
                    ? $e->pruebaAlcoholemia->fecha_hora->format('d/m/Y H:i:s')
                    : 'SIN FECHA';
                $existe = Storage::disk('public')->exists($e->path) ? '✓' : '✗ FALTA ARCHIVO';
                $this->line("  ID {$e->id} | {$e->path} | {$fecha} | {$existe}");
            });
            return self::SUCCESS;
        }

        // ── Procesar ─────────────────────────────────────────────────────
        $ok       = 0;
        $errores  = 0;
        $omitidos = 0;

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunk(50, function ($evidencias) use (
            &$ok, &$errores, &$omitidos, $ubicacion, $bar
        ) {
            foreach ($evidencias as $evidencia) {
                $bar->advance();

                // Sin prueba vinculada con fecha — omitir
                if (! $evidencia->pruebaAlcoholemia || ! $evidencia->pruebaAlcoholemia->fecha_hora) {
                    $this->newLine();
                    $this->warn("  ID {$evidencia->id}: sin prueba o fecha asociada — omitida.");
                    $omitidos++;
                    continue;
                }

                $path      = $evidencia->path;
                $fullPath  = Storage::disk('public')->path($path);

                // Archivo físico no existe
                if (! file_exists($fullPath)) {
                    $this->newLine();
                    $this->warn("  ID {$evidencia->id}: archivo no encontrado en {$path} — omitida.");
                    $omitidos++;
                    continue;
                }

                try {
                    $fechaHora = $evidencia->pruebaAlcoholemia->fecha_hora;
                    $numero    = $evidencia->id; // número de verificación global único

                    $this->sobreimprimirMarca($fullPath, $fechaHora, $numero, $ubicacion);

                    // Marcar como procesada
                    $evidencia->update([self::MARCA_COLUMN => true]);
                    $ok++;
                } catch (Throwable $e) {
                    $this->newLine();
                    $this->error("  ID {$evidencia->id}: ERROR — {$e->getMessage()}");
                    $errores++;
                }
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->info("Procesadas correctamente : {$ok}");
        if ($omitidos > 0) {
            $this->warn("Omitidas (sin datos/archivo): {$omitidos}");
        }
        if ($errores > 0) {
            $this->error("Con error               : {$errores}");
        }

        return $errores > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Sobreimprime el overlay de marca de agua sobre la imagen, en la esquina
     * inferior derecha, usando exactamente el mismo estilo visual que el
     * componente FotoConOverlay del frontend.
     *
     * Modifica el archivo en disco directamente (el path ya es el definitivo).
     */
    private function sobreimprimirMarca(
        string $fullPath,
        \Illuminate\Support\Carbon $fechaHora,
        int    $numero,
        string $ubicacion
    ): void {
        // Detectar tipo de imagen
        $info = @getimagesize($fullPath);
        if (! $info) {
            throw new \RuntimeException('No se puede leer la imagen (getimagesize falló).');
        }

        $img = match ($info[2]) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($fullPath),
            IMAGETYPE_PNG  => imagecreatefrompng($fullPath),
            IMAGETYPE_WEBP => imagecreatefromwebp($fullPath),
            default        => throw new \RuntimeException("Tipo de imagen no soportado: {$info[2]}"),
        };

        if (! $img) {
            throw new \RuntimeException('GD no pudo cargar la imagen.');
        }

        $w = imagesx($img);
        $h = imagesy($img);

        // Líneas de texto (mismo contenido que el frontend)
        $lineas = [
            'VERIFICACIÓN #' . str_pad((string) $numero, 4, '0', STR_PAD_LEFT),
            $fechaHora->format('d/m/Y') . '  ' . $fechaHora->format('H:i:s'),
            $ubicacion,
        ];

        $font    = 5;  // fuente bitmap GD más grande disponible sin TTF
        $charW   = imagefontwidth($font);
        $charH   = imagefontheight($font);
        $padding = 8;
        $lineGap = 4;

        // Ancho máximo de texto
        $maxTextW = 0;
        foreach ($lineas as $linea) {
            $maxTextW = max($maxTextW, strlen($linea) * $charW);
        }

        $blockH = count($lineas) * $charH + (count($lineas) - 1) * $lineGap;
        $blockW = $maxTextW;

        // Posición esquina inferior derecha con margen
        $margin = 12;
        $x0 = $w - $blockW - $padding * 2 - $margin;
        $y0 = $h - $blockH - $padding * 2 - $margin;

        // Colores
        $white      = imagecolorallocatealpha($img, 255, 255, 255, 0);
        $shadow     = imagecolorallocatealpha($img, 0, 0, 0, 20); // sombra semitransparente

        // Sombra de texto (text-shadow simulado: desplazado 1px)
        foreach ($lineas as $i => $linea) {
            $ty = $y0 + $padding + $i * ($charH + $lineGap);
            $tx = $x0 + $padding;
            // 4 sombras para simular contorno negro
            foreach ([[-1,-1],[1,-1],[-1,1],[1,1],[0,1],[1,0],[-1,0],[0,-1]] as [$dx,$dy]) {
                imagestring($img, $font, $tx + $dx, $ty + $dy, $linea, $shadow);
            }
        }

        // Texto blanco principal
        foreach ($lineas as $i => $linea) {
            $ty = $y0 + $padding + $i * ($charH + $lineGap);
            $tx = $x0 + $padding;
            imagestring($img, $font, $tx, $ty, $linea, $white);
        }

        // Guardar primero en archivo temporal, verificar, luego reemplazar
        $tmpPath = $fullPath . '.tmp_marca';

        $saved = match ($info[2]) {
            IMAGETYPE_JPEG => imagejpeg($img, $tmpPath, 92),
            IMAGETYPE_PNG  => imagepng($img, $tmpPath, 6),
            IMAGETYPE_WEBP => imagewebp($img, $tmpPath, 90),
            default        => false,
        };

        imagedestroy($img);

        if (! $saved) {
            @unlink($tmpPath);
            throw new \RuntimeException('GD no pudo guardar la imagen temporal.');
        }

        // Verificar que el archivo temporal sea una imagen válida antes de reemplazar
        $check = @getimagesize($tmpPath);
        if (! $check) {
            @unlink($tmpPath);
            throw new \RuntimeException('El archivo temporal generado no es una imagen válida. Original conservado.');
        }

        // Reemplazar el original solo si la verificación pasó
        if (! rename($tmpPath, $fullPath)) {
            @unlink($tmpPath);
            throw new \RuntimeException('No se pudo reemplazar el archivo original. Original conservado.');
        }
    }

    private function columnaExiste(): bool
    {
        return \Illuminate\Support\Facades\Schema::hasColumn('prueba_evidencias', self::MARCA_COLUMN);
    }
}
