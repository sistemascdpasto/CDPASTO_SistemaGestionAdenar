import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Catálogo de Clientes', href: '/modules/reparto/clientes' },
];

interface ClienteRow {
    id: number;
    codigo_cliente: string;
    cliente: string | null;
    propietario: string | null;
    identificacion: string | null;
    longitud: number | null;
    latitud: number | null;
    barrio: string | null;
    direccion: string | null;
    departamento: string | null;
    municipio: string | null;
    actividad_economica: string | null;
    telefonos: string | null;
    correo_electronico: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface ClientesPaginator {
    data: ClienteRow[];
    links: PaginationLink[];
    total: number;
}

interface Filters {
    search: string;
    municipio: string;
    barrio: string;
}

export default function ClientesIndex({
    clientes,
    municipios,
    barrios,
    filters,
    total,
}: {
    clientes: ClientesPaginator;
    municipios: string[];
    barrios: string[];
    filters: Filters;
    total: number;
}) {
    const [search, setSearch] = useState(filters.search);
    const [municipioFiltro, setMunicipioFiltro] = useState(filters.municipio);
    const [barrioFiltro, setBarrioFiltro] = useState(filters.barrio);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const importForm = useForm<{ archivo: File | null }>({ archivo: null });

    const buscar = (s: string, m: string, b: string) => {
        router.get(route('reparto.clientes.index'), { search: s, municipio: m, barrio: b }, { preserveState: true, replace: true });
    };

    const handleSearch = (v: string) => { setSearch(v); buscar(v, municipioFiltro, barrioFiltro); };
    const handleMunicipio = (v: string) => { const val = v === 'todos' ? '' : v; setMunicipioFiltro(val); buscar(search, val, barrioFiltro); };
    const handleBarrio = (v: string) => { const val = v === 'todos' ? '' : v; setBarrioFiltro(val); buscar(search, municipioFiltro, val); };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        importForm.setData('archivo', file);
    };

    const submitImportar = () => {
        if (!importForm.data.archivo) return;
        importForm.post(route('reparto.clientes.importar'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                importForm.reset();
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const eliminar = (c: ClienteRow) => {
        if (!confirm(`¿Eliminar el cliente "${c.cliente ?? c.codigo_cliente}"?`)) return;
        router.delete(route('reparto.clientes.destroy', c.id), { preserveScroll: true });
    };

    const eliminarTodos = () => {
        if (!confirm(`¿Eliminar TODOS los ${total} clientes del catálogo? Esta acción no se puede deshacer.`)) return;
        router.delete(route('reparto.clientes.destroyAll'), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Catálogo de Clientes" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Catálogo de Clientes</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {total.toLocaleString()} clientes registrados
                        </p>
                    </div>

                    {/* Importar Excel */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 px-3 py-2">
                            <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                className="text-sm text-muted-foreground file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-emerald-600 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-emerald-700"
                            />
                            {importForm.data.archivo && (
                                <button
                                    type="button"
                                    onClick={() => { importForm.setData('archivo', null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                        <Button
                            onClick={submitImportar}
                            disabled={!importForm.data.archivo || importForm.processing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Upload className="size-4" />
                            {importForm.processing ? 'Importando...' : 'Importar Excel'}
                        </Button>
                        {total > 0 && (
                            <Button variant="outline" onClick={eliminarTodos} className="border-red-300 text-red-600 hover:bg-red-50">
                                <Trash2 className="size-4" />
                                Limpiar todo
                            </Button>
                        )}
                    </div>
                </div>

                {/* Instrucciones del Excel */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Formato esperado del Excel:</strong> columnas{' '}
                    <span className="font-mono">CodigoCliente, Cliente, Propietario, Identificacion, Longitud, Latitud, Barrio, Direccion, Departamento, Municipio, ActividadEconomica, Telefonos, CorreoElectronico</span>.
                    Si el cliente ya existe (mismo CodigoCliente) sus datos se actualizan.
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-3">
                    <Input
                        className="w-64"
                        placeholder="Buscar por código, nombre, propietario..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    <Select value={municipioFiltro || 'todos'} onValueChange={handleMunicipio}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Municipio" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los municipios</SelectItem>
                            {municipios.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={barrioFiltro || 'todos'} onValueChange={handleBarrio}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Barrio" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los barrios</SelectItem>
                            {barrios.map((b) => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="flex items-center text-sm text-muted-foreground">
                        {clientes.total.toLocaleString()} resultado{clientes.total !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Tabla */}
                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-bold text-black dark:text-white whitespace-nowrap">Código</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Cliente</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Propietario</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Identificación</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Departamento</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Municipio</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Barrio</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Dirección</TableHead>
                                <TableHead className="font-bold text-black dark:text-white whitespace-nowrap">Actividad Económica</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Teléfonos</TableHead>
                                <TableHead className="font-bold text-black dark:text-white">Correo</TableHead>
                                <TableHead className="text-right font-bold text-black dark:text-white">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clientes.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                                        {total === 0
                                            ? 'No hay clientes registrados. Importa un archivo Excel para comenzar.'
                                            : 'No se encontraron clientes con los filtros aplicados.'}
                                    </TableCell>
                                </TableRow>
                            )}
                            {clientes.data.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-mono text-sm font-medium whitespace-nowrap">{c.codigo_cliente}</TableCell>
                                    <TableCell className="capitalize font-medium">{c.cliente?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="capitalize">{c.propietario?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="font-mono text-sm">{c.identificacion ?? '—'}</TableCell>
                                    <TableCell className="capitalize">{c.departamento?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="capitalize">{c.municipio?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="capitalize">{c.barrio?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="capitalize text-sm">{c.direccion?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="capitalize text-sm">{c.actividad_economica?.toLowerCase() ?? '—'}</TableCell>
                                    <TableCell className="text-sm">{c.telefonos ?? '—'}</TableCell>
                                    <TableCell className="text-sm lowercase">{c.correo_electronico ?? '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => eliminar(c)}
                                            title="Eliminar"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Paginación */}
                {clientes.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {clientes.links.map((link, i) => (
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
        </AppLayout>
    );
}
