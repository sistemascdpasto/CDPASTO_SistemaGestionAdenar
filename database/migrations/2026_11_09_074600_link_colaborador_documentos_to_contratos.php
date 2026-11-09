<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colaborador_documentos', function (Blueprint $table) {
            $table->foreignId('contrato_id')
                ->nullable()
                ->after('colaborador_id')
                ->constrained('colaborador_contratos')
                ->cascadeOnDelete();
        });

        DB::table('colaborador_documentos')
            ->where('campo', 'documento_contrato')
            ->whereNull('contrato_id')
            ->orderBy('colaborador_id')
            ->orderBy('id')
            ->get()
            ->groupBy('colaborador_id')
            ->each(function ($documentos, $colaboradorId): void {
                $contratos = DB::table('colaborador_contratos')
                    ->where('colaborador_id', $colaboradorId)
                    ->orderByRaw('CASE WHEN fecha_inicio IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('fecha_inicio')
                    ->orderBy('id')
                    ->pluck('id');

                foreach ($documentos->values() as $index => $documento) {
                    if (! isset($contratos[$index])) {
                        break;
                    }

                    DB::table('colaborador_documentos')
                        ->where('id', $documento->id)
                        ->update(['contrato_id' => $contratos[$index]]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('colaborador_documentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('contrato_id');
        });
    }
};
