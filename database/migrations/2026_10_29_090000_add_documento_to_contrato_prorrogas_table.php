<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contrato_prorrogas', function (Blueprint $table) {
            $table->string('documento_path')->nullable()->after('observaciones');
            $table->string('documento_nombre')->nullable()->after('documento_path');
        });
    }

    public function down(): void
    {
        Schema::table('contrato_prorrogas', function (Blueprint $table) {
            $table->dropColumn(['documento_path', 'documento_nombre']);
        });
    }
};
