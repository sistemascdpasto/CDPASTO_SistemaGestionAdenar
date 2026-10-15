<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('extintor_inspecciones', function (Blueprint $table) {
            $table->string('firma_path')->nullable()->after('observaciones_recarga');
        });
    }

    public function down(): void
    {
        Schema::table('extintor_inspecciones', function (Blueprint $table) {
            $table->dropColumn('firma_path');
        });
    }
};
