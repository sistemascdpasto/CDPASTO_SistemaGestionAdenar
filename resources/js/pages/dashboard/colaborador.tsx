import { CountUp } from '@/components/count-up';
import HeadingSmall from '@/components/heading-small';
import { Reveal } from '@/components/reveal';
import { SafeImage } from '@/components/safe-image';
import { ShinyText } from '@/components/shiny-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    BellRing,
    CalendarClock,
    CircleDollarSign,
    ClipboardCheck,
    GraduationCap,
    HeartPulse,
    Route,
    ShieldCheck,
    Star,
    Stethoscope,
    TestTube,
    Trophy,
    User,
    type LucideIcon,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const TURNO_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

type EstadoHoy = 'Apto' | 'Apto con Observaciones' | 'No Apto' | null;

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Apto: 'default',
    'Apto con Observaciones': 'secondary',
    'No Apto': 'destructive',
};

const CONDICION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Bueno: 'default',
    Regular: 'secondary',
    Malo: 'destructive',
};

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

interface CondicionRow {
    id: number;
    momento: string;
    estado: string;
    observacion: string | null;
    fecha_hora: string;
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
    ultimasCondiciones: CondicionRow[];
    alertasPendientes: number;
    pruebasMes: number;
    aci: { realizadas: number; meta: number };
    capacitaciones: { total: number; revisadas: number; pendientes: number; progreso: number };
}

const ACCESOS: { label: string; url: string; icon: LucideIcon }[] = [
    { label: 'Mi perfil', url: '/portal/perfil', icon: User },
    { label: 'Mis pruebas', url: '/portal/pruebas', icon: TestTube },
    { label: 'Mis planeaciones de ruta', url: '/portal/mis-rutas-reparto', icon: Route },
    { label: 'Mis estrellas del camión', url: '/portal/mis-indicadores-reparto', icon: Star },
    { label: 'Mi plan premiación', url: '/portal/mi-plan-premiacion', icon: Trophy },
    { label: 'Mi compensación diaria', url: '/portal/mi-compensacion', icon: CalendarClock },
    { label: 'Mi compensación variable', url: '/portal/mi-compensacion-variable', icon: CircleDollarSign },
    { label: 'Condición de salud', url: '/portal/condicion-salud', icon: HeartPulse },
    { label: 'Encuesta de morbilidad', url: '/portal/encuesta-morbilidad', icon: Stethoscope },
    { label: 'Mis capacitaciones', url: '/portal/capacitaciones', icon: GraduationCap },
    { label: 'Mis alertas', url: '/portal/alertas', icon: BellRing },
];

