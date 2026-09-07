import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { ImportarEvaluacionesOwdDialog } from '@/pages/seguridad/evaluaciones-owd/importar-dialog';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Download, Eye, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Evaluaciones OWD', href: '/modules/seguridad/evaluaciones-owd' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface ColaboradorLigero {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
}

interface EvaluacionLigera {
    id: number;
    fecha_evaluacion: string | null;
    evaluado: string | null;
    qr_safety: string | null;
    evaluador: string | null;
    qr_safety_evaluador: string | null;
    bu: string | null;
    agencia: string | null;
    type: string | null;
    pillar: string | null;
    colaborador: ColaboradorLigero | null;
    evaluador_colaborador: ColaboradorLigero | null;
}

interface PreguntaRow {
    id: number;
    proceso: string | null;
    actividad: string | null;
    tarea: string | null;
    puntuacion: string | null;
    ponderacion: number | null;
    requiere_plan_accion: boolean;
    version: string | null;
    evaluacion_owd: EvaluacionLigera;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PreguntasPaginator {
    data: PreguntaRow[];
    links: PaginationLink[];
}

interface Filtros {
    [key: string]: string | undefined;
    colaborador?: string;
    evaluador?: string;
    mes?: string;
    anio?: string;
    bu?: string;
    pais?: string;
    region?: string;
    uen?: string;
    agencia?: string;
    type?: string;
    pillar?: string;
    proceso?: string;
    actividad?: string;
    puntuacion?: string;
    plan_accion?: string;
}

interface Catalogos {
    bu: string[];
    pais: string[];
    region: string[];
    uen: string[];
    agencia: string[];
    type: string[];
    pillar: string[];
}

function badgePuntuacion(puntuacion: string | null) {
    if (puntuacion === 'OK') return <Badge>OK</Badge>;
    if (puntuacion === 'Not Applicable') return <Badge variant="secondary">N/A</Badge>;
    if (!puntuacion) return <span className="text-muted-foreground">—</span>;
    return <Badge variant="destructive">{puntuacion}</Badge>;
}

export default function EvaluacionesOwdIndex({
    preguntas,
    filters,
    catalogos,
}: {
    preguntas: PreguntasPaginator;
    filters: Filtros;
    catalogos: Catalogos;
}) {
    const vacio: Filtros = {
        colaborador: '', evaluador: '', mes: '', anio: '', bu: '', pais: '', region: '', uen: '',
        agencia: '', type: '', pillar: '', proceso: '', actividad: '', puntuacion: '', plan_accion: '',
    };
    const [form, setForm] = useState<Filtros>({ ...vacio, ...filters });
    const isFirst = useRef(true);
    const debouncedForm = useDebouncedValue(form, 400);

    useEffect(() => {
        if (isFirst.current) { isFirst.current = false; return; }
        router.get(route('seguridad.evaluaciones-owd.index'), debouncedForm, { preserveState: true, replace: true });
    }, [JSON.stringify(debouncedForm)]);

    const limpiarFiltros = () => {
        setForm(vacio);
        router.get(route('seguridad.evaluaciones-owd.index'), {}, { preserveState: true, replace: true });
    };

    const set = (campo: keyof Filtros) => (v: string) => setForm((f) => ({ ...f, [campo]: v === 'todos' ? '' : v }));

    const exportUrl = (ruta: string) => route(ruta, { ...form });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Evaluaciones OWD" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall
                        title="Evaluaciones OWD"
                        description="Observaciones de trabajo seguro importadas desde Excel, una fila por pregunta evaluada."
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <a href={exportUrl('seguridad.evaluaciones-owd.exportar')}>
                                <Download />
                                Exportar
                            </a>
                        </Button>
                        <ImportarEvaluacionesOwdDialog
                            trigger={
                                <Button variant="outline">
                                    <Upload />
                                    Importar Excel
                                </Button>
                            }
                        />
                    </div>
                </div>

                <form className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                    <Input
                        placeholder="Colaborador (nombre o QR)"
                        className="col-span-2"
                        value={form.colaborador}
                        onChange={(e) => setForm({ ...form, colaborador: e.target.value })}
                    />
                    <Input
                        placeholder="Evaluador (nombre o QR)"
                        className="col-span-2"
                        value={form.evaluador}
                        onChange={(e) => setForm({ ...form, evaluador: e.target.value })}
                    />
                    <Select value={form.mes || 'todos'} onValueChange={set('mes')}>
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
                    <Input placeholder="Año" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} />

