<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->text('novedad_no_disponible')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('novedad_no_disponible');
        });
    }
};
