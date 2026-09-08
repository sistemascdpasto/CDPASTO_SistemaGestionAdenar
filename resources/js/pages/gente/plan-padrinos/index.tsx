import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Search, ShieldAlert, UserCheck } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Seguimiento de Pruebas y Plan Padrino', href: '/modules/gente/plan-padrinos' },
];

interface EtapaInfo {
    aplica: boolean;
    estado: 'realizada' | 'pendiente' | 'destiempo' | 'no_aplica';
    fecha_prueba: string;
    fecha_prueba_formateada: string;
    dias_vencido: number;
    fecha_realizacion: string | null;
    realizado_por: string | null;
    observaciones: string | null;
}

interface ColaboradorRow {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    fecha_ingreso: string;
    etapas: Record<string, EtapaInfo>;
}

interface Metrics {
    pendientes_7: number;
    pendientes_30: number;
    pendientes_90: number;
    total_destiempo: number;
    total_realizadas: number;
}

interface Filters {
    search: string;
    estado: string;
}

interface Props {
    colaboradores: ColaboradorRow[];
    metrics: Metrics;
    filters: Filters;
}

export default function SeguimientoPruebasIndex({ colaboradores, metrics, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [loadingIdEtapa, setLoadingIdEtapa] = useState<string | null>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        router.get(
            route('gente.plan-padrinos.index'),
            { search: val, estado: filters.estado },
            { preserveState: true, replace: true }
        );
    };

    const handleFilterEstado = (nuevoEstado: string) => {
        router.get(
            route('gente.plan-padrinos.index'),
            { search, estado: nuevoEstado },
            { preserveState: true, replace: true }
        );
    };

    const handleTogglePrueba = (colaboradorId: number, etapaKey: string, actualmenteRealizada: boolean) => {
        const key = `${colaboradorId}-${etapaKey}`;
        setLoadingIdEtapa(key);
        router.post(
            route('gente.plan-padrinos.toggle'),
            {
                colaborador_id: colaboradorId,
                etapa: etapaKey,
                realizada: !actualmenteRealizada,
            },
            {
                preserveScroll: true,
                onFinish: () => setLoadingIdEtapa(null),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Seguimiento de Pruebas y Plan Padrino" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                <HeadingSmall
                    title="Seguimiento de Pruebas y Plan Padrino"
                    description="Evaluación automática de etapas de prueba (7, 30 y 90 días) para colaboradores activos de la empresa."
                />

                {/* Tarjetas de Resumen Superior */}
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Card 7 días */}
                    <Card className="border-l-4 border-l-amber-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                Prueba 7 Días
                            </CardTitle>
                            <Clock className="h-5 w-5 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-300">
                                {metrics.pendientes_7}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">pendientes de realizar</p>
                        </CardContent>
                    </Card>

                    {/* Card 30 días */}
                    <Card className="border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                Prueba 30 Días
                            </CardTitle>
                            <Calendar className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-300">
                                {metrics.pendientes_30}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">pendientes de realizar</p>
                        </CardContent>
                    </Card>

                    {/* Card 90 días */}
                    <Card className="border-l-4 border-l-purple-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                                Prueba 90 Días
                            </CardTitle>
                            <UserCheck className="h-5 w-5 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-300">
                                {metrics.pendientes_90}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">pendientes de realizar</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros y Búsqueda */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border shadow-sm">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Buscar por colaborador, cédula o cargo..."
                            value={search}
                            onChange={handleSearchChange}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={filters.estado === 'todos' || !filters.estado ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterEstado('todos')}
                        >
                            Todas
                        </Button>
                        <Button
                            variant={filters.estado === 'pendientes' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterEstado('pendientes')}
                            className="text-amber-700 border-amber-300 dark:text-amber-300"
                        >
                            <Clock className="mr-1 h-3.5 w-3.5" />
                            Pendientes
                        </Button>
                        <Button
                            variant={filters.estado === 'destiempo' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterEstado('destiempo')}
                            className="text-red-700 border-red-300 dark:text-red-300"
                        >
                            <AlertCircle className="mr-1 h-3.5 w-3.5" />
                            A Destiempo ({metrics.total_destiempo})
                        </Button>
                        <Button
                            variant={filters.estado === 'realizadas' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterEstado('realizadas')}
                            className="text-emerald-700 border-emerald-300 dark:text-emerald-300"
                        >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Realizadas ({metrics.total_realizadas})
                        </Button>
                    </div>
                </div>

                {/* Matriz Principal */}
                <Card className="shadow-sm overflow-hidden border">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[300px] font-bold text-foreground">COLABORADOR</TableHead>
                                    <TableHead className="w-[260px] text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-500/5">
                                        7 DÍAS
                                    </TableHead>
                                    <TableHead className="w-[260px] text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-500/5">
                                        30 DÍAS
                                    </TableHead>
                                    <TableHead className="w-[260px] text-center font-bold text-purple-700 dark:text-purple-400 bg-purple-500/5">
                                        90 DÍAS
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {colaboradores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                            No se encontraron colaboradores en etapa de prueba según los filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    colaboradores.map((colaborador) => (
                                        <TableRow key={colaborador.id} className="hover:bg-muted/30">
                                            {/* Colaborador Info */}
                                            <TableCell className="align-top font-medium py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-base font-semibold text-foreground">
                                                        {colaborador.nombre_completo}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Badge variant="outline" className="font-medium text-xs">
                                                            {colaborador.cargo}
                                                        </Badge>
                                                        <span>C.C. {colaborador.cedula}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground mt-0.5">
                                                        Ingreso: <strong className="text-foreground">{colaborador.fecha_ingreso}</strong>
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Etapas: 7, 30, 90 */}
                                            {(['7_dias', '30_dias', '90_dias'] as const).map((etapaKey) => {
                                                const etapa = colaborador.etapas[etapaKey];
                                                const key = `${colaborador.id}-${etapaKey}`;
                                                const isLoading = loadingIdEtapa === key;

                                                if (!etapa || !etapa.aplica || etapa.estado === 'no_aplica') {
                                                    return (
                                                        <TableCell key={etapaKey} className="text-center align-middle text-muted-foreground/40 font-bold text-xl">
                                                            —
                                                        </TableCell>
                                                    );
                                                }

                                                return (
                                                    <TableCell key={etapaKey} className="align-top py-3 px-3">
                                                        <div className="flex flex-col gap-2 rounded-lg border p-3 bg-card shadow-2xs">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-muted-foreground font-medium">Fecha prueba:</span>
                                                                <span className="font-semibold">{etapa.fecha_prueba_formateada}</span>
                                                            </div>

                                                            {/* Estado: Realizada */}
                                                            {etapa.estado === 'realizada' && (
                                                                <div className="flex flex-col gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs">
                                                                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                                                                        <span className="flex items-center gap-1">
                                                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                                            Realizada
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[11px] text-muted-foreground mt-1">
                                                                        <div>Realizada: <strong>{etapa.fecha_realizacion}</strong></div>
                                                                        <div>Por: <strong>{etapa.realizado_por}</strong></div>
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={isLoading}
                                                                        onClick={() => handleTogglePrueba(colaborador.id, etapaKey, true)}
                                                                        className="mt-1 h-7 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    >
                                                                        Desmarcar
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {/* Estado: Pendiente */}
                                                            {etapa.estado === 'pendiente' && (
                                                                <div className="flex flex-col gap-2 rounded bg-amber-500/10 border border-amber-500/30 p-2 text-xs">
                                                                    <div className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300">
                                                                        <Clock className="h-4 w-4 text-amber-600" />
                                                                        Pendiente
                                                                    </div>
                                                                    <Button
                                                                        variant="default"
                                                                        size="sm"
                                                                        disabled={isLoading}
                                                                        onClick={() => handleTogglePrueba(colaborador.id, etapaKey, false)}
                                                                        className="w-full h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                                                                    >
                                                                        {isLoading ? 'Guardando...' : 'Marcar como realizada'}
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {/* Estado: A Destiempo */}
                                                            {etapa.estado === 'destiempo' && (
                                                                <div className="flex flex-col gap-2 rounded bg-red-500/10 border border-red-500/30 p-2 text-xs">
                                                                    <div className="flex items-center gap-1 font-bold text-red-700 dark:text-red-300">
                                                                        <ShieldAlert className="h-4 w-4 text-red-600" />
                                                                        A destiempo
                                                                    </div>
                                                                    <p className="text-[11px] font-medium text-red-600/90 dark:text-red-400">
                                                                        Venció hace <strong>{etapa.dias_vencido} {etapa.dias_vencido === 1 ? 'día' : 'días'}</strong>.
                                                                    </p>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        disabled={isLoading}
                                                                        onClick={() => handleTogglePrueba(colaborador.id, etapaKey, false)}
                                                                        className="w-full h-8 text-xs font-semibold"
                                                                    >
                                                                        {isLoading ? 'Guardando...' : 'Registrar realizada'}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
