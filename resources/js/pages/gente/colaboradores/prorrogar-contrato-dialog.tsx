import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { AlertCircle, CalendarPlus, CheckCircle2, FileDown, History, PlusCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface ContratoItemDialog {
    id: number;
    tipo_contrato?: string | null;
    tipo_contrato_otro?: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado?: string | null;
    cantidad_prorrogas?: number;
    es_aprendiz?: boolean;
}

export interface ProrrogaItemDialog {
    id: number;
    contrato_id?: number | null;
    fecha_anterior?: string | null;
    fecha_inicio?: string | null;
    fecha_nueva?: string | null;
    tipo?: string | null;
}

interface Props {
    colaboradorId: number;
    nombreCompleto: string;
    fechaActual: string | null;
    cantidadProrrogas?: number;
    esAprendiz?: boolean;
    trigger?: React.ReactNode;
    contratos?: ContratoItemDialog[];
    prorrogas?: ProrrogaItemDialog[];
    catalogoTiposContrato?: string[];
}

const OPCIONES_RAPIDAS = [
    { label: '1 mes', meses: 1 },
    { label: '2 meses', meses: 2 },
    { label: '3 meses', meses: 3 },
    { label: '1 año', meses: 12 },
];
const MAX_PRORROGAS_INICIALES = 3;

function fechaEnFormatoISO(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
    const resultado = new Date(`${fecha}T00:00:00Z`);
    resultado.setUTCDate(resultado.getUTCDate() + dias);

    return fechaEnFormatoISO(resultado);
}

function diasEntre(fechaInicial: string, fechaFinal: string): number {
    const milisegundosPorDia = 24 * 60 * 60 * 1000;

    return (Date.parse(`${fechaFinal}T00:00:00Z`) - Date.parse(`${fechaInicial}T00:00:00Z`)) / milisegundosPorDia;
}

function fechaHoyLocal(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function sumarMeses(fechaBase: string | null, meses: number): string {
    const base = new Date(`${fechaBase ?? fechaHoyLocal()}T00:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + meses);

    return fechaEnFormatoISO(base);
}

function formatearFechaVisual(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    return fecha.split('-').reverse().join('/');
}

export function ProrrogarContratoDialog({
    colaboradorId,
    nombreCompleto,
    fechaActual,
    cantidadProrrogas = 0,
    esAprendiz = false,
    trigger,
    contratos = [],
    prorrogas = [],
    catalogoTiposContrato = ['Término Fijo', 'Indefinido', 'Obra o Labor', 'Aprendizaje SENA'],
}: Props) {
    const [open, setOpen] = useState(false);
    const [modoPersonalizado, setModoPersonalizado] = useState(false);
    const [seleccionManualForzada, setSeleccionManualForzada] = useState(false);
    const [crearNuevoContrato, setCrearNuevoContrato] = useState(false);

    // Mapeo del fin efectivo de cada contrato (tomando su última prórroga o su fecha_fin)
    const contratosConSecuencia = useMemo(() => {
        return contratos.map((c, index) => {
            const prorrogasDeEste = prorrogas
                .filter((p) => p.contrato_id === c.id && p.tipo === 'prorroga')
                .sort((a, b) => {
                    const fa = a.fecha_nueva ?? '';
                    const fb = b.fecha_nueva ?? '';
                    return fb.localeCompare(fa);
                });

            const ultimaProrroga = prorrogasDeEste[0];
            const fechaFinSecuencia = ultimaProrroga?.fecha_nueva ?? c.fecha_fin;
            const proximaFechaInicio = fechaFinSecuencia ? sumarDias(fechaFinSecuencia, 1) : '';

            return {
                ...c,
                numero: index + 1,
                fecha_fin_secuencia: fechaFinSecuencia,
                proxima_fecha_inicio: proximaFechaInicio,
                cantidad_prorrogas_calculada: prorrogasDeEste.length,
            };
        });
    }, [contratos, prorrogas]);

    // Contrato más reciente o activo
    const contratoMasReciente = useMemo(() => {
        return contratosConSecuencia.find((c) => c.estado === 'activo') ?? contratosConSecuencia[0] ?? null;
    }, [contratosConSecuencia]);

    const fechaInicioPredeterminada = contratoMasReciente?.proxima_fecha_inicio || (fechaActual ? sumarDias(fechaActual, 1) : '');

    const { data, setData, patch, processing, errors, reset } = useForm({
        fecha_inicio_prorroga: fechaInicioPredeterminada,
        fecha_retiro_empresa: '',
        contrato_id: (contratoMasReciente?.id ?? null) as number | null,
        crear_nuevo_contrato: false,
        nuevo_contrato_tipo: 'Término Fijo',
        nuevo_contrato_inicio: '',
        nuevo_contrato_fin: '',
    });

    // Detectar si la fecha de inicio actual continúa exactamente alguna secuencia contractual
    const contratoContinuidadDetectado = useMemo(() => {
        if (!data.fecha_inicio_prorroga) return null;
        return contratosConSecuencia.find((c) => c.proxima_fecha_inicio === data.fecha_inicio_prorroga) ?? null;
    }, [contratosConSecuencia, data.fecha_inicio_prorroga]);

    // El contrato asignado actual
    const contratoSeleccionado = useMemo(() => {
        if (crearNuevoContrato) return null;
        return contratosConSecuencia.find((c) => c.id === data.contrato_id) ?? null;
    }, [contratosConSecuencia, data.contrato_id, crearNuevoContrato]);

    const esAprendizEfectivo = contratoSeleccionado?.es_aprendiz ?? esAprendiz;
    const cantidadProrrogasEfectiva = contratoSeleccionado ? contratoSeleccionado.cantidad_prorrogas_calculada : cantidadProrrogas;
    const numeroProximaProrroga = cantidadProrrogasEfectiva + 1;
    const esProrrogaAnual = !esAprendizEfectivo && numeroProximaProrroga > MAX_PRORROGAS_INICIALES;

    const fechaFinBaseActual = contratoSeleccionado?.fecha_fin_secuencia ?? fechaActual;

    const calcularFechaFinAnual = (fechaInicio: string): string => sumarDias(sumarMeses(fechaInicio, 12), -1);

    const calcularFechaFinOpcion = (meses: number): string => {
        const fechaFinBase = sumarMeses(fechaFinBaseActual, meses);
        const fechaInicioBase = fechaFinBaseActual ? sumarDias(fechaFinBaseActual, 1) : '';
        const desplazamiento = fechaInicioBase && data.fecha_inicio_prorroga ? diasEntre(fechaInicioBase, data.fecha_inicio_prorroga) : 0;

        return sumarDias(fechaFinBase, desplazamiento);
    };

    // Resetear al abrir el modal
    useEffect(() => {
        if (open) {
            const inicio = fechaInicioPredeterminada;
            const inicialContratoId = contratoMasReciente?.id ?? null;
            const finPredeterminada = esProrrogaAnual && inicio ? calcularFechaFinAnual(inicio) : '';

            setData({
                fecha_inicio_prorroga: inicio,
                fecha_retiro_empresa: finPredeterminada,
                contrato_id: inicialContratoId,
                crear_nuevo_contrato: false,
                nuevo_contrato_tipo: 'Término Fijo',
                nuevo_contrato_inicio: '',
                nuevo_contrato_fin: '',
            });
            setModoPersonalizado(false);
            setSeleccionManualForzada(false);
            setCrearNuevoContrato(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Reaccionar a cambios en fecha_inicio_prorroga:
    const cambiarFechaInicio = (nuevaFechaInicio: string) => {
        const continuidad = contratosConSecuencia.find((c) => c.proxima_fecha_inicio === nuevaFechaInicio);

        // Si no se había forzado selección manual:
        let nuevoContratoId = data.contrato_id;
        let esCreacion = crearNuevoContrato;

        if (!seleccionManualForzada) {
            if (continuidad) {
                nuevoContratoId = continuidad.id;
                esCreacion = false;
            } else if (contratosConSecuencia.length > 0) {
                // Fechas no continuas o anteriores: si hay contratos pero no coinciden exactamente,
                // no se reasigna a ciegas al más reciente si no continúa su secuencia
                const coincideConActual = contratoMasReciente?.proxima_fecha_inicio === nuevaFechaInicio;
                if (!coincideConActual) {
                    // Mantener selección manual visible para confirmación del usuario
                }
            }
        }

        if (esProrrogaAnual) {
            setModoPersonalizado(false);
            setData({
                ...data,
                fecha_inicio_prorroga: nuevaFechaInicio,
                fecha_retiro_empresa: nuevaFechaInicio ? calcularFechaFinAnual(nuevaFechaInicio) : '',
                contrato_id: nuevoContratoId,
                crear_nuevo_contrato: esCreacion,
            });
            return;
        }

        const desplazamiento = data.fecha_inicio_prorroga && nuevaFechaInicio ? diasEntre(data.fecha_inicio_prorroga, nuevaFechaInicio) : 0;

        setData({
            ...data,
            fecha_inicio_prorroga: nuevaFechaInicio,
            fecha_retiro_empresa: data.fecha_retiro_empresa ? sumarDias(data.fecha_retiro_empresa, desplazamiento) : '',
            contrato_id: nuevoContratoId,
            crear_nuevo_contrato: esCreacion,
        });
    };

    const seleccionarOpcion = (meses: number) => {
        setModoPersonalizado(false);
        setData({
            ...data,
            fecha_retiro_empresa: calcularFechaFinOpcion(meses),
        });
    };

    const handleSelectContrato = (valor: string) => {
        setSeleccionManualForzada(true);
        if (valor === '__nuevo_contrato__') {
            setCrearNuevoContrato(true);
            setData({
                ...data,
                crear_nuevo_contrato: true,
                contrato_id: null,
                nuevo_contrato_inicio: data.fecha_inicio_prorroga,
                nuevo_contrato_fin: data.fecha_inicio_prorroga ? sumarDias(data.fecha_inicio_prorroga, -1) : '',
            });
        } else {
            setCrearNuevoContrato(false);
            const idNum = parseInt(valor, 10);
            setData({
                ...data,
                crear_nuevo_contrato: false,
                contrato_id: idNum,
            });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('gente.colaboradores.prorrogar-contrato', colaboradorId), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    const hayContinuidad = Boolean(contratoContinuidadDetectado && !crearNuevoContrato && data.contrato_id === contratoContinuidadDetectado.id);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm">
                        <CalendarPlus className="mr-1.5 h-4 w-4" />
                        Prorrogar
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="h-5 w-5 text-amber-600" />
                        Prorrogar contrato
                    </DialogTitle>
                    <DialogDescription className="space-y-1">
                        <span className="text-foreground font-semibold">{nombreCompleto}</span>
                        <span className="text-muted-foreground block text-xs">
                            {esAprendizEfectivo
                                ? `Prórroga ${numeroProximaProrroga} (Aprendiz)`
                                : esProrrogaAnual
                                ? `Prórroga anual ${numeroProximaProrroga - MAX_PRORROGAS_INICIALES}`
                                : `Prórroga ${numeroProximaProrroga} de ${MAX_PRORROGAS_INICIALES}`}
                        </span>
                        {fechaFinBaseActual && (
                            <span className="text-muted-foreground block text-xs">
                                Fecha de vencimiento anterior de la secuencia: <strong className="text-foreground">{formatearFechaVisual(fechaFinBaseActual)}</strong>
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-1">
                    {/* 1. Fechas de la prórroga */}
                    <div className="space-y-2">
                        <Label htmlFor="fecha_inicio_prorroga" className="text-sm font-medium">
                            Fecha de inicio de la prórroga
                        </Label>
                        <Input
                            id="fecha_inicio_prorroga"
                            type="date"
                            required
                            value={data.fecha_inicio_prorroga}
                            onChange={(e) => cambiarFechaInicio(e.target.value)}
                        />
                        <InputError message={errors.fecha_inicio_prorroga} />
                    </div>

                    {/* 2. Detección de continuidad vs Selección manual del contrato */}
                    <div className="rounded-lg border p-3 text-xs space-y-2 bg-muted/20">
                        {hayContinuidad && !seleccionManualForzada ? (
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="size-4 shrink-0" />
                                    <span>
                                        Secuencia continua: Se asociará a{' '}
                                        <strong>
                                            {contratoContinuidadDetectado ? `Contrato (Inicio ${formatearFechaVisual(contratoContinuidadDetectado.fecha_inicio)})` : 'Contrato activo'}
                                        </strong>
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                                    onClick={() => setSeleccionManualForzada(true)}
                                >
                                    Cambiar
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                                    <span>
                                        {contratoContinuidadDetectado
                                            ? 'Confirmar contrato al que pertenece esta prórroga:'
                                            : 'Las fechas no continúan automáticamente la secuencia del contrato más reciente. Selecciona a qué contrato pertenece esta prórroga o crea uno nuevo:'}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-medium">Contrato asignado</Label>
                                    <Select
                                        value={crearNuevoContrato ? '__nuevo_contrato__' : (data.contrato_id ? String(data.contrato_id) : '')}
                                        onValueChange={handleSelectContrato}
                                    >
                                        <SelectTrigger className="h-8 text-xs bg-background">
                                            <SelectValue placeholder="Selecciona un contrato" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {contratosConSecuencia.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    Contrato {c.numero} · {c.tipo_contrato || 'Sin tipo'} ({formatearFechaVisual(c.fecha_inicio)} — {formatearFechaVisual(c.fecha_fin_secuencia)}) {c.estado === 'activo' ? '· Activo' : '· Histórico'}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="__nuevo_contrato__" className="text-cyan-700 dark:text-cyan-400 font-medium">
                                                + Crear nuevo contrato histórico
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {crearNuevoContrato && (
                                    <div className="rounded-md border border-cyan-200 bg-cyan-50/50 p-2.5 dark:border-cyan-900 dark:bg-cyan-950/20 space-y-2 mt-2">
                                        <div className="flex items-center gap-1.5 font-semibold text-cyan-800 dark:text-cyan-300">
                                            <PlusCircle className="size-3.5" />
                                            <span>Nuevo contrato histórico</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label className="text-[10px]">Tipo de contrato</Label>
                                                <Select
                                                    value={data.nuevo_contrato_tipo}
                                                    onValueChange={(val) => setData('nuevo_contrato_tipo', val)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {catalogoTiposContrato.map((t) => (
                                                            <SelectItem key={t} value={t}>
                                                                {t}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-[10px]">Fecha inicio contrato</Label>
                                                <Input
                                                    type="date"
                                                    className="h-7 text-xs bg-background"
                                                    value={data.nuevo_contrato_inicio}
                                                    onChange={(e) => setData('nuevo_contrato_inicio', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {esProrrogaAnual ? (
                        <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
                            Después de las tres primeras prórrogas, el contrato se extiende por un año. La fecha final se ajusta al cambiar el inicio.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Extender por</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {OPCIONES_RAPIDAS.map((op) => {
                                    const fechaResultante = calcularFechaFinOpcion(op.meses);
                                    const activa = !modoPersonalizado && data.fecha_retiro_empresa === fechaResultante;
                                    return (
                                        <button
                                            key={op.meses}
                                            type="button"
                                            onClick={() => seleccionarOpcion(op.meses)}
                                            className={`focus-visible:ring-ring rounded-md border px-2 py-2 text-center text-sm transition-colors focus:outline-none focus-visible:ring-2 ${
                                                activa
                                                    ? 'border-amber-500 bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                                    : 'border-input bg-background hover:bg-muted'
                                            }`}
                                        >
                                            {op.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Fecha personalizada */}
                    {!esProrrogaAnual && (
                        <div className="space-y-2">
                            <Label htmlFor="fecha_personalizada" className="text-sm font-medium">
                                O elige una fecha específica de finalización
                            </Label>
                            <Input
                                id="fecha_personalizada"
                                type="date"
                                value={modoPersonalizado ? data.fecha_retiro_empresa : ''}
                                onChange={(e) => {
                                    setModoPersonalizado(true);
                                    setData({
                                        ...data,
                                        fecha_retiro_empresa: e.target.value,
                                    });
                                }}
                            />
                            <InputError message={errors.fecha_retiro_empresa} />
                        </div>
                    )}
                    {esProrrogaAnual && (
                        <div className="space-y-2">
                            <Label htmlFor="fecha_fin_anual" className="text-sm font-medium">
                                Fecha de finalización anual
                            </Label>
                            <Input id="fecha_fin_anual" type="date" value={data.fecha_retiro_empresa} readOnly />
                            <InputError message={errors.fecha_retiro_empresa} />
                        </div>
                    )}

                    {data.fecha_inicio_prorroga && data.fecha_retiro_empresa && (
                        <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
                            Vigencia de la prórroga:{' '}
                            <span className="text-foreground font-semibold">{formatearFechaVisual(data.fecha_inicio_prorroga)}</span>
                            {' al '}
                            <span className="text-foreground font-semibold">{formatearFechaVisual(data.fecha_retiro_empresa)}</span>
                        </p>
                    )}

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={processing}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        {data.fecha_retiro_empresa && (
                            <Button type="button" variant="outline" asChild>
                                <a
                                    href={`/modules/gente/contratos/${colaboradorId}/prorroga-pdf?fecha=${data.fecha_retiro_empresa}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileDown className="mr-1.5 h-4 w-4" />
                                    Descargar carta PDF
                                </a>
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={processing || !data.fecha_retiro_empresa}
                            className="bg-amber-600 text-white hover:bg-amber-700"
                        >
                            {processing ? 'Guardando…' : 'Confirmar prórroga'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
