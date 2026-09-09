<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\ResponsableRutaVerificacion;
use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ResponsableRutaController extends Controller
{
    /**
     * Vista principal del formulario.
     *
     * - Toma la fecha actual del servidor (no editable).
     * - Carga colaboradores activos con cargo "Responsable de Ruta".
     * - Devuelve el registro del proceso actual (si existe) para mostrar
     *   habilitar/deshabilitar Inicio/Finalización.
     */
    public function index(): Response
    {
        $fechaActual = Carbon::now();
        $fechaStr = $fechaActual->format('Y-m-d');

        $colaboradoresResponsables = Colaborador::query()
            ->where('is_active', true)
            ->whereNotNull('cargo')
            ->where('cargo', '!=', '')
            ->whereRaw('LOWER(TRIM(cargo)) LIKE ?', ['%responsable%ruta%'])
            ->orderByRaw('TRIM(CONCAT(apellidos, \' \', nombres)) ASC')
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'codigo_qr_skap'])
            ->get()
            ->map(function ($c) {
                return [
                    'id' => $c->id,
                    'cedula' => $c->cedula,
                    'nombre_completo' => trim(($c->apellidos ?? '') . ' ' . ($c->nombres ?? '')),
                    'cargo' => $c->cargo,
                    'codigo_qr_skap' => $c->codigo_qr_skap,
                ];
            })
            ->values()
            ->all();

        // Estado de procesos existentes (por cada responsable + fecha actual)
        $estadosPorColaborador = [];
        foreach ($colaboradoresResponsables as $c) {
            $registro = ResponsableRutaVerificacion::porColaboradorFecha($c['id'], $fechaStr)->first();
            if ($registro !== null) {
                $inicioCarbon = $registro->inicio?->format('H:i:s');
                $finCarbon = $registro->fin?->format('H:i:s');
                $estaFinalizado = (bool) $registro->esta_finalizado;
                $estadosPorColaborador[$c['id']] = [
                    'id'                 => $registro->id,
                    'inicio'             => $inicioCarbon,
                    'inicio_fecha'     => $registro->inicio?->toIso8601String(),
                    'fin'                => $finCarbon,
                    'fin_fecha'         => $registro->fin?->toIso8601String(),
                    'duracion_minutos'   => $registro->duracion_minutos,
                    'duracion_formateada' => $registro->duracion_formateada,
                    'esta_finalizado'    => $estaFinalizado,
                ];
            }
        }

        return Inertia::render('gente/responsable-ruta/index', [
            'fecha_actual'             => $fechaStr,
            'colaboradores'          => $colaboradoresResponsables,
            'estados_por_colaborador' => $estadosPorColaborador,
        ]);
    }

    /**
     * Guardar el INICIO de la verificación de carga del vehículo.
     *
     * Reglas:
     *  - Debe existir el colaborador y ser Responsable de Ruta activo.
     *  - NO debe existir un registro de inicio para ese colaborador + fecha.
     */
    public function storeInicio(Request $request): RedirectResponse
    {
        $validado = $request->validate([
            'colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
        ]);

        $colaborador = Colaborador::query()
            ->where('id', $validado['colaborador_id'])
            ->where('is_active', true)
            ->whereRaw('LOWER(TRIM(cargo)) LIKE ?', ['%responsable%ruta%'])
            ->first();

        if ($colaborador === null) {
            return back()->withErrors([
                'colaborador_id' => 'El colaborador seleccionado no es un Responsable de Ruta activo válido.',
            ])->withInput();
        }

        $hoy = Carbon::now()->format('Y-m-d');

        // 🔒 Bloqueo: ya existe un inicio/finalización para hoy
        $existe = ResponsableRutaVerificacion::porColaboradorFecha($colaborador->id, $hoy)->exists();
        if ($existe) {
            return back()->withErrors([
                'colaborador_id' => 'Este Responsable de Ruta ya registró el Inicio hoy. Solo se permite un registro por día.',
            ])->withInput();
        }

        $ahora = Carbon::now();

        ResponsableRutaVerificacion::create([
            'colaborador_id' => $colaborador->id,
            'fecha'          => $hoy,
            'inicio'         => $ahora,
            'fin'            => null,
            'duracion_minutos' => null,
            'created_by'     => $request->user()?->id,
            'closed_by'      => null,
        ]);

        return back()->with([
            'success' => '✅ Inicio de verificación de carga registrado exitosamente a las ' . $ahora->format('H:i:s') . '.',
        ]);
    }

    /**
     * Guardar la FINALIZACIÓN de la verificación de carga del vehículo.
     *
     * Reglas:
     *  - Debe existir un registro con INICIO y SIN FIN para el colaborador + fecha.
     *  - No se permite otra finalización una vez completado.
     */
    public function storeFin(Request $request): RedirectResponse
    {
        $validado = $request->validate([
            'colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
        ]);

        $hoy = Carbon::now()->format('Y-m-d');

        $registro = ResponsableRutaVerificacion::porColaboradorFecha($validado['colaborador_id'], $hoy)->first();

        if ($registro === null) {
            return back()->withErrors([
            'colaborador_id' => 'No se encontró ningún registro de Inicio para este Responsable de Ruta hoy. Debe iniciar primero el inicio antes de finalizar.',
            ])->withInput();
        }

        if ($registro->esta_finalizado) {
            return back()->withErrors([
                'colaborador_id' => '🚫 Este proceso ya se encuentra cerrado. No se permite registrar otra finalización.',
            ])->withInput();
        }

        $ahora = Carbon::now();

        // Cálculo de duración en minutos (redondeado hacia arriba, mínimo 1)
        $segundos = max(0, $ahora->timestamp - $registro->inicio->timestamp);
        $minutos = (int) ceil($segundos / 60);
        if ($minutos < 1 && $segundos > 0) {
            $minutos = 1;
        }

        $registro->update([
            'fin'              => $ahora,
            'duracion_minutos' => $minutos,
            'closed_by'        => $request->user()?->id,
        ]);

        $duracionStr = $registro->fresh()->duracion_formateada ?? ($minutos . ' min');

        return back()->with([
            'success' => '✅ Finalización registrada exitosamente. Tiempo de verificación: ' . $duracionStr . '.',
        ]);
    }
}
