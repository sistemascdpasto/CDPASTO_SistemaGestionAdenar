<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El módulo "Asignaciones de conductores" se retiró del sistema.
     */
    public function up(): void
    {
        Schema::dropIfExists('asignacion_conductores');
    }

    public function down(): void
    {
        // Sin reversa: la definición original vive en
        // 2026_08_03_120000_create_asignacion_conductores_table.php.
    }
};
