import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { ImportarAcisDialog } from '@/pages/seguridad/acis/importar-dialog';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'ACIS', href: '/modules/seguridad/acis' },
    { title: 'Reportes ACI', href: '/modules/seguridad/acis' },
];

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface AciRow {
    id: number;
    folio: string;
    fecha_incidente: string | null;
    area: string | null;
    clasificacion: string | null;
    estatus_asignacion: string | null;
    colaborador: { id: number; nombres: string; apellidos: string; cedula: string; centro: string | null } | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface AcisPaginator {
    data: AciRow[];
    links: PaginationLink[];
}

interface Filtros {
    [key: string]: string | undefined;
    folio?: string;
    mes?: string;
    anio?: string;
    colaborador?: string;
    area?: string;
    tipo_riesgo?: string;
    centro?: string;
}

export default function AcisIndex({
    acis,
    filters,
    catalogos,
}: {
    acis: AcisPaginator;
    filters: Filtros;
    catalogos: { areas: string[]; centros: string[] };
}) {
    const [form, setForm] = useState<Filtros>({
        folio: filters.folio ?? '',
        mes: filters.mes ?? '',
        anio: filters.anio ?? '',
        colaborador: filters.colaborador ?? '',
        area: filters.area ?? '',
        tipo_riesgo: filters.tipo_riesgo ?? '',
        centro: filters.centro ?? '',
    });
    const isFirst = useRef(true);
    const debouncedForm = useDebouncedValue(form, 400);

    useEffect(() => {
        if (isFirst.current) { isFirst.current = false; return; }
        router.get(route('seguridad.acis.index'), debouncedForm, { preserveState: true, replace: true });
    }, [JSON.stringify(debouncedForm)]);

    const limpiarFiltros = () => {
        const vacio: Filtros = { folio: '', mes: '', anio: '', colaborador: '', area: '', tipo_riesgo: '', centro: '' };
        setForm(vacio);
        router.get(route('seguridad.acis.index'), {}, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reportes ACI" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall title="Reportes ACI" description="Actos y condiciones inseguras importados desde el programa SKAP." />
                    <ImportarAcisDialog
                        trigger={
                            <Button variant="outline">
                                <Upload />
                                Importar Excel
                            </Button>
                        }
                    />
                </div>

                <form className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                    <Input
                        placeholder="Folio"
                        value={form.folio}
                        onChange={(e) => setForm({ ...form, folio: e.target.value })}
                    />
                    <Input
                        placeholder="Colaborador (nombre, cédula o SKAP)"
                        className="col-span-2"
                        value={form.colaborador}
                        onChange={(e) => setForm({ ...form, colaborador: e.target.value })}
                    />
                    <Select value={form.mes || 'todos'} onValueChange={(v) => setForm({ ...form, mes: v === 'todos' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los meses</SelectItem>
                            {MESES.map((mes, index) => (
                                <SelectItem key={mes} value={String(index + 1)}>
                                    {mes}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="Año"
                        value={form.anio}
                        onChange={(e) => setForm({ ...form, anio: e.target.value })}
                    />
                    <Select value={form.area || 'todas'} onValueChange={(v) => setForm({ ...form, area: v === 'todas' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Área" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas las áreas</SelectItem>
                            {catalogos.areas.map((area) => (
                                <SelectItem key={area} value={area}>
                                    {area}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.centro || 'todos'} onValueChange={(v) => setForm({ ...form, centro: v === 'todos' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Centro" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los centros</SelectItem>
                            {catalogos.centros.map((centro) => (
                                <SelectItem key={centro} value={centro}>
                                    {centro}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="col-span-2 flex gap-2 md:col-span-4 lg:col-span-7">
                        <Button type="button" variant="outline" onClick={limpiarFiltros}>
                            Limpiar
                        </Button>
                    </div>
                </form>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Folio</TableHead>
                                <TableHead>Fecha del incidente</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Área</TableHead>
                                <TableHead>Clasificación</TableHead>
                                <TableHead>Estatus</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {acis.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                                        No hay reportes ACI que coincidan con los filtros.
                                    </TableCell>
                                </TableRow>
                            )}
                            {acis.data.map((aci) => (
                                <TableRow key={aci.id}>
                                    <TableCell className="font-medium">{aci.folio}</TableCell>
                                    <TableCell>{aci.fecha_incidente ? new Date(aci.fecha_incidente).toLocaleDateString() : '—'}</TableCell>
                                    <TableCell>
                                        {aci.colaborador ? `${aci.colaborador.nombres} ${aci.colaborador.apellidos}` : '—'}
                                    </TableCell>
                                    <TableCell>{aci.area ?? '—'}</TableCell>
                                    <TableCell>{aci.clasificacion ?? '—'}</TableCell>
                                    <TableCell>{aci.estatus_asignacion ?? '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end">
                                            <IconActionButton icon={Eye} label="Ver detalle" href={route('seguridad.acis.show', aci.id)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {acis.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {acis.links.map((link, index) => (
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
