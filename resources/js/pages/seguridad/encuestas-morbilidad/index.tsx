import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Encuestas de Morbilidad', href: '/modules/seguridad/encuestas-morbilidad' },
];

interface ColaboradorLigero {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    area: string | null;
    cargo: string | null;
}

interface EncuestaRow {
    id: number;
    enviado_en: string | null;
    colaborador: ColaboradorLigero | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface EncuestasPaginator {
    data: EncuestaRow[];
    links: PaginationLink[];
}

interface Filtros {
    [key: string]: string | undefined;
    colaborador?: string;
    mes?: string;
    anio?: string;
}

export default function EncuestasMorbilidadIndex({ encuestas, filters }: { encuestas: EncuestasPaginator; filters: Filtros }) {
    const [form, setForm] = useState<Filtros>({
        colaborador: filters.colaborador ?? '',
        mes: filters.mes ?? '',
        anio: filters.anio ?? '',
    });
    const isFirst = useRef(true);
    const debouncedForm = useDebouncedValue(form, 400);

    useEffect(() => {
        if (isFirst.current) { isFirst.current = false; return; }
        router.get(route('seguridad.encuestas-morbilidad.index'), debouncedForm, { preserveState: true, replace: true });
    }, [JSON.stringify(debouncedForm)]);

    const limpiarFiltros = () => {
        const vacio: Filtros = { colaborador: '', mes: '', anio: '' };
        setForm(vacio);
        router.get(route('seguridad.encuestas-morbilidad.index'), {}, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Encuestas de Morbilidad Sentida" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall
                        title="Encuestas de Morbilidad Sentida"
                        description="Encuestas de auto-reporte de salud completadas por los colaboradores."
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('seguridad.encuestas-morbilidad.preguntas.index')}>Catálogo de preguntas</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('portal.encuesta-morbilidad')}>Diligenciar formulario</Link>
                        </Button>
                    </div>
                </div>

                <form className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Input
                        placeholder="Colaborador (nombre o cédula)"
                        className="col-span-2"
                        value={form.colaborador}
                        onChange={(e) => setForm({ ...form, colaborador: e.target.value })}
                    />
                    <Input placeholder="Mes" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} />
                    <Input placeholder="Año" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} />
                    <div className="col-span-2 flex gap-2 md:col-span-4">
                        <Button type="button" variant="outline" onClick={limpiarFiltros}>
                            Limpiar
                        </Button>
                    </div>
                </form>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Área</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Fecha de envío</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {encuestas.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                                        No hay encuestas completadas que coincidan con los filtros.
                                    </TableCell>
                                </TableRow>
                            )}
                            {encuestas.data.map((encuesta) => (
                                <TableRow key={encuesta.id}>
                                    <TableCell>
                                        {encuesta.colaborador
                                            ? `${encuesta.colaborador.nombres} ${encuesta.colaborador.apellidos} — ${encuesta.colaborador.cedula}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell>{encuesta.colaborador?.area ?? '—'}</TableCell>
                                    <TableCell>{encuesta.colaborador?.cargo ?? '—'}</TableCell>
                                    <TableCell>{encuesta.enviado_en ? new Date(encuesta.enviado_en).toLocaleString() : '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end">
                                            <IconActionButton
                                                icon={Eye}
                                                label="Ver detalle"
                                                href={route('seguridad.encuestas-morbilidad.show', encuesta.id)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {encuestas.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {encuestas.links.map((link, index) => (
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
