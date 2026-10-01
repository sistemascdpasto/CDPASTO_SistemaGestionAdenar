import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Catálogo de Barrios', href: '/modules/reparto/barrios' },
];

interface Municipio {
    id: number;
    nombre: string;
}

interface BarrioRow {
    id: number;
    nombre: string;
    codigo: string | null;
    municipio: Municipio;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface BarriosPaginator {
    data: BarrioRow[];
    links: PaginationLink[];
    total: number;
}

interface Filters {
    search: string;
    municipio_id: string;
}

export default function BarriosIndex({
    barrios,
    municipios,
    filters,
}: {
    barrios: BarriosPaginator;
    municipios: Municipio[];
    filters: Filters;
}) {
    const [search, setSearch] = useState(filters.search);
    const [municipioFiltro, setMunicipioFiltro] = useState(filters.municipio_id);
    const [editingBarrio, setEditingBarrio] = useState<BarrioRow | null>(null);
    const [openCreate, setOpenCreate] = useState(false);
    const [openEdit, setOpenEdit] = useState(false);

    // ── Formulario crear ──────────────────────────────────────
    const createForm = useForm({ municipio_id: '', nombre: '', codigo: '' });
    const editForm = useForm({ nombre: '', codigo: '' });

    const buscar = (s: string, m: string) => {
        router.get(route('reparto.barrios.index'), { search: s, municipio_id: m }, { preserveState: true, replace: true });
    };

    const handleSearchChange = (v: string) => {
        setSearch(v);
        buscar(v, municipioFiltro);
    };

    const handleMunicipioChange = (v: string) => {
        const val = v === 'todos' ? '' : v;
        setMunicipioFiltro(val);
        buscar(search, val);
    };

    const submitCreate = () => {
        createForm.post(route('reparto.barrios.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setOpenCreate(false);
            },
        });
    };

    const openEditDialog = (b: BarrioRow) => {
        setEditingBarrio(b);
        editForm.setData({ nombre: b.nombre, codigo: b.codigo ?? '' });
        setOpenEdit(true);
    };

    const submitEdit = () => {
        if (!editingBarrio) return;
        editForm.put(route('reparto.barrios.update', editingBarrio.id), {
            preserveScroll: true,
            onSuccess: () => {
                setOpenEdit(false);
                setEditingBarrio(null);
            },
        });
    };

    const eliminar = (b: BarrioRow) => {
        if (!confirm(`¿Eliminar el barrio "${b.nombre}"?`)) return;
        router.delete(route('reparto.barrios.destroy', b.id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Catálogo de Barrios" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Catálogo de Barrios</h1>
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <Plus className="size-4" />
                                Nuevo barrio
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Registrar barrio</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div className="grid gap-1.5">
                                    <Label>Municipio</Label>
                                    <Select
                                        value={createForm.data.municipio_id || 'none'}
                                        onValueChange={(v) => createForm.setData('municipio_id', v === 'none' ? '' : v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar municipio..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {municipios.map((m) => (
                                                <SelectItem key={m.id} value={String(m.id)}>
                                                    {m.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {createForm.errors.municipio_id && (
                                        <p className="text-xs text-red-600">{createForm.errors.municipio_id}</p>
                                    )}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Nombre del barrio</Label>
                                    <Input
                                        value={createForm.data.nombre}
                                        onChange={(e) => createForm.setData('nombre', e.target.value)}
                                        placeholder="Ej: Centro, La Merced..."
                                    />
                                    {createForm.errors.nombre && (
                                        <p className="text-xs text-red-600">{createForm.errors.nombre}</p>
                                    )}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Código <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                                    <Input
                                        value={createForm.data.codigo}
                                        onChange={(e) => createForm.setData('codigo', e.target.value)}
                                        placeholder="Ej: 001, B-12..."
                                    />
                                    {createForm.errors.codigo && (
                                        <p className="text-xs text-red-600">{createForm.errors.codigo}</p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                </DialogClose>
                                <Button onClick={submitCreate} disabled={createForm.processing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    Guardar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-3">
                    <Input
                        className="w-64"
                        placeholder="Buscar barrio o código..."
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    <Select value={municipioFiltro || 'todos'} onValueChange={handleMunicipioChange}>
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Todos los municipios" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los municipios</SelectItem>
                            {municipios.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                    {m.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="flex items-center text-sm text-muted-foreground">
                        {barrios.total} registro{barrios.total !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Tabla */}
                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-bold text-black dark:text-white">Departamento</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Municipio</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Barrio</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Código</TableHead>
                                <TableHead className="text-right font-bold text-black dark:text-white">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {barrios.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                        No se encontraron barrios.
                                    </TableCell>
                                </TableRow>
                            )}
                            {barrios.data.map((b) => (
                                <TableRow key={b.id}>
                                    <TableCell className="capitalize text-muted-foreground text-sm">Nariño</TableCell>
                                    <TableCell className="capitalize">{b.municipio.nombre.toLowerCase()}</TableCell>
                                    <TableCell className="capitalize font-medium">{b.nombre.toLowerCase()}</TableCell>
                                    <TableCell>
                                        {b.codigo ? (
                                            <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                {b.codigo}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => openEditDialog(b)}
                                                title="Editar"
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => eliminar(b)}
                                                title="Eliminar"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Paginación */}
                {barrios.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {barrios.links.map((link, i) => (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                disabled={!link.url}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Diálogo editar */}
            <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar barrio</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Nombre del barrio</Label>
                            <Input
                                value={editForm.data.nombre}
                                onChange={(e) => editForm.setData('nombre', e.target.value)}
                            />
                            {editForm.errors.nombre && (
                                <p className="text-xs text-red-600">{editForm.errors.nombre}</p>
                            )}
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Código <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                            <Input
                                value={editForm.data.codigo}
                                onChange={(e) => editForm.setData('codigo', e.target.value)}
                                placeholder="Ej: 001, B-12..."
                            />
                            {editForm.errors.codigo && (
                                <p className="text-xs text-red-600">{editForm.errors.codigo}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={submitEdit} disabled={editForm.processing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Actualizar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
