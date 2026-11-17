<?php

namespace App\Mail\Gente;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

/**
 * Correo agrupado de vencimiento de contratos.
 *
 * Recibe una colección de arrays con:
 *   - nombre_completo : string
 *   - fecha_vencimiento: Carbon
 *
 * Se envía una sola vez por ejecución del scheduler, con todos los
 * colaboradores en la ventana de anticipación, en lugar de un correo
 * por cada uno (comportamiento anterior).
 */
class ContratosPorVencerMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  Collection<int, array{nombre_completo: string, fecha_vencimiento: \Illuminate\Support\Carbon}>  $contratos
     */
    public function __construct(public readonly Collection $contratos) {}

    public function envelope(): Envelope
    {
        $cantidad = $this->contratos->count();
        $sufijo   = $cantidad === 1 ? '1 contrato próximo a vencer' : "{$cantidad} contratos próximos a vencer";

        return new Envelope(
            subject: "ADENAR Contratos: {$sufijo}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.gente.contratos-por-vencer',
        );
    }
}
