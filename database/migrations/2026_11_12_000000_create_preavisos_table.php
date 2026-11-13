<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('preavisos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->cascadeOnDelete();
            $table->foreignId('contrato_id')->constrained('colaborador_contratos')->cascadeOnDelete();
            $table->foreignId('prorroga_id')->nullable()->constrained('contrato_prorrogas')->cascadeOnDelete();
            $table->date('fecha');
            $table->date('fecha_desde')->nullable();
            $table->date('fecha_hasta')->nullable();
            $table->string('documento_path')->nullable();
            $table->string('documento_nombre')->nullable();
            $table->timestamps();

            $table->index(['colaborador_id', 'fecha']);
            $table->index('contrato_id');
            $table->index('prorroga_id');
        });

        // Backfill de contratos existentes
        $contratos = DB::table('colaborador_contratos')
            ->orderBy('id')
            ->get();

        foreach ($contratos as $contrato) {
            $primeraProrroga = DB::table('contrato_prorrogas')
                ->where('contrato_id', $contrato->id)
                ->where('tipo', 'prorroga')
                ->orderBy('fecha_anterior')
                ->orderBy('id')
                ->first();

            $fechaFinInicial = $primeraProrroga?->fecha_anterior ?? $contrato->fecha_fin;
            $fechaInicioInicial = $contrato->fecha_inicio;

            if ($fechaFinInicial) {
                $docPreaviso = DB::table('colaborador_documentos')
                    ->where('colaborador_id', $contrato->colaborador_id)
                    ->where('campo', 'documento_preaviso_terminacion')
                    ->whereDate('fecha_documento', $fechaFinInicial)
                    ->first();

                DB::table('preavisos')->insert([
                    'colaborador_id'   => $contrato->colaborador_id,
                    'contrato_id'      => $contrato->id,
                    'prorroga_id'      => null,
                    'fecha'            => $fechaFinInicial,
                    'fecha_desde'      => $fechaInicioInicial,
                    'fecha_hasta'      => $fechaFinInicial,
                    'documento_path'   => $docPreaviso?->path,
                    'documento_nombre' => $docPreaviso?->nombre_original ?? ($docPreaviso?->path ? basename($docPreaviso->path) : null),
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ]);

                if ($docPreaviso && ! $docPreaviso->contrato_id) {
                    DB::table('colaborador_documentos')
                        ->where('id', $docPreaviso->id)
                        ->update(['contrato_id' => $contrato->id]);
                }
            }
        }

        // Backfill de prórrogas existentes
        $prorrogas = DB::table('contrato_prorrogas')
            ->where('tipo', 'prorroga')
            ->whereNotNull('fecha_nueva')
            ->orderBy('id')
            ->get();

        foreach ($prorrogas as $prorroga) {
            $contratoId = $prorroga->contrato_id;
            if (! $contratoId) {
                $contratoId = DB::table('colaborador_contratos')
                    ->where('colaborador_id', $prorroga->colaborador_id)
                    ->orderByDesc('fecha_inicio')
                    ->orderByDesc('id')
                    ->value('id');
            }

            if (! $contratoId) {
                continue;
            }

            $fechaDesde = $prorroga->fecha_inicio ?? ($prorroga->fecha_anterior ? Carbon::parse($prorroga->fecha_anterior)->addDay()->toDateString() : null);

            $docPreaviso = DB::table('colaborador_documentos')
                ->where('colaborador_id', $prorroga->colaborador_id)
                ->where('campo', 'documento_preaviso_terminacion')
                ->whereDate('fecha_documento', $prorroga->fecha_nueva)
                ->first();

            DB::table('preavisos')->insert([
                'colaborador_id'   => $prorroga->colaborador_id,
                'contrato_id'      => $contratoId,
                'prorroga_id'      => $prorroga->id,
                'fecha'            => $prorroga->fecha_nueva,
                'fecha_desde'      => $fechaDesde,
                'fecha_hasta'      => $prorroga->fecha_nueva,
                'documento_path'   => $docPreaviso?->path,
                'documento_nombre' => $docPreaviso?->nombre_original ?? ($docPreaviso?->path ? basename($docPreaviso->path) : null),
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);

            if ($docPreaviso && ! $docPreaviso->contrato_id) {
                DB::table('colaborador_documentos')
                    ->where('id', $docPreaviso->id)
                    ->update(['contrato_id' => $contratoId]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('preavisos');
    }
};
