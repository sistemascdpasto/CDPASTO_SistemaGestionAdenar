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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { History, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect } from 'react';

export interface ActivacionEditableItem {
    id: string | number;
    is_active: boolean;
    tipo: string;
    fecha: string | null;
    motivo: string | null;
    observaciones: string | null;
    usuario?: string | null;
}

interface EditarActivacionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    colaboradorId: number;
    activacionItem: ActivacionEditableItem | null;
}

export function EditarActivacionDialog({
    open,
    onOpenChange,
    colaboradorId,
    activacionItem,
}: EditarActivacionDialogProps) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        motivo: '',
        observaciones: '',
    });

    useEffect(() => {
        if (activacionItem && open) {
            setData({
                motivo: activacionItem.motivo ?? '',
                observaciones: activacionItem.observaciones ?? '',
            });
        }
    }, [activacionItem, open, setData]);

    if (!activacionItem) return null;

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(
            route('gente.contratos.activaciones.update', {
                colaborador: colaboradorId,
                activacion: activacionItem.id,
            }),
            {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            },
        );
    };

    const esFinalizacion = activacionItem.tipo === 'finalizacion_contrato';
    const etiqueta = esFinalizacion
        ? 'Finalización de contrato'
        : activacionItem.is_active
          ? 'Activación'
          : 'Desactivación';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <History className="size-4 text-emerald-600" />
                        Editar registro de activación
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Evento: <span className="font-medium">{etiqueta}</span>
                        {activacionItem.fecha && (
                            <> &mdash; {activacionItem.fecha}</>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="grid gap-2">
                        <Label htmlFor="editar_activacion_motivo">Motivo</Label>
                        <Input
                            id="editar_activacion_motivo"
                            value={data.motivo}
                            onChange={(e) => setData('motivo', e.target.value)}
                            placeholder="Motivo del evento"
                            maxLength={255}
                            disabled={processing}
                        />
                        <InputError message={errors.motivo} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="editar_activacion_observaciones">Observaciones</Label>
                        <Input
                            id="editar_activacion_observaciones"
                            value={data.observaciones}
                            onChange={(e) => setData('observaciones', e.target.value)}
                            placeholder="Observaciones adicionales"
                            maxLength={1000}
                            disabled={processing}
                        />
                        <InputError message={errors.observaciones} />
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
                            disabled={processing}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
