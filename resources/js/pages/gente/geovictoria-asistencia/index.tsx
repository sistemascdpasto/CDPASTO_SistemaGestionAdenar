import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, BedDouble, CalendarClock, Clock, Moon, Search, Timer, Users } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Asistencia GeoVictoria', href: '/modules/gente/asistencia-geovictoria' },
];

const TODOS = 'todos';

type Vista = 'hoy' | 'indicadores' | 'detalle';

// Misma paleta warning/critical ya validada (chequeo de daltonismo) que usa
// el módulo de Consultas SIMIT, para mantener el mismo lenguaje visual de
// alerta en toda la app.
const COLOR_EXCESO_JORNADA = '#d03b3b'; // critical
const COLOR_DESCANSO_NO_EFECTIVO = '#fab219'; // warning
const COLOR_NEUTRO = '#2a78d6'; // categorical slot 1 (azul), para series únicas

interface RegistroRow {
    id: number;
    identificador: string;
    fecha: string;
    apellidos: string | null;
    nombres: string | null;
    cargo: string | null;
    grupo: string | null;
    permiso: string | null;
    turno: string | null;
    entrada: string | null;
    salida_descanso: string | null;
    ingreso_descanso: string | null;
    salida: string | null;
    horas_trabajadas: string | null;
    hea: string | null;
    hec: string | null;
    hnt: string | null;
    exceso_jornada: boolean;
    horas_descanso_previo: string | null;
    descanso_no_efectivo: boolean;
    hora_minima_entrada: string | null;
}

