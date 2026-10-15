<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('extintor_inspecciones', function (Blueprint $table) {
            $table->string('condicion', 20)->nullable()->after('responsable_periodico');
            $table->string('tipo_agente', 80)->nullable()->after('condicion');
            $table->string('agente_impulsor', 20)->nullable()->after('tipo_agente');
            $table->decimal('capacidad_kg', 6, 2)->nullable()->after('agente_impulsor');
            $table->string('marca', 80)->nullable()->after('capacidad_kg');
            $table->string('parte_mantenimiento', 255)->nullable()->after('marca');
            $table->string('senalizacion', 255)->nullable()->after('parte_mantenimiento');
            $table->string('demarcacion', 20)->nullable()->after('senalizacion');
            $table->string('funcionamiento', 255)->nullable()->after('demarcacion');
            $table->string('acceso', 255)->nullable()->after('funcionamiento');
        });
    }

    public function down(): void
    {
        Schema::table('extintor_inspecciones', function (Blueprint $table) {
            $table->dropColumn([
                'condicion', 'tipo_agente', 'agente_impulsor', 'capacidad_kg',
                'marca', 'parte_mantenimiento', 'senalizacion', 'demarcacion',
                'funcionamiento', 'acceso',
            ]);
        });
    }
};
