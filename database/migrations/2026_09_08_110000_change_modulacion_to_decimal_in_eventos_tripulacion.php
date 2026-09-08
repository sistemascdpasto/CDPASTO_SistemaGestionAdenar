<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            // Modulación viene como porcentaje ("100.00%", 1.0) — guardar como decimal igual que adherencia_tiempo
            $table->decimal('modulacion', 6, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            $table->string('modulacion', 100)->nullable()->change();
        });
    }
};
