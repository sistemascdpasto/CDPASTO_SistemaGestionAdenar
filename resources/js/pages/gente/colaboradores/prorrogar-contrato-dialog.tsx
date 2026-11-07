import InputError from '@/components/input-error';
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
import { useForm } from '@inertiajs/react';
import { CalendarPlus, FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    colaboradorId: number;
    nombreCompleto: string;
    fechaActual: string | null;
    cantidadProrrogas: number;
    esAprendiz?: boolean;
    trigger?: React.ReactNode;
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

function fechaInicioPredeterminada(fechaActual: string | null): string {
    return fechaActual ? sumarDias(fechaActual, 1) : '';
}

function fechaFinAnualPredeterminada(fechaActual: string | null): string {
    const fechaInicio = fechaInicioPredeterminada(fechaActual);

    return fechaInicio ? sumarDias(sumarMeses(fechaInicio, 12), -1) : '';
}

export function ProrrogarContratoDialog({ colaboradorId, nombreCompleto, fechaActual, cantidadProrrogas, esAprendiz = false, trigger }: Props) {
    const [open, setOpen] = useState(false);
    const [modoPersonalizado, setModoPersonalizado] = useState(false);
    const numeroProximaProrroga = cantidadProrrogas + 1;
    const esProrrogaAnual = !esAprendiz && numeroProximaProrroga > MAX_PRORROGAS_INICIALES;

    const { data, setData, patch, processing, errors, reset } = useForm({
        fecha_inicio_prorroga: fechaInicioPredeterminada(fechaActual),
        fecha_retiro_empresa: esProrrogaAnual ? fechaFinAnualPredeterminada(fechaActual) : '',
    });

    // Al abrir el dialog resetear al estado inicial
    useEffect(() => {
        if (open) {
            setData({
                fecha_inicio_prorroga: fechaInicioPredeterminada(fechaActual),
                fecha_retiro_empresa: esProrrogaAnual ? fechaFinAnualPredeterminada(fechaActual) : '',
            });
            setModoPersonalizado(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const calcularFechaFinOpcion = (meses: number): string => {
        const fechaFinBase = sumarMeses(fechaActual, meses);
        const fechaInicioBase = fechaInicioPredeterminada(fechaActual);
        const desplazamiento = fechaInicioBase && data.fecha_inicio_prorroga ? diasEntre(fechaInicioBase, data.fecha_inicio_prorroga) : 0;

        return sumarDias(fechaFinBase, desplazamiento);
    };

    const calcularFechaFinAnual = (fechaInicio: string): string => sumarDias(sumarMeses(fechaInicio, 12), -1);

    const seleccionarOpcion = (meses: number) => {
        setModoPersonalizado(false);
        setData({
            ...data,
            fecha_retiro_empresa: calcularFechaFinOpcion(meses),
        });
    };

    const cambiarFechaInicio = (fechaInicio: string) => {
        if (esProrrogaAnual) {
            setModoPersonalizado(false);
            setData({
                ...data,
                fecha_inicio_prorroga: fechaInicio,
                fecha_retiro_empresa: fechaInicio ? calcularFechaFinAnual(fechaInicio) : '',
            });

            return;
        }

        const desplazamiento = data.fecha_inicio_prorroga && fechaInicio ? diasEntre(data.fecha_inicio_prorroga, fechaInicio) : 0;

        setData({
            ...data,
            fecha_inicio_prorroga: fechaInicio,
            fecha_retiro_empresa: data.fecha_retiro_empresa ? sumarDias(data.fecha_retiro_empresa, desplazamiento) : '',
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('gente.colaboradores.prorrogar-contrato', colaboradorId), {
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

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

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="h-5 w-5 text-amber-600" />
                        Prorrogar contrato
                    </DialogTitle>
                    <DialogDescription>
                        <span className="text-foreground font-medium">{nombreCompleto}</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                            {esAprendiz
                                ? `Prórroga ${numeroProximaProrroga} del contrato de aprendiz`
                                : esProrrogaAnual
                                ? `Prórroga anual ${numeroProximaProrroga - MAX_PRORROGAS_INICIALES}`
                                : `Prórroga ${numeroProximaProrroga} de ${MAX_PRORROGAS_INICIALES}`}
                        </span>
                        {fechaActual && (
                            <span className="text-muted-foreground mt-0.5 block text-xs">
                                Fecha actual de finalización: {fechaActual.split('-').reverse().join('/')}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="fecha_inicio_prorroga" className="text-sm font-medium">
                            Fecha de inicio de la prórroga
                        </Label>
                        <Input
                            id="fecha_inicio_prorroga"
                            type="date"
                            min={fechaActual ? sumarDias(fechaActual, 1) : undefined}
                            required
                            value={data.fecha_inicio_prorroga}
                            onChange={(e) => cambiarFechaInicio(e.target.value)}
                        />
                        <InputError message={errors.fecha_inicio_prorroga} />
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
                                O elige una fecha específica
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
                            <span className="text-foreground font-semibold">{data.fecha_inicio_prorroga.split('-').reverse().join('/')}</span>
                            {' al '}
                            <span className="text-foreground font-semibold">{data.fecha_retiro_empresa.split('-').reverse().join('/')}</span>
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