interface SeguimientoRow {
    id: number;
    fecha: string;
    identificador: string;
    nombre: string;
    cargo: string | null;
    grupo: string | null;
    salida: string | null;
    hora_minima_entrada: string;
    entrada_siguiente: string | null;
    estado: 'pendiente' | 'cumplio' | 'incumplio';
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface RegistrosPaginator {
    data: RegistroRow[];
    links: PaginationLink[];
    from: number | null;
}

type Filters = {
    search: string;
    grupo: string;
    cargo: string;
    tipo: string;
    fecha_desde: string;
    fecha_hasta: string;
};

interface TendenciaDia {
    fecha: string;
    exceso_jornada: number;
    descanso_no_efectivo: number;
}

interface TopEmpleado {
    identificador: string;
    nombre: string;
    total_exceso_jornada: number;
    total_descanso_no_efectivo: number;
}

interface PorGrupo {
    grupo: string;
    exceso_jornada: number;
    descanso_no_efectivo: number;
}

interface PorCargo {
    cargo: string;
    total: number;
}

interface HorasPorCargo {
    cargo: string;
    horas: number;
}

interface Indicadores {
    resumen: {
        total_registros: number;
        empleados: number;
        pct_exceso_jornada: number;
        pct_descanso_no_efectivo: number;
        promedio_horas_trabajadas: string | null;
    };
    tendencia_diaria: TendenciaDia[];
    top_empleados: TopEmpleado[];
    por_grupo: PorGrupo[];
    distribucion_cargo: PorCargo[];
    horas_promedio_cargo: HorasPorCargo[];
}

interface Hoy {
    fecha: string;
    registros: RegistroRow[];
    resumen: {
        total: number;
        exceso_jornada: number;
        descanso_no_efectivo: number;
    };
}

interface Opciones {
    grupos: string[];
    cargos: string[];
}

function formatFechaCorta(fecha: string): string {
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
}

function nombreCompleto(registro: RegistroRow): string {
    return [registro.nombres, registro.apellidos].filter(Boolean).join(' ') || registro.identificador;
}

function EmptyChart({ children }: { children: React.ReactNode }) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

// Tabla compartida por "Hoy" y "Detalle": mismas columnas en el mismo
// orden en ambas pestañas. "Hoy" la usa sin paginación (from=1, sin lista
// de links); "Detalle" le pasa la página actual del paginador.
function RegistroTable({ data, from, emptyMessage }: { data: RegistroRow[]; from: number; emptyMessage: string }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Salida descanso</TableHead>
                        <TableHead>Ingreso descanso</TableHead>
                        <TableHead>Salida</TableHead>
                        <TableHead>Horas trabajadas</TableHead>
                        <TableHead>Exceso jornada</TableHead>
                        <TableHead>Descanso previo</TableHead>
                        <TableHead>Descanso no efectivo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={14} className="text-muted-foreground py-6 text-center">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                    {data.map((registro, index) => (
                        <TableRow
                            key={registro.id}
                            className={registro.exceso_jornada || registro.descanso_no_efectivo ? 'bg-destructive/5' : undefined}
                        >
                            <TableCell className="text-muted-foreground">{from + index}</TableCell>
                            <TableCell>{registro.fecha}</TableCell>
                            <TableCell>{registro.identificador}</TableCell>
                            <TableCell className="font-medium">{nombreCompleto(registro)}</TableCell>
                            <TableCell>{registro.cargo ?? '—'}</TableCell>
                            <TableCell>{registro.grupo ?? '—'}</TableCell>
                            <TableCell>{registro.entrada ?? '—'}</TableCell>
                            <TableCell>{registro.salida_descanso ?? '—'}</TableCell>
                            <TableCell>{registro.ingreso_descanso ?? '—'}</TableCell>
                            <TableCell>{registro.salida ?? '—'}</TableCell>
                            <TableCell>{registro.horas_trabajadas ?? '—'}</TableCell>
                            <TableCell>
                                {registro.exceso_jornada ? (
                                    <Badge variant="destructive" className="gap-1">
                                        <Timer className="size-3" />
                                        Sí
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        No
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>{registro.horas_descanso_previo ?? '—'}</TableCell>
                            <TableCell>
                                {registro.descanso_no_efectivo ? (
                                    <Badge variant="secondary" className="gap-1">
                                        <AlertTriangle className="size-3" />
                                        Sí
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        No
                                    </Badge>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

// "2026-10-01 07:00" -> "07:00 (01/10)"
function formatHoraMinima(valor: string): string {
    const [fecha, hora] = valor.split(' ');
    return `${hora} (${formatFechaCorta(fecha)})`;
}

function EstadoSeguimiento({ estado }: { estado: SeguimientoRow['estado'] }) {
    if (estado === 'incumplio') {
        return (
            <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" />
                Entró antes
            </Badge>
        );
    }
    if (estado === 'cumplio') {
        return (
            <Badge variant="outline" className="border-[#0ca30c] text-[#0ca30c]">
                Cumplió
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-muted-foreground">
            Pendiente
        </Badge>
    );
}

// Salidas después de las 18:30 de ayer y hoy, con la hora desde la que
// pueden marcar la siguiente entrada sin caer en descanso no efectivo.
function SeguimientoTable({ data }: { data: SeguimientoRow[] }) {
    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Moon className="size-4" />
                    Seguimiento de salidas después de las 6:30 pm (ayer y hoy)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Empleado</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Grupo</TableHead>
                                <TableHead>Salida</TableHead>
                                <TableHead>Puede entrar desde</TableHead>
                                <TableHead>Entrada siguiente</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-muted-foreground py-6 text-center">
                                        Nadie ha marcado salida después de las 6:30 pm ayer ni hoy.
                                    </TableCell>
                                </TableRow>
                            )}
                            {data.map((fila) => (
                                <TableRow key={fila.id} className={fila.estado === 'incumplio' ? 'bg-destructive/5' : undefined}>
                                    <TableCell>{fila.fecha}</TableCell>
                                    <TableCell className="font-medium">{fila.nombre}</TableCell>
                                    <TableCell>{fila.cargo ?? '—'}</TableCell>
                                    <TableCell>{fila.grupo ?? '—'}</TableCell>
                                    <TableCell>{fila.salida ?? '—'}</TableCell>
                                    <TableCell className="font-medium">{formatHoraMinima(fila.hora_minima_entrada)}</TableCell>
                                    <TableCell>{fila.entrada_siguiente ?? '—'}</TableCell>
                                    <TableCell>
                                        <EstadoSeguimiento estado={fila.estado} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function GeovictoriaAsistenciaIndex({
    registros,
    indicadores,
    hoy,
    seguimiento,
    filters,
    opciones,
}: {
    registros: RegistrosPaginator;
    indicadores: Indicadores;
    hoy: Hoy;
    seguimiento: SeguimientoRow[];
    filters: Filters;
    opciones: Opciones;
}) {
    const [vista, setVista] = useState<Vista>('hoy');
    const [search, setSearch] = useState(filters.search);
    const isFirstRender = useRef(true);

    const applyFilters = (overrides: Partial<Filters>) => {
        router.get(route('gente.asistencia-geovictoria.index'), { ...filters, search, ...overrides }, { preserveState: true, replace: true });
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const timeout = setTimeout(() => applyFilters({ search }), 400);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const submitFilters: FormEventHandler = (e) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const sinTendencia = indicadores.tendencia_diaria.every((dia) => dia.exceso_jornada + dia.descanso_no_efectivo === 0);
    const sinPorGrupo = indicadores.por_grupo.every((g) => g.exceso_jornada + g.descanso_no_efectivo === 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Asistencia GeoVictoria" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall
                        title="Asistencia GeoVictoria"
                        description="Exceso de jornada y descanso no efectivo, calculados automáticamente cada día."
                    />
                    <div className="flex rounded-md border border-sidebar-border/70 p-1">
                        <Button type="button" variant={vista === 'hoy' ? 'default' : 'ghost'} size="sm" onClick={() => setVista('hoy')}>
                            Hoy
                        </Button>
                        <Button
                            type="button"
                            variant={vista === 'indicadores' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setVista('indicadores')}
                        >
                            Indicadores
                        </Button>
                        <Button type="button" variant={vista === 'detalle' ? 'default' : 'ghost'} size="sm" onClick={() => setVista('detalle')}>
                            Detalle
                        </Button>
                    </div>
                </div>

                {vista === 'hoy' ? (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="size-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Registros del día en curso</span>
                            <Badge variant="outline">{hoy.fecha}</Badge>
                        </div>

                        <KpiCardGrid className="sm:grid-cols-3">
                            <KpiCard label="Registros hoy" value={hoy.resumen.total} icon={Clock} color="#0ca30c" />
                            <KpiCard label="Exceso de jornada" value={hoy.resumen.exceso_jornada} icon={Timer} color={COLOR_EXCESO_JORNADA} />
                            <KpiCard
                                label="Descanso no efectivo"
                                value={hoy.resumen.descanso_no_efectivo}
                                icon={BedDouble}
                                color={COLOR_DESCANSO_NO_EFECTIVO}
                            />
                        </KpiCardGrid>

                        <SeguimientoTable data={seguimiento} />

                        <RegistroTable data={hoy.registros} from={1} emptyMessage="Todavía no hay registros de hoy." />
                    </div>
                ) : vista === 'indicadores' ? (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="grid gap-1">
                                <Label className="text-xs text-muted-foreground">Desde</Label>
                                <Input
                                    type="date"
                                    className="w-40"
                                    value={filters.fecha_desde}
                                    onChange={(e) => applyFilters({ fecha_desde: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs text-muted-foreground">Hasta</Label>
                                <Input
                                    type="date"
                                    className="w-40"
                                    value={filters.fecha_hasta}
                                    onChange={(e) => applyFilters({ fecha_hasta: e.target.value })}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyFilters({ fecha_desde: hoy.fecha, fecha_hasta: hoy.fecha })}
                            >
                                Hoy
                            </Button>
                            {(filters.fecha_desde !== '' || filters.fecha_hasta !== '') && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => applyFilters({ fecha_desde: '', fecha_hasta: '' })}
                                >
                                    Limpiar rango
                                </Button>
                            )}
                        </div>

                        <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-5">
                            <KpiCard label="Empleados monitoreados" value={indicadores.resumen.empleados} icon={Users} color="#0ca30c" />
                            <KpiCard label="Registros totales" value={indicadores.resumen.total_registros} icon={Clock} color="#0ca30c" />
                            <KpiCard
                                label="Exceso de jornada"
                                value={indicadores.resumen.pct_exceso_jornada}
                                suffix="%"
                                decimals={1}
                                icon={Timer}
                                color={COLOR_EXCESO_JORNADA}
                            />
                            <KpiCard
                                label="Descanso no efectivo"
                                value={indicadores.resumen.pct_descanso_no_efectivo}
                                suffix="%"
                                decimals={1}
                                icon={BedDouble}
                                color={COLOR_DESCANSO_NO_EFECTIVO}
                            />
                            <KpiCard
                                label="Promedio horas trabajadas"
                                value={indicadores.resumen.promedio_horas_trabajadas ?? '—'}
                                icon={Clock}
                                color="#0ca30c"
                            />
                        </KpiCardGrid>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Incidencias por día
                                        {filters.fecha_desde || filters.fecha_hasta ? ' (rango seleccionado)' : ' (últimos 30 días)'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {sinTendencia ? (
                                        <EmptyChart>Todavía no hay incidencias registradas en este rango.</EmptyChart>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={indicadores.tendencia_diaria}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="fecha" tickFormatter={formatFechaCorta} tick={{ fontSize: 12 }} interval={2} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                <Tooltip labelFormatter={(label) => formatFechaCorta(String(label))} />
                                                <Legend
                                                    formatter={(value: string) =>
                                                        value === 'exceso_jornada' ? 'Exceso de jornada' : 'Descanso no efectivo'
                                                    }
                                                />
                                                <Bar dataKey="exceso_jornada" stackId="dia" name="exceso_jornada" fill={COLOR_EXCESO_JORNADA} />
                                                <Bar
                                                    dataKey="descanso_no_efectivo"
                                                    stackId="dia"
                                                    name="descanso_no_efectivo"
                                                    radius={[4, 4, 0, 0]}
                                                    fill={COLOR_DESCANSO_NO_EFECTIVO}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Incidencias por grupo</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {sinPorGrupo ? (
                                        <EmptyChart>Todavía no hay incidencias registradas.</EmptyChart>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={indicadores.por_grupo}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="grupo" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={50} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Legend
                                                    formatter={(value: string) =>
                                                        value === 'exceso_jornada' ? 'Exceso de jornada' : 'Descanso no efectivo'
                                                    }
                                                />
                                                <Bar dataKey="exceso_jornada" name="exceso_jornada" fill={COLOR_EXCESO_JORNADA} />
                                                <Bar
                                                    dataKey="descanso_no_efectivo"
                                                    name="descanso_no_efectivo"
                                                    radius={[4, 4, 0, 0]}
                                                    fill={COLOR_DESCANSO_NO_EFECTIVO}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Registros por cargo</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {indicadores.distribucion_cargo.length === 0 ? (
                                    <EmptyChart>Todavía no hay registros.</EmptyChart>
                                ) : (
                                    // Barras horizontales en vez de dona: con muchos cargos distintos
                                    // (esta empresa tiene más de 15) cada categoría ya se distingue por
                                    // su fila/etiqueta, no por color — así se evita una leyenda
                                    // imposible de leer y colores que tendrían que ciclarse.
                                    <ResponsiveContainer width="100%" height={Math.max(280, indicadores.distribucion_cargo.length * 32)}>
                                        <BarChart data={indicadores.distribucion_cargo} layout="vertical" margin={{ left: 8, right: 16 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                                            <YAxis type="category" dataKey="cargo" width={170} tick={{ fontSize: 11 }} interval={0} />
                                            <Tooltip />
                                            <Bar dataKey="total" name="Registros" fill={COLOR_NEUTRO} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Top 10 empleados con más incidencias
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {indicadores.top_empleados.length === 0 ? (
                                        <EmptyChart>Ningún empleado ha registrado incidencias todavía.</EmptyChart>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={indicadores.top_empleados}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="nombre" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Legend
                                                    formatter={(value: string) =>
                                                        value === 'total_exceso_jornada' ? 'Exceso de jornada' : 'Descanso no efectivo'
                                                    }
                                                />
                                                <Bar
                                                    dataKey="total_exceso_jornada"
                                                    name="total_exceso_jornada"
                                                    stackId="emp"
                                                    fill={COLOR_EXCESO_JORNADA}
                                                />
                                                <Bar
                                                    dataKey="total_descanso_no_efectivo"
                                                    name="total_descanso_no_efectivo"
                                                    stackId="emp"
                                                    radius={[4, 4, 0, 0]}
                                                    fill={COLOR_DESCANSO_NO_EFECTIVO}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Horas trabajadas promedio por cargo
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {indicadores.horas_promedio_cargo.length === 0 ? (
                                        <EmptyChart>Todavía no hay turnos completados.</EmptyChart>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={indicadores.horas_promedio_cargo}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="cargo" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                                <YAxis tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Bar dataKey="horas" name="Horas promedio" fill={COLOR_NEUTRO} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-end gap-2">
                            <form onSubmit={submitFilters} className="flex max-w-xs items-center gap-2">
                                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o identificador..." />
                                <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
                                    <Search className="size-4" />
                                </Button>
                            </form>

                            <Select value={filters.tipo || TODOS} onValueChange={(value) => applyFilters({ tipo: value === TODOS ? '' : value })}>
                                <SelectTrigger className="w-52">
                                    <SelectValue placeholder="Incidencia" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Incidencia: todas</SelectItem>
                                    <SelectItem value="exceso_jornada">Exceso de jornada</SelectItem>
                                    <SelectItem value="descanso_no_efectivo">Descanso no efectivo</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filters.grupo || TODOS} onValueChange={(value) => applyFilters({ grupo: value === TODOS ? '' : value })}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Grupo: todos</SelectItem>
                                    {opciones.grupos.map((grupo) => (
                                        <SelectItem key={grupo} value={grupo}>
                                            {grupo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={filters.cargo || TODOS} onValueChange={(value) => applyFilters({ cargo: value === TODOS ? '' : value })}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Cargo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Cargo: todos</SelectItem>
                                    {opciones.cargos.map((cargo) => (
                                        <SelectItem key={cargo} value={cargo}>
                                            {cargo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="grid gap-1">
                                <Label className="text-xs text-muted-foreground">Desde</Label>
                                <Input
                                    type="date"
                                    className="w-40"
                                    value={filters.fecha_desde}
                                    onChange={(e) => applyFilters({ fecha_desde: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs text-muted-foreground">Hasta</Label>
                                <Input
                                    type="date"
                                    className="w-40"
                                    value={filters.fecha_hasta}
                                    onChange={(e) => applyFilters({ fecha_hasta: e.target.value })}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyFilters({ fecha_desde: hoy.fecha, fecha_hasta: hoy.fecha })}
                            >
                                Hoy
                            </Button>
                        </div>

                        <RegistroTable data={registros.data} from={registros.from ?? 1} emptyMessage="No se encontraron registros." />

                        {registros.links.length > 3 && (
                            <div className="flex flex-wrap gap-1">
                                {registros.links.map((link, index) => (
                                    <Button key={index} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={!!link.url}>
                                        {link.url ? (
                                            <Link href={link.url} preserveScroll preserveState dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
