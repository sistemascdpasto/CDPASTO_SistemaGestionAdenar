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
    Calendar,
    DollarSign,
    GraduationCap,
    HeartPulse,
    type LucideIcon,
    Star,
    Stethoscope,
    Trophy,
    User,
    UserCheck,
} from 'lucide-react';
import { type ReactNode } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const TURNO_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

type EstadoHoy = 'Apto' | 'Apto con Observaciones' | 'No Apto' | null;

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Apto: 'default',
    'Apto con Observaciones': 'secondary',
    'No Apto': 'destructive',
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

interface Resumen {
    compensacion_diaria: { dias_trabajados: number; total_ganado: number };
    compensacion_variable: { total_pago_variable: number; anio: number };
    plan_premiacion: { aci_realizadas: number; meta: number };
    plan_padrinos: { etapa_pendiente: string | null } | null;
    geovictoria: { recientes_30_dias: number };
    capacitaciones_pendientes: number;
    condicion_salud: { estado: 'Bueno' | 'Regular' | 'Malo' | null; fecha_hora: string | null };
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

const ESTADO_SALUD_COLOR: Record<string, string> = {
    Bueno: 'text-green-700 dark:text-green-400',
    Regular: 'text-amber-600 dark:text-amber-400',
    Malo: 'text-destructive',
};

interface TeaserCardProps {
    icon: LucideIcon;
    color: string;
    titulo: string;
    href: string;
    delay?: number;
    children: ReactNode;
}

function TeaserCard({ icon: Icon, color, titulo, href, delay = 0, children }: TeaserCardProps) {
    return (
        <Reveal delay={delay}>
            <Card className="h-full border-sidebar-border/70 dark:border-sidebar-border">
                <CardContent className="flex h-full items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex size-10 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}1a`, color }}
                        >
                            <Icon className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{titulo}</p>
                            <div className="text-xs text-muted-foreground">{children}</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={href}>Ver más</Link>
                    </Button>
                </CardContent>
            </Card>
        </Reveal>
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

                {/* Resumen de todo el portal */}
                <div className="space-y-3">
                    <HeadingSmall title="Mi resumen" description="Cómo vas en cada área de tu portal." />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <TeaserCard icon={Trophy} color="#D97706" titulo="Plan Premiación" href="/portal/mi-plan-premiacion" delay={300}>
                            {resumen.plan_premiacion.aci_realizadas}/{resumen.plan_premiacion.meta} ACI realizadas este mes
                        </TeaserCard>

                        <TeaserCard icon={Calendar} color="#0891B2" titulo="Mi Compensación Diaria" href="/portal/mi-compensacion" delay={340}>
                            {resumen.compensacion_diaria.dias_trabajados} día(s) trabajados · {formatCOP(resumen.compensacion_diaria.total_ganado)}{' '}
                            este mes
                        </TeaserCard>

                        <TeaserCard
                            icon={DollarSign}
                            color="#15803d"
                            titulo="Mi Compensación Variable"
                            href="/portal/mi-compensacion-variable"
                            delay={380}
                        >
                            {formatCOP(resumen.compensacion_variable.total_pago_variable)} en {resumen.compensacion_variable.anio}
                        </TeaserCard>

                        {resumen.plan_padrinos && (
                            <TeaserCard icon={UserCheck} color="#7C3AED" titulo="Mi Plan Padrinos" href="/portal/mi-plan-padrinos" delay={420}>
                                {resumen.plan_padrinos.etapa_pendiente
                                    ? `Etapa ${resumen.plan_padrinos.etapa_pendiente} pendiente`
                                    : 'Todas tus etapas están al día'}
                            </TeaserCard>
                        )}

                        <TeaserCard
                            icon={AlertTriangle}
                            color="#D4102A"
                            titulo="Mis Incidencias GeoVictoria"
                            href="/portal/mis-incidencias-geovictoria"
                            delay={460}
                        >
                            {resumen.geovictoria.recientes_30_dias > 0
                                ? `${resumen.geovictoria.recientes_30_dias} incidencia(s) en los últimos 30 días`
                                : 'Sin incidencias recientes'}
                        </TeaserCard>

                        <TeaserCard icon={GraduationCap} color="#0D9488" titulo="Mis Capacitaciones" href="/portal/capacitaciones" delay={500}>
                            {resumen.capacitaciones_pendientes > 0
                                ? `${resumen.capacitaciones_pendientes} material(es) por revisar`
                                : 'Estás al día'}
                        </TeaserCard>

                        <TeaserCard icon={HeartPulse} color="#3F7A22" titulo="Condición de Salud" href="/portal/condicion-salud" delay={540}>
                            {resumen.condicion_salud.estado ? (
                                <span className={ESTADO_SALUD_COLOR[resumen.condicion_salud.estado]}>
                                    Último registro: {resumen.condicion_salud.estado}
                                </span>
                            ) : (
                                'Sin registros'
                            )}
                        </TeaserCard>

                        {resumen.encuesta_morbilidad_pendiente && (
                            <TeaserCard
                                icon={Stethoscope}
                                color="#3F7A22"
                                titulo="Encuesta de Morbilidad"
                                href="/portal/encuesta-morbilidad"
                                delay={580}
                            >
                                Tienes una encuesta sin terminar
                            </TeaserCard>
                        )}

                        <TeaserCard icon={Star} color="#D4102A" titulo="Mis Estrellas del Camión" href="/portal/mis-indicadores-reparto" delay={620}>
                            {resumen.indicadores_reparto.jornadas_mes} jornada(s) registradas este mes
                        </TeaserCard>
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
