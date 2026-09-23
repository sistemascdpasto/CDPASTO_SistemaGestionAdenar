<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('revision_novedades', function (Blueprint $table) {
            $table->string('cantidad_revisada_unidad')->nullable()->after('cantidad_revisada');
        });
    }

    public function down(): void
    {
        Schema::table('revision_novedades', function (Blueprint $table) {
            $table->dropColumn('cantidad_revisada_unidad');
        });
    }
};
