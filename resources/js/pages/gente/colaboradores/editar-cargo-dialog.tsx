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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { Briefcase, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect } from 'react';
import { PerfilCargoSelect } from './wizard/components/perfil-cargo-select';

const perfilesCargosVacios: Record<string, string> = {};

export interface CargoEditableItem {
    id: number;
    cargo: string;
    area?: string | null;
    perfil_nombre?: string | null;
    perfil?: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
}

interface EditarCargoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    colaboradorId: number;
    cargoItem: CargoEditableItem | null;
    perfilesCargos?: Record<string, string>;
}

export function EditarCargoDialog({
    open,
    onOpenChange,
    colaboradorId,
    cargoItem,
    perfilesCargos = perfilesCargosVacios,
}: EditarCargoDialogProps) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        cargo: '',
        area: '',
        perfil_nombre: '',
        perfil: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'ACTIVO',
    });

    useEffect(() => {
        if (cargoItem && open) {
            setData({
                cargo: cargoItem.cargo || '',
                area: cargoItem.area || 'Operativa',
                perfil_nombre:
                    cargoItem.perfil_nombre ||
                    (perfilesCargos[cargoItem.cargo] === cargoItem.perfil
                        ? cargoItem.cargo
                        : Object.entries(perfilesCargos).find(([, value]) => value === cargoItem.perfil)?.[0] ?? ''),
                perfil: cargoItem.perfil || '',
                fecha_inicio: cargoItem.fecha_inicio ? cargoItem.fecha_inicio.slice(0, 10) : '',
                fecha_fin: cargoItem.fecha_fin ? cargoItem.fecha_fin.slice(0, 10) : '',
                estado: cargoItem.estado || 'ACTIVO',
            });
        }
    }, [cargoItem, open, perfilesCargos, setData]);

    if (!cargoItem) return null;

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('gente.colaboradores.cargos.update', { colaborador: colaboradorId, cargo: cargoItem.id }), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                reset();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <Briefcase className="size-4 text-emerald-600" />
                        Editar registro de cargo
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Modifica los detalles del cargo histórico o activo asignado al colaborador.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="grid gap-2">
                        <Label htmlFor="editar_cargo_cargo">Cargo</Label>
                        <Input
                            id="editar_cargo_cargo"
                            value={data.cargo}
                            onChange={(e) => {
                                const val = e.target.value;
                                setData('cargo', val);
                                setData('perfil_nombre', perfilesCargos[val] ? val : '');
                                setData('perfil', perfilesCargos[val] ?? '');
                            }}
                            placeholder="Nombre del cargo"
                            disabled={processing}
                        />
                        <InputError message={errors.cargo} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="editar_cargo_area">Área</Label>
                        <Select value={data.area} onValueChange={(v) => setData('area', v)} disabled={processing}>
                            <SelectTrigger id="editar_cargo_area">
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
                        <Label htmlFor="editar_cargo_perfil">Perfil / Funciones del cargo</Label>
                        <PerfilCargoSelect
                            id="editar_cargo_perfil"
                            value={data.perfil_nombre}
                            perfilesCargos={perfilesCargos}
                            onChange={(nombre, observaciones) => {
                                setData('perfil_nombre', nombre);
                                setData('perfil', observaciones);
                            }}
                            disabled={processing}
                        />
                        {data.perfil && (
                            <p className="text-muted-foreground whitespace-pre-line rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed">
                                {data.perfil}
                            </p>
                        )}
                        <InputError message={errors.perfil} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="editar_cargo_fecha_inicio">Fecha inicio</Label>
                            <Input
                                id="editar_cargo_fecha_inicio"
                                type="date"
                                value={data.fecha_inicio}
                                onChange={(e) => setData('fecha_inicio', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.fecha_inicio} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editar_cargo_fecha_fin">Fecha fin</Label>
                            <Input
                                id="editar_cargo_fecha_fin"
                                type="date"
                                value={data.fecha_fin}
                                onChange={(e) => setData('fecha_fin', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.fecha_fin} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="editar_cargo_estado">Estado</Label>
                        <Select value={data.estado} onValueChange={(v) => setData('estado', v)} disabled={processing}>
                            <SelectTrigger id="editar_cargo_estado">
                                <SelectValue placeholder="Selecciona el estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                                <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.estado} />
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" size="sm" disabled={processing}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" size="sm" disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">
                            {processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
