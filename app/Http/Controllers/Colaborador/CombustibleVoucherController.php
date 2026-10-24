<?php

namespace App\Http\Controllers\Colaborador;

use App\Http\Controllers\Controller;
use App\Models\Flota\CombustibleVoucher;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use App\Services\Flota\GeminiVoucherExtractorService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Portal del Colaborador: sube la foto del voucher de tanqueo y Gemini
 * extrae los datos en el mismo request (ver GeminiVoucherExtractorService
 * — no hay queue worker corriendo en Railway, así que esto es síncrono,
 * igual que la sincronización de MyGeotab). Un usuario de Flota revisa y
 * corrige antes de que el voucher cuente en la analítica de rendimiento
 * (ver Flota\CombustibleVoucherController).
 */
class CombustibleVoucherController extends Controller
{
    public function index(Request $request): Response
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        return Inertia::render('colaborador/mis-tanqueadas/index', [
            'vouchers' => $colaborador->combustibleVouchers()
                ->latest('created_at')
                ->limit(30)
                ->get()
                ->map(fn (CombustibleVoucher $v) => [
                    'id' => $v->id,
                    'placa' => $v->placa,
                    'foto_url' => Storage::disk('public')->url($v->foto_path),
                    'estado' => $v->estado,
                    'galones' => $v->galones,
                    'total_pagado' => $v->total_pagado,
                    'fecha_voucher' => $v->fecha_voucher?->toDateString(),
                    'created_at' => $v->created_at->toDateTimeString(),
                ]),
            'placas' => Vehiculo::query()->where('is_active', true)->orderBy('placa')->pluck('placa'),
        ]);
    }

    public function store(Request $request, GeminiVoucherExtractorService $extractor): RedirectResponse
    {
        $colaborador = $this->colaboradorDeOFallar($request);

        $validado = $request->validate([
            'placa' => ['required', 'string', 'max:50'],
            'foto' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,heic', 'max:10240'],
        ]);

        $path = $request->file('foto')->store("flota/combustible/vouchers/{$colaborador->id}", 'public');

        $voucher = CombustibleVoucher::create([
            'colaborador_id' => $colaborador->id,
            'placa' => strtoupper(trim($validado['placa'])),
            'foto_path' => $path,
            'estado' => 'pendiente',
        ]);

        try {
            $datos = $extractor->extraer($path);

            $voucher->update([
                'estado' => 'procesado',
                'galones' => $datos['galones'],
                'total_pagado' => $datos['total_pagado'],
                'precio_galon' => $datos['precio_galon'],
                'fecha_voucher' => $datos['fecha'],
                'gemini_raw' => $datos['raw'],
            ]);

            return back()->with('status', [
                'type' => 'success',
                'message' => 'Voucher subido. Un supervisor de Flota revisará los datos leídos.',
            ]);
        } catch (\Throwable $e) {
            Log::error('Voucher de combustible: fallo la extracción con Gemini.', [
                'voucher_id' => $voucher->id,
                'error' => $e->getMessage(),
            ]);

            $voucher->update(['estado' => 'error', 'gemini_error' => $e->getMessage()]);

            return back()->with('status', [
                'type' => 'success',
                'message' => 'Voucher subido, pero no pudimos leer la foto automáticamente. Un supervisor de Flota la revisará a mano.',
            ]);
        }
    }

    private function colaboradorDeOFallar(Request $request): Colaborador
    {
        return $request->user()->colaborador ?? abort(
            403,
            'Tu cuenta todavía no está vinculada a un registro de colaborador. Contacta a un administrador.'
        );
    }
}
