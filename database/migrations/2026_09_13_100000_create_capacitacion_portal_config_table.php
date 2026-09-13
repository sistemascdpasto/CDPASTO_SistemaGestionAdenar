<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reemplaza a 'capacitacion_banner' (creada 2026_09_10) con el mismo
 * concepto que ya usa EasyOL: título/subtítulo/imagen de fondo del hero
 * del portal de capacitaciones, editable desde un solo Dialog en vez de
 * la sección de banner incrustada en el índice de administrador.
 *
 * Si ya existe un banner configurado (frase/sub_frase/imagen), se migra su
 * contenido a la fila nueva en vez de resetear a los valores por defecto —
 * lo que el administrador ya haya personalizado no se pierde.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capacitacion_portal_config', function (Blueprint $table) {
            $table->id();
            $table->string('titulo_hero', 255)->default('Atraemos talento, desarrollamos potencial.');
            $table->string('subtitulo_hero', 500)->nullable();
            $table->string('imagen_hero_path', 1024)->nullable();
            $table->timestamps();
        });

        $bannerAnterior = Schema::hasTable('capacitacion_banner')
            ? DB::table('capacitacion_banner')->first()
            : null;

        DB::table('capacitacion_portal_config')->insert([
            'titulo_hero' => $bannerAnterior->frase ?? 'Atraemos talento, desarrollamos potencial.',
            'subtitulo_hero' => $bannerAnterior->sub_frase ?? 'Capacitaciones certificadas para el crecimiento profesional de tu equipo. Aprende a tu ritmo, avanza con propósito.',
            'imagen_hero_path' => $bannerAnterior->imagen_path ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::dropIfExists('capacitacion_banner');
    }

    public function down(): void
    {
        Schema::dropIfExists('capacitacion_portal_config');

        Schema::create('capacitacion_banner', function (Blueprint $table) {
            $table->id();
            $table->string('imagen_path')->nullable();
            $table->string('frase', 300)->nullable()->default('Tu aprendizaje impulsa tu seguridad y la de tus compañeros.');
            $table->string('sub_frase', 300)->nullable()->default('Explora los materiales disponibles y marca tu progreso.');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
        });
    }
};
