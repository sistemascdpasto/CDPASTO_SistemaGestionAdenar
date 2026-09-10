<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('actas_taller', function (Blueprint $table) {
            $table->string('contacto_taller')->nullable()->after('telefono_entrega');
        });
    }

    public function down(): void
    {
        Schema::table('actas_taller', function (Blueprint $table) {
            $table->dropColumn('contacto_taller');
        });
    }
};
