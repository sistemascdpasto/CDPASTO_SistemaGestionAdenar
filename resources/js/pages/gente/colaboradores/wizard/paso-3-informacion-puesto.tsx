import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PillToggle, SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Briefcase,
    Building2,
    FileText,
    GraduationCap,
    LoaderCircle,
    Plus,
    Power,
    QrCode,
    Trash2,
    Umbrella,
    X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FormEventHandler, useState } from 'react';
import { type WizardCatalogos } from './catalogos';
import { CargoCombobox } from './components/cargo-combobox';
import { ExternalSelect } from './components/external-select';
import { SimpleFileField } from './components/simple-file-field';
import { type ColaboradorRecord, type Paso3FormData } from './types';
import { errorDeArchivo } from './utils';

const getHoyLocalISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const hoyISO = getHoyLocalISO();

/**
 * Restringe el selector a "hoy en adelante" para fechas nuevas, pero sin
 * bloquear una fecha histórica que el colaborador ya tenía guardada — si no,
 * reabrir un contrato o unas vacaciones ya vencidas impide avanzar el wizard.
 */
function minDateFor(valorGuardado: unknown): string {
    const valor = typeof valorGuardado === 'string' ? valorGuardado : null;
    return valor && valor < hoyISO ? valor : hoyISO;
}

type HistorialCargo = {
    id: number;
    cargo: string;
    area?: string | null;
    perfil?: string | null;
    fecha_inicio: string;
    fecha_fin: string | null;
    estado: 'ACTIVO' | 'INACTIVO';
};

type HistorialContrato = {
    id: number;
    tipo_contrato: string;
    tipo_contrato_otro: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
};

interface Paso3Props {
    colaborador: ColaboradorRecord;
    catalogos: WizardCatalogos;
    historialCargos: HistorialCargo[];
    onBack: () => void;
    redirectTo?: string;
    historialContratos?: HistorialContrato[];
    esReingreso?: boolean;
}

