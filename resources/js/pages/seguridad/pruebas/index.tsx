import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarDays, Eye, FileSpreadsheet, FileText, Pencil, Plus } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Pruebas de Alcoholemia', href: '/modules/seguridad/pruebas' },
];

const TIPO_LABELS: Record<string, string> = { pre_ruta: 'Pre Ruta', ruta: 'Ruta', post_ruta: 'Post Ruta' };

interface PruebaRow {
    id: number;
    tipo: string;
    resultado: string | null;
    es_positivo: boolean;
    estado: string;
    fecha_hora: string;
    firma_path: string | null;
    colaborador: { nombres: string; apellidos: string; cedula: string } | null;
    alcoholimetro: { codigo: string } | null;
    responsable: { name: string } | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PruebasPaginator {
    data: PruebaRow[];
    links: PaginationLink[];
}

interface Filters {
    estado: string;
    tipo: string;
    fecha_desde: string;
    fecha_hasta: string;
    colaborador: string;
}

export default function PruebasIndex({ pruebas, filters }: { pruebas: PruebasPaginator; filters: Filters }) {
    const [form, setForm] = useState(filters);
    const debouncedForm = useDebouncedValue(form, 400);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        router.get(route('seguridad.pruebas.index'), { ...debouncedForm }, { preserveState: true, replace: true });
    }, [JSON.stringify(debouncedForm)]);

    const exportUrl = (ruta: string) => route(ruta, { ...form });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pruebas de Alcoholemia" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall title="Pruebas de Alcoholemia" description="Registro, filtros y exportación de pruebas de alcoholemia." />
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('seguridad.pruebas.calendario')}>
                                <CalendarDays className="size-4" />
                                Calendario
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={route('seguridad.pruebas.create')}>
                                <Plus className="size-4" />
                                Registrar prueba
                            </Link>
                        </Button>
                    </div>
                </div>

                <form className="grid gap-3 rounded-lg border border-sidebar-border/70 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-sidebar-border">
                    <div className="grid gap-1.5">
                        <Label htmlFor="colaborador">Colaborador o cédula</Label>
                        <Input
                            id="colaborador"
                            value={form.colaborador}
                            onChange={(e) => setForm({ ...form, colaborador: e.target.value })}
                            placeholder="Buscar..."
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="fecha_desde">Desde</Label>
                        <Input id="fecha_desde" type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="fecha_hasta">Hasta</Label>
                        <Input id="fecha_hasta" type="date" value={form.fecha_hasta} onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Tipo</Label>
                        <Select value={form.tipo || 'todos'} onValueChange={(value) => setForm({ ...form, tipo: value === 'todos' ? '' : value })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="pre_ruta">Pre Ruta</SelectItem>
                                <SelectItem value="ruta">Ruta</SelectItem>
                                <SelectItem value="post_ruta">Post Ruta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Estado</Label>
                        <Select value={form.estado || 'todas'} onValueChange={(value) => setForm({ ...form, estado: value === 'todas' ? '' : value })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">Todos los estados</SelectItem>
                                <SelectItem value="realizada">Realizadas</SelectItem>
                                <SelectItem value="programada">Programadas</SelectItem>
                                <SelectItem value="cancelada">Canceladas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-5">
                        <Button type="button" variant="outline" asChild>
                            <a href={exportUrl('seguridad.pruebas.exportar-pdf')}>
                                <FileText className="size-4" />
                                Exportar PDF
                            </a>
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <a href={exportUrl('seguridad.pruebas.exportar-excel')}>
                                <FileSpreadsheet className="size-4" />
                                Exportar Excel
                            </a>
                        </Button>
                    </div>
                </form>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Dispositivo</TableHead>
                                <TableHead>Resultado</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pruebas.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-muted-foreground py-6 text-center">
                                        No se encontraron pruebas.
                                    </TableCell>
                                </TableRow>
                            )}
                            {pruebas.data.map((prueba) => (
                                <TableRow key={prueba.id}>
                                    <TableCell>{new Date(prueba.fecha_hora).toLocaleString()}</TableCell>
                                    <TableCell>
                                        {prueba.colaborador ? `${prueba.colaborador.nombres} ${prueba.colaborador.apellidos}` : '—'}
                                    </TableCell>
                                    <TableCell>{TIPO_LABELS[prueba.tipo] ?? prueba.tipo}</TableCell>
                                    <TableCell>{prueba.alcoholimetro?.codigo ?? '—'}</TableCell>
                                    <TableCell>
                                        {prueba.estado === 'programada' ? (
                                            <Badge variant="secondary">Programada</Badge>
                                        ) : (
                                            <Badge variant={prueba.es_positivo ? 'destructive' : 'default'}>
                                                {prueba.resultado} — {prueba.es_positivo ? 'Positivo' : 'Negativo'}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{prueba.responsable?.name ?? '—'}</TableCell>
                                    <TableCell>
                                        {prueba.firma_path ? (
                                            <SafeImage
                                                src={`/storage/${prueba.firma_path}`}
                                                alt="Firma"
                                                className="h-8 w-16 rounded border border-sidebar-border/70 bg-white object-contain dark:border-sidebar-border"
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <IconActionButton icon={Eye} label="Ver" href={route('seguridad.pruebas.show', prueba.id)} />
                                            <IconActionButton icon={Pencil} label="Editar" href={route('seguridad.pruebas.edit', prueba.id)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {pruebas.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {pruebas.links.map((link, index) => (
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
