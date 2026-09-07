import { IconActionButton } from '@/components/icon-action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Dispositivos', href: '/modules/seguridad/dispositivos' },
];

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Disponible: 'default',
    'En uso': 'secondary',
    'En mantenimiento': 'secondary',
    'Fuera de servicio': 'destructive',
};

interface DispositivoRow {
    id: number;
    codigo: string;
    marca: string | null;
    modelo: string | null;
    estado: string;
    fecha_calibracion: string | null;
    fecha_vencimiento_certificado: string | null;
    calibracion_proxima: boolean;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface DispositivosPaginator {
    data: DispositivoRow[];
    links: PaginationLink[];
}

export default function DispositivosIndex({ dispositivos, filters }: { dispositivos: DispositivosPaginator; filters: { search: string } }) {
    const [search, setSearch] = useState(filters.search);
    const debouncedSearch = useDebouncedValue(search);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        router.get(route('seguridad.dispositivos.index'), { search: debouncedSearch }, { preserveState: true, replace: true });
    }, [debouncedSearch]);

    const submitSearch: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(route('seguridad.dispositivos.index'), { search }, { preserveState: true, replace: true });
    };

    const destroyDispositivo = (dispositivo: DispositivoRow) => {
        router.delete(route('seguridad.dispositivos.destroy', dispositivo.id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dispositivos" />
            <div className="flex h-full flex-1 flex-col gap-6 px-4 pb-10 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                            <AlertTriangle className="size-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dispositivos</p>
                            <p className="text-xs text-gray-400">Administra los alcoholímetros disponibles para las pruebas.</p>
                        </div>
                    </div>
                    <Button asChild>
                        <Link href={route('seguridad.dispositivos.create')}>
                            <Plus className="size-4" />
                            Nuevo dispositivo
                        </Link>
                    </Button>
                </div>

                <form onSubmit={submitSearch} className="flex max-w-sm items-center gap-2">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, marca o modelo..." />
                    <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
                        <Search className="size-4" />
                    </Button>
                </form>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Marca / Modelo</TableHead>
                                <TableHead>Calibración</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dispositivos.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                                        No se encontraron dispositivos.
                                    </TableCell>
                                </TableRow>
                            )}
                            {dispositivos.data.map((dispositivo) => (
                                <TableRow key={dispositivo.id}>
                                    <TableCell className="font-medium">{dispositivo.codigo}</TableCell>
                                    <TableCell>
                                        {[dispositivo.marca, dispositivo.modelo].filter(Boolean).join(' / ') || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {dispositivo.fecha_calibracion ?? '—'}
                                            {dispositivo.calibracion_proxima && (
                                                <Badge variant="destructive" className="gap-1">
                                                    <AlertTriangle className="size-3" />
                                                    Próxima
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={ESTADO_VARIANT[dispositivo.estado] ?? 'default'}>{dispositivo.estado}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <IconActionButton icon={Eye} label="Ver" href={route('seguridad.dispositivos.show', dispositivo.id)} />
                                            <IconActionButton icon={Pencil} label="Editar" href={route('seguridad.dispositivos.edit', dispositivo.id)} />
                                            <Dialog>
                                                <TooltipProvider delayDuration={200}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive"
                                                                    aria-label="Eliminar"
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Eliminar</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <DialogContent>
                                                    <DialogTitle>¿Eliminar el dispositivo {dispositivo.codigo}?</DialogTitle>
                                                    <DialogDescription>
                                                        Esta acción elimina el dispositivo de forma lógica; el historial de pruebas se conserva.
                                                    </DialogDescription>
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button variant="secondary">Cancelar</Button>
                                                        </DialogClose>
                                                        <Button variant="destructive" onClick={() => destroyDispositivo(dispositivo)}>
                                                            Eliminar
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {dispositivos.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {dispositivos.links.map((link, index) => (
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
        </AppLayout>
    );
}
