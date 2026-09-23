<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carretas', function (Blueprint $table) {
            $table->renameColumn('placa', 'identificacion');
        });
    }

    public function down(): void
    {
        Schema::table('carretas', function (Blueprint $table) {
            $table->renameColumn('identificacion', 'placa');
        });
    }
};
