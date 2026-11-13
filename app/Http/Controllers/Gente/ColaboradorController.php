<?php

namespace App\Http\Controllers\Gente;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gente\StoreColaboradorRequest;
use App\Http\Requests\Gente\UpdateColaboradorPaso1Request;
use App\Http\Requests\Gente\UpdateColaboradorPaso2Request;
use App\Http\Requests\Gente\UpdateColaboradorPaso3Request;
use App\Http\Requests\Gente\UpdateColaboradorPaso4Request;
use App\Http\Requests\Gente\UpdateColaboradorRequest;
use App\Http\Requests\Gente\ProrrogarContratoRequest;
use App\Models\Gente\ContratoProrroga;
use App\Models\Gente\OpcionCatalogo;
use App\Models\Gente\TipoDocumento;
use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorCargo;
use App\Models\Seguridad\Entrenamiento;
use App\Models\User;
use App\Services\Seguridad\CargoHistorialService;
use App\Services\Seguridad\ColaboradorAutoprovisionService;
use App\Services\Seguridad\ColaboradorCatalogoService;
use App\Services\Seguridad\IndiceRiesgoCalculator;
use App\Services\Gente\ContratoVigenciaService;
use App\Support\Seguridad\ColaboradorDocumentoCampos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ColaboradorController extends Controller
{
    public function index(Request $request, ColaboradorCatalogoService $catalogos): Response
    {
        $search = $request->string('search')->trim()->toString();
        $registro = $request->string('registro')->trim()->toString();
        $estado = $request->string('estado')->trim()->toString();
        $area = $request->string('area')->trim()->toString();
        $cargo = $request->string('cargo')->trim()->toString();
        $centro = $request->string('centro')->trim()->toString();
        $tipoContrato = $request->string('tipo_contrato')->trim()->toString();
        $eps = $request->string('eps')->trim()->toString();
        $arl = $request->string('arl')->trim()->toString();
        $fechaIngresoDesde = $request->string('fecha_ingreso_desde')->trim()->toString();
        $fechaIngresoHasta = $request->string('fecha_ingreso_hasta')->trim()->toString();
        $vencimientoContrato = $request->string('vencimiento_contrato')->trim()->toString();

        // Mismo umbral que la alerta de HU03, para que "próximos a vencer"
        // signifique lo mismo en la alerta y en este filtro.
        $limiteProximoVencer = now()->addDays((int) config('seguridad.dias_alerta_vencimiento_contrato'));

        $colaboradores = Colaborador::query()
            ->select([
                'id', 'cedula', 'nombres', 'apellidos', 'area', 'cargo', 'centro',
                'celular_1', 'codigo_qr_skap', 'correo', 'direccion', 'centro_trabajo',
                'eps', 'eps_otro', 'arl', 'arl_otro', 'fecha_ingreso_empresa', 'tipo_padrino',
                'imagen', 'is_active', 'estado_registro', 'wizard_step',
            ])
            ->withExists(['prorrogas as tiene_finalizacion' => fn ($query) => $query
                ->where('tipo', 'finalizacion')
                ->where((new Colaborador)->qualifyColumn('is_active'), false)])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombres', 'like', "%{$search}%")
                        ->orWhere('apellidos', 'like', "%{$search}%")
                        ->orWhere('cedula', 'like', "%{$search}%");
                });
            })
            ->when(
                $registro === 'borrador',
                fn ($query) => $query->where('estado_registro', 'borrador'),
                fn ($query) => $query->when($registro !== 'todos', fn ($query) => $query->completos())
            )
            ->when($estado === 'activo', fn ($query) => $query->where('is_active', true))
            ->when($estado === 'inactivo', fn ($query) => $query->where('is_active', false))
            ->when($area !== '', fn ($query) => $query->where('area', $area))
            ->when($cargo !== '', fn ($query) => $query->where('cargo', $cargo))
            ->when($centro !== '', fn ($query) => $query->where('centro', $centro))
            ->when($tipoContrato !== '', fn ($query) => $query->where('tipo_contrato', $tipoContrato))
            ->when($eps !== '', fn ($query) => $query->where('eps', $eps))
            ->when($arl !== '', fn ($query) => $query->where('arl', $arl))
            ->when($fechaIngresoDesde !== '', fn ($query) => $query->whereDate('fecha_ingreso_empresa', '>=', $fechaIngresoDesde))
            ->when($fechaIngresoHasta !== '', fn ($query) => $query->whereDate('fecha_ingreso_empresa', '<=', $fechaIngresoHasta))
            ->when($vencimientoContrato === 'vencidos', fn ($query) => $query->sinFinalizacionConfirmada()->whereNotNull('fecha_retiro_empresa')->where('fecha_retiro_empresa', '<', now()))
            ->when($vencimientoContrato === 'proximos', fn ($query) => $query->sinFinalizacionConfirmada()->whereNotNull('fecha_retiro_empresa')->whereBetween('fecha_retiro_empresa', [now(), $limiteProximoVencer]))
            ->when($vencimientoContrato === 'vigentes', fn ($query) => $query->where(function ($query) use ($limiteProximoVencer) {
                $query->whereNull('fecha_retiro_empresa')->orWhere('fecha_retiro_empresa', '>', $limiteProximoVencer);
            })->sinFinalizacionConfirmada())
            ->orderBy('nombres')
            ->paginate(15)
            ->withQueryString();

        // Resumen global (siempre sobre todos los registros, sin filtros activos)
        $limiteProximoVencerResumen = now()->addDays((int) config('seguridad.dias_alerta_vencimiento_contrato'));
        $totalCompletos = Colaborador::completos()->count();
        $resumen = [
            'total' => $totalCompletos,
            'activos' => Colaborador::completos()->where('is_active', true)->count(),
            'inactivos' => Colaborador::completos()->where('is_active', false)->count(),
            'borradores' => Colaborador::where('estado_registro', 'borrador')->count(),
            'area_operativa' => Colaborador::completos()->where('area', 'Operativa')->count(),
            'area_administrativa' => Colaborador::completos()->where('area', 'Administrativa')->count(),
            'contratos_proximos' => Colaborador::completos()
                ->sinFinalizacionConfirmada()
                ->whereNotNull('fecha_retiro_empresa')
                ->whereBetween('fecha_retiro_empresa', [now(), $limiteProximoVencerResumen])
                ->count(),
            'contratos_vencidos' => Colaborador::completos()
                ->sinFinalizacionConfirmada()
                ->whereNotNull('fecha_retiro_empresa')
                ->where('fecha_retiro_empresa', '<', now())
                ->count(),
        ];

        return Inertia::render('gente/colaboradores/index', [
            'colaboradores' => $colaboradores,
            'resumen' => $resumen,
            'filters' => [
                'search' => $search,
                'registro' => $registro,
                'estado' => $estado,
                'area' => $area,
                'cargo' => $cargo,
                'centro' => $centro,
                'tipo_contrato' => $tipoContrato,
                'eps' => $eps,
                'arl' => $arl,
                'fecha_ingreso_desde' => $fechaIngresoDesde,
                'fecha_ingreso_hasta' => $fechaIngresoHasta,
                'vencimiento_contrato' => $vencimientoContrato,
            ],
            'borradoresCount' => $resumen['borradores'],
            'catalogos' => $this->catalogos($catalogos),
        ]);
    }

    public function create(ColaboradorCatalogoService $catalogos): Response
    {
        return Inertia::render('gente/colaboradores/wizard/index', [
            'colaborador' => null,
            'currentStep' => 1,
            'catalogos' => $this->catalogos($catalogos),
        ]);
    }

    /**
     * Paso 1 del wizard: crea el colaborador como borrador. Los pasos
     * siguientes se completan sobre este mismo registro vía wizard().
     */
    public function store(StoreColaboradorRequest $request, ColaboradorAutoprovisionService $autoprovision): RedirectResponse
    {
        $data = $request->validated();

        $data = $this->resolverOtros($data, [
            'tipo_documento' => ['tipo_documento', 'tipo_documento_otro_label'],
            'eps' => ['eps', 'eps_otro'],
            'afp' => ['afp', 'afp_otro'],
            'arl' => ['arl', 'arl_otro'],
            'estado_civil' => ['estado_civil', 'estado_civil_otro'],
        ]);

        foreach (ColaboradorDocumentoCampos::paso1() as $field) {
            unset($data[$field]);
        }

        if ($request->hasFile('imagen')) {
            $data['imagen'] = $request->file('imagen')->store('colaboradores', 'public');
        }

        if (empty($data['user_id'])) {
            $data['user_id'] = $autoprovision->provisionar($data['cedula'], $data['nombres'], $data['apellidos'], $data['correo'] ?? null)->id;
        }

        $colaborador = Colaborador::create([
            ...$data,
            'is_active' => $request->boolean('is_active', true),
            'estado_registro' => 'borrador',
            'wizard_step' => 1,
        ]);

        $this->storeDocuments($request, $colaborador, ColaboradorDocumentoCampos::paso1());

        return to_route('gente.colaboradores.wizard', $colaborador);
    }

    /**
     * Muestra el wizard sobre un colaborador ya existente: retoma un
     * borrador donde se quedó, o permite revisar/editar cualquier paso de
     * un colaborador ya completo (esta es también la vista de "editar").
     */
    public function wizard(
        Request $request,
        Colaborador $colaborador,
        ColaboradorCatalogoService $catalogos,
    ): Response|RedirectResponse
    {
        if ($colaborador->tieneFinalizacionConfirmada()) {
            return to_route('gente.colaboradores.show', $colaborador)
                ->with('status', 'El colaborador tiene el contrato finalizado y no se puede editar.');
        }

        $maxStep = max(1, (int) $colaborador->wizard_step);
        // Un borrador arranca en el siguiente paso sin completar; un
        // colaborador completo arranca en el Paso 1 para revisar desde el
        // principio (no tendría sentido aterrizar siempre en "Archivos").
        $siguienteStepPorDefecto = $colaborador->estado_registro === 'completo' ? 1 : min($maxStep + 1, 4);
        $currentStep = min(max((int) $request->integer('paso', $siguienteStepPorDefecto), 1), 4);

        $colaboradorData = $this->colaboradorArrayConFechasSimples($colaborador);
        $colaboradorData = [...$colaboradorData, ...$this->documentPaths($colaborador)];

        return Inertia::render('gente/colaboradores/wizard/index', [
            'colaborador' => $colaboradorData,
            'currentStep' => $currentStep,
            'esReingreso' => $colaborador->esReingreso(),
            'catalogos' => $this->catalogos($catalogos),
            'historialCargos' => $colaborador->cargos()
                ->reorder()
                ->orderBy('fecha_inicio')
                ->orderBy('id')
                ->get()
                ->map(fn ($c) => [
                    'id'           => $c->id,
                    'cargo'        => $c->cargo,
                    'area'         => $c->area,
                    'perfil'       => $c->perfil,
                    'fecha_inicio' => $c->fecha_inicio?->toDateString(),
                    'fecha_fin'    => $c->fecha_fin?->toDateString(),
                    'estado'       => $c->estado,
                ])->values()->all(),
            'historialContratos' => $colaborador->contratos()
                ->reorder()
                ->orderBy('fecha_inicio')
                ->orderBy('id')
                ->get()
                ->map(fn ($c) => [
                'id'               => $c->id,
                'tipo_contrato'    => $c->tipo_contrato,
                'tipo_contrato_otro' => $c->tipo_contrato_otro,
                'fecha_inicio'     => $c->fecha_inicio?->toDateString(),
                'fecha_fin'        => $c->fecha_fin?->toDateString(),
                'estado'           => $c->estado,
                ])->values()->all(),
            'usuarios' => $this->usuariosVinculables($colaborador),
        ]);
    }

    /**
     * Cuando un campo viene como "Otro", persiste el valor del label
     * (campo_otro_label) en la tabla correspondiente de catálogo y
     * reemplaza el valor por el nombre real para que quede guardado
     * en la columna del colaborador.
     *
     * @param  array<string, mixed>  $data  Datos validados del request
     * @param  array<string, string>  $mapa  campo => [categoria, campoLabel]
     * @return array<string, mixed> $data con los valores resueltos
     */
    private function resolverOtros(array $data, array $mapa): array
    {
        foreach ($mapa as $campo => [$categoria, $campoLabel]) {
            if (($data[$campo] ?? null) === 'Otro' && ! empty($data[$campoLabel])) {
                $nombre = trim($data[$campoLabel]);

                if ($campo === 'tipo_documento') {
                    TipoDocumento::firstOrCreate(
                        ['nombre' => $nombre],
                        ['es_personalizado' => true]
                    );
                } else {
                    OpcionCatalogo::firstOrCreate(
                        ['categoria' => $categoria, 'nombre' => $nombre],
                        ['es_personalizado' => true]
                    );
                }

                $data[$campo] = $nombre;
                $data[$campoLabel] = null;
            }
        }

        return $data;
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function catalogos(ColaboradorCatalogoService $catalogos): array
    {
        return [
            'tiposDocumento' => collect(config('seguridad.colaboradores.tipos_documento', []))
                ->merge(TipoDocumento::orderBy('es_personalizado')->orderBy('nombre')->pluck('nombre'))
                ->unique()
                ->values()
                ->all(),
            'epsOpciones' => OpcionCatalogo::opcionesDe('eps'),
            'afpOpciones' => OpcionCatalogo::opcionesDe('afp'),
            'arlOpciones' => OpcionCatalogo::opcionesDe('arl'),
            'estadosCiviles' => OpcionCatalogo::opcionesDe('estado_civil'),
            'tiposContrato' => $catalogos->tiposContrato(),
            'cargosAnteriores' => OpcionCatalogo::opcionesDe('cargo_anterior'),
            'cargos' => $catalogos->cargos(),
            'perfilesCargos' => $catalogos->perfilesCargos(),
            'centros' => config('seguridad.colaboradores.centros'),
            'centrosTrabajo' => config('seguridad.colaboradores.centros_trabajo'),
            'motivosRetiro' => config('seguridad.colaboradores.motivos_retiro'),
            'licenciaCategorias' => config('seguridad.colaboradores.licencia_conduccion_categorias'),
            'documentoGrupos' => config('seguridad.documentos_colaborador.grupos'),
            'documentoFields' => config('seguridad.documentos_colaborador.documentos'),
        ];
    }

    public function updatePaso1(UpdateColaboradorPaso1Request $request, Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $data = $request->validated();

        $data = $this->resolverOtros($data, [
            'tipo_documento' => ['tipo_documento', 'tipo_documento_otro_label'],
            'eps' => ['eps', 'eps_otro'],
            'afp' => ['afp', 'afp_otro'],
            'arl' => ['arl', 'arl_otro'],
            'estado_civil' => ['estado_civil', 'estado_civil_otro'],
        ]);

        foreach (ColaboradorDocumentoCampos::paso1() as $field) {
            unset($data[$field]);
        }

        if ($request->boolean('eliminar_imagen')) {
            if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
                Storage::disk('public')->delete($colaborador->imagen);
            }
            $data['imagen'] = null;
        } elseif ($request->hasFile('imagen')) {
            if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
                Storage::disk('public')->delete($colaborador->imagen);
            }

            $data['imagen'] = $request->file('imagen')->store('colaboradores', 'public');
        } else {
            // Sin archivo nuevo ni orden de eliminación, no se toca la foto ya guardada
            unset($data['imagen']);
        }

        $colaborador->update([
            ...$data,
            'wizard_step' => max((int) $colaborador->wizard_step, 1),
        ]);

        $this->storeDocuments($request, $colaborador, ColaboradorDocumentoCampos::paso1());

        return to_route('gente.colaboradores.wizard', ['colaborador' => $colaborador, 'paso' => 2]);
    }

    public function updateFoto(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $request->validate([
            'imagen' => ['required', 'image', 'max:2048'],
        ]);

        if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
            Storage::disk('public')->delete($colaborador->imagen);
        }

        $path = $request->file('imagen')->store('colaboradores', 'public');
        $colaborador->update(['imagen' => $path]);

        return back()->with('status', 'Foto actualizada correctamente.');
    }

    public function destroyFoto(Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
            Storage::disk('public')->delete($colaborador->imagen);
        }

        $colaborador->update(['imagen' => null]);

        return back()->with('status', 'Foto eliminada correctamente.');
    }

    public function updatePaso2(UpdateColaboradorPaso2Request $request, Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $data = $request->validated();

        foreach (ColaboradorDocumentoCampos::paso2() as $field) {
            unset($data[$field]);
        }

        $colaborador->update([
            ...$data,
            'wizard_step' => max((int) $colaborador->wizard_step, 2),
        ]);

        $this->storeDocuments($request, $colaborador, ColaboradorDocumentoCampos::paso2());

        return to_route('gente.colaboradores.wizard', ['colaborador' => $colaborador, 'paso' => 3]);
    }

    public function updatePaso3(
        UpdateColaboradorPaso3Request $request,
        Colaborador $colaborador,
        CargoHistorialService $cargoHistorial,
        ContratoVigenciaService $contratoVigencia,
    ): RedirectResponse
    {
        $estadoSolicitado = $request->boolean('is_active', (bool) $colaborador->is_active);
        $cambioEstado = $estadoSolicitado !== (bool) $colaborador->is_active;

        if ($colaborador->is_active) {
            $this->asegurarEditable($colaborador);
        } else {
            abort_if(
                $colaborador->tieneFinalizacionConfirmada(),
                403,
                'El contrato ya fue finalizado y no se puede modificar.',
            );
            abort_unless(
                $cambioEstado && $estadoSolicitado,
                403,
                'Debe reactivar al colaborador desde este paso para continuar.',
            );
        }

        $data = $request->validated();
        unset($data['is_active']);

        $data = $this->resolverOtros($data, [
            'tipo_contrato' => ['tipo_contrato', 'tipo_contrato_otro'],
        ]);
        $primerContrato = $colaborador->contratos()
            ->reorder()
            ->orderBy('fecha_inicio')
            ->orderBy('id')
            ->first();
        $contratoActual = $contratoVigencia->contratoActual($colaborador);
        $fechaInicioContratoPrincipal = $data['fecha_ingreso_empresa'] ?? null;
        $fechaFinContratoPrincipal = $data['fecha_retiro_empresa'] ?? null;

        // En el wizard las fechas principales representan el primer contrato.
        // No deben reemplazar las fechas actuales del colaborador cuando este
        // tiene contratos posteriores; esos se editan por separado en el historial.
        if ($primerContrato && ! $primerContrato->is($contratoActual)) {
            unset($data['fecha_ingreso_empresa'], $data['fecha_retiro_empresa']);
        }

        $datosNuevoContrato = [
            'tipo_contrato' => $data['nuevo_tipo_contrato'] ?? null,
            'tipo_contrato_otro' => $data['nuevo_tipo_contrato_otro'] ?? null,
            'fecha_inicio' => $data['nuevo_fecha_inicio'] ?? null,
            'fecha_fin' => $data['nuevo_fecha_fin'] ?? null,
            'cargo' => $data['nuevo_cargo'] ?? null,
            'area' => $data['nuevo_area'] ?? null,
        ];

        foreach ([
            ...ColaboradorDocumentoCampos::paso3(),
            'es_nuevo_contrato',
            'nuevo_tipo_contrato',
            'nuevo_tipo_contrato_otro',
            'nuevo_fecha_inicio',
            'nuevo_fecha_fin',
            'nuevo_cargo',
            'nuevo_area',
            'contratos_editados',
            'cargos_editados',
        ] as $field) {
            unset($data[$field]);
        }

        $cargo = $data['cargo'] ?? null;
        $cargoFechaInicio = $data['cargo_fecha_inicio'] ?? null;
        $cargoPerfil = $data['perfil'] ?? null;
        unset($data['cargo'], $data['cargo_fecha_inicio'], $data['guardar_historial_cargo'], $data['perfil']);

        $colaborador->update([
            ...$data,
            'wizard_step' => max((int) $colaborador->wizard_step, 3),
        ]);

        $tipoContrato = $colaborador->fresh()->tipo_contrato;
        $fechaInicio  = $colaborador->fresh()->fecha_ingreso_empresa;
        $fechaFin     = $colaborador->fresh()->contrato_fecha_hasta ?? $colaborador->fresh()->fecha_retiro_empresa;
        $esNuevoContrato = $request->boolean('es_nuevo_contrato') || $colaborador->esReingreso() || $cambioEstado;

        // Actualizar contratos editados del historial
        $contratosEditados = json_decode($request->input('contratos_editados', '[]'), true);
        foreach ($contratosEditados as $contratoData) {
            $contrato = $colaborador->contratos()->find($contratoData['id'] ?? null);
            if ($contrato) {
                $contratoVigencia->actualizarContrato($colaborador, $contrato, [
                    'tipo_contrato'      => $contratoData['tipo_contrato'] ?? $contrato->tipo_contrato,
                    'tipo_contrato_otro' => $contratoData['tipo_contrato_otro'] ?? $contrato->tipo_contrato_otro,
                    'fecha_inicio'       => $contratoData['fecha_inicio'] ?? $contrato->fecha_inicio,
                    'fecha_fin'          => $contratoData['fecha_fin'] ?? $contrato->fecha_fin,
                ]);
            }
        }

        // Actualizar cargos editados del historial
        $cargosEditados = json_decode($request->input('cargos_editados', '[]'), true);
        foreach ($cargosEditados as $cargoData) {
            $cargoHist = $colaborador->cargos()->find($cargoData['id'] ?? null);
            if ($cargoHist) {
                $cargoHist->update([
                    'cargo'        => $cargoData['cargo'] ?? $cargoHist->cargo,
                    'area'         => $cargoData['area'] ?? $cargoHist->area,
                    'perfil'       => $cargoData['perfil'] ?? $cargoHist->perfil,
                    'fecha_inicio' => $cargoData['fecha_inicio'] ?? $cargoHist->fecha_inicio,
                    'fecha_fin'    => ! empty($cargoData['fecha_fin']) ? $cargoData['fecha_fin'] : null,
                    'estado'       => $cargoData['estado'] ?? $cargoHist->estado,
                ]);
                if ($cargoHist->estado === 'ACTIVO') {
                    $colaborador->update([
                        'cargo' => $cargoHist->cargo,
                        ...(! empty($cargoHist->area) ? ['area' => $cargoHist->area] : []),
                    ]);
                }
            }
        }

        if ($tipoContrato || $cambioEstado) {
            if ($esNuevoContrato) {
                // Crear nuevo registro con los campos dedicados del nuevo contrato
                $contratoCreado = $contratoVigencia->crearContratoActual($colaborador, [
                    'tipo_contrato'      => $datosNuevoContrato['tipo_contrato'] ?: $tipoContrato,
                    'tipo_contrato_otro' => $datosNuevoContrato['tipo_contrato_otro'],
                    'fecha_inicio'       => $datosNuevoContrato['fecha_inicio'] ?: $fechaInicio,
                    'fecha_fin'          => $datosNuevoContrato['fecha_fin'] ?: $fechaFin,
                    'cargo'              => $datosNuevoContrato['cargo'] ?: $cargo,
                    'area'               => $datosNuevoContrato['area'] ?: ($data['area'] ?? $colaborador->area),
                    'registrado_por'     => $request->user()?->id,
                ]);

                if (! $estadoSolicitado) {
                    $contratoCreado->update(['estado' => 'finalizado']);
                }

                $cargoContrato = $datosNuevoContrato['cargo'] ?: $cargo;
                $areaContrato = $datosNuevoContrato['area'] ?: ($data['area'] ?? $colaborador->area);
                $fechaInicioContrato = $cambioEstado
                    ? $cargoFechaInicio
                    : ($datosNuevoContrato['fecha_inicio'] ?: $fechaInicio);
                if ($cargoContrato && $fechaInicioContrato) {
                    $cargoHistorial->asignar(
                        $colaborador,
                        $cargoContrato,
                        $fechaInicioContrato,
                        $areaContrato,
                        $cargoPerfil,
                        $cambioEstado,
                    );

                    if ($cambioEstado && ! $estadoSolicitado) {
                        $cargoAsignado = $colaborador->cargos()
                            ->where('cargo', $cargoContrato)
                            ->whereDate('fecha_inicio', $fechaInicioContrato)
                            ->latest('id')
                            ->first();

                        $cargoAsignado?->update([
                            'fecha_fin' => $datosNuevoContrato['fecha_fin'],
                            'estado' => 'INACTIVO',
                        ]);
                    }
                }
            } else {
                $contratoActual = $contratoVigencia->contratoActual($colaborador);
                if ($contratoActual) {
                    $contratoActual->refresh();
                    $editaronContratoActual = collect($contratosEditados)
                        ->contains(fn (array $contratoData) => (int) ($contratoData['id'] ?? 0) === $contratoActual->id);
                    $fechasContratoActual = $editaronContratoActual || ($primerContrato && ! $primerContrato->is($contratoActual))
                        ? [
                            'fecha_inicio' => $contratoActual->fecha_inicio,
                            'fecha_fin' => $contratoActual->fecha_fin,
                        ]
                        : [
                            'fecha_inicio' => $fechaInicioContratoPrincipal ?? $fechaInicio,
                            'fecha_fin' => $fechaFinContratoPrincipal ?? $fechaFin,
                        ];

                    $contratoVigencia->actualizarContrato($colaborador, $contratoActual, [
                        'tipo_contrato'      => $tipoContrato,
                        'tipo_contrato_otro' => $colaborador->fresh()->tipo_contrato_otro,
                        ...$fechasContratoActual,
                    ]);
                }
            }
        }

        // Reglas del historial de cargos (3 escenarios). Devuelve un mensaje
        // informativo cuando el cargo no cambió (Escenario B); el resto del
        // guardado del paso ya se hizo arriba.
        $info = $cambioEstado
            ? null
            : $cargoHistorial->registrarCambio($colaborador, $cargo, $cargoFechaInicio, $data['area'] ?? null, $cargoPerfil);

        if ($cambioEstado) {
            $colaborador->update(['is_active' => $estadoSolicitado]);
            $colaborador->user?->update(['is_active' => $estadoSolicitado]);
            $colaborador->activacionHistorial()->create([
                'is_active' => $estadoSolicitado,
                'tipo' => $estadoSolicitado ? 'activacion' : 'desactivacion',
                'fecha' => now(),
                'motivo' => $estadoSolicitado
                    ? 'Reactivación registrada desde el wizard'
                    : (($data['motivo_retiro'] ?? null) ?: 'Desactivación registrada desde el wizard'),
                'observaciones' => 'Cambio de estado registrado junto con un nuevo contrato y cargo.',
                'user_id' => $request->user()?->id,
            ]);
        }

        $this->storeDocuments($request, $colaborador, ColaboradorDocumentoCampos::paso3());

        if ($cambioEstado) {
            return to_route('gente.colaboradores.show', $colaborador)
                ->with('status', $estadoSolicitado
                    ? 'Colaborador activado con un nuevo contrato y cargo registrados.'
                    : 'Colaborador desactivado con un nuevo contrato y cargo registrados.');
        }

        // Si viene desde la vista de contratos, regresar allí
        if ($request->input('redirect_to') === 'contratos') {
            return to_route('gente.contratos.show', ['colaborador' => $colaborador])
                ->with('status', $info ?? 'Contrato actualizado correctamente.');
        }

        $redirect = to_route('gente.colaboradores.wizard', ['colaborador' => $colaborador, 'paso' => 4]);

        if ($info) {
            $redirect->with('status', $info);
        }

        return $redirect;
    }

    public function updateCargo(Request $request, Colaborador $colaborador, $cargo): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $cargoModel = $cargo instanceof ColaboradorCargo
            ? $cargo
            : ($colaborador->cargos()->find($cargo) ?? ColaboradorCargo::findOrFail($cargo));

        abort_if((int) $cargoModel->colaborador_id !== (int) $colaborador->id, 403);

        $validated = $request->validate([
            'cargo' => ['required', 'string', 'max:100'],
            'area' => ['nullable', 'string', 'max:100'],
            'perfil' => ['nullable', 'string'],
            'fecha_inicio' => ['required', 'date'],
            'fecha_fin' => ['nullable', 'date'],
            'estado' => ['nullable', 'string', 'in:ACTIVO,INACTIVO'],
        ]);

        $cargoModel->update($validated);

        if ($cargoModel->estado === 'ACTIVO') {
            $colaborador->update([
                'cargo' => $cargoModel->cargo,
                ...(! empty($cargoModel->area) ? ['area' => $cargoModel->area] : []),
            ]);
        }

        return back()->with('status', 'Registro de cargo actualizado correctamente.');
    }

    public function destroyCargo(Colaborador $colaborador, $cargo): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $cargoModel = $cargo instanceof ColaboradorCargo
            ? $cargo
            : ($colaborador->cargos()->find($cargo) ?? ColaboradorCargo::find($cargo));

        if (! $cargoModel) {
            return back()->with('status', 'Registro de cargo eliminado.');
        }

        abort_if((int) $cargoModel->colaborador_id !== (int) $colaborador->id, 403);

        $eraActivo = $cargoModel->estado === 'ACTIVO';

        $cargoModel->delete();

        // Si se eliminó el cargo activo, reactivar el más reciente que quede
        if ($eraActivo) {
            $anterior = $colaborador->cargos()
                ->where('estado', 'INACTIVO')
                ->latest('fecha_inicio')
                ->first();

            if ($anterior) {
                $anterior->update(['estado' => 'ACTIVO', 'fecha_fin' => null]);
                $colaborador->update([
                    'cargo' => $anterior->cargo,
                    ...(! empty($anterior->area) ? ['area' => $anterior->area] : []),
                ]);
            } else {
                $colaborador->update(['cargo' => null]);
            }
        }

        return back()->with('status', 'Registro de cargo eliminado.');
    }

    public function updatePaso4(UpdateColaboradorPaso4Request $request, Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $data = $request->validated();

        foreach (ColaboradorDocumentoCampos::paso4() as $field) {
            unset($data[$field]);
        }

        // Las categorías de licencia de conducción son un arreglo JSON en la
        // columna `licencia_conduccion_categorias`. Se asigna de forma
        // explícita porque un arreglo vacío enviado por FormData no llega al
        // servidor, así garantizamos que deseleccionar todas las categorías
        // también quede persistido (en lugar de conservar el valor anterior).
        $colaborador->update([
            ...$data,
            'licencia_conduccion_categorias' => $data['licencia_conduccion_categorias'] ?? [],
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);

        $this->storeDocuments($request, $colaborador, ColaboradorDocumentoCampos::paso4());

        return to_route('gente.colaboradores.show', $colaborador)->with('status', 'Colaborador registrado correctamente.');
    }

    public function show(Colaborador $colaborador, IndiceRiesgoCalculator $calculator): Response
    {
        $documentos = $this->documentPaths($colaborador);
        $colaboradorData = [
            ...$this->colaboradorArrayConFechasSimples($colaborador),
            ...$documentos,
            'tiene_finalizacion' => $colaborador->tieneFinalizacionConfirmada(),
        ];

        return Inertia::render('gente/colaboradores/show', [
            'colaborador' => $colaboradorData,
            'indiceRiesgo' => $calculator->calcular($colaborador),
            'documentoGrupos' => config('seguridad.documentos_colaborador.grupos'),
            'documentoFields' => config('seguridad.documentos_colaborador.documentos'),
            'pruebas' => $colaborador->pruebasAlcoholemia()
                ->with('alcoholimetro:id,codigo')
                ->latest('fecha_hora')
                ->limit(25)
                ->get(),
            'condicionesSalud' => $colaborador->condicionesSalud()
                ->latest('fecha_hora')
                ->limit(25)
                ->get(),
            'evaluacionesMedicas' => $colaborador->evaluacionesMedicas()
                ->with('conceptoAptitud:id,nombre')
                ->latest('fecha_evaluacion')
                ->limit(25)
                ->get(),
            'llamadosAtencion' => $colaborador->llamadosAtencion()
                ->with('registradoPor:id,name')
                ->latest('fecha_hora')
                ->limit(25)
                ->get(),
            'entrenamientos' => $colaborador->entrenamientos()
                ->with(['entrenamiento:id,nombre', 'registradoPor:id,name'])
                ->orderByDesc('fecha_registro')
                ->orderByDesc('hora_registro')
                ->limit(50)
                ->get(),
            'entrenamientosCatalogo' => Entrenamiento::orderBy('nombre')->get(['id', 'nombre']),
            'certificadosAprendizaje' => [
                'escuelaPilotos' => count($documentos['documento_escuela_pilotos'] ?? []) > 0,
                'brigadista' => count($documentos['documento_certificado_brigadista'] ?? []) > 0,
            ],
        ]);
    }

    /**
     * Exporta la hoja de vida del colaborador como PDF.
     */
    public function exportarPdf(Colaborador $colaborador): \Illuminate\Http\Response
    {
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('gente.colaborador-pdf', [
            'colaborador' => $colaborador,
        ])->setPaper('a4', 'portrait');

        $nombreArchivo = 'hoja-de-vida-' . str($colaborador->nombre_completo)->slug() . '.pdf';

        return $pdf->download($nombreArchivo);
    }

    /**
     * Prorroga el contrato de un colaborador actualizando fecha_retiro_empresa
     * y marcando como atendida cualquier alerta de retiro_proximo pendiente.
     */
    public function prorrogarContrato(
        ProrrogarContratoRequest $request,
        Colaborador $colaborador,
        ContratoVigenciaService $contratoVigencia,
    ): RedirectResponse
    {
        $esFinalizacionSolicitada = $request->input('tipo', 'prorroga') === 'finalizacion';

        if ($colaborador->is_active || ! $esFinalizacionSolicitada) {
            $this->asegurarEditable($colaborador);
        } else {
            abort_if(
                $colaborador->tieneFinalizacionConfirmada(),
                403,
                'El contrato ya fue finalizado y no se puede modificar.',
            );
        }

        $datos = $request->validated();
        $contratoActual = $contratoVigencia->contratoActual($colaborador);
        $tipo = $datos['tipo'] ?? 'prorroga';
        $esFinalizacion = $tipo === 'finalizacion';
        $nuevaFechaRetiro = $request->date('fecha_retiro_empresa');

        // 1. Resolver el contrato objetivo para la prórroga
        $contratoDestino = null;
        if (! empty($datos['crear_nuevo_contrato'])) {
            $contratoDestino = $colaborador->contratos()->create([
                'tipo_contrato' => $datos['nuevo_contrato_tipo'] ?? 'Término Fijo',
                'fecha_inicio' => $datos['nuevo_contrato_inicio'] ?? $datos['fecha_inicio_prorroga'],
                'fecha_fin' => $datos['nuevo_contrato_fin'] ?? $nuevaFechaRetiro,
                'estado' => 'finalizado',
                'observaciones' => 'Contrato histórico creado al registrar prórroga.',
                'registrado_por' => $request->user()->id,
            ]);
        } elseif (! empty($datos['contrato_id'])) {
            $contratoDestino = $colaborador->contratos()->find($datos['contrato_id']);
        } else {
            // Detección automática por continuidad de fechas
            $fechaInicioBuscada = $datos['fecha_inicio_prorroga'] ?? null;
            if ($fechaInicioBuscada) {
                foreach ($colaborador->contratos()->get() as $c) {
                    $ultP = $c->prorrogas()->where('tipo', 'prorroga')->orderByDesc('fecha_nueva')->orderByDesc('id')->first();
                    $finSec = $ultP?->fecha_nueva?->toDateString() ?? $c->fecha_fin?->toDateString();
                    if ($finSec && \Illuminate\Support\Carbon::parse($finSec)->addDay()->toDateString() === $fechaInicioBuscada) {
                        $contratoDestino = $c;
                        break;
                    }
                }
            }
            $contratoDestino ??= $contratoActual;
        }

        if ($esFinalizacion) {
            $contratoDestino?->update(['estado' => 'finalizado']);
            if ($contratoActual && $contratoDestino?->id !== $contratoActual->id) {
                $contratoActual->update(['estado' => 'finalizado']);
            }
        }

        // 2. Determinar la fecha anterior específica de la secuencia de este contrato
        $ultProrrogaDestino = $contratoDestino?->prorrogas()
            ->where('tipo', 'prorroga')
            ->orderByDesc('fecha_nueva')
            ->orderByDesc('id')
            ->first();
        $fechaAnteriorSecuencia = $ultProrrogaDestino?->fecha_nueva?->toDateString()
            ?? $contratoDestino?->fecha_fin?->toDateString()
            ?? ($colaborador->fecha_retiro_empresa ? $colaborador->fecha_retiro_empresa->toDateString() : null);

        // 3. Actualizar fecha_retiro_empresa solo si es el contrato activo o si la fecha nueva es mayor/vigente
        $esContratoVigente = ! $contratoActual || ($contratoDestino && $contratoDestino->id === $contratoActual->id);
        if ($esContratoVigente || ! $colaborador->fecha_retiro_empresa || $nuevaFechaRetiro->greaterThanOrEqualTo($colaborador->fecha_retiro_empresa)) {
            $colaborador->update([
                'fecha_retiro_empresa' => $nuevaFechaRetiro,
                'is_active' => $esFinalizacion ? false : $colaborador->is_active,
            ]);
        }

        if ($esFinalizacion && $colaborador->user) {
            $colaborador->user->update(['is_active' => false]);
        }

        if ($esFinalizacion) {
            try {
                $colaborador->activacionHistorial()->create([
                    'is_active' => false,
                    'tipo' => 'finalizacion_contrato',
                    'fecha' => now(),
                    'motivo' => $datos['observaciones'] ?? 'Finalización de contrato',
                    'observaciones' => 'Colaborador desactivado automáticamente por finalización de contrato.',
                    'user_id' => $request->user()->id,
                ]);
            } catch (\Throwable) {
                // No interrumpe el flujo
            }
        }

        $documentoPath = null;
        $documentoNombre = null;
        if ($request->hasFile('documento')) {
            $archivo = $request->file('documento');
            $documentoPath = $archivo->store('colaboradores/prorrogas', 'public');
            $documentoNombre = $archivo->getClientOriginalName();
        }

        // Registrar en el historial de prórrogas
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'contrato_id' => $contratoDestino?->id,
            'registrado_por' => $request->user()->id,
            'fecha_anterior' => $fechaAnteriorSecuencia ?? $nuevaFechaRetiro,
            'fecha_inicio' => $esFinalizacion ? null : ($datos['fecha_inicio_prorroga'] ?? null),
            'fecha_nueva' => $nuevaFechaRetiro,
            'tipo' => $tipo,
            'observaciones' => $datos['observaciones'] ?? null,
            'documento_path' => $documentoPath,
            'documento_nombre' => $documentoNombre,
        ]);

        // Atender todas las alertas de retiro pendientes de este colaborador
        Alerta::query()
            ->where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo')
            ->where('atendida', false)
            ->update([
                'atendida' => true,
                'atendida_por' => $request->user()->id,
                'atendida_en' => now(),
            ]);

        return back()->with('status', 'Contrato actualizado correctamente.');
    }

    /**
     * La transición de estado se completa en el paso 3 del wizard para
     * exigir el contrato y el cargo correspondientes.
     */
    public function toggleActivo(Colaborador $colaborador): RedirectResponse
    {
        abort_if(
            $colaborador->tieneFinalizacionConfirmada(),
            403,
            'El contrato ya fue finalizado. No se puede cambiar el estado.',
        );

        return to_route('gente.colaboradores.edit', [
            'colaborador' => $colaborador,
            'paso' => 3,
        ]);
    }

    /**
     * "Editar" reutiliza el mismo wizard que crear: para un colaborador ya
     * completo simplemente arranca en el Paso 1 con los 4 pasos
     * desbloqueados (ver wizard()).
     */
    public function edit(
        Request $request,
        Colaborador $colaborador,
        ColaboradorCatalogoService $catalogos,
    ): Response|RedirectResponse
    {
        return $this->wizard($request, $colaborador, $catalogos);
    }

    public function update(UpdateColaboradorRequest $request, Colaborador $colaborador, CargoHistorialService $cargoHistorial, ColaboradorAutoprovisionService $autoprovision): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $data = $request->validated();

        foreach (ColaboradorDocumentoCampos::todas() as $field) {
            unset($data[$field]);
        }

        $cargo = $data['cargo'] ?? null;
        $cargoFechaInicio = $data['cargo_fecha_inicio'] ?? null;
        unset($data['cargo'], $data['cargo_fecha_inicio']);

        if ($request->boolean('eliminar_imagen')) {
            if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
                Storage::disk('public')->delete($colaborador->imagen);
            }
            $data['imagen'] = null;
        } elseif ($request->hasFile('imagen')) {
            if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
                Storage::disk('public')->delete($colaborador->imagen);
            }

            $data['imagen'] = $request->file('imagen')->store('colaboradores', 'public');
        } else {
            unset($data['imagen']);
        }

        $colaborador->update($data);

        // Reglas del historial de cargos: la misma lógica central que usa el
        // wizard (ver CargoHistorialService::registrarCambio). Devuelve un
        // mensaje informativo cuando el cargo no cambió.
        $info = $cargoHistorial->registrarCambio($colaborador, $cargo, $cargoFechaInicio);

        if ($colaborador->user_id) {
            $usuario = User::find($colaborador->user_id);

            if ($usuario) {
                $autoprovision->sincronizarCorreo($usuario, $data['correo'] ?? null);
            }
        }

        $this->storeDocuments($request, $colaborador, ColaboradorDocumentoCampos::todas());

        return to_route('gente.colaboradores.index')->with('status', $info ?? 'Colaborador actualizado correctamente.');
    }

    public function destroy(Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        foreach ($this->documentPaths($colaborador) as $paths) {
            if (!is_iterable($paths)) {
                continue;
            }
            foreach ($paths as $path) {
                $location = is_array($path) ? ($path['path'] ?? null) : $path;
                if (!empty($location) && is_string($location) && Storage::disk('public')->exists($location)) {
                    Storage::disk('public')->delete($location);
                }
            }
        }

        if (!empty($colaborador->imagen) && is_string($colaborador->imagen) && Storage::disk('public')->exists($colaborador->imagen)) {
            Storage::disk('public')->delete($colaborador->imagen);
        }

        $colaborador->delete();

        return to_route('gente.colaboradores.index')->with('status', 'Colaborador eliminado correctamente.');
    }

    private function asegurarEditable(Colaborador $colaborador): void
    {
        abort_if(
            $colaborador->tieneFinalizacionConfirmada(),
            403,
            'El contrato ya fue finalizado y no se puede modificar.',
        );

        abort_if(
            ! $colaborador->is_active,
            403,
            'El colaborador está inactivo y no se puede modificar. Actívelo primero.',
        );
    }

    /**
     * @param  array<int, string>  $campos
     */
    private function storeDocuments(Request $request, Colaborador $colaborador, array $campos): void
    {
        foreach ($campos as $field) {
            $files = $request->file($field, []);
            $files = is_array($files) ? $files : [$files];

            foreach (array_filter($files) as $file) {
                $colaborador->documentos()->create([
                    'campo' => $field,
                    'path' => $file->store('colaboradores/documentos', 'public'),
                    'fecha_documento' => now()->toDateString(),
                ]);
            }
        }
    }

    private function usuariosVinculables(?Colaborador $colaborador = null): Collection
    {
        return User::role(Role::Colaborador->value)
            ->where(function ($query) use ($colaborador) {
                $query->whereDoesntHave('colaborador')
                    ->when($colaborador?->user_id, fn ($q) => $q->orWhere('id', $colaborador->user_id));
            })
            ->orderBy('name')
            ->get(['id', 'name', 'identification_number']);
    }

    /**
     * `toArray()` serializa los atributos con cast 'date' como datetime ISO
     * completo (ej. "2024-06-01T00:00:00.000000Z"), lo que no calza con el
     * formato "Y-m-d" que esperan los <input type="date"> del wizard ni con
     * el valor que se vuelve a enviar al reenviar un paso sin tocar esa
     * fecha. Se normalizan a "Y-m-d" antes de mandarlos a Inertia.
     */
    private function colaboradorArrayConFechasSimples(Colaborador $colaborador): array
    {
        $data = $colaborador->toArray();

        foreach ($colaborador->getCasts() as $campo => $cast) {
            if ($cast === 'date' && $colaborador->{$campo} !== null) {
                $data[$campo] = $colaborador->{$campo}->toDateString();
            }
        }

        return $data;
    }

    private function documentPaths(Colaborador $colaborador): array
    {
        $paths = [];

        foreach (ColaboradorDocumentoCampos::todas() as $field) {
            $paths[$field] = $colaborador->{$field}
                ? [['path' => $colaborador->{$field}, 'fecha' => null]]
                : [];
        }

        foreach ($colaborador->documentos as $documento) {
            $paths[$documento->campo][] = [
                'path' => $documento->path,
                'fecha' => $documento->fecha_documento?->format('Y-m-d'),
            ];
        }

        return $paths;
    }
}
