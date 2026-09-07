<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->date('fecha_vencimiento_soat')->nullable()->after('imagen');
            $table->date('fecha_vencimiento_tecnomecanica')->nullable()->after('fecha_vencimiento_soat');

            // Fecha de vencimiento para la que ya se envió el aviso por correo.
            // Si el documento se renueva (cambia la fecha de vencimiento), el
            // valor deja de coincidir y el aviso vuelve a enviarse.
            $table->date('soat_alerta_enviada_para')->nullable()->after('fecha_vencimiento_tecnomecanica');
            $table->date('tecnomecanica_alerta_enviada_para')->nullable()->after('soat_alerta_enviada_para');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn([
                'fecha_vencimiento_soat',
                'fecha_vencimiento_tecnomecanica',
                'soat_alerta_enviada_para',
                'tecnomecanica_alerta_enviada_para',
            ]);
        });
    }
};
