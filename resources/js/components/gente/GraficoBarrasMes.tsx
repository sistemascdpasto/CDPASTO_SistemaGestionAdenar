import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ColaboradorItem {
    nombre_completo: string;
    cargo: string;
    resultado: number | null;
    resultado_asistencia: number | null;
    resultado_reparto: number;
    resultado_flota: number;
    calificacion_total: number;
}

interface Props {
    colaboradores: ColaboradorItem[];
    mes: number;
    anio: number;
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PILARES = [
    { key: 'resultado', label: 'Seguridad', max: 35, color: '#6ee7b7' },
    { key: 'resultado_asistencia', label: 'Gente', max: 15, color: '#fcd34d' },
    { key: 'resultado_reparto', label: 'Reparto', max: 35, color: '#fda4af' },
    { key: 'resultado_flota', label: 'Flota', max: 15, color: '#93c5fd' },
] as const;

const PAGE_SIZE = 20;

interface TooltipPayload {
    value?: number;
    dataKey?: string;
    name?: string;
    color?: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((acc: number, p) => acc + (p.value ?? 0), 0);
    return (
        <div className="border-border bg-card min-w-[200px] rounded-lg border px-3 py-2 shadow-lg">
            <p className="text-foreground mb-2 text-xs leading-tight font-bold">{label}</p>
            {payload.map((p) => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-foreground flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                    </span>
                    <span className="font-bold tabular-nums" style={{ color: p.color }}>
                        {p.value?.toFixed(1)}%
                    </span>
                </div>
            ))}
            <div className="border-border mt-1.5 flex items-center justify-between border-t pt-1.5 text-xs">
                <span className="text-foreground">Total</span>
                <span
                    className={`font-black tabular-nums ${
                        total >= 70
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : total >= 50
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                    }`}
                >
                    {total.toFixed(1)}%
                </span>
            </div>
        </div>
    );
}

function abreviarNombre(nombre: string, maxLen = 13): string {
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) {
        const abrev = `${partes[0]} ${partes[1].charAt(0)}.`;
        return abrev.length <= maxLen ? abrev : partes[0].slice(0, maxLen);
    }
    return nombre.slice(0, maxLen);
}

