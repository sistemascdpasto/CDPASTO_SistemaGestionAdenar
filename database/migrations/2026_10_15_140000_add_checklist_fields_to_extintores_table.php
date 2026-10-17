<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('extintores', function (Blueprint $table) {
            // Condición general del extintor
            $table->string('condicion', 20)->nullable()->after('observaciones');           // buena | mala
            // Tipo de agente impulsor
            $table->string('agente_impulsor', 20)->nullable()->after('condicion');         // directa | indirecta
            // Parte del extintor que requiere mantenimiento (código de codificación)
            $table->string('parte_mantenimiento', 255)->nullable()->after('agente_impulsor');
            // Señalización
            $table->string('senalizacion', 255)->nullable()->after('parte_mantenimiento');
            // Demarcación
            $table->string('demarcacion', 10)->nullable()->after('senalizacion');          // buena | mala | N/A
            // Funcionamiento del extintor
            $table->string('funcionamiento', 255)->nullable()->after('demarcacion');
            // Acceso al extintor
            $table->string('acceso', 255)->nullable()->after('funcionamiento');
        });
    }

    public function down(): void
    {
        Schema::table('extintores', function (Blueprint $table) {
            $table->dropColumn([
                'condicion', 'agente_impulsor', 'parte_mantenimiento',
                'senalizacion', 'demarcacion', 'funcionamiento', 'acceso',
            ]);
        });
    }
};
