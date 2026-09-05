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
import { AlertTriangle, BellRing, Truck, User } from 'lucide-react';

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
    asignacionConductor: { apto_rutas_criticas: string | null } | null;
}

export default function ColaboradorDashboard({
    colaborador,
    estadoHoy,
    jornadaAbierta,
    indiceRiesgo,
    ultimasPruebas,
    alertasPendientes,
    asignacionConductor,
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

                {asignacionConductor && (
                    <Reveal delay={280}>
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                                <Truck className="size-4 text-muted-foreground" />
                                <CardTitle className="text-sm font-medium text-muted-foreground">Evaluación de conductor</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between gap-4">
                                <p className="text-sm text-muted-foreground">
                                    Apto para rutas críticas: <span className="font-medium text-foreground">{asignacionConductor.apto_rutas_criticas ?? '—'}</span>
                                </p>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href="/portal/rutas">Ver detalle</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </Reveal>
                )}

                {/* Plan Premiación */}
                <Reveal delay={300}>
                    <Card className="border-amber-200/70 bg-gradient-to-r from-amber-500/5 to-transparent dark:border-amber-800/40 dark:from-amber-950/20">
                        <CardContent className="flex items-center justify-between gap-4 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-xl">
                                    🏆
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Plan Premiación</p>
                                    <p className="text-xs text-muted-foreground">Revisa tus indicadores y metas del mes</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" asChild className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30">
                                <Link href="/portal/mi-plan-premiacion">Ver mis resultados</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </Reveal>

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