export function Paso3InformacionPuesto({
    colaborador,
    catalogos,
    historialCargos,
    onBack,
    redirectTo,
    historialContratos = [],
    esReingreso = false,
}: Paso3Props) {
    const contratoPrincipal = historialContratos[0] ?? null;
    const cargoInicial = (colaborador.cargo as string) ?? '';
    const areaInicial = (colaborador.area as Paso3FormData['area']) ?? 'Operativa';
    const estadoInicial = Boolean(colaborador.is_active);

    // Si viene desde contratos con redirect_to, activar el checkbox por defecto.
    const [esNuevoContrato, setEsNuevoContrato] = useState(redirectTo === 'contratos' || esReingreso);
    const [estadoActivo, setEstadoActivo] = useState(estadoInicial);
    const cambioEstado = estadoActivo !== estadoInicial;

    const [nuevoFechaInicio, setNuevoFechaInicio] = useState('');
    const [nuevoFechaFin, setNuevoFechaFin] = useState('');
    const [nuevoTipoContrato, setNuevoTipoContrato] = useState('');
    const [nuevoTipoContratoOtro, setNuevoTipoContratoOtro] = useState('');
    const [nuevoPerfil, setNuevoPerfil] = useState('');
    // nuevoArea and nuevoCargo are handled by existing area/cargo fields; no separate inputs needed

    const [deseaCambioCargoArea, setDeseaCambioCargoArea] = useState(false);

    // Estados editables para el historial (campos editables o eliminables)
    const [contratosEditables, setContratosEditables] = useState<HistorialContrato[]>(historialContratos.slice(1));
    const [cargosEditables, setCargosEditables] = useState<HistorialCargo[]>(historialCargos);

    const { data, setData, post, processing, errors, transform } = useForm<Paso3FormData>({
        is_active: estadoInicial,
        area: areaInicial,
        cargo: cargoInicial,
        perfil: '',
        guardar_historial_cargo: 'no',
        cargo_fecha_inicio: '',

        sena_especialidad: (colaborador.sena_especialidad as string) ?? '',
        sena_numero_grupo: colaborador.sena_numero_grupo?.toString() ?? '',
        sena_institucion: (colaborador.sena_institucion as string) ?? '',
        sena_nit: (colaborador.sena_nit as string) ?? '',
        sena_centro_formacion: (colaborador.sena_centro_formacion as string) ?? '',
        documento_sena_carta_presentacion: [],

        centro: (colaborador.centro as string) ?? '',
        centro_trabajo: (colaborador.centro_trabajo as string) ?? '',
        fecha_ingreso_empresa: contratoPrincipal?.fecha_inicio ?? (colaborador.fecha_ingreso_empresa as string) ?? '',
        fecha_retiro_empresa: contratoPrincipal?.fecha_fin ?? (colaborador.fecha_retiro_empresa as string) ?? '',
        motivo_retiro: (colaborador.motivo_retiro as string) ?? '',
        motivo_retiro_observaciones: (colaborador.motivo_retiro_observaciones as string) ?? '',
        tipo_contrato: (colaborador.tipo_contrato as string) ?? '',
        tipo_contrato_otro: (colaborador.tipo_contrato_otro as string) ?? '',

        codigo_qr_skap: (colaborador.codigo_qr_skap as string) ?? '',

        vacaciones_aplica: (colaborador.vacaciones_aplica as Paso3FormData['vacaciones_aplica']) ?? '',
        vacaciones_fecha_desde: (colaborador.vacaciones_fecha_desde as string) ?? '',
        vacaciones_fecha_hasta: (colaborador.vacaciones_fecha_hasta as string) ?? '',
        vacaciones_pagadas_fecha_desde: (colaborador.vacaciones_pagadas_fecha_desde as string) ?? '',
        vacaciones_pagadas_fecha_hasta: (colaborador.vacaciones_pagadas_fecha_hasta as string) ?? '',
    });

    const setContratoField = (id: number, field: keyof HistorialContrato, value: string) => {
        setContratosEditables((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

        if (id === contratoPrincipal?.id && field === 'fecha_inicio') {
            setData('fecha_ingreso_empresa', value);
        } else if (id === contratoPrincipal?.id && field === 'fecha_fin') {
            setData('fecha_retiro_empresa', value);
        }
    };

    const setCargoField = (id: number, field: keyof HistorialCargo, value: string) => {
        setCargosEditables((prev) => {
            const updated = prev.map((c) => (c.id === id ? { ...c, [field]: value } : c));
            const activo = updated.find((c) => c.estado === 'ACTIVO') ?? updated[updated.length - 1];
            if (activo && id === activo.id) {
                if (field === 'cargo') setData('cargo', value);
                if (field === 'area') setData('area', value as Paso3FormData['area']);
            }
            return updated;
        });
    };

    const setFechaContratoPrincipal = (field: 'fecha_inicio' | 'fecha_fin', value: string) => {
        if (contratoPrincipal) {
            setContratoField(contratoPrincipal.id, field, value);
            return;
        }

        setData(field === 'fecha_inicio' ? 'fecha_ingreso_empresa' : 'fecha_retiro_empresa', value);
    };

    const cargoActualParaSena = data.cargo ?? '';
    const esAprendizSena = cargoActualParaSena.toUpperCase().includes('APRENDIZ');
    const fechaRetiroColaborador = colaborador.fecha_retiro_empresa as string | null;
    const mostrarMotivoRetiro = Boolean(fechaRetiroColaborador && fechaRetiroColaborador <= hoyISO);

    const existing = (key: string) => (colaborador?.[key] as { path: string; fecha: string | null }[]) ?? [];

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => ({
            ...formData,
            _method: 'PATCH',
            redirect_to: redirectTo ?? '',
            es_nuevo_contrato: esNuevoContrato || cambioEstado ? '1' : '0',
            nuevo_fecha_inicio: esNuevoContrato || cambioEstado ? nuevoFechaInicio : '',
            nuevo_fecha_fin: esNuevoContrato || cambioEstado ? nuevoFechaFin : '',
            nuevo_tipo_contrato: esNuevoContrato || cambioEstado ? nuevoTipoContrato : '',
            nuevo_tipo_contrato_otro: esNuevoContrato || cambioEstado ? nuevoTipoContratoOtro : '',
            nuevo_area: esNuevoContrato || cambioEstado ? (formData.area ?? '') : '',
            nuevo_cargo: esNuevoContrato || cambioEstado ? (formData.cargo ?? '') : '',
            guardar_historial_cargo: deseaCambioCargoArea || esNuevoContrato || cambioEstado ? 'si' : 'no',
            cargo_fecha_inicio: deseaCambioCargoArea
                ? cambioEstado || !esNuevoContrato
                    ? formData.cargo_fecha_inicio
                    : nuevoFechaInicio
                : esNuevoContrato || cambioEstado
                  ? nuevoFechaInicio
                  : '',
            perfil: esNuevoContrato ? nuevoPerfil : (formData.perfil ?? ''),
            contratos_editados: JSON.stringify(contratosEditables),
            cargos_editados: JSON.stringify(cargosEditables),
        }));
        post(route('gente.colaboradores.paso3.update', colaborador.id), { forceFormData: true });
    };

    return (
        <form onSubmit={submit} className="grid gap-6">
            <SeccionCard
                icon={Power}
                titulo="Estado del colaborador"
                subtitulo="Los cambios de estado requieren registrar un nuevo contrato y cargo"
                tono="azul"
            >
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="is_active"
                        checked={estadoActivo}
                        onCheckedChange={(checked) => {
                            const activo = checked === true;
                            setEstadoActivo(activo);
                            setData('is_active', activo);
                            if (activo !== estadoInicial) {
                                setEsNuevoContrato(true);
                                setDeseaCambioCargoArea(true);
                                setData('guardar_historial_cargo', 'si');
                            }
                        }}
                        disabled={processing}
                    />
                    <div className="grid gap-1">
                        <Label htmlFor="is_active" className="cursor-pointer">
                            {estadoActivo ? 'Colaborador activo' : 'Colaborador inactivo'}
                        </Label>
                        {cambioEstado && (
                            <p className="text-muted-foreground text-sm">
                                Indique las fechas del nuevo contrato y la fecha efectiva del nuevo cargo.
                            </p>
                        )}
                    </div>
                </div>
            </SeccionCard>

            {/* 1. CENTRO: Centro de trabajo y ubicación */}
            <SeccionCard icon={Building2} titulo="Centro" subtitulo="Centro de trabajo y ubicación" tono="azul">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="centro">Centro</Label>
                        <Select value={data.centro} onValueChange={(value) => setData('centro', value)} disabled={processing}>
                            <SelectTrigger id="centro">
                                <SelectValue placeholder="Selecciona el centro" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.centros.map((centro) => (
                                    <SelectItem key={centro} value={centro}>
                                        {centro}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.centro} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="centro_trabajo">Centro de trabajo</Label>
                        <Select value={data.centro_trabajo} onValueChange={(value) => setData('centro_trabajo', value)} disabled={processing}>
                            <SelectTrigger id="centro_trabajo">
                                <SelectValue placeholder="Selecciona el centro de trabajo" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.centrosTrabajo.map((centro) => (
                                    <SelectItem key={centro} value={centro}>
                                        {centro}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.centro_trabajo} />
                    </div>
                </div>
            </SeccionCard>

            {/* 2. CONTRATO: Tipo de contrato, fechas y condiciones */}
            <SeccionCard icon={FileText} titulo="Contrato" subtitulo="Tipo de contrato, fechas y condiciones" tono="azul">
                <div className="space-y-4">
                    {/* Contrato 1 */}
                    <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                        <div className="flex items-center justify-between border-b pb-2 sm:col-span-2">
                            <span className="text-foreground text-xs font-bold">Contrato 1</span>
                            {contratosEditables.length > 0 && contratoPrincipal && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive h-7 gap-1 px-2 text-xs"
                                    title="Eliminar Contrato 1"
                                    onClick={() => {
                                        if (!confirm('¿Eliminar el Contrato 1 y sus prórrogas?')) return;
                                        router.delete(
                                            route('gente.contratos.historial.destroy', {
                                                colaborador: colaborador.id,
                                                contrato: contratoPrincipal.id,
                                            }),
                                            {
                                                preserveScroll: true,
                                            },
                                        );
                                    }}
                                    disabled={processing}
                                >
                                    <Trash2 className="size-3.5" />
                                    Eliminar
                                </Button>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="fecha_ingreso_empresa">Fecha inicio</Label>
                            <Input
                                id="fecha_ingreso_empresa"
                                type="date"
                                value={data.fecha_ingreso_empresa ?? ''}
                                onChange={(e) => setFechaContratoPrincipal('fecha_inicio', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.fecha_ingreso_empresa} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="fecha_retiro_empresa">Fecha finalización</Label>
                            <Input
                                id="fecha_retiro_empresa"
                                type="date"
                                value={data.fecha_retiro_empresa ?? ''}
                                onChange={(e) => setFechaContratoPrincipal('fecha_fin', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.fecha_retiro_empresa} />
                        </div>

                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="tipo_contrato">Tipo de contrato</Label>
                            <Select value={data.tipo_contrato} onValueChange={(value) => setData('tipo_contrato', value)} disabled={processing}>
                                <SelectTrigger id="tipo_contrato">
                                    <SelectValue placeholder="Selecciona el tipo de contrato" />
                                </SelectTrigger>
                                <SelectContent>
                                    {catalogos.tiposContrato.map((tipo) => (
                                        <SelectItem key={tipo} value={tipo}>
                                            {tipo}
                                        </SelectItem>
                                    ))}
                                    <SelectSeparator />
                                    <SelectItem value="Otro" className="font-medium text-sky-600">
                                        <span className="flex items-center gap-1.5">
                                            <Plus className="size-3.5" />
                                            Agregar otro…
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={errors.tipo_contrato} />
                            {data.tipo_contrato === 'Otro' && (
                                <div className="grid gap-1.5 border-l-2 border-sky-300 pl-3 dark:border-sky-500/30">
                                    <Input
                                        placeholder="Escribe el tipo de contrato"
                                        value={data.tipo_contrato_otro ?? ''}
                                        onChange={(e) => setData('tipo_contrato_otro', e.target.value)}
                                        disabled={processing}
                                    />
                                    <InputError message={errors.tipo_contrato_otro} />
                                </div>
                            )}
                        </div>

                        {mostrarMotivoRetiro && (
                            <>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="motivo_retiro">Motivo de retiro</Label>
                                    <Select
                                        value={data.motivo_retiro}
                                        onValueChange={(value) => setData('motivo_retiro', value)}
                                        disabled={processing}
                                    >
                                        <SelectTrigger id="motivo_retiro">
                                            <SelectValue placeholder="Selecciona el motivo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {catalogos.motivosRetiro.map((motivo) => (
                                                <SelectItem key={motivo} value={motivo}>
                                                    {motivo}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.motivo_retiro} />
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="motivo_retiro_observaciones">Observaciones</Label>
                                    <Textarea
                                        id="motivo_retiro_observaciones"
                                        value={data.motivo_retiro_observaciones ?? ''}
                                        onChange={(e) => setData('motivo_retiro_observaciones', e.target.value)}
                                        placeholder="Observaciones sobre el motivo de retiro..."
                                        disabled={processing}
                                        rows={3}
                                    />
                                    <InputError message={errors.motivo_retiro_observaciones} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Historial de contratos posteriores (Contrato 2, 3...) */}
                    {contratosEditables.length > 0 && (
                        <div className="space-y-4">
                            {contratosEditables.map((c, i) => (
                                <div key={c.id} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                                    <div className="flex items-center justify-between border-b pb-2 sm:col-span-2">
                                        <span className="text-foreground text-xs font-bold">Contrato {i + 2}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-destructive h-7 gap-1 px-2 text-xs"
                                            title={`Eliminar Contrato ${i + 2}`}
                                            onClick={() => {
                                                if (!confirm(`¿Eliminar el registro de Contrato ${i + 2}?`)) return;
                                                setContratosEditables((prev) => prev.filter((item) => item.id !== c.id));
                                                router.delete(
                                                    route('gente.contratos.historial.destroy', { colaborador: colaborador.id, contrato: c.id }),
                                                    {
                                                        preserveScroll: true,
                                                    },
                                                );
                                            }}
                                            disabled={processing}
                                        >
                                            <Trash2 className="size-3.5" />
                                            Eliminar
                                        </Button>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Fecha inicio</Label>
                                        <Input
                                            type="date"
                                            value={c.fecha_inicio ?? ''}
                                            onChange={(e) => setContratoField(c.id, 'fecha_inicio', e.target.value)}
                                            disabled={processing}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Fecha finalización</Label>
                                        <Input
                                            type="date"
                                            value={c.fecha_fin ?? ''}
                                            onChange={(e) => setContratoField(c.id, 'fecha_fin', e.target.value)}
                                            disabled={processing}
                                        />
                                    </div>
                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label>Tipo de contrato</Label>
                                        <Select
                                            value={c.tipo_contrato}
                                            onValueChange={(v) => setContratoField(c.id, 'tipo_contrato', v)}
                                            disabled={processing}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona el tipo de contrato" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {catalogos.tiposContrato.map((tipo) => (
                                                    <SelectItem key={tipo} value={tipo}>
                                                        {tipo}
                                                    </SelectItem>
                                                ))}
                                                <SelectSeparator />
                                                <SelectItem value="Otro" className="font-medium text-sky-600">
                                                    <span className="flex items-center gap-1.5">
                                                        <Plus className="size-3.5" />
                                                        Agregar otro…
                                                    </span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {c.tipo_contrato === 'Otro' && (
                                            <div className="grid gap-1.5 border-l-2 border-sky-300 pl-3 dark:border-sky-500/30">
                                                <Input
                                                    placeholder="Escribe el tipo de contrato"
                                                    value={c.tipo_contrato_otro ?? ''}
                                                    onChange={(e) => setContratoField(c.id, 'tipo_contrato_otro', e.target.value)}
                                                    disabled={processing}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Checkbox agregar nuevo contrato */}
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2 sm:col-span-2 dark:border-amber-700/40 dark:bg-amber-950/10">
                        <Checkbox
                            id="es_nuevo_contrato"
                            checked={esNuevoContrato}
                            onCheckedChange={(checked) => {
                                setEsNuevoContrato(checked === true);
                            }}
                            disabled={processing || esReingreso || cambioEstado}
                        />
                        <Label htmlFor="es_nuevo_contrato" className="cursor-pointer text-sm font-medium text-amber-800 dark:text-amber-300">
                            {esReingreso
                                ? 'Registrar nuevo contrato por reingreso'
                                : cambioEstado
                                  ? 'Registrar nuevo contrato (obligatorio al cambiar el estado)'
                                  : 'Agregar nuevo contrato'}
                        </Label>
                    </div>

                    {/* Campos del nuevo contrato (con Área y Cargo propios del nuevo contrato) */}
                    {esNuevoContrato && (
                        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/20 p-4 sm:col-span-2 dark:border-amber-800/30 dark:bg-amber-950/10">
                            <p className="text-xs font-semibold tracking-wider text-amber-900 uppercase dark:text-amber-200">
                                Datos del nuevo contrato
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="nuevo_fecha_inicio">Fecha inicio</Label>
                                    <Input
                                        id="nuevo_fecha_inicio"
                                        type="date"
                                        value={nuevoFechaInicio ?? ''}
                                        onChange={(e) => setNuevoFechaInicio(e.target.value)}
                                        disabled={processing}
                                    />
                                    <InputError message={errors.nuevo_fecha_inicio} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="nuevo_fecha_fin">Fecha finalización</Label>
                                    <Input
                                        id="nuevo_fecha_fin"
                                        type="date"
                                        value={nuevoFechaFin ?? ''}
                                        onChange={(e) => setNuevoFechaFin(e.target.value)}
                                        disabled={processing}
                                    />
                                    <InputError message={errors.nuevo_fecha_fin} />
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label>Tipo de contrato (nuevo)</Label>
                                    <Select value={nuevoTipoContrato} onValueChange={setNuevoTipoContrato} disabled={processing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona el tipo de contrato" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {catalogos.tiposContrato.map((tipo) => (
                                                <SelectItem key={tipo} value={tipo}>
                                                    {tipo}
                                                </SelectItem>
                                            ))}
                                            <SelectSeparator />
                                            <SelectItem value="Otro" className="font-medium text-sky-600">
                                                <span className="flex items-center gap-1.5">
                                                    <Plus className="size-3.5" />
                                                    Agregar otro…
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.nuevo_tipo_contrato} />
                                    {nuevoTipoContrato === 'Otro' && (
                                        <div className="grid gap-1.5 border-l-2 border-sky-300 pl-3 dark:border-sky-500/30">
                                            <Input
                                                placeholder="Escribe el tipo de contrato"
                                                value={nuevoTipoContratoOtro ?? ''}
                                                onChange={(e) => setNuevoTipoContratoOtro(e.target.value)}
                                                disabled={processing}
                                            />
                                            <InputError message={errors.nuevo_tipo_contrato_otro} />
                                        </div>
                                    )}
                                </div>

                                {/* Cargo del nuevo contrato */}
                                <div className="grid gap-2">
                                    <Label htmlFor="nuevo_contrato_cargo">Cargo</Label>
                                    <CargoCombobox
                                        id="nuevo_contrato_cargo"
                                        value={data.cargo ?? ''}
                                        onChange={(value) => {
                                            setData('cargo', value);
                                            // Precargar perfil si hay coincidencia y el campo está vacío
                                            if (catalogos.perfilesCargos[value] && !nuevoPerfil) {
                                                setNuevoPerfil(catalogos.perfilesCargos[value]);
                                            }
                                        }}
                                        cargos={catalogos.cargos}
                                        disabled={processing}
                                    />
                                    <InputError message={errors.cargo} />
                                </div>

                                {/* Área del nuevo contrato */}
                                <div className="grid gap-2">
                                    <Label htmlFor="nuevo_contrato_area">Área o dependencia</Label>
                                    <Select
                                        value={data.area}
                                        onValueChange={(value) => setData('area', value as Paso3FormData['area'])}
                                        disabled={processing}
                                    >
                                        <SelectTrigger id="nuevo_contrato_area">
                                            <SelectValue placeholder="Selecciona el área" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Administrativa">Administrativa</SelectItem>
                                            <SelectItem value="Operativa">Operativa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.area} />
                                </div>

                                {/* Perfil / Funciones del cargo del nuevo contrato */}
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label>Perfil / Funciones del cargo</Label>
                                    <Select
                                        value={Object.entries(catalogos.perfilesCargos).find(([, v]) => v === nuevoPerfil)?.[0] ?? ''}
                                        onValueChange={(nombre) => setNuevoPerfil(catalogos.perfilesCargos[nombre] ?? '')}
                                        disabled={processing}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona un perfil..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(catalogos.perfilesCargos).map((nombre) => (
                                                <SelectItem key={nombre} value={nombre}>
                                                    {nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {nuevoPerfil && (
                                        <div className="relative">
                                            <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 pr-8 text-xs leading-relaxed whitespace-pre-line">
                                                {nuevoPerfil}
                                            </p>
                                            <button
                                                type="button"
                                                className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 rounded p-0.5"
                                                title="Quitar perfil"
                                                onClick={() => setNuevoPerfil('')}
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </SeccionCard>

            {/* 3. CARGO Y ÁREA: Debajo de las tarjetas Centro y Contrato */}
            <SeccionCard icon={Briefcase} titulo="Cargo y Área" subtitulo="Área, dependencia, cargo y cambio de asignación" tono="verde">
                <div className="grid gap-4">
                    {/* Campos editables de los cargos registrados */}
                    {cargosEditables.length > 0 ? (
                        <div className="space-y-4">
                            {cargosEditables.map((c, i) => (
                                <div key={c.id} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                                    <div className="flex items-center justify-between border-b pb-2 sm:col-span-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-foreground text-xs font-bold">Cargo {i + 1}</span>
                                            <span
                                                className={
                                                    c.estado === 'ACTIVO'
                                                        ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                        : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold'
                                                }
                                            >
                                                {c.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                        {cargosEditables.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-destructive h-7 gap-1 px-2 text-xs"
                                                title={`Eliminar Cargo ${i + 1}`}
                                                onClick={() => {
                                                    if (!confirm(`¿Eliminar el registro de Cargo ${i + 1} ("${c.cargo}")?`)) return;
                                                    setCargosEditables((prev) => prev.filter((item) => item.id !== c.id));
                                                    router.delete(
                                                        route('gente.colaboradores.cargos.destroy', { colaborador: colaborador.id, cargo: c.id }),
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    );
                                                }}
                                                disabled={processing}
                                            >
                                                <Trash2 className="size-3.5" />
                                                Eliminar
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Fecha inicio</Label>
                                        <Input
                                            type="date"
                                            value={c.fecha_inicio ? c.fecha_inicio.slice(0, 10) : ''}
                                            onChange={(e) => setCargoField(c.id, 'fecha_inicio', e.target.value)}
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Fecha finalización</Label>
                                        <Input
                                            type="date"
                                            value={c.fecha_fin ? c.fecha_fin.slice(0, 10) : ''}
                                            onChange={(e) => setCargoField(c.id, 'fecha_fin', e.target.value)}
                                            disabled={processing}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Cargo</Label>
                                        <CargoCombobox
                                            id={`cargo_hist_${c.id}`}
                                            value={c.cargo}
                                            onChange={(value) => {
                                                setCargoField(c.id, 'cargo', value);
                                                // Precargar perfil si hay coincidencia
                                                if (catalogos.perfilesCargos[value] && !c.perfil) {
                                                    setCargoField(c.id, 'perfil', catalogos.perfilesCargos[value]);
                                                }
                                            }}
                                            cargos={catalogos.cargos}
                                            disabled={processing}
                                        />
                                        {catalogos.perfilesCargos[c.cargo] && (
                                            <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-line">
                                                {catalogos.perfilesCargos[c.cargo]}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Área o dependencia</Label>
                                        <Select
                                            value={c.area ?? 'Operativa'}
                                            onValueChange={(value) => setCargoField(c.id, 'area', value)}
                                            disabled={processing}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona el área" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Administrativa">Administrativa</SelectItem>
                                                <SelectItem value="Operativa">Operativa</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label>Perfil / Funciones del cargo</Label>
                                        <Select
                                            value={Object.entries(catalogos.perfilesCargos).find(([, v]) => v === c.perfil)?.[0] ?? ''}
                                            onValueChange={(nombre) => {
                                                setCargoField(c.id, 'perfil', catalogos.perfilesCargos[nombre] ?? '');
                                            }}
                                            disabled={processing}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un perfil..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(catalogos.perfilesCargos).map((nombre) => (
                                                    <SelectItem key={nombre} value={nombre}>
                                                        {nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {c.perfil && (
                                            <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-line">
                                                {c.perfil}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Si no hay registros de historial de cargos aún, mostrar card con el mismo estilo */
                        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                            <div className="border-b pb-2 sm:col-span-2">
                                <span className="text-foreground text-xs font-bold">Cargo 1</span>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cargo">Cargo</Label>
                                <CargoCombobox
                                    id="cargo"
                                    value={data.cargo ?? ''}
                                    onChange={(value) => setData('cargo', value)}
                                    cargos={catalogos.cargos}
                                    disabled={processing}
                                />
                                {catalogos.perfilesCargos[data.cargo ?? ''] && (
                                    <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-line">
                                        {catalogos.perfilesCargos[data.cargo ?? '']}
                                    </p>
                                )}
                                <InputError message={errors.cargo} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="area">Área o dependencia</Label>
                                <Select
                                    value={data.area}
                                    onValueChange={(value) => setData('area', value as Paso3FormData['area'])}
                                    disabled={processing}
                                >
                                    <SelectTrigger id="area">
                                        <SelectValue placeholder="Selecciona el área" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Administrativa">Administrativa</SelectItem>
                                        <SelectItem value="Operativa">Operativa</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.area} />
                            </div>
                        </div>
                    )}

                    {/* Checkbox para cambio de cargo y/o área */}
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-3 dark:border-emerald-700/40 dark:bg-emerald-950/10">
                        <Checkbox
                            id="desea_cambio_cargo_area"
                            checked={deseaCambioCargoArea}
                            onCheckedChange={(checked) => {
                                const isChecked = checked === true;
                                setDeseaCambioCargoArea(isChecked);
                                if (!isChecked) {
                                    setData((prev) => ({
                                        ...prev,
                                        cargo_fecha_inicio: '',
                                        guardar_historial_cargo: 'no',
                                    }));
                                } else {
                                    setData((prev) => ({
                                        ...prev,
                                        guardar_historial_cargo: 'si',
                                    }));
                                }
                            }}
                            disabled={processing || cambioEstado}
                        />
                        <div>
                            <Label
                                htmlFor="desea_cambio_cargo_area"
                                className="cursor-pointer text-sm font-semibold text-emerald-900 dark:text-emerald-200"
                            >
                                ¿Desea realizar un cambio de cargo y/o área?
                            </Label>
                            <p className="text-muted-foreground text-xs">
                                {cambioEstado
                                    ? 'Obligatorio al cambiar el estado: registra una nueva asignación en el historial.'
                                    : 'Registra una nueva asignación en el historial conservando los datos anteriores.'}
                            </p>
                        </div>
                    </div>

                    {/* Si está activo el check, mostrar los campos para el nuevo cargo y su fecha efectiva */}
                    {deseaCambioCargoArea && (
                        <div className="grid gap-4 border-l-2 border-emerald-400 pl-3 sm:grid-cols-2 dark:border-emerald-500/40">
                            {!esNuevoContrato && (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="nueva_area_cambio">Nueva área o dependencia</Label>
                                        <Select
                                            value={data.area}
                                            onValueChange={(value) => setData('area', value as Paso3FormData['area'])}
                                            disabled={processing}
                                        >
                                            <SelectTrigger id="nueva_area_cambio">
                                                <SelectValue placeholder="Selecciona el área" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Administrativa">Administrativa</SelectItem>
                                                <SelectItem value="Operativa">Operativa</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.area} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="nuevo_cargo_cambio">Nuevo cargo</Label>
                                        <CargoCombobox
                                            id="nuevo_cargo_cambio"
                                            value={data.cargo ?? ''}
                                            onChange={(value) => {
                                                setData('cargo', value);
                                                // Precargar perfil si hay coincidencia
                                                if (catalogos.perfilesCargos[value] && !data.perfil) {
                                                    setData('perfil', catalogos.perfilesCargos[value]);
                                                }
                                            }}
                                            cargos={catalogos.cargos}
                                            disabled={processing}
                                        />
                                        {catalogos.perfilesCargos[data.cargo ?? ''] && (
                                            <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-line">
                                                {catalogos.perfilesCargos[data.cargo ?? '']}
                                            </p>
                                        )}
                                        <InputError message={errors.cargo} />
                                    </div>

                                    {/* Perfil del cambio de cargo */}
                                    <div className="grid gap-2">
                                        <Label>Perfil / Funciones del cargo</Label>
                                        <Select
                                            value={Object.entries(catalogos.perfilesCargos).find(([, v]) => v === data.perfil)?.[0] ?? ''}
                                            onValueChange={(nombre) => setData('perfil', catalogos.perfilesCargos[nombre] ?? '')}
                                            disabled={processing}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un perfil..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(catalogos.perfilesCargos).map((nombre) => (
                                                    <SelectItem key={nombre} value={nombre}>
                                                        {nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {data.perfil && (
                                            <div className="relative">
                                                <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 pr-8 text-xs leading-relaxed whitespace-pre-line">
                                                    {data.perfil}
                                                </p>
                                                <button
                                                    type="button"
                                                    className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 rounded p-0.5"
                                                    title="Quitar perfil"
                                                    onClick={() => setData('perfil', '')}
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {!esNuevoContrato || cambioEstado ? (
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="cargo_fecha_inicio">Fecha efectiva del cambio</Label>
                                    <Input
                                        id="cargo_fecha_inicio"
                                        type="date"
                                        value={data.cargo_fecha_inicio ?? ''}
                                        onChange={(e) => setData('cargo_fecha_inicio', e.target.value)}
                                        disabled={processing}
                                    />
                                    <InputError message={errors.cargo_fecha_inicio} />
                                    <p className="text-muted-foreground text-xs">
                                        La fecha del cambio es independiente de la fecha de inicio del contrato. El cargo anterior se cerrará un día
                                        antes de esta fecha.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-lg bg-emerald-50/50 p-2 text-xs text-emerald-800 sm:col-span-2 dark:bg-emerald-950/20 dark:text-emerald-300">
                                    Se aplicará el nuevo cargo y área con la fecha de inicio del nuevo contrato (
                                    {nuevoFechaInicio || 'indicada en la tarjeta Contrato'}). No se requiere fecha adicional.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SeccionCard>

            {/* 4. INFORMACIÓN APRENDIZ SENA */}
            {esAprendizSena && (
                <SeccionCard
                    icon={GraduationCap}
                    titulo="Información aprendiz SENA"
                    subtitulo="Solo visible porque el cargo asignado es Aprendiz"
                    tono="verde"
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="sena_especialidad">Especialidad o programa de formación</Label>
                            <Input
                                id="sena_especialidad"
                                value={data.sena_especialidad ?? ''}
                                onChange={(e) => setData('sena_especialidad', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.sena_especialidad} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sena_numero_grupo">Número de grupo</Label>
                            <Input
                                id="sena_numero_grupo"
                                type="number"
                                value={data.sena_numero_grupo ?? ''}
                                onChange={(e) => setData('sena_numero_grupo', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.sena_numero_grupo} />
                        </div>
                        <ExternalSelect
                            label="Institución de formación"
                            value={data.sena_institucion ?? ''}
                            onValueChange={(value) => setData('sena_institucion', value)}
                            fetchUrl={route('gente.colaboradores.referencias.instituciones-sena')}
                            error={errors.sena_institucion}
                            disabled={processing}
                        />
                        <div className="grid gap-2">
                            <Label htmlFor="sena_nit">NIT</Label>
                            <Input
                                id="sena_nit"
                                value={data.sena_nit ?? ''}
                                onChange={(e) => setData('sena_nit', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.sena_nit} />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="sena_centro_formacion">Centro de formación</Label>
                            <Input
                                id="sena_centro_formacion"
                                value={data.sena_centro_formacion ?? ''}
                                onChange={(e) => setData('sena_centro_formacion', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.sena_centro_formacion} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <SimpleFileField
                            label="Carta de presentación"
                            files={data.documento_sena_carta_presentacion}
                            existing={existing('documento_sena_carta_presentacion')}
                            onChange={(files) => setData('documento_sena_carta_presentacion', files)}
                            error={errorDeArchivo(errors, 'documento_sena_carta_presentacion')}
                            disabled={processing}
                        />
                    </div>
                </SeccionCard>
            )}

            {/* 5. CÓDIGO QR SKAP */}
            <SeccionCard icon={QrCode} titulo="Código QR SKAP" tono="verde">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="grid w-full max-w-xs gap-2">
                        <Label htmlFor="codigo_qr_skap">Número de código</Label>
                        <Input
                            id="codigo_qr_skap"
                            value={data.codigo_qr_skap ?? ''}
                            onChange={(e) => setData('codigo_qr_skap', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.codigo_qr_skap} />
                    </div>
                    <div className="border-border bg-card flex flex-col items-center gap-2 rounded-xl border p-3">
                        {data.codigo_qr_skap ? (
                            <QRCodeSVG value={data.codigo_qr_skap} size={100} />
                        ) : (
                            <div className="text-muted-foreground flex size-[100px] items-center justify-center text-center text-xs">Sin código</div>
                        )}
                    </div>
                </div>
            </SeccionCard>

            {/* 6. VACACIONES */}
            <SeccionCard icon={Umbrella} titulo="Vacaciones" tono="azul">
                <div className="grid gap-4">
                    <PillToggle
                        label="Vacaciones"
                        value={data.vacaciones_aplica}
                        onChange={(value) => setData('vacaciones_aplica', value)}
                        disabled={processing}
                        options={[
                            { value: 'no_aplica', label: 'No aplica' },
                            { value: 'aplica', label: 'Aplica' },
                        ]}
                    />
                    {data.vacaciones_aplica === 'aplica' && (
                        <div className="grid gap-4 border-l-2 border-emerald-300 pl-4 sm:grid-cols-2 dark:border-emerald-500/30">
                            <div className="grid gap-2">
                                <Label htmlFor="vacaciones_fecha_desde">Fecha desde</Label>
                                <Input
                                    id="vacaciones_fecha_desde"
                                    type="date"
                                    min={minDateFor(colaborador.vacaciones_fecha_desde)}
                                    value={data.vacaciones_fecha_desde ?? ''}
                                    onChange={(e) => setData('vacaciones_fecha_desde', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.vacaciones_fecha_desde} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="vacaciones_fecha_hasta">Fecha hasta</Label>
                                <Input
                                    id="vacaciones_fecha_hasta"
                                    type="date"
                                    min={minDateFor(colaborador.vacaciones_fecha_hasta)}
                                    value={data.vacaciones_fecha_hasta ?? ''}
                                    onChange={(e) => setData('vacaciones_fecha_hasta', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.vacaciones_fecha_hasta} />
                            </div>
                        </div>
                    )}
                    <div className="border-border grid gap-2 border-t pt-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="vacaciones_pagadas_fecha_desde">Vacaciones pagadas — desde</Label>
                            <Input
                                id="vacaciones_pagadas_fecha_desde"
                                type="date"
                                min={minDateFor(colaborador.vacaciones_pagadas_fecha_desde)}
                                value={data.vacaciones_pagadas_fecha_desde ?? ''}
                                onChange={(e) => setData('vacaciones_pagadas_fecha_desde', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.vacaciones_pagadas_fecha_desde} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="vacaciones_pagadas_fecha_hasta">Vacaciones pagadas — hasta</Label>
                            <Input
                                id="vacaciones_pagadas_fecha_hasta"
                                type="date"
                                min={minDateFor(colaborador.vacaciones_pagadas_fecha_hasta)}
                                value={data.vacaciones_pagadas_fecha_hasta ?? ''}
                                onChange={(e) => setData('vacaciones_pagadas_fecha_hasta', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.vacaciones_pagadas_fecha_hasta} />
                        </div>
                    </div>
                </div>
            </SeccionCard>

            <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
                    <ArrowLeft className="size-4" />
                    Anterior
                </Button>
                <Button type="submit" disabled={processing}>
                    {processing && <LoaderCircle className="size-4 animate-spin" />}
                    {esReingreso ? 'Confirmar reingreso' : 'Siguiente'}
                    <ArrowRight className="size-4" />
                </Button>
            </div>
        </form>
    );
}
