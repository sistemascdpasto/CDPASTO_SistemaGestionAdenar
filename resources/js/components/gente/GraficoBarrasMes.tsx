import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

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

const MESES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const PILARES = [
    { key: 'resultado',            label: 'Seguridad', max: 35, color: '#10b981' },
    { key: 'resultado_asistencia', label: 'Gente',     max: 15, color: '#f59e0b' },
    { key: 'resultado_reparto',    label: 'Reparto',   max: 35, color: '#f43f5e' },
    { key: 'resultado_flota',      label: 'Flota',     max: 15, color: '#3b82f6' },
] as const;

const PAGE_SIZE = 20;

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((acc: number, p: any) => acc + (p.value ?? 0), 0);
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 min-w-[200px]">
            <p className="mb-2 text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                    </span>
                    <span className="font-bold tabular-nums" style={{ color: p.color }}>
                        {p.value?.toFixed(1)}%
                    </span>
                </div>
            ))}
            <div className="mt-1.5 border-t border-slate-200 dark:border-slate-700 pt-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className={`font-black tabular-nums ${
                    total >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                    : total >= 50 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>{total.toFixed(1)}%</span>
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
        nombre:               abreviarNombre(c.nombre_completo),
        nombreCompleto:       c.nombre_completo,
        resultado:            Math.max(0, c.resultado ?? 0),
        resultado_asistencia: Math.max(0, c.resultado_asistencia ?? 0),
        resultado_reparto:    Math.max(0, c.resultado_reparto ?? 0),
        resultado_flota:      Math.max(0, c.resultado_flota ?? 0),
    }));

    // Promedio de la página visible → línea de referencia del gráfico
    const promedioPagina = data.length > 0
        ? data.reduce((acc, c) =>
            acc + c.resultado + c.resultado_asistencia + c.resultado_reparto + c.resultado_flota, 0
          ) / data.length
        : 0;

    // Promedio global de todos → subtítulo informativo
    const promedioGlobal = sorted.length > 0
        ? sorted.reduce((acc, c) => acc + c.calificacion_total, 0) / sorted.length
        : 0;

    const chartHeight = Math.max(300, Math.min(480, slice.length * 18 + 120));

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-slate-500" />
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Resultados por Pilar — {MESES[mes]} {anio}
                            </CardTitle>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {sorted.length} colaborador{sorted.length !== 1 ? 'es' : ''}{' '}
                                · prom. global{' '}
                                <span className="font-semibold text-purple-600 dark:text-purple-400">
                                    {promedioGlobal.toFixed(1)}%
                                </span>
                                {totalPaginas > 1 && (
                                    <> · mostrando{' '}
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                            {paginaSegura * PAGE_SIZE + 1}–{Math.min((paginaSegura + 1) * PAGE_SIZE, sorted.length)}
                                        </span>
                                        {' '}de {sorted.length}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Leyenda pilares */}
                        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            {PILARES.map(p => (
                                <span key={p.key} className="flex items-center gap-1">
                                    <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                                    {p.label}
                                    <span className="text-slate-400">/{p.max}%</span>
                                </span>
                            ))}
                        </div>

                        {/* Controles de paginación */}
                        {totalPaginas > 1 && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline" size="icon" className="h-7 w-7"
                                    disabled={paginaSegura === 0}
                                    onClick={() => setPagina(p => Math.max(0, p - 1))}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-xs text-slate-500 tabular-nums px-1">
                                    {paginaSegura + 1} / {totalPaginas}
                                </span>
                                <Button
                                    variant="outline" size="icon" className="h-7 w-7"
                                    disabled={paginaSegura >= totalPaginas - 1}
                                    onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 20, left: 0, bottom: 64 }}
                        barCategoryGap="18%"
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="nombre"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            angle={-40}
                            textAnchor="end"
                            interval={0}
                            height={68}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            width={42}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
                        <Legend
                            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                            formatter={(value) => <span style={{ color: '#475569' }}>{value}</span>}
                        />

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
                                    const total =
                                        entry.resultado +
                                        entry.resultado_asistencia +
                                        entry.resultado_reparto +
                                        entry.resultado_flota;
                                    return (
                                        <Cell
                                            key={`cell-${p.key}-${index}`}
                                            fill={p.color}
                                            fillOpacity={total >= 70 ? 1 : 0.6}
                                        />
                                    );
                                })}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>

                {/* Mini resumen — promedios de la página visible */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {PILARES.map((p) => {
                        const avg = data.reduce((acc, c) => {
                            const val =
                                p.key === 'resultado'              ? c.resultado
                                : p.key === 'resultado_asistencia' ? c.resultado_asistencia
                                : p.key === 'resultado_reparto'    ? c.resultado_reparto
                                : c.resultado_flota;
                            return acc + val;
                        }, 0) / Math.max(1, data.length);
                        const pct = (avg / p.max) * 100;
                        return (
                            <div key={p.key} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                        <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                                        {p.label}
                                    </span>
                                    <span className="font-bold tabular-nums" style={{ color: p.color }}>
                                        {avg.toFixed(1)}/{p.max}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: p.color }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
