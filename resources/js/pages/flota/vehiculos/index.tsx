import HeadingSmall from '@/components/heading-small';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Power, Search, Truck } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Documentación', href: '/modules/flota/vehiculos' },
];

type Centro = 'UD' | 'UC';

interface VehiculoRow {
    id: number;
    placa: string;
    truck_type: string | null;
    modelo: string | null;
    capacidad_pallets: number | null;
    capacidad_carga_kg: number | null;
    imagen: string | null;
    is_active: boolean;
    novedad_no_disponible: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface VehiculosPaginator {
    data: VehiculoRow[];
    links: PaginationLink[];
}

export default function VehiculosIndex({
    vehiculos,
    filters,
}: {
    vehiculos: VehiculosPaginator;
    filters: { search: string; centro: Centro };
}) {
    const { auth } = usePage<SharedData>().props;
    const { flash } = usePage<{ flash?: { error?: string } }>().props;
    const puedeEliminar = auth.isAdmin;

    const [search, setSearch] = useState(filters.search);
    const debouncedSearch = useDebouncedValue(search);
    const isFirstRender = useRef(true);

    const [vehiculoNoDisponible, setVehiculoNoDisponible] = useState<VehiculoRow | null>(null);
    const [novedad, setNovedad] = useState('');
    const [novedadError, setNovedadError] = useState<string | null>(null);
    const [enviandoNovedad, setEnviandoNovedad] = useState(false);

    const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

    // Propagar el error flash del backend al estado local del diálogo
    useEffect(() => {
        if (flash?.error) setErrorEliminar(flash.error);
    }, [flash?.error]);

    const centro = filters.centro ?? 'UD';

    const switchCentro = (c: Centro) => {
        router.get(route('flota.vehiculos.index'), { search, centro: c }, { preserveState: true, replace: true });
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        router.get(route('flota.vehiculos.index'), { search: debouncedSearch, centro }, { preserveState: true, replace: true });
    }, [debouncedSearch]);

