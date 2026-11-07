<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('contrato_prorrogas')
            ->whereNull('contrato_id')
            ->orderBy('id')
            ->chunkById(100, function ($prorrogas): void {
                foreach ($prorrogas as $prorroga) {
                    $contratos = DB::table('colaborador_contratos')
                        ->where('colaborador_id', $prorroga->colaborador_id);

                    $contratoId = null;
                    if ($prorroga->fecha_anterior) {
                        $contratoId = (clone $contratos)
                            ->whereNotNull('fecha_inicio')
                            ->whereDate('fecha_inicio', '<=', $prorroga->fecha_anterior)
                            ->orderByDesc('fecha_inicio')
                            ->orderByDesc('id')
                            ->value('id');
                    }

                    if (! $contratoId && $prorroga->fecha_anterior) {
                        $contratoId = (clone $contratos)
                            ->whereDate('fecha_fin', $prorroga->fecha_anterior)
                            ->orderByDesc('id')
                            ->value('id');
                    }

                    if (! $contratoId) {
                        $contratoIds = (clone $contratos)->orderBy('id')->pluck('id');
                        $contratoId = $contratoIds->count() === 1 ? $contratoIds->first() : null;
                    }

                    if ($contratoId) {
                        DB::table('contrato_prorrogas')
                            ->where('id', $prorroga->id)
                            ->update(['contrato_id' => $contratoId]);
                    }
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('contrato_prorrogas')->update(['contrato_id' => null]);
    }
};
