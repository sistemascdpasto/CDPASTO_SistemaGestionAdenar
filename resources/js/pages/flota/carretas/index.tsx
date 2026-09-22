import HeadingSmall from '@/components/heading-small';
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
import { Plus, Power, Search } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Carretas', href: '/modules/flota/carretas' },
];

interface CarretaRow {
    id: number;
    placa: string;
    tipo: string | null;
    is_active: boolean;
    novedad_no_disponible: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface CarretasPaginator {
    data: CarretaRow[];
    links: PaginationLink[];
}

export default function CarretasIndex({ carretas, filters }: { carretas: CarretasPaginator; filters: { search: string } }) {
    const { auth } = usePage<SharedData>().props;
    // Eliminar carretas es exclusivo de Administrador; Flota conserva el
    // resto de acciones (crear, editar, marcar disponibilidad).
    const puedeEliminar = auth.isAdmin;

    const [search, setSearch] = useState(filters.search);
    const debouncedSearch = useDebouncedValue(search);
    const isFirstRender = useRef(true);

    const [carretaNoDisponible, setCarretaNoDisponible] = useState<CarretaRow | null>(null);
    const [novedad, setNovedad] = useState('');
    const [novedadError, setNovedadError] = useState<string | null>(null);
    const [enviandoNovedad, setEnviandoNovedad] = useState(false);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        router.get(route('flota.carretas.index'), { search: debouncedSearch }, { preserveState: true, replace: true });
    }, [debouncedSearch]);

    const submitFilters: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(route('flota.carretas.index'), { search }, { preserveState: true, replace: true });
    };

    const destroyCarreta = (carreta: CarretaRow) => {
        router.delete(route('flota.carretas.destroy', carreta.id), { preserveScroll: true });
    };

    const toggleActivo = (carreta: CarretaRow) => {
        if (carreta.is_active) {
            // Va a quedar no disponible: primero se digita la novedad.
            setCarretaNoDisponible(carreta);
            setNovedad('');
            setNovedadError(null);
            return;
        }

        router.patch(route('flota.carretas.toggle-activo', carreta.id), {}, { preserveScroll: true });
    };

    const confirmarNoDisponible = () => {
        if (!carretaNoDisponible) return;
        if (novedad.trim() === '') {
            setNovedadError('Escribe la novedad por la que la carreta no está disponible.');
            return;
        }

        setEnviandoNovedad(true);
        router.patch(
            route('flota.carretas.toggle-activo', carretaNoDisponible.id),
            { novedad },
            {
                preserveScroll: true,
                onError: (errs) => setNovedadError((errs as Record<string, string>).novedad ?? 'No se pudo guardar la novedad.'),
                onSuccess: () => setCarretaNoDisponible(null),
                onFinish: () => setEnviandoNovedad(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Carretas" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall title="Carretas" description="Registro de carretas y su disponibilidad." />
                    <Button asChild>
                        <Link href={route('flota.carretas.create')}>
                            <Plus className="size-4" />
                            Nueva carreta
                        </Link>
                    </Button>
                </div>

                <form onSubmit={submitFilters} className="flex max-w-sm items-center gap-2">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa o tipo..." />
                    <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
                        <Search className="size-4" />
                    </Button>
                </form>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Placa</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {carretas.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                        No se encontraron carretas.
                                    </TableCell>
                                </TableRow>
                            )}
                            {carretas.data.map((carreta) => (
                                <TableRow key={carreta.id}>
                                    <TableCell className="font-medium">{carreta.placa}</TableCell>
                                    <TableCell>{carreta.tipo ?? '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={carreta.is_active ? 'default' : 'destructive'}>
                                            {carreta.is_active ? 'Disponible' : 'No disponible'}
                                        </Badge>
                                        {!carreta.is_active && carreta.novedad_no_disponible && (
                                            <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground" title={carreta.novedad_no_disponible}>
                                                {carreta.novedad_no_disponible}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={route('flota.carretas.edit', carreta.id)}>Editar</Link>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => toggleActivo(carreta)}
                                                aria-label={carreta.is_active ? 'Marcar como no disponible' : 'Marcar como disponible'}
                                                title={carreta.is_active ? 'Marcar como no disponible' : 'Marcar como disponible'}
                                                className={carreta.is_active ? 'text-emerald-600' : 'text-muted-foreground'}
                                            >
                                                <Power className="size-4" />
                                            </Button>
                                            {puedeEliminar && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="destructive" size="sm">
                                                            Eliminar
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogTitle>¿Eliminar la carreta {carreta.placa}?</DialogTitle>
                                                        <DialogDescription>Esta acción elimina la carreta de forma lógica.</DialogDescription>
                                                        <DialogFooter>
                                                            <DialogClose asChild>
                                                                <Button variant="secondary">Cancelar</Button>
                                                            </DialogClose>
                                                            <Button variant="destructive" onClick={() => destroyCarreta(carreta)}>
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

                {carretas.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {carretas.links.map((link, index) => (
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

            <Dialog open={carretaNoDisponible !== null} onOpenChange={(open) => !open && setCarretaNoDisponible(null)}>
                <DialogContent>
                    <DialogTitle>Marcar {carretaNoDisponible?.placa} como no disponible</DialogTitle>
                    <DialogDescription>Escribe la novedad por la que la carreta queda fuera de servicio.</DialogDescription>
                    <div className="grid gap-1.5 py-2">
                        <Label htmlFor="novedad">Novedad</Label>
                        <Textarea
                            id="novedad"
                            value={novedad}
                            onChange={(e) => {
                                setNovedad(e.target.value);
                                setNovedadError(null);
                            }}
                            placeholder="Ej: Falla en el sistema de frenos, pendiente de repuesto."
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
