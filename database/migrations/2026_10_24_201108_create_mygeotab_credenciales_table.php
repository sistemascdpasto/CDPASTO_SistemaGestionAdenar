<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla singleton (siempre id=1): guarda las credenciales REALES de
     * MyGeotab, cifradas, para poder rotarlas desde el panel de admin sin
     * redeploy (la contraseña de MyGeotab cambia periódicamente). Si no hay
     * fila, App\Support\MygeotabCredentials cae al valor semilla del .env.
     */
    public function up(): void
    {
        Schema::create('mygeotab_credenciales', function (Blueprint $table) {
            $table->id();
            $table->text('username')->nullable();
            $table->text('password')->nullable();
            $table->text('database')->nullable();
            $table->foreignId('actualizado_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mygeotab_credenciales');
    }
};