    const submitFilters: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(route('flota.vehiculos.index'), { search, centro }, { preserveState: true, replace: true });
    };

    const destroyVehiculo = (vehiculo: VehiculoRow) => {
        setErrorEliminar(null);
        router.delete(route('flota.vehiculos.destroy', vehiculo.id), {
            preserveScroll: true,
            onError: (errs) => {
                const msg = (errs as Record<string, string>).error ?? 'No se pudo eliminar el vehículo.';
                setErrorEliminar(msg);
            },
        });
    };

    const toggleActivo = (vehiculo: VehiculoRow) => {
        if (vehiculo.is_active) {
            setVehiculoNoDisponible(vehiculo);
            setNovedad('');
            setNovedadError(null);
            return;
        }
        router.patch(route('flota.vehiculos.toggle-activo', vehiculo.id), {}, { preserveScroll: true });
    };

    const confirmarNoDisponible = () => {
        if (!vehiculoNoDisponible) return;
        if (novedad.trim() === '') {
            setNovedadError('Escribe la novedad por la que el vehículo no está disponible.');
            return;
        }

        setEnviandoNovedad(true);
        router.patch(
            route('flota.vehiculos.toggle-activo', vehiculoNoDisponible.id),
            { novedad },
            {
                preserveScroll: true,
                onError: (errs) => setNovedadError((errs as Record<string, string>).novedad ?? 'No se pudo guardar la novedad.'),
                onSuccess: () => setVehiculoNoDisponible(null),
                onFinish: () => setEnviandoNovedad(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Documentación de Flota" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall title="Documentación de Flota" description="Ficha documental de cada camión: foto, datos y documentos habilitantes." />
                    <Button asChild>
                        <Link href={route('flota.vehiculos.create')}>
                            <Plus className="size-4" />
                            Nuevo vehículo
                        </Link>
                    </Button>
                </div>

                {/* Selector de centro */}
                <div className="flex items-center gap-1 self-start rounded-lg border border-sidebar-border/70 bg-muted p-1 dark:border-sidebar-border">
                    {(['UD', 'UC'] as Centro[]).map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => switchCentro(c)}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                                centro === c
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <form onSubmit={submitFilters} className="flex max-w-sm items-center gap-2">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa, tipo o modelo..." />
                    <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
                        <Search className="size-4" />
                    </Button>
                </form>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vehículo</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Modelo</TableHead>
                                <TableHead>Capacidad pallets</TableHead>
                                <TableHead>Capacidad carga</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vehiculos.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                                        No se encontraron vehículos.
                                    </TableCell>
                                </TableRow>
                            )}
                            {vehiculos.data.map((vehiculo) => (
                                <TableRow key={vehiculo.id}>
                                    <TableCell>
                                        {vehiculo.imagen ? (
                                            <SafeImage
                                                src={`/storage/${vehiculo.imagen}`}
                                                alt={vehiculo.placa}
                                                className="h-10 w-14 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                <Truck className="size-4" />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link href={route('flota.vehiculos.show', vehiculo.id)} className="hover:underline">
                                            {vehiculo.placa}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{vehiculo.truck_type ?? '—'}</TableCell>
                                    <TableCell>{vehiculo.modelo ?? '—'}</TableCell>
                                    <TableCell>{vehiculo.capacidad_pallets ?? '—'}</TableCell>
                                    <TableCell>{vehiculo.capacidad_carga_kg ? `${vehiculo.capacidad_carga_kg.toLocaleString()} Kg` : '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={vehiculo.is_active ? 'default' : 'destructive'}>
                                            {vehiculo.is_active ? 'Disponible' : 'No disponible'}
                                        </Badge>
                                        {!vehiculo.is_active && vehiculo.novedad_no_disponible && (
                                            <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground" title={vehiculo.novedad_no_disponible}>
                                                {vehiculo.novedad_no_disponible}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={route('flota.vehiculos.show', vehiculo.id)}>Ver</Link>
                                            </Button>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={route('flota.vehiculos.edit', vehiculo.id)}>Editar</Link>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => toggleActivo(vehiculo)}
                                                aria-label={vehiculo.is_active ? 'Marcar como no disponible' : 'Marcar como disponible'}
                                                title={vehiculo.is_active ? 'Marcar como no disponible' : 'Marcar como disponible'}
                                                className={vehiculo.is_active ? 'text-emerald-600' : 'text-muted-foreground'}
                                            >
                                                <Power className="size-4" />
                                            </Button>
                                            {puedeEliminar && (
                                                <Dialog onOpenChange={() => setErrorEliminar(null)}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="destructive" size="sm">
                                                            Eliminar
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogTitle>¿Eliminar el vehículo {vehiculo.placa}?</DialogTitle>
                                                        <DialogDescription>
                                                            Esta acción elimina el vehículo permanentemente de la base de datos. Solo es posible si no tiene registros asociados en el sistema.
                                                        </DialogDescription>
                                                        {errorEliminar && (
                                                            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                                                                {errorEliminar}
                                                            </p>
                                                        )}
                                                        <DialogFooter>
                                                            <DialogClose asChild>
                                                                <Button variant="secondary">Cancelar</Button>
                                                            </DialogClose>
                                                            <Button variant="destructive" onClick={() => destroyVehiculo(vehiculo)}>
                                                                Eliminar
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {vehiculos.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {vehiculos.links.map((link, index) => (
                            <Button key={index} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={!!link.url}>
                                {link.url ? (
                                    <Link href={link.url} preserveScroll dangerouslySetInnerHTML={{ __html: link.label }} />
                                ) : (
                                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={vehiculoNoDisponible !== null} onOpenChange={(open) => !open && setVehiculoNoDisponible(null)}>
                <DialogContent>
                    <DialogTitle>Marcar {vehiculoNoDisponible?.placa} como no disponible</DialogTitle>
                    <DialogDescription>Escribe la novedad por la que el vehículo queda fuera de servicio.</DialogDescription>
                    <div className="grid gap-1.5 py-2">
                        <Label htmlFor="novedad">Novedad</Label>
                        <Textarea
                            id="novedad"
                            value={novedad}
                            onChange={(e) => {
                                setNovedad(e.target.value);
                                setNovedadError(null);
                            }}
                            placeholder="Ej: Falla mecánica en el motor, pendiente de repuesto."
                            className="min-h-24"
                        />
                        {novedadError && <p className="text-[11px] text-red-500">{novedadError}</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={confirmarNoDisponible} disabled={enviandoNovedad}>
                            Marcar como no disponible
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
