<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alertas_descartadas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alerta_id')->constrained('alertas')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('descartada_en')->useCurrent();

            // Un usuario solo puede descartar la misma alerta una vez.
            $table->unique(['alerta_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alertas_descartadas');
    }
};
