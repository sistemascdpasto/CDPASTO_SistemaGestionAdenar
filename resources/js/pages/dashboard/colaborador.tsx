import { CountUp } from '@/components/count-up';
import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Reveal } from '@/components/reveal';
import { SafeImage } from '@/components/safe-image';
import { ShinyText } from '@/components/shiny-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, BellRing, Calendar, CheckCircle2, Clock, DollarSign, Star, Stethoscope, User } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const TURNO_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

type EstadoHoy = 'Apto' | 'Apto con Observaciones' | 'No Apto' | null;

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Apto: 'default',
    'Apto con Observaciones': 'secondary',
    'No Apto': 'destructive',
};

const ESTADO_SALUD_DOT: Record<string, string> = {
    Bueno: 'bg-green-600',
    Regular: 'bg-amber-500',
    Malo: 'bg-destructive',
};

const COLOR_EXCESO_JORNADA = '#d03b3b';
const COLOR_DESCANSO_NO_EFECTIVO = '#fab219';
const COLOR_COMPENSACION = '#15803d';

interface IndiceRiesgo {
    puntaje: number;
    nivel: 'Bajo' | 'Medio' | 'Alto';
    pruebas_positivas: number;
    salud_mala: number;
    dias_considerados: number;
}

const NIVEL_VARIANT: Record<IndiceRiesgo['nivel'], 'default' | 'secondary' | 'destructive'> = {
    Bajo: 'default',
    Medio: 'secondary',
    Alto: 'destructive',
};

interface PruebaRow {
    id: number;
    tipo: string;
    resultado: string | null;
    es_positivo: boolean;
    estado: string;
    fecha_hora: string;
    alcoholimetro: { codigo: string } | null;
}

type EstadoEtapa = 'realizada' | 'pendiente' | 'no_aplica';
type EstadoSalud = 'Bueno' | 'Regular' | 'Malo';

interface Resumen {
    compensacion_diaria: {
        dias_trabajados: number;
        total_ganado: number;
        tendencia: { fecha: string; valor: number }[];
    };
    compensacion_variable: {
        total_pago_variable: number;
        anio: number;
        historial_mensual: { mes_num: number; mes_label: string; total: number }[];
    };
    plan_premiacion: { aci_realizadas: number; meta: number; porcentaje: number };
    plan_padrinos: { etapas: { etapa: string; label: string; estado: EstadoEtapa }[] } | null;
    geovictoria: {
        recientes_30_dias: number;
        tendencia: { fecha: string; exceso_jornada: number; descanso_no_efectivo: number }[];
    };
    capacitaciones: { pendientes: number; total_publicado: number; porcentaje: number };
    condicion_salud: {
        estado: EstadoSalud | null;
        fecha_hora: string | null;
        historial: { estado: EstadoSalud; fecha_hora: string }[];
    };
    encuesta_morbilidad_pendiente: boolean;
    indicadores_reparto: { jornadas_mes: number };
}

