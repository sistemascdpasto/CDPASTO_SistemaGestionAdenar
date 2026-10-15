<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Models\Flota\Extintor;
use App\Models\Flota\ExtintorInspeccion;
use App\Services\Seguridad\QrCodeGenerator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Controlador público — sin autenticación.
 * Al escanear el QR del extintor se llega aquí y se muestran todos los datos.
 */
class ExtintorPublicoController extends Controller
{
    public function show(string $token, QrCodeGenerator $qr): Response
    {
        $extintor = Extintor::with([
            'asignaciones',
            'inspecciones.evidencias',
        ])->where('numero_serie', $token)
          ->orWhere('qr_token', $token)
          ->firstOrFail();

        $activa = $extintor->asignacionActiva;
        $maxRecarga = $extintor->inspecciones()->where('incluye_recarga', true)->max('fecha_recarga');

        return Inertia::render('flota/extintores/publico', [
            'extintor' => [
                'id'                  => $extintor->id,
                'numero_serie'        => $extintor->numero_serie,
                'tipo_agente'         => $extintor->tipo_agente,
                'capacidad_kg'        => $extintor->capacidad_kg,
                'marca'               => $extintor->marca,
                'fecha_fabricacion'   => $extintor->fecha_fabricacion?->format('d/m/Y'),
                'fecha_vencimiento'   => $extintor->fecha_vencimiento?->format('d/m/Y'),
                'vencido'             => $extintor->vencido,
                'observaciones'       => $extintor->observaciones,
                'condicion'           => $extintor->condicion,
                'agente_impulsor'     => $extintor->agente_impulsor,
                'parte_mantenimiento' => $extintor->parte_mantenimiento,
                'senalizacion'        => $extintor->senalizacion,
                'demarcacion'         => $extintor->demarcacion,
                'funcionamiento'      => $extintor->funcionamiento,
                'acceso'              => $extintor->acceso,
                'ultima_recarga'      => $maxRecarga ? \Carbon\Carbon::parse($maxRecarga)->format('d/m/Y') : null,
                'placa_actual'        => $activa?->placa,
                'fecha_asignacion'    => $activa?->fecha_colocacion?->format('d/m/Y'),
                'foto_url'            => $extintor->foto_url,
            ],
            'tiene_inspeccion_inicio' => $extintor->inspecciones->contains('tipo', ExtintorInspeccion::TIPO_INICIO),
            'asignaciones' => $extintor->asignaciones->map(fn ($a) => [
                'placa'                   => $a->placa,
                'fecha_colocacion'        => $a->fecha_colocacion?->format('d/m/Y'),
                'fecha_retiro'            => $a->fecha_retiro?->format('d/m/Y'),
                'responsable_colocacion'  => $a->responsable_colocacion,
                'responsable_retiro'      => $a->responsable_retiro,
                'activo'                  => $a->activo,
            ])->values(),
            'inspecciones' => $extintor->inspecciones->map(fn ($i) => [
                'id'                       => $i->id,
                'tipo'                     => $i->tipo,
                'tipo_label'               => $i->tipo_label,
                'fecha_inspeccion'         => $i->fecha_inspeccion?->format('d/m/Y'),
                'responsable_inicio'       => $i->responsable_inicio,
                'responsable_periodico'    => $i->responsable_periodico,
                'condicion'                => $i->condicion,
                'tipo_agente'              => $i->tipo_agente,
                'agente_impulsor'          => $i->agente_impulsor,
                'parte_mantenimiento'      => $i->parte_mantenimiento,
                'senalizacion'             => $i->senalizacion,
                'demarcacion'              => $i->demarcacion,
                'funcionamiento'           => $i->funcionamiento,
                'acceso'                   => $i->acceso,
                'observaciones_inspeccion' => $i->observaciones_inspeccion,
                'incluye_recarga'          => (bool) $i->incluye_recarga,
                'fecha_recarga'            => $i->fecha_recarga?->format('d/m/Y'),
                'fecha_proxima_recarga'    => $i->fecha_proxima_recarga?->format('d/m/Y'),
                'observaciones_recarga'    => $i->observaciones_recarga,
                'evidencias_count'         => $i->evidencias->count(),
            ])->values(),
            // SVG del QR para mostrar en la propia página pública
            'qr_svg' => $qr->generateSvg(url("/ext/{$extintor->numero_serie}"), 180),
        ]);
    }
}
