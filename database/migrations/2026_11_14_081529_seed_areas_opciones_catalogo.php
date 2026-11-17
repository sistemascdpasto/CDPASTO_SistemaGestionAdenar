<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $areas = ['Administrativa', 'Operativa'];

        foreach ($areas as $nombre) {
            DB::table('opciones_catalogo')->insertOrIgnore([
                'categoria'       => 'area',
                'nombre'          => $nombre,
                'es_personalizado' => false,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('opciones_catalogo')
            ->where('categoria', 'area')
            ->where('es_personalizado', false)
            ->delete();
    }
};