interface ColaboradorDashboardProps {
    colaborador: {
        id: number;
        nombre_completo: string;
        cargo: string | null;
        turno: string | null;
        area: string | null;
        imagen: string | null;
    };
    estadoHoy: EstadoHoy;
    jornadaAbierta: boolean;
    indiceRiesgo: IndiceRiesgo;
    ultimasPruebas: PruebaRow[];
    alertasPendientes: number;
    resumen: Resumen;
}

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function formatDiaCorto(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

// ─── Gráfica: ganancia diaria (área con degradado) ─────────────────────────

function TendenciaCompensacionChart({ data }: { data: Resumen['compensacion_diaria']['tendencia'] }) {
    const vacio = data.every((d) => d.valor === 0);
    const datos = data.map((d) => ({ ...d, etiqueta: formatDiaCorto(d.fecha) }));

    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia diaria (últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent>
                {vacio ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Sin registros en el rango.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={datos} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                            <defs>
                                <linearGradient id="grad-compensacion" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLOR_COMPENSACION} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={COLOR_COMPENSACION} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} interval={4} />
                            <YAxis tick={{ fontSize: 11 }} width={34} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                            <Tooltip formatter={(value) => formatCOP(Number(value))} />
                            <Area
                                type="monotone"
                                dataKey="valor"
                                name="Ganancia"
                                stroke={COLOR_COMPENSACION}
                                fill="url(#grad-compensacion)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Gráfica: compensación variable por mes (barras) ───────────────────────

function CompensacionVariableMensualChart({ data, mesActual }: { data: Resumen['compensacion_variable']['historial_mensual']; mesActual: number }) {
    const vacio = data.every((d) => d.total === 0);

    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Compensación variable por mes</CardTitle>
            </CardHeader>
            <CardContent>
                {vacio ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Sin datos este año.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="mes_label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} width={34} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                            <Tooltip formatter={(value) => formatCOP(Number(value))} />
                            <Bar dataKey="total" name="Variable" radius={[4, 4, 0, 0]}>
                                {data.map((d) => (
                                    <Cell key={d.mes_num} fill={d.mes_num === mesActual ? COLOR_COMPENSACION : '#86efac'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Gráfica: incidencias GeoVictoria (barras apiladas) ────────────────────

function GeovictoriaTendenciaChart({ data }: { data: Resumen['geovictoria']['tendencia'] }) {
    const vacio = data.every((d) => d.exceso_jornada === 0 && d.descanso_no_efectivo === 0);
    const datos = data.map((d) => ({ ...d, etiqueta: formatDiaCorto(d.fecha) }));

    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Incidencias GeoVictoria (últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent>
                {vacio ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Sin incidencias en el rango. ¡Sigue así!</p>
                ) : (
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={datos} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} interval={4} />
                            <YAxis tick={{ fontSize: 11 }} width={24} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="exceso_jornada" stackId="dia" name="Exceso de jornada" fill={COLOR_EXCESO_JORNADA} />
                            <Bar dataKey="descanso_no_efectivo" stackId="dia" name="Descanso no efectivo" fill={COLOR_DESCANSO_NO_EFECTIVO} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Anillo SVG de porcentaje (mismo lenguaje visual que mi-compensacion) ──

function RingGauge({ percent, label, sublabel, color }: { percent: number; label: string; sublabel: string; color: string }) {
    const CIRCUM = 2 * Math.PI * 44;
    const pct = Math.max(0, Math.min(100, percent));
    const dash = (pct / 100) * CIRCUM;

    return (
        <Card className="h-full border-sidebar-border/70 dark:border-sidebar-border">
            <CardContent className="flex h-full items-center gap-4 py-5">
                <div className="relative shrink-0">
                    <svg width="72" height="72" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke={`${color}33`} strokeWidth="9" />
                        <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="none"
                            stroke={color}
                            strokeWidth="9"
                            strokeLinecap="round"
                            strokeDasharray={`${dash} ${CIRCUM}`}
                            transform="rotate(-90 50 50)"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-base font-extrabold leading-none" style={{ color }}>
                            {pct}%
                        </span>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Stepper de etapas del Plan Padrinos ───────────────────────────────────

function PadrinosStepper({ etapas, className }: { etapas: NonNullable<Resumen['plan_padrinos']>['etapas']; className?: string }) {
    const ESTADO_LABEL: Record<EstadoEtapa, string> = { realizada: 'Realizada', pendiente: 'Pendiente', no_aplica: 'Aún no aplica' };

    return (
        <Card className={cn('h-full border-sidebar-border/70 dark:border-sidebar-border', className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mi Plan Padrinos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {etapas.map((e) => (
                    <div
                        key={e.etapa}
                        className="flex items-center gap-3 rounded-md border border-sidebar-border/50 px-3 py-2 dark:border-sidebar-border"
                    >
                        {e.estado === 'realizada' ? (
                            <CheckCircle2 className="size-4 shrink-0 text-green-700 dark:text-green-400" />
                        ) : e.estado === 'pendiente' ? (
                            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        ) : (
                            <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className="text-sm text-foreground">Etapa {e.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{ESTADO_LABEL[e.estado]}</span>
                    </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/portal/mi-plan-padrinos">Ver detalle</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

// ─── Mi salud: timeline de condición de salud + encuesta pendiente ─────────

function SaludCard({
    historial,
    encuestaPendiente,
    className,
}: {
    historial: Resumen['condicion_salud']['historial'];
    encuestaPendiente: boolean;
    className?: string;
}) {
    return (
        <Card className={cn('h-full border-sidebar-border/70 dark:border-sidebar-border', className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mi Salud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {encuestaPendiente && (
                    <Link
                        href="/portal/encuesta-morbilidad"
                        className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                        <Stethoscope className="size-3.5 shrink-0" />
                        Tienes una encuesta de morbilidad sin terminar
                    </Link>
                )}

                {historial.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin registros de condición de salud.</p>
                ) : (
                    <div className="space-y-2">
                        {historial.map((h, index) => (
                            <div key={index} className="flex items-center gap-2.5 text-xs">
                                <span className={cn('size-2 shrink-0 rounded-full', ESTADO_SALUD_DOT[h.estado] ?? 'bg-muted-foreground')} />
                                <span className="font-medium text-foreground">{h.estado}</span>
                                <span className="text-muted-foreground">{new Date(h.fecha_hora).toLocaleDateString('es-CO')}</span>
                            </div>
                        ))}
                    </div>
                )}

                <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/portal/condicion-salud">Ver detalle</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

export default function ColaboradorDashboard({
    colaborador,
    estadoHoy,
    jornadaAbierta,
    indiceRiesgo,
    ultimasPruebas,
    alertasPendientes,
    resumen,
}: ColaboradorDashboardProps) {
    const mesActual = new Date().getMonth() + 1;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Portal" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <Reveal>
                    <div className="flex items-center gap-4">
                        {colaborador.imagen ? (
                            <SafeImage
                                src={`/storage/${colaborador.imagen}`}
                                alt={colaborador.nombre_completo}
                                className="h-16 w-16 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <User className="size-6" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Bienvenido, <ShinyText color="#3F7A22">{colaborador.nombre_completo}</ShinyText>
                            </h1>
                            <p className="text-muted-foreground">
                                {colaborador.cargo ?? 'Colaborador'}
                                {colaborador.turno ? ` · Turno ${TURNO_LABELS[colaborador.turno] ?? colaborador.turno}` : ''}
                                {colaborador.area ? ` · ${colaborador.area}` : ''}
                            </p>
                        </div>
                    </div>
                </Reveal>

                {jornadaAbierta && (
                    <Reveal delay={40}>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                                <div>
                                    <p className="font-medium">Tienes una jornada sin cerrar</p>
                                    <p className="text-amber-800/90 dark:text-amber-300/80">
                                        Registraste tu ingreso pero todavía no tu salida, que es de carácter obligatorio.
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" asChild>
                                <Link href="/portal/condicion-salud">Registrar salida</Link>
                            </Button>
                        </div>
                    </Reveal>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Reveal delay={80}>
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Estado de hoy</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Badge variant={estadoHoy ? ESTADO_VARIANT[estadoHoy] : 'secondary'}>{estadoHoy ?? 'Sin evaluar'}</Badge>
                            </CardContent>
                        </Card>
                    </Reveal>

                    <Reveal delay={160}>
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Índice de riesgo ({indiceRiesgo.dias_considerados} días)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Badge variant={NIVEL_VARIANT[indiceRiesgo.nivel]}>{indiceRiesgo.nivel}</Badge>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {indiceRiesgo.pruebas_positivas} prueba(s) positiva(s) · {indiceRiesgo.salud_mala} episodio(s) de salud
                                </p>
                            </CardContent>
                        </Card>
                    </Reveal>

                    <Reveal delay={240}>
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Alertas pendientes</CardTitle>
                                <div className="flex size-9 items-center justify-center rounded-full bg-[#D4102A1a] text-[#D4102A]">
                                    <BellRing className="size-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold tracking-tight">
                                    <CountUp end={alertasPendientes} />
                                </p>
                            </CardContent>
                        </Card>
                    </Reveal>
                </div>

                {/* ══ Mi compensación ══ */}
                <div className="space-y-3">
                    <HeadingSmall title="Mi compensación" description="Tu ganancia diaria y tu variable mensual." />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Reveal delay={300}>
                            <TendenciaCompensacionChart data={resumen.compensacion_diaria.tendencia} />
                        </Reveal>
                        <Reveal delay={340}>
                            <CompensacionVariableMensualChart data={resumen.compensacion_variable.historial_mensual} mesActual={mesActual} />
                        </Reveal>
                    </div>
                    <KpiCardGrid className="sm:grid-cols-3">
                        <KpiCard label="Días trabajados (mes)" value={resumen.compensacion_diaria.dias_trabajados} icon={Calendar} color="#0891B2" />
                        <KpiCard label="Ganado este mes" value={formatCOP(resumen.compensacion_diaria.total_ganado)} icon={DollarSign} color={COLOR_COMPENSACION} />
                        <KpiCard
                            label={`Variable ${resumen.compensacion_variable.anio}`}
                            value={formatCOP(resumen.compensacion_variable.total_pago_variable)}
                            icon={DollarSign}
                            color={COLOR_COMPENSACION}
                        />
                    </KpiCardGrid>
                </div>

                {/* ══ Mis indicadores ══ */}
                <div className="space-y-3">
                    <HeadingSmall title="Mis indicadores" description="Premiación, capacitaciones e incidencias." />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Reveal delay={380}>
                            <RingGauge
                                percent={resumen.plan_premiacion.porcentaje}
                                label="Plan Premiación"
                                sublabel={`${resumen.plan_premiacion.aci_realizadas}/${resumen.plan_premiacion.meta} ACI este mes`}
                                color="#D97706"
                            />
                        </Reveal>
                        <Reveal delay={420}>
                            <RingGauge
                                percent={resumen.capacitaciones.porcentaje}
                                label="Capacitaciones"
                                sublabel={
                                    resumen.capacitaciones.pendientes > 0
                                        ? `${resumen.capacitaciones.pendientes} por revisar`
                                        : 'Estás al día'
                                }
                                color="#0D9488"
                            />
                        </Reveal>
                        <Reveal delay={460}>
                            <Card className="h-full border-sidebar-border/70 dark:border-sidebar-border">
                                <CardContent className="flex h-full flex-col justify-center gap-1 py-5">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Star className="size-4" style={{ color: '#D4102A' }} />
                                        <span className="text-sm font-semibold text-foreground">Mis Estrellas del Camión</span>
                                    </div>
                                    <p className="text-2xl font-semibold tracking-tight">{resumen.indicadores_reparto.jornadas_mes}</p>
                                    <p className="text-xs text-muted-foreground">jornada(s) registradas este mes</p>
                                    <Link
                                        href="/portal/mis-indicadores-reparto"
                                        className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                                    >
                                        Ver detalle →
                                    </Link>
                                </CardContent>
                            </Card>
                        </Reveal>
                    </div>
                    <Reveal delay={500}>
                        <GeovictoriaTendenciaChart data={resumen.geovictoria.tendencia} />
                    </Reveal>
                </div>

                {/* ══ Mi plan padrinos + Mi salud ══ */}
                <div className="space-y-3">
                    <HeadingSmall title="Mi plan padrinos y mi salud" description="Acompañamiento de ingreso y condición de salud." />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {resumen.plan_padrinos && (
                            <Reveal delay={540}>
                                <PadrinosStepper etapas={resumen.plan_padrinos.etapas} />
                            </Reveal>
                        )}
                        <Reveal delay={580}>
                            <SaludCard
                                historial={resumen.condicion_salud.historial}
                                encuestaPendiente={resumen.encuesta_morbilidad_pendiente}
                                className={!resumen.plan_padrinos ? 'lg:col-span-2' : undefined}
                            />
                        </Reveal>
                    </div>
                </div>

                <div className="space-y-3">
                    <HeadingSmall title="Últimas pruebas de alcoholemia" description="Tus 5 pruebas más recientes." />
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Resultado</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ultimasPruebas.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                            <AlertTriangle className="mx-auto mb-2 size-5" />
                                            Sin pruebas registradas.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {ultimasPruebas.map((prueba) => (
                                    <TableRow key={prueba.id}>
                                        <TableCell>{new Date(prueba.fecha_hora).toLocaleString()}</TableCell>
                                        <TableCell className="capitalize">{prueba.tipo}</TableCell>
                                        <TableCell>{prueba.resultado ?? '—'}</TableCell>
                                        <TableCell>
                                            {prueba.estado === 'programada' ? (
                                                <Badge variant="secondary">Programada</Badge>
                                            ) : (
                                                <Badge variant={prueba.es_positivo ? 'destructive' : 'default'}>
                                                    {prueba.es_positivo ? 'Positivo' : 'Negativo'}
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
