import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, ClipboardList, QrCode, Target, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'ACIS', href: '/modules/seguridad/acis' },
    { title: 'Indicadores', href: '/modules/seguridad/acis-indicadores' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    return `${MESES_ABREV[mes - 1]} ${anio}`;
}

interface Resumen {
    total_aci_mes: number;
    colaboradores_en_programa: number;
    cumplen_meta: number;
    no_cumplen_meta: number;
    porcentaje_cumplimiento: number;
    problematicas_detectadas: number;
    qr_skap_activos: number;
}

interface UltimoAci {
    id: number;
    folio: string;
    fecha_incidente: string | null;
    area: string | null;
    tipo_riesgo: string | null;
    estatus_asignacion: string | null;
    colaborador: { nombres: string; apellidos: string } | null;
}

interface ColaboradorMeta {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cantidad: number;
    faltantes: number;
    cumple: boolean;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface ColaboradoresMetaPaginator {
    data: ColaboradorMeta[];
    links: PaginationLink[];
    total: number;
}

const PROXIMAMENTE = [
    { titulo: 'Seguimientos ACIS', nota: 'Se habilita con el módulo de Seguimiento SKAP (Fase 3).' },
    { titulo: 'Acciones de mejora', nota: 'Se habilita con el módulo de Acciones de mejora (Fase 3).' },
    { titulo: 'Acciones vencidas', nota: 'Se habilita con el módulo de Acciones de mejora (Fase 3).' },
    { titulo: 'Comités People', nota: 'Se habilita con el módulo de Comités People (Fase 3).' },
    { titulo: 'Capacitadores activos', nota: 'Falta definir qué es un capacitador SKAP en el sistema.' },
    { titulo: 'Evaluadores activos', nota: 'Falta definir qué es un evaluador SKAP en el sistema.' },
];

export default function AcisIndicadores({
    filtros,
    resumen,
    ultimosAci,
    colaboradoresMeta,
    aciPorArea,
    aciPorMes,
}: {
    filtros: { mes: number; anio: number };
    resumen: Resumen;
    ultimosAci: UltimoAci[];
    colaboradoresMeta: ColaboradoresMetaPaginator;
    aciPorArea: { area: string; cantidad: number }[];
    aciPorMes: { periodo: string; cantidad: number }[];
}) {
    const cambiarFiltro = (cambios: Partial<{ mes: number; anio: number }>) => {
        router.get(route('seguridad.acis.indicadores'), { ...filtros, ...cambios, page: 1 }, { preserveState: true, replace: true });
    };

    const kpis = [
        { label: 'Total ACI del mes', valor: resumen.total_aci_mes, icon: ClipboardList, color: '#3F7A22' },
        {
            label: 'Cumplimiento meta (4 ACI)',
            valor: `${resumen.porcentaje_cumplimiento}% (${resumen.cumplen_meta}/${resumen.colaboradores_en_programa})`,
            icon: Target,
            color: '#0369A1',
        },
        { label: 'QR SKAP activos', valor: resumen.qr_skap_activos, icon: QrCode, color: '#B45309' },
        { label: 'Problemáticas detectadas', valor: resumen.problematicas_detectadas, icon: AlertTriangle, color: '#B91C1C' },
    ];

    const datosTendencia = aciPorMes.map((fila) => ({ ...fila, etiqueta: formatearPeriodo(fila.periodo) }));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Indicadores ACIS" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall title="Indicadores ACIS" description="Panel general del programa de actos y condiciones inseguras." />
                    <div className="flex gap-2">
                        <Select value={String(filtros.mes)} onValueChange={(v) => cambiarFiltro({ mes: Number(v) })}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MESES.map((mes, index) => (
                                    <SelectItem key={mes} value={String(index + 1)}>
                                        {mes}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(filtros.anio)} onValueChange={(v) => cambiarFiltro({ anio: Number(v) })}>
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[filtros.anio - 1, filtros.anio, filtros.anio + 1].map((anio) => (
                                    <SelectItem key={anio} value={String(anio)}>
                                        {anio}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                    {kpis.map((kpi) => (
                        <KpiCard key={kpi.label} label={kpi.label} value={kpi.valor} icon={kpi.icon} color={kpi.color} />
                    ))}
                </KpiCardGrid>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">ACI por área — mes seleccionado</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {aciPorArea.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">Sin datos para este mes.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={aciPorArea}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="area" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="cantidad" fill="#3F7A22" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Tendencia — últimos 6 meses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={datosTendencia}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="cantidad" stroke="#0369A1" fill="#0369A1" fillOpacity={0.2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Últimos ACI del mes</p>
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Área</TableHead>
                                    <TableHead>Estatus</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ultimosAci.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                            Sin reportes en este mes.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {ultimosAci.map((aci) => (
                                    <TableRow key={aci.id}>
                                        <TableCell className="font-medium">
                                            <Link href={route('seguridad.acis.show', aci.id)} className="text-primary hover:underline">
                                                {aci.folio}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{aci.colaborador ? `${aci.colaborador.nombres} ${aci.colaborador.apellidos}` : '—'}</TableCell>
                                        <TableCell>{aci.area ?? '—'}</TableCell>
                                        <TableCell>{aci.estatus_asignacion ?? '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-sm font-medium text-foreground">
                        <Users className="mr-1 inline size-4" />
                        Cumplimiento de la meta por colaborador
                        <span className="ml-1 text-xs font-normal text-muted-foreground">({colaboradoresMeta.total} en el programa)</span>
                    </p>
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>ACI del mes</TableHead>
                                    <TableHead>Le faltan</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {colaboradoresMeta.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                            No hay colaboradores con QR SKAP activo.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {colaboradoresMeta.data.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            {c.nombres} {c.apellidos} — {c.cedula}
                                        </TableCell>
                                        <TableCell>
                                            {c.cantidad}/4
                                        </TableCell>
                                        <TableCell>{c.faltantes}</TableCell>
                                        <TableCell>
                                            <Badge variant={c.cumple ? 'default' : 'secondary'}>{c.cumple ? 'Cumple' : 'No cumple'}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {colaboradoresMeta.links.length > 3 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {colaboradoresMeta.links.map((link, index) => (
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

                <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Próximamente</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {PROXIMAMENTE.map((item) => (
                            <Card key={item.titulo} className="border-dashed border-border bg-muted/30">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">{item.titulo}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">{item.nota}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
