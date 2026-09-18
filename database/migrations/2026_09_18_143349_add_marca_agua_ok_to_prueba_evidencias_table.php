<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prueba_evidencias', function (Blueprint $table) {
            // false = aún no procesada por php artisan fotos
            // true  = ya tiene la marca de agua sobreimpresa
            $table->boolean('marca_agua_ok')->default(false)->after('path');
        });
    }

    public function down(): void
    {
        Schema::table('prueba_evidencias', function (Blueprint $table) {
            $table->dropColumn('marca_agua_ok');
        });
    }
};
