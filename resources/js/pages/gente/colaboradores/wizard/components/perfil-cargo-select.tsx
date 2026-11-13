import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface PerfilCargoSelectProps {
    id: string;
    value: string;
    perfilesCargos: Record<string, string>;
    onChange: (nombre: string, observaciones: string) => void;
    disabled?: boolean;
}

export function PerfilCargoSelect({ id, value, perfilesCargos, onChange, disabled = false }: PerfilCargoSelectProps) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        nombre: '',
        observaciones: '',
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        const perfilCreado = {
            nombre: data.nombre.trim(),
            observaciones: data.observaciones.trim(),
        };

        post(route('gente.perfiles-cargos.store'), {
            preserveScroll: true,
            onSuccess: () => {
                onChange(perfilCreado.nombre, perfilCreado.observaciones);
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <>
            <div className="flex items-center gap-2">
                <Select value={value} onValueChange={(nombre) => onChange(nombre, perfilesCargos[nombre] ?? '')} disabled={disabled}>
                    <SelectTrigger id={id} className="min-w-0 flex-1">
                        <SelectValue placeholder="Selecciona un perfil..." />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.keys(perfilesCargos).map((nombre) => (
                            <SelectItem key={nombre} value={nombre}>
                                {nombre}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" title="Agregar perfil" disabled={disabled} onClick={() => setOpen(true)}>
                    <Plus className="size-4" />
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Agregar perfil de cargo</DialogTitle>
                        <DialogDescription>Guarda el nombre del perfil y las observaciones que aparecerán al seleccionarlo.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor={`${id}_nombre`}>Nombre del perfil</Label>
                            <Input
                                id={`${id}_nombre`}
                                value={data.nombre}
                                onChange={(event) => setData('nombre', event.target.value)}
                                maxLength={150}
                                disabled={processing}
                                required
                            />
                            <InputError message={errors.nombre} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`${id}_observaciones`}>Observaciones / funciones</Label>
                            <Textarea
                                id={`${id}_observaciones`}
                                value={data.observaciones}
                                onChange={(event) => setData('observaciones', event.target.value)}
                                maxLength={5000}
                                rows={5}
                                disabled={processing}
                                required
                            />
                            <InputError message={errors.observaciones} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={processing} onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={processing || !data.nombre.trim() || !data.observaciones.trim()}>
                                {processing ? 'Guardando...' : 'Guardar perfil'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