function KpiCard({
    label,
    icon: Icon,
    color,
    children,
    hint,
}: {
    label: string;
    icon: LucideIcon;
    color: string;
    children: React.ReactNode;
    hint?: string;
}) {
    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a`, color }}>
                    <Icon className="size-4" />
                </div>
            </CardHeader>
            <CardContent>
                {children}
                {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
    ultimasCondiciones,
    alertasPendientes,
    pruebasMes,
    aci,
    capacitaciones,
}: ColaboradorDashboardProps) {
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
                                className="size-16 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
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

                <Reveal delay={80}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <KpiCard label="Estado de hoy" icon={ClipboardCheck} color="#3F7A22">
                            <Badge variant={estadoHoy ? ESTADO_VARIANT[estadoHoy] : 'secondary'}>{estadoHoy ?? 'Sin evaluar'}</Badge>
                        </KpiCard>

                        <KpiCard
                            label="Índice de riesgo"
                            icon={ShieldCheck}
                            color={indiceRiesgo.nivel === 'Alto' ? '#D4102A' : indiceRiesgo.nivel === 'Medio' ? '#B45309' : '#3F7A22'}
                            hint={`${indiceRiesgo.pruebas_positivas} positiva(s) · ${indiceRiesgo.salud_mala} de salud · ${indiceRiesgo.dias_considerados} días`}
                        >
                            <Badge variant={NIVEL_VARIANT[indiceRiesgo.nivel]}>{indiceRiesgo.nivel}</Badge>
                        </KpiCard>

                        <KpiCard label="Alertas pendientes" icon={BellRing} color="#D4102A">
                            <p className="text-2xl font-semibold tabular-nums tracking-tight">
                                <CountUp end={alertasPendientes} />
                            </p>
                        </KpiCard>

                        <KpiCard label="Pruebas este mes" icon={TestTube} color="#0369A1" hint="Alcoholemias realizadas">
                            <p className="text-2xl font-semibold tabular-nums tracking-tight">
                                <CountUp end={pruebasMes} />
                            </p>
                        </KpiCard>

                        <KpiCard label="ACI del mes" icon={Trophy} color="#D97706" hint={`Meta del mes: ${aci.meta}`}>
                            <p className="text-2xl font-semibold tabular-nums tracking-tight">
                                <CountUp end={aci.realizadas} />
                                <span className="text-base font-medium text-muted-foreground">/{aci.meta}</span>
                            </p>
                        </KpiCard>

                        <KpiCard
                            label="Capacitaciones"
                            icon={GraduationCap}
                            color="#0D9488"
                            hint={
                                capacitaciones.total > 0
                                    ? `${capacitaciones.revisadas}/${capacitaciones.total} vistas · ${capacitaciones.progreso}%`
                                    : 'Sin material asignado'
                            }
                        >
                            <p className="text-2xl font-semibold tabular-nums tracking-tight">
                                <CountUp end={capacitaciones.pendientes} />
                                <span className="ml-1 text-sm font-medium text-muted-foreground">
                                    {capacitaciones.pendientes === 1 ? 'pendiente' : 'pendientes'}
                                </span>
                            </p>
                        </KpiCard>
                    </div>
                </Reveal>

                <Reveal delay={140}>
                    <Card className="border-amber-200/70 bg-gradient-to-r from-amber-500/5 to-transparent dark:border-amber-800/40 dark:from-amber-950/20">
                        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                    <Trophy className="size-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Plan Premiación</p>
                                    <p className="text-xs text-muted-foreground">Revisa tus indicadores y metas del mes.</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/portal/mi-plan-premiacion">Ver mis resultados</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </Reveal>

                <div className="space-y-3">
                    <HeadingSmall title="Acceso rápido" description="Todo tu portal en un solo lugar." />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {ACCESOS.map((acceso, i) => (
                            <Reveal key={acceso.url} delay={i * 40}>
                                <Link
                                    href={acceso.url}
                                    className="group flex h-full flex-col items-center gap-2 rounded-lg border border-sidebar-border/70 bg-card p-4 text-center transition-colors hover:border-foreground/20 hover:bg-muted/40 dark:border-sidebar-border"
                                >
                                    <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                                        <acceso.icon className="size-4" />
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{acceso.label}</span>
                                </Link>
                            </Reveal>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                        <HeadingSmall title="Últimas pruebas de alcoholemia" description="Tus 5 pruebas más recientes." />
                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
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
                                    {ultimasPruebas.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                                                <AlertTriangle className="mx-auto mb-2 size-5" />
                                                Sin pruebas registradas.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        ultimasPruebas.map((prueba) => (
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
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <HeadingSmall title="Últimas condiciones de salud" description="Tus 5 autorregistros más recientes." />
                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Momento</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Observación</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ultimasCondiciones.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                                                <HeartPulse className="mx-auto mb-2 size-5" />
                                                Sin registros de condición de salud.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        ultimasCondiciones.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell>{new Date(c.fecha_hora).toLocaleString()}</TableCell>
                                                <TableCell className="capitalize">{c.momento}</TableCell>
                                                <TableCell>
                                                    <Badge variant={CONDICION_VARIANT[c.estado] ?? 'secondary'}>{c.estado}</Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[16rem] truncate text-muted-foreground">{c.observacion ?? '—'}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
