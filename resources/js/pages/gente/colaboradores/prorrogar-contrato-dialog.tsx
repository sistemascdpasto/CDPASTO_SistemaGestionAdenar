import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { CalendarPlus, FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    colaboradorId: number;
    nombreCompleto: string;
    fechaActual: string | null;
    trigger?: React.ReactNode;
}

const OPCIONES_RAPIDAS = [
    { label: '1 mes', meses: 1 },
    { label: '2 meses', meses: 2 },
    { label: '3 meses', meses: 3 },
    { label: '1 año', meses: 12 },
];

function sumarMeses(fechaBase: string | null, meses: number): string {
    const base = fechaBase ? new Date(fechaBase + 'T00:00:00') : new Date();
    base.setMonth(base.getMonth() + meses);
    return base.toISOString().slice(0, 10);
}

export function ProrrogarContratoDialog({ colaboradorId, nombreCompleto, fechaActual, trigger }: Props) {
    const [open, setOpen] = useState(false);
    const [modoPersonalizado, setModoPersonalizado] = useState(false);

    const { data, setData, patch, processing, errors, reset } = useForm({
        fecha_retiro_empresa: '',
    });

    // Al abrir el dialog resetear al estado inicial
    useEffect(() => {
        if (open) {
            setData({ fecha_retiro_empresa: '' });
            setModoPersonalizado(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const seleccionarOpcion = (meses: number) => {
        setModoPersonalizado(false);
        setData('fecha_retiro_empresa', sumarMeses(fechaActual, meses));
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
                        <span className="font-medium text-foreground">{nombreCompleto}</span>
                        {fechaActual && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                                Fecha actual de finalización:{' '}
                                {fechaActual.split('-').reverse().join('/')}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Opciones rápidas */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Extender por</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {OPCIONES_RAPIDAS.map((op) => {
                                const fechaResultante = sumarMeses(fechaActual, op.meses);
                                const activa = !modoPersonalizado && data.fecha_retiro_empresa === fechaResultante;
                                return (
                                    <button
                                        key={op.meses}
                                        type="button"
                                        onClick={() => seleccionarOpcion(op.meses)}
                                        className={`rounded-md border px-2 py-2 text-center text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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

                    {/* Fecha personalizada */}
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
                                setData('fecha_retiro_empresa', e.target.value);
                            }}
                        />
                        <InputError message={errors.fecha_retiro_empresa} />
                    </div>

                    {/* Resumen de la nueva fecha */}
                    {data.fecha_retiro_empresa && (
                        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                            Nueva fecha de finalización:{' '}
                            <span className="font-semibold text-foreground">
                                {data.fecha_retiro_empresa.split('-').reverse().join('/')}
                            </span>
                        </p>
                    )}

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={processing}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        {data.fecha_retiro_empresa && (
                            <Button
                                type="button"
                                variant="outline"
                                asChild
                            >
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
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {processing ? 'Guardando…' : 'Confirmar prórroga'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