export default function GraficoBarrasMes({ colaboradores, mes, anio }: Props) {
    // Hook siempre antes de cualquier return
    const [pagina, setPagina] = useState(0);
    const [visible, setVisible] = useState(true);

    // Resetear a página 0 cuando cambian los datos (mes, año o filtros)
    useEffect(() => {
        setPagina(0);
    }, [colaboradores, mes, anio]);

    if (colaboradores.length === 0) return null;

    // Ordenar por calificación total desc
    const sorted = [...colaboradores].sort((a, b) => b.calificacion_total - a.calificacion_total);

    const totalPaginas = Math.ceil(sorted.length / PAGE_SIZE);
    const paginaSegura = Math.min(pagina, Math.max(0, totalPaginas - 1));

    // Slice de la página actual
    const slice = sorted.slice(paginaSegura * PAGE_SIZE, (paginaSegura + 1) * PAGE_SIZE);

    const data = slice.map((c) => ({
        nombre: abreviarNombre(c.nombre_completo),
        nombreCompleto: c.nombre_completo,
        resultado: Math.max(0, c.resultado ?? 0),
        resultado_asistencia: Math.max(0, c.resultado_asistencia ?? 0),
        resultado_reparto: Math.max(0, c.resultado_reparto ?? 0),
        resultado_flota: Math.max(0, c.resultado_flota ?? 0),
    }));

    // Promedio de la página visible → línea de referencia del gráfico
    const promedioPagina =
        data.length > 0
            ? data.reduce((acc, c) => acc + c.resultado + c.resultado_asistencia + c.resultado_reparto + c.resultado_flota, 0) / data.length
            : 0;

    // Promedio global de todos → subtítulo informativo
    const promedioGlobal = sorted.length > 0 ? sorted.reduce((acc, c) => acc + c.calificacion_total, 0) / sorted.length : 0;

    const chartHeight = Math.max(200, Math.min(320, slice.length * 10 + 80));

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="text-foreground h-5 w-5" />
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Resultados por Pilar — {MESES[mes]} {anio}
                            </CardTitle>
                            <p className="text-foreground mt-0.5 text-xs">
                                {sorted.length} colaborador{sorted.length !== 1 ? 'es' : ''} · prom. global{' '}
                                <span className="font-semibold text-foreground">{promedioGlobal.toFixed(1)}%</span>
                                {visible && totalPaginas > 1 && (
                                    <>
                                        {' '}
                                        · mostrando{' '}
                                        <span className="text-foreground font-medium">
                                            {paginaSegura * PAGE_SIZE + 1}–{Math.min((paginaSegura + 1) * PAGE_SIZE, sorted.length)}
                                        </span>{' '}
                                        de {sorted.length}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Controles de paginación */}
                        {visible && totalPaginas > 1 && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={paginaSegura === 0}
                                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-foreground px-1 text-xs tabular-nums">
                                    {paginaSegura + 1} / {totalPaginas}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={paginaSegura >= totalPaginas - 1}
                                    onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}

                        {/* Botón colapsar/expandir */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs px-2"
                            onClick={() => setVisible((v) => !v)}
                        >
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${visible ? '' : '-rotate-90'}`} />
                            {visible ? 'Ocultar' : 'Mostrar'}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {visible && <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 48 }} barCategoryGap="18%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="nombre"
                            tick={{ fontSize: 10, fill: '#0f172a' }}
                            angle={-35}
                            textAnchor="end"
                            interval="preserveStartEnd"
                            height={52}
                        />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#0f172a' }} width={42} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />

                        {/* Promedio de la página visible */}
                        <ReferenceLine
                            y={promedioPagina}
                            stroke="#a855f7"
                            strokeDasharray="4 3"
                            strokeWidth={1.5}
                            label={{ value: `Prom. ${promedioPagina.toFixed(1)}%`, position: 'insideTopRight', fontSize: 10, fill: '#a855f7' }}
                        />
                        {/* Meta 70% */}
                        <ReferenceLine
                            y={70}
                            stroke="#10b981"
                            strokeDasharray="4 3"
                            strokeWidth={1.5}
                            label={{ value: 'Meta 70%', position: 'insideTopLeft', fontSize: 10, fill: '#10b981' }}
                        />

                        {PILARES.map((p) => (
                            <Bar
                                key={p.key}
                                dataKey={p.key}
                                name={p.label}
                                stackId="a"
                                fill={p.color}
                                isAnimationActive={true}
                                animationDuration={400}
                                radius={p.key === 'resultado_flota' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                            >
                                {data.map((entry, index) => {
                                    const total = entry.resultado + entry.resultado_asistencia + entry.resultado_reparto + entry.resultado_flota;
                                    return <Cell key={`cell-${p.key}-${index}`} fill={p.color} fillOpacity={total >= 70 ? 1 : 0.6} />;
                                })}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>

                {/* Mini resumen — promedios de la página visible */}
                <div className="border-border mt-1 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
                    {PILARES.map((p) => {
                        const avg =
                            data.reduce((acc, c) => {
                                const val =
                                    p.key === 'resultado'
                                        ? c.resultado
                                        : p.key === 'resultado_asistencia'
                                          ? c.resultado_asistencia
                                          : p.key === 'resultado_reparto'
                                            ? c.resultado_reparto
                                            : c.resultado_flota;
                                return acc + val;
                            }, 0) / Math.max(1, data.length);
                        const pct = (avg / p.max) * 100;
                        return (
                            <div key={p.key} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-foreground flex items-center gap-1 font-medium">
                                        <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                                        {p.label}
                                    </span>
                                    <span className="text-foreground font-bold tabular-nums">
                                        {avg.toFixed(1)}/{p.max}%
                                    </span>
                                </div>
                                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: p.color }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>}
        </Card>
    );
}
