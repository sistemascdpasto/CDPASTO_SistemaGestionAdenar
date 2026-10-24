<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Models\Flota\CombustibleVoucher;
use App\Services\Flota\GeminiVoucherExtractorService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Revisión de vouchers de tanqueo subidos por Colaboradores (ver
 * Colaborador\CombustibleVoucherController). Solo los vouchers 'revisado'
 * entran en el cálculo de rendimiento km/gl — no se confía un dato
 * financiero a un OCR sin que alguien de Flota lo confirme o corrija.
 */
class CombustibleVoucherController extends Controller
{
    public function index(Request $request): Response
    {
        $estado = $request->input('estado', 'pendientes');

        $vouchers = CombustibleVoucher::with('colaborador:id,nombres,apellidos', 'revisadoPor:id,name')
            ->when($estado === 'pendientes', fn ($q) => $q->whereIn('estado', ['pendiente', 'procesado', 'error']))
            ->when($estado !== 'pendientes' && $estado !== 'todos', fn ($q) => $q->where('estado', $estado))
            ->latest('created_at')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (CombustibleVoucher $v) => [
                'id' => $v->id,
                'placa' => $v->placa,
                'foto_url' => Storage::disk('public')->url($v->foto_path),
                'estado' => $v->estado,
                'galones' => $v->galones,
                'total_pagado' => $v->total_pagado,
                'precio_galon' => $v->precio_galon,
                'fecha_voucher' => $v->fecha_voucher?->toDateString(),
                'gemini_error' => $v->gemini_error,
                'colaborador' => $v->colaborador ? trim("{$v->colaborador->nombres} {$v->colaborador->apellidos}") : null,
                'revisado_por' => $v->revisadoPor?->name,
                'created_at' => $v->created_at->toDateTimeString(),
            ]);

        return Inertia::render('flota/combustible/vouchers/index', [
            'vouchers' => $vouchers,
            'filters' => compact('estado'),
        ]);
    }

    public function update(Request $request, CombustibleVoucher $voucher): RedirectResponse
    {
        $validado = $request->validate([
            'placa' => ['required', 'string', 'max:50'],
            'galones' => ['required', 'numeric', 'min:0'],
            'total_pagado' => ['required', 'numeric', 'min:0'],
            'precio_galon' => ['nullable', 'numeric', 'min:0'],
            'fecha_voucher' => ['required', 'date_format:Y-m-d'],
        ]);

        $voucher->update([
            ...$validado,
            'placa' => strtoupper(trim($validado['placa'])),
            'precio_galon' => $validado['precio_galon'] ?? round($validado['total_pagado'] / max($validado['galones'], 0.01), 2),
            'estado' => 'revisado',
            'revisado_por_id' => $request->user()->id,
            'revisado_at' => now(),
        ]);

        return back()->with('status', ['type' => 'success', 'message' => 'Voucher revisado y confirmado.']);
    }

    public function reprocesar(CombustibleVoucher $voucher, GeminiVoucherExtractorService $extractor): RedirectResponse
    {
        // Ver el mismo ajuste (y por qué) en Colaborador\CombustibleVoucherController::store().
        if ((int) ini_get('max_execution_time') < 60) {
            @set_time_limit(60);
        }

        try {
            $datos = $extractor->extraer($voucher->foto_path);

            $voucher->update([
                'estado' => 'procesado',
                'galones' => $datos['galones'],
                'total_pagado' => $datos['total_pagado'],
                'precio_galon' => $datos['precio_galon'],
                'fecha_voucher' => $datos['fecha'],
                'gemini_raw' => $datos['raw'],
                'gemini_error' => null,
            ]);

            return back()->with('status', ['type' => 'success', 'message' => 'Voucher reprocesado correctamente.']);
        } catch (\Throwable $e) {
            $voucher->update(['estado' => 'error', 'gemini_error' => $e->getMessage()]);

            return back()->with('status', ['type' => 'error', 'message' => 'No se pudo reprocesar: '.$e->getMessage()]);
        }
    }
}
