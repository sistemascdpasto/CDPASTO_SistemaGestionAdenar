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
import { Textarea } from '@/components/ui/textarea';
import { router } from '@inertiajs/react';
import { LoaderCircle, XCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

/** Tipos base de finalización que siempre están disponibles */
const TIPOS_BASE = [
    'Finalización de contrato anticipado',
    'Renuncia por parte del trabajador',
    'Vencimiento de término',
    'Mutuo acuerdo',
    'Justa causa',
];

interface Props {
    colaboradorId: number;
    /** Fecha de la última prórroga o del contrato actual (YYYY-MM-DD) */
    fechaUltima: string | null;
    trigger?: React.ReactNode;
}

export function FinalizarContratoDialog({ colaboradorId, fechaUltima, trigger }: Props) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [tiposDisponibles, setTiposDisponibles] = useState<string[]>(TIPOS_BASE);
    const [nuevoTipo, setNuevoTipo] = useState('');
    const [mostrarInputNuevo, setMostrarInputNuevo] = useState(false);

    const [fechaRetiro, setFechaRetiro] = useState('');
    const [tipoFinalizacion, setTipoFinalizacion] = useState('');
    const [observaciones, setObservaciones] = useState('');

    // Al abrir: precarga la fecha y limpia el formulario
    useEffect(() => {
        if (open) {
            setFechaRetiro(fechaUltima ?? '');
            setTipoFinalizacion('');
            setObservaciones('');
            setNuevoTipo('');
            setMostrarInputNuevo(false);
        }
    }, [open, fechaUltima]);

    const handleAgregarTipo = () => {
        const valor = nuevoTipo.trim();
        if (!valor) return;
        if (!tiposDisponibles.includes(valor)) {
            setTiposDisponibles((prev) => [...prev, valor]);
        }
        setTipoFinalizacion(valor);
        setNuevoTipo('');
        setMostrarInputNuevo(false);
    };

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!tipoFinalizacion || !fechaRetiro) return;

        const obsText = tipoFinalizacion + (observaciones ? ': ' + observaciones : '');

        setProcessing(true);
        router.patch(
            route('gente.colaboradores.prorrogar-contrato', colaboradorId),
            {
                fecha_retiro_empresa: fechaRetiro,
                tipo: 'finalizacion',
                observaciones: obsText,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOpen(false);
                    setProcessing(false);
                },
                onError: () => {
                    setProcessing(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!processing) setOpen(v); }}>
            {trigger ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                    >
                        <XCircle className="size-4" />
                        Confirmar finalización
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <XCircle className="size-4 text-red-600" />
                        Finalizar contrato
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Registra la fecha y el tipo de finalización. El colaborador quedará desactivado automáticamente.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">

                    {/* Fecha de finalización */}
                    <div className="grid gap-2">
                        <Label htmlFor="finalizar_fecha">Fecha de finalización</Label>
                        <Input
                            id="finalizar_fecha"
                            type="date"
                            value={fechaRetiro}
                            onChange={(e) => setFechaRetiro(e.target.value)}
                            disabled={processing}
                        />
                    </div>

                    {/* Tipo de finalización */}
                    <div className="grid gap-2">
                        <Label htmlFor="finalizar_tipo">Tipo de finalización</Label>
                        <Select
                            value={tipoFinalizacion}
                            onValueChange={(v) => {
                                if (v === '__nuevo__') {
                                    setMostrarInputNuevo(true);
                                } else {
                                    setMostrarInputNuevo(false);
                                    setTipoFinalizacion(v);
                                }
                            }}
                            disabled={processing}
                        >
                            <SelectTrigger id="finalizar_tipo">
                                <SelectValue placeholder="Selecciona o agrega un tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {tiposDisponibles.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t}
                                    </SelectItem>
                                ))}
                                <SelectItem
                                    value="__nuevo__"
                                    className="font-medium text-emerald-700 dark:text-emerald-400"
                                >
                                    + Agregar nuevo tipo...
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Input inline para agregar tipo nuevo */}
                        {mostrarInputNuevo && (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nombre del nuevo tipo..."
                                    value={nuevoTipo}
                                    onChange={(e) => setNuevoTipo(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAgregarTipo();
                                        }
                                    }}
                                    disabled={processing}
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAgregarTipo}
                                    disabled={!nuevoTipo.trim() || processing}
                                >
                                    Agregar
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Observaciones */}
                    <div className="grid gap-2">
                        <Label htmlFor="finalizar_obs">
                            Observaciones{' '}
                            <span className="text-muted-foreground font-normal">(opcional)</span>
                        </Label>
                        <Textarea
                            id="finalizar_obs"
                            rows={2}
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            disabled={processing}
                            placeholder="Describe el motivo de la finalización..."
                            className="resize-none"
                        />
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" size="sm" disabled={processing}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                            disabled={processing || !tipoFinalizacion || !fechaRetiro}
                        >
                            {processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                            Confirmar finalización
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