                    <Select value={form.bu || 'todos'} onValueChange={set('bu')}>
                        <SelectTrigger>
                            <SelectValue placeholder="BU" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las BU</SelectItem>
                            {catalogos.bu.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.pais || 'todos'} onValueChange={set('pais')}>
                        <SelectTrigger>
                            <SelectValue placeholder="País" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los países</SelectItem>
                            {catalogos.pais.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.region || 'todos'} onValueChange={set('region')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Región" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las regiones</SelectItem>
                            {catalogos.region.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.uen || 'todos'} onValueChange={set('uen')}>
                        <SelectTrigger>
                            <SelectValue placeholder="UEN" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las UEN</SelectItem>
                            {catalogos.uen.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.agencia || 'todos'} onValueChange={set('agencia')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Agencia" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las agencias</SelectItem>
                            {catalogos.agencia.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.type || 'todos'} onValueChange={set('type')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los tipos</SelectItem>
                            {catalogos.type.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.pillar || 'todos'} onValueChange={set('pillar')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pillar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los pillares</SelectItem>
                            {catalogos.pillar.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input placeholder="Proceso" value={form.proceso} onChange={(e) => setForm({ ...form, proceso: e.target.value })} />
                    <Input placeholder="Actividad" value={form.actividad} onChange={(e) => setForm({ ...form, actividad: e.target.value })} />
                    <Select value={form.puntuacion || 'todos'} onValueChange={set('puntuacion')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Puntuación" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas</SelectItem>
                            <SelectItem value="OK">OK</SelectItem>
                            <SelectItem value="No OK">No OK</SelectItem>
                            <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={form.plan_accion || 'todos'} onValueChange={set('plan_accion')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Plan de acción" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="1">Con plan de acción</SelectItem>
                            <SelectItem value="0">Sin plan de acción</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="col-span-2 flex gap-2 md:col-span-4 lg:col-span-6">
                        <Button type="button" variant="outline" onClick={limpiarFiltros}>
                            Limpiar
                        </Button>
                    </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Evaluado</TableHead>
                                <TableHead>Evaluador</TableHead>
                                <TableHead>Pillar</TableHead>
                                <TableHead>Proceso / Tarea</TableHead>
                                <TableHead>Puntuación</TableHead>
                                <TableHead>Plan de acción</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {preguntas.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                                        No hay evaluaciones que coincidan con los filtros.
                                    </TableCell>
                                </TableRow>
                            )}
                            {preguntas.data.map((pregunta) => (
                                <TableRow key={pregunta.id}>
                                    <TableCell>
                                        {pregunta.evaluacion_owd.fecha_evaluacion
                                            ? new Date(pregunta.evaluacion_owd.fecha_evaluacion).toLocaleString()
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {pregunta.evaluacion_owd.colaborador
                                            ? `${pregunta.evaluacion_owd.colaborador.nombres} ${pregunta.evaluacion_owd.colaborador.apellidos}`
                                            : (pregunta.evaluacion_owd.evaluado ?? '—')}
                                    </TableCell>
                                    <TableCell>
                                        {pregunta.evaluacion_owd.evaluador_colaborador
                                            ? `${pregunta.evaluacion_owd.evaluador_colaborador.nombres} ${pregunta.evaluacion_owd.evaluador_colaborador.apellidos}`
                                            : (pregunta.evaluacion_owd.evaluador ?? '—')}
                                    </TableCell>
                                    <TableCell>{pregunta.evaluacion_owd.pillar ?? '—'}</TableCell>
                                    <TableCell className="max-w-xs">
                                        <p className="truncate text-sm">{pregunta.proceso ?? '—'}</p>
                                        <p className="truncate text-xs text-muted-foreground">{pregunta.tarea ?? '—'}</p>
                                    </TableCell>
                                    <TableCell>{badgePuntuacion(pregunta.puntuacion)}</TableCell>
                                    <TableCell>
                                        {pregunta.requiere_plan_accion ? <Badge variant="destructive">SI</Badge> : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end">
                                            <IconActionButton
                                                icon={Eye}
                                                label="Ver evaluación completa"
                                                href={route('seguridad.evaluaciones-owd.show', pregunta.evaluacion_owd.id)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {preguntas.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {preguntas.links.map((link, index) => (
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
