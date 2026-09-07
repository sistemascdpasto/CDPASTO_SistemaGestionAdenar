import HeadingSmall from '@/components/heading-small';
import CalendarioFestivos from '@/components/gente/CalendarioFestivos';
import GraficoBarrasMes from '@/components/gente/GraficoBarrasMes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Award, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Flame, GraduationCap, Medal, Percent, Search, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Premiación', href: '/modules/gente/plan-premiacion' },
];

const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
];

const ANIOS = [2024, 2025, 2026, 2027];

interface ColaboradorItem {
    id: number;
    cedula: string;
    nombre_completo: string;
    nombres: string;
    apellidos: string;
    cargo: string;
    area: string;
    aci_realizadas: number;
    meta: number;
    porcentaje: number;
    porcentaje_owd_ruta: number | null;
    porcentaje_owd_ruta_label: string;
    promedio_calificaciones: number | null;
    promedio_calificaciones_label: string;
    resultado: number | null;
    resultado_label: string;
    porcentaje_dpo: number;
    porcentaje_dpo_label: string;
    porcentaje_ausentismo: number | null;
    porcentaje_ausentismo_label: string;
    porcentaje_malas_marcaciones: number;
    porcentaje_malas_marcaciones_label: string;
    resultado_asistencia: number | null;
    resultado_asistencia_label: string;
    porcentaje_rechazos: number | null;
    porcentaje_rechazos_label: string;
    porcentaje_sac: number;
    porcentaje_sac_label: string;
    porcentaje_adherencia_tiempo: number | null;
    porcentaje_adherencia_tiempo_label: string;
    promedio_rmd: number | null;
    promedio_rmd_label: string;
    porcentaje_checklist_pre: number | null;
    porcentaje_checklist_pre_label: string;
    porcentaje_checklist_post: number | null;
    porcentaje_checklist_post_label: string;
    resultado_reparto: number;
    resultado_reparto_label: string;
    resultado_flota: number;
    resultado_flota_label: string;
    calificacion_total: number;
    calificacion_total_label: string;
    faltantes: number;
    cumple: boolean;
    estado: 'meta_alcanzada' | 'en_progreso' | 'sin_participacion';
}

interface Resumen {
    meta_base: number;
    total_colaboradores: number;
    total_acis_mes: number;
    cumplen_meta: number;
    en_progreso: number;
    sin_participacion: number;
    promedio_porcentaje: number;
}

interface Filters {
    mes: number;
    anio: number;
    search: string;
    estado: string;
    cargo: string;
}

interface Props {
    colaboradores: ColaboradorItem[];
    resumen: Resumen;
    top3: ColaboradorItem[];
    peores2?: ColaboradorItem[];
    cargos?: string[];
    filters: Filters;
    puede_editar?: boolean;
}

const parseCargosFilter = (filterStr?: string): string[] => {
    if (!filterStr || filterStr === 'todos') return [];
    return filterStr.split(',').map((s) => s.trim()).filter(Boolean);
};

const parseMesesChecklistFilter = (filterStr?: string): number[] => {
    if (!filterStr) return [];
    return filterStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 1 && n <= 12);
};

export default function PlanPremiacionIndex({ colaboradores, resumen, top3, peores2 = [], cargos = [], filters, puede_editar = false }: Props) {
    const [mes, setMes] = useState<number>(filters.mes || new Date().getMonth() + 1);
    const [anio, setAnio] = useState<number>(filters.anio || new Date().getFullYear());
    const [search, setSearch] = useState<string>(filters.search || '');
    const [formulasAbiertas, setFormulasAbiertas] = useState<boolean>(false);
    const [estado, setEstado] = useState<string>(filters.estado || 'todos');
    const [selectedCargos, setSelectedCargos] = useState<string[]>(parseCargosFilter(filters.cargo));

    // Paginación
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(25);
    const [pageSizeInput, setPageSizeInput] = useState<string>('25');

    // Columnas visibles
    type ColKey = 'aci' | 'owd' | 'calificaciones' | 'res_seguridad'
                | 'dpo' | 'ausentismo' | 'marcaciones' | 'res_gente'
                | 'rechazos' | 'sac' | 'adherencia_tiempo' | 'rmd' | 'res_reparto'
                | 'cl_pre' | 'cl_post' | 'res_flota'
                | 'total';

    const COLUMNAS_DEF: { key: ColKey; label: string; pilar: string }[] = [
        { key: 'aci',               label: '% ACI (10%)',                pilar: 'SEGURIDAD' },
        { key: 'owd',               label: '% OWD Ruta (15%)',           pilar: 'SEGURIDAD' },
        { key: 'calificaciones',    label: '% Calificaciones (10%)',     pilar: 'SEGURIDAD' },
        { key: 'res_seguridad',     label: 'Resultado Seguridad',        pilar: 'SEGURIDAD' },
        { key: 'dpo',               label: '% DPO Academy (5%)',         pilar: 'GENTE' },
        { key: 'ausentismo',        label: '% Ausentismo (5%)',          pilar: 'GENTE' },
        { key: 'marcaciones',       label: '% Malas Marcaciones (5%)',   pilar: 'GENTE' },
        { key: 'res_gente',         label: 'Resultado Gente',            pilar: 'GENTE' },
        { key: 'rechazos',          label: '% Rechazos (11%)',           pilar: 'REPARTO' },
        { key: 'sac',               label: '% SAC (8%)',                 pilar: 'REPARTO' },
        { key: 'adherencia_tiempo', label: '% Adherencia Tiempo (8%)',   pilar: 'REPARTO' },
        { key: 'rmd',               label: 'RMD (8%)',                   pilar: 'REPARTO' },
        { key: 'res_reparto',       label: 'Resultado Reparto',          pilar: 'REPARTO' },
        { key: 'cl_pre',            label: '% CL Pre (7.5%)',            pilar: 'FLOTA' },
        { key: 'cl_post',           label: '% CL Post (7.5%)',           pilar: 'FLOTA' },
        { key: 'res_flota',         label: 'Resultado Flota',            pilar: 'FLOTA' },
        { key: 'total',             label: 'TOTAL 100%',                 pilar: 'TOTAL' },
    ];

    const STORAGE_KEY = 'plan-premiacion:cols-visibles';
    const allKeys = COLUMNAS_DEF.map(c => c.key);

    const [colsVisibles, setColsVisibles] = useState<Set<ColKey>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: ColKey[] = JSON.parse(stored);
                // Filtrar claves inválidas por si el schema cambió
                const valid = parsed.filter(k => allKeys.includes(k));
                if (valid.length > 0) return new Set(valid);
            }
        } catch {
            // Si hay algún error de parseo, usar default
        }
        
        return new Set(allKeys);
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...colsVisibles]));
    }, [colsVisibles]);

    const toggleCol = (key: ColKey) => {
        setColsVisibles(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const cv = (key: ColKey) => colsVisibles.has(key);

    // Recalcular colSpan de pilares según columnas visibles
    const colSpanSeguridad = [cv('aci'), cv('owd'), cv('calificaciones'), cv('res_seguridad')].filter(Boolean).length;
    const colSpanGente     = [cv('dpo'), cv('ausentismo'), cv('marcaciones'), cv('res_gente')].filter(Boolean).length;
    const colSpanReparto   = [cv('rechazos'), cv('sac'), cv('adherencia_tiempo'), cv('rmd'), cv('res_reparto')].filter(Boolean).length;
    const colSpanFlota     = [cv('cl_pre'), cv('cl_post'), cv('res_flota')].filter(Boolean).length;

    const totalPages = Math.max(1, Math.ceil(colaboradores.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedColabs = colaboradores.slice((safePage - 1) * pageSize, safePage * pageSize);

    const handlePageSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPageSizeInput(e.target.value);
    };

    const handlePageSizeInputBlur = () => {
        const parsed = parseInt(pageSizeInput, 10);
        if (!isNaN(parsed) && parsed >= 1) {
            setPageSize(parsed);
            setCurrentPage(1);
        } else {
            setPageSizeInput(String(pageSize));
        }
    };

    const handlePageSizeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    const handleFilter = (newMes = mes, newAnio = anio, newSearch = search, newEstado = estado, newCargos = selectedCargos) => {
        setCurrentPage(1);
        const cargoParam = newCargos.length > 0 ? newCargos.join(',') : '';
        router.get(
            '/modules/gente/plan-premiacion',
            {
                mes: newMes,
                anio: newAnio,
                search: newSearch,
                estado: newEstado === 'todos' ? '' : newEstado,
                cargo: cargoParam,
                meses_checklist: String(newMes),
            },
            { preserveState: false, replace: true },
        );
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        handleFilter(mes, anio, val, estado, selectedCargos);
    };

    const handleMesChange = (val: string) => {
        const m = parseInt(val, 10);
        setMes(m);
        handleFilter(m, anio, search, estado, selectedCargos);
    };

    const handleAnioChange = (val: string) => {
        const a = parseInt(val, 10);
        setAnio(a);
        handleFilter(mes, a, search, estado, selectedCargos);
    };

    const handleEstadoChange = (val: string) => {
        setEstado(val);
        handleFilter(mes, anio, search, val, selectedCargos);
    };

    const handleToggleCargo = (cargoItem: string) => {
        let next: string[];
        if (cargoItem === 'todos') {
            next = [];
        } else if (selectedCargos.includes(cargoItem)) {
            next = selectedCargos.filter((c) => c !== cargoItem);
        } else {
            next = [...selectedCargos, cargoItem];
        }
        setSelectedCargos(next);
        handleFilter(mes, anio, search, estado, next);
    };

    const getCargoLabel = () => {
        if (selectedCargos.length === 0) return 'Todos los Cargos';
        if (selectedCargos.length === 1) return selectedCargos[0];
        return `${selectedCargos.length} Cargos seleccionados`;
    };

    const cargoParam = '';
    const exportUrl = [
        `/modules/gente/plan-premiacion/exportar`,
        `?mes=${mes}`,
        `&anio=${anio}`,
        `&meses_checklist=${mes}`,
        search ? `&search=${encodeURIComponent(search)}` : '',
        estado && estado !== 'todos' ? `&estado=${encodeURIComponent(estado)}` : '',
    ].join('');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Plan Premiación - Módulo Gente" />

            <div className="space-y-6 p-6">
                {/* Header Banner */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    Plan Premiación ACI, OWD & Calificaciones
                                </h1>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Evaluación mensual de participación ACI, porcentaje OWD Ruta y promedio de Calificaciones por módulo.
                            </p>
                        </div>
                        <div className="min-w-[260px]">
                            <button
                                type="button"
                                onClick={() => setFormulasAbiertas(v => !v)}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors mb-1"
                            >
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${formulasAbiertas ? 'rotate-180' : ''}`} />
                                {formulasAbiertas ? 'Ocultar fórmulas' : 'Ver fórmulas de cálculo'}
                            </button>
                            {formulasAbiertas && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 rounded-lg border border-amber-200/60 bg-amber-500/10 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2">
                                    {/* SEGURIDAD 35% */}
                                    <div className="col-span-2 mt-1 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" /> Seguridad 35%
                                    </div>
                                    <div><span className="font-bold text-emerald-700 dark:text-emerald-400">ACI</span> <span className="text-slate-500">(10%)</span> — Realizadas ÷ 32 × 100</div>
                                    <div><span className="font-bold text-emerald-700 dark:text-emerald-400">OWD Ruta</span> <span className="text-slate-500">(15%)</span> — Sin NO OK = 100% | Con NO OK = 0%</div>
                                    <div><span className="font-bold text-emerald-700 dark:text-emerald-400">Calificaciones</span> <span className="text-slate-500">(10%)</span> — Promedio de notas por módulo</div>

                                    {/* GENTE 15% */}
                                    <div className="col-span-2 mt-2 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <Users className="h-3 w-3" /> Gente 15%
                                    </div>
                                    <div><span className="font-bold text-amber-600 dark:text-amber-400">DPO Academy</span> <span className="text-slate-500">(5%)</span> — Sin registro = 100% | En listado = 0%</div>
                                    <div><span className="font-bold text-amber-600 dark:text-amber-400">Ausentismo</span> <span className="text-slate-500">(5%)</span> — Sin incapacidad = 100% | Con incapacidad = 0%</div>
                                    <div><span className="font-bold text-amber-600 dark:text-amber-400">Malas Marcaciones</span> <span className="text-slate-500">(5%)</span> — Sin corrección = 100% | Con corrección = 0%</div>

                                    {/* REPARTO 35% */}
                                    <div className="col-span-2 mt-2 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                                        <Medal className="h-3 w-3" /> Reparto 35%
                                    </div>
                                    <div><span className="font-bold text-rose-700 dark:text-rose-400">Rechazos</span> <span className="text-slate-500">(11%)</span> — ≥ 2.3% rechazos = 100% | &lt; 2.3% = 0%</div>
                                    <div><span className="font-bold text-rose-700 dark:text-rose-400">SAC</span> <span className="text-slate-500">(8%)</span> — Sin casos = 100% | Con casos = 0%</div>
                                    <div><span className="font-bold text-rose-700 dark:text-rose-400">Adherencia Tiempo</span> <span className="text-slate-500">(8%)</span> — ≥ 83% adherencia = 100% | &lt; 83% = 0%</div>
                                    <div><span className="font-bold text-rose-700 dark:text-rose-400">RMD</span> <span className="text-slate-500">(8%)</span> — Promedio ≥ 4 = 100% | &lt; 4 = 0%</div>

                                    {/* FLOTA 15% */}
                                    <div className="col-span-2 mt-2 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Flota 15%
                                    </div>
                                    <div><span className="font-bold text-blue-700 dark:text-blue-400">Checklist Pre</span> <span className="text-slate-500">(7.5%)</span> — Promedio % adherencia CL pre operacional</div>
                                    <div><span className="font-bold text-blue-700 dark:text-blue-400">Checklist Post</span> <span className="text-slate-500">(7.5%)</span> — Promedio % adherencia CL post operacional</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Filtros y Búsqueda</CardTitle>
                    </CardHeader>
                    <CardContent>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 w-full">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Año</label>
                                    <Select value={String(anio)} onValueChange={handleAnioChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar Año" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ANIOS.map((a) => (
                                                <SelectItem key={a} value={String(a)}>
                                                    {a}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Mes</label>
                                    <Select value={String(mes)} onValueChange={handleMesChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar Mes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MESES.map((m) => (
                                                <SelectItem key={m.value} value={String(m.value)}>
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar Colaborador</label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="text"
                                            placeholder="Nombre, apellido, cédula..."
                                            value={search}
                                            onChange={handleSearchChange}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:self-end">
                                <CalendarioFestivos
                                    mesInicial={mes}
                                    anioInicial={anio}
                                    puedeEditar={puede_editar}
                                />

                                {/* Selector de columnas visibles */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-2 text-xs">
                                            <ChevronDown className="h-4 w-4" />
                                            Columnas
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60 max-h-96 overflow-y-auto">
                                        <DropdownMenuLabel className="text-xs">Mostrar / ocultar columnas</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {['SEGURIDAD', 'GENTE', 'REPARTO', 'FLOTA', 'TOTAL'].map(pilar => (
                                            <div key={pilar}>
                                                <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400 py-1">{pilar}</DropdownMenuLabel>
                                                {COLUMNAS_DEF.filter(c => c.pilar === pilar).map(col => (
                                                    <DropdownMenuCheckboxItem
                                                        key={col.key}
                                                        checked={cv(col.key)}
                                                        onCheckedChange={() => toggleCol(col.key)}
                                                        className="text-xs"
                                                    >
                                                        {col.label}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                                <DropdownMenuSeparator />
                                            </div>
                                        ))}
                                        <div className="px-2 py-1">
                                            <button
                                                onClick={() => setColsVisibles(new Set(allKeys))}
                                                className="w-full rounded text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline text-center py-0.5 transition-colors"
                                            >
                                                Mostrar todas
                                            </button>
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button asChild variant="outline" className="w-full md:w-auto">
                                    <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4" />
                                        Exportar Excel
                                    </a>
                                </Button>
                            </div>
                    </CardContent>
                </Card>


                {/* Podio + Peores — todos en una sola fila */}
                {(top3.length > 0 || peores2.length > 0) && (
                    <Card className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Award className="h-5 w-5 text-amber-500" />
                                <CardTitle className="text-base font-semibold">Reconocimiento del Mes</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {/* Top 3 */}
                                {top3.map((item, idx) => {
                                    const badge =
                                        idx === 0 ? { bg: 'bg-amber-500', label: '1° Lugar 🥇' }
                                        : idx === 1 ? { bg: 'bg-slate-400', label: '2° Lugar 🥈' }
                                        : { bg: 'bg-amber-700', label: '3° Lugar 🥉' };
                                    const cardBg =
                                        idx === 0 ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800'
                                        : idx === 1 ? 'bg-slate-50 border-slate-300 dark:bg-slate-900/40 dark:border-slate-800'
                                        : 'bg-orange-50/50 border-orange-300 dark:bg-orange-950/20 dark:border-orange-900/40';
                                    return (
                                        <div key={item.id} className={`rounded-lg border p-3 shadow-sm flex flex-col gap-1 ${cardBg}`}>
                                            <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${badge.bg}`}>
                                                {badge.label}
                                            </span>
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                                                {item.nombre_completo}
                                            </p>
                                            <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                                                {item.calificacion_total_label}
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-1">
                                                {item.cargo}
                                            </p>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                                {item.cedula}
                                            </p>
                                        </div>
                                    );
                                })}

                                {/* Peores 2 */}
                                {peores2.map((item, idx) => (
                                    <div key={item.id} className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 shadow-sm flex flex-col gap-1 dark:border-rose-900/40 dark:bg-rose-950/10">
                                        <span className="self-start rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                            {idx === 0 ? 'Penúltimo' : 'Último'} lugar
                                        </span>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                                            {item.nombre_completo}
                                        </p>
                                        <p className="text-base font-extrabold text-red-600 dark:text-red-400">
                                            {item.calificacion_total_label}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-1">
                                            {item.cargo}
                                        </p>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                            {item.cedula}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Gráfico + Tabla lado a lado */}
                <div className="flex gap-6 items-start">

                    {/* Gráfico — mitad del ancho, sticky */}
                    <div className="w-1/2 shrink-0 sticky top-6 self-start">
                        <GraficoBarrasMes colaboradores={colaboradores} mes={mes} anio={anio} />
                    </div>

                    {/* Tabla Principal — mitad del ancho, scrolleable */}
                    <div className="w-1/2 min-w-0">
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <CardTitle className="text-base font-semibold">
                                Lista de Colaboradores ({colaboradores.length})
                                {totalPages > 1 && (
                                    <span className="ml-2 text-xs font-normal text-slate-500">
                                        — mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, colaboradores.length)} de {colaboradores.length}
                                    </span>
                                )}
                            </CardTitle>

                            {/* Control de registros por página */}
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <span className="text-xs whitespace-nowrap">Registros por página:</span>
                                <Input
                                    type="number"
                                    min={1}
                                    max={colaboradores.length || 9999}
                                    value={pageSizeInput}
                                    onChange={handlePageSizeInputChange}
                                    onBlur={handlePageSizeInputBlur}
                                    onKeyDown={handlePageSizeInputKeyDown}
                                    className="w-20 h-8 text-center text-sm"
                                />
                                <div className="flex gap-1 items-center">
                                    {[10, 25, 50, 100].map((n) => (
                                        <button
                                            key={n}
                                            onClick={() => { setPageSize(n); setPageSizeInput(String(n)); setCurrentPage(1); }}
                                            className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                                pageSize === n
                                                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    {/* Fila 1: Grupos de Pilares con Porcentajes */}
                                    <TableRow className="border-b bg-slate-100/90 dark:bg-slate-800/90">
                                        <TableHead rowSpan={2} className="align-middle font-bold text-slate-900 dark:text-slate-100">Nombre</TableHead>
                                        <TableHead rowSpan={2} className="align-middle font-bold text-slate-900 dark:text-slate-100">Cargo</TableHead>

                                        {colSpanSeguridad > 0 && (
                                            <TableHead colSpan={colSpanSeguridad} className="text-center font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 border-x border-emerald-200 dark:border-emerald-800/50 py-2 text-xs uppercase tracking-wider">
                                                SEGURIDAD 35%
                                            </TableHead>
                                        )}
                                        {colSpanGente > 0 && (
                                            <TableHead colSpan={colSpanGente} className="text-center font-bold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 border-x border-amber-200 dark:border-amber-800/50 py-2 text-xs uppercase tracking-wider">
                                                GENTE 15%
                                            </TableHead>
                                        )}
                                        {colSpanReparto > 0 && (
                                            <TableHead colSpan={colSpanReparto} className="text-center font-bold text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/60 border-x border-rose-200 dark:border-rose-800/50 py-2 text-xs uppercase tracking-wider">
                                                REPARTO 35%
                                            </TableHead>
                                        )}
                                        {colSpanFlota > 0 && (
                                            <TableHead colSpan={colSpanFlota} className="text-center font-bold text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/60 border-x border-blue-200 dark:border-blue-800/50 py-2 text-xs uppercase tracking-wider">
                                                FLOTA 15%
                                            </TableHead>
                                        )}
                                        {cv('total') && (
                                            <TableHead rowSpan={2} className="text-center font-bold text-purple-800 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/60 border-x border-purple-200 dark:border-purple-800/50 py-2 text-xs uppercase tracking-wider align-middle">
                                                TOTAL 100%
                                            </TableHead>
                                        )}
                                    </TableRow>

                                    {/* Fila 2: Subcolumnas de Métricas */}
                                    <TableRow className="border-b bg-slate-50 dark:bg-slate-900/50 text-xs">
                                        {cv('aci')            && <TableHead className="w-32 text-right bg-emerald-50/40 dark:bg-emerald-950/20">% ACI <span className="text-emerald-600 font-bold">(10%)</span></TableHead>}
                                        {cv('owd')            && <TableHead className="w-32 text-right bg-emerald-50/40 dark:bg-emerald-950/20">% OWD Ruta <span className="text-emerald-600 font-bold">(15%)</span></TableHead>}
                                        {cv('calificaciones') && <TableHead className="w-36 text-right bg-emerald-50/40 dark:bg-emerald-950/20">% Calificaciones <span className="text-emerald-600 font-bold">(10%)</span></TableHead>}
                                        {cv('res_seguridad')  && <TableHead className="w-32 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30">Resultado</TableHead>}

                                        {cv('dpo')            && <TableHead className="w-32 text-right bg-amber-50/40 dark:bg-amber-950/20">% DPO Academy <span className="text-amber-600 font-bold">(5%)</span></TableHead>}
                                        {cv('ausentismo')     && <TableHead className="w-32 text-right bg-amber-50/40 dark:bg-amber-950/20">% Ausentismo <span className="text-amber-600 font-bold">(5%)</span></TableHead>}
                                        {cv('marcaciones')    && <TableHead className="w-36 text-right bg-amber-50/40 dark:bg-amber-950/20">% Malas Marcaciones <span className="text-amber-600 font-bold">(5%)</span></TableHead>}
                                        {cv('res_gente')      && <TableHead className="w-32 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30">Resultado</TableHead>}

                                        {cv('rechazos')           && <TableHead className="w-32 text-right bg-rose-50/40 dark:bg-rose-950/20">% Rechazos <span className="text-rose-600 font-bold">(11%)</span></TableHead>}
                                        {cv('sac')                && <TableHead className="w-32 text-right bg-rose-50/40 dark:bg-rose-950/20">% SAC <span className="text-rose-600 font-bold">(8%)</span></TableHead>}
                                        {cv('adherencia_tiempo')  && <TableHead className="w-36 text-right bg-rose-50/40 dark:bg-rose-950/20">% Adherencia Tiempo <span className="text-rose-600 font-bold">(8%)</span></TableHead>}
                                        {cv('rmd')                && <TableHead className="w-24 text-right bg-rose-50/40 dark:bg-rose-950/20">RMD <span className="text-rose-600 font-bold">(8%)</span></TableHead>}
                                        {cv('res_reparto')        && <TableHead className="w-32 text-right font-bold text-rose-700 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-900/30">Resultado</TableHead>}

                                        {cv('cl_pre')    && <TableHead className="w-36 text-right bg-blue-50/40 dark:bg-blue-950/20">% Adherencia CL Pre <span className="text-blue-600 font-bold">(7.5%)</span></TableHead>}
                                        {cv('cl_post')   && <TableHead className="w-36 text-right bg-blue-50/40 dark:bg-blue-950/20">% Adherencia CL Post <span className="text-blue-600 font-bold">(7.5%)</span></TableHead>}
                                        {cv('res_flota') && <TableHead className="w-32 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30">Resultado</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {colaboradores.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={19} className="py-8 text-center text-slate-500">
                                                No se encontraron colaboradores para el filtro seleccionado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedColabs.map((colab) => (
                                            <TableRow key={colab.id} className="cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-colors">
                                                <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                                                    <a
                                                        href={`/modules/gente/plan-premiacion/${colab.id}?mes=${mes}&anio=${anio}`}
                                                        className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                                    >
                                                        {colab.nombre_completo}
                                                    </a>
                                                </TableCell>

                                                <TableCell className="text-slate-700 dark:text-slate-300">
                                                    {colab.cargo}
                                                </TableCell>

                                                {/* % ACI */}
                                                {cv('aci') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${
                                                                    colab.porcentaje >= 100
                                                                        ? 'bg-emerald-500'
                                                                        : colab.porcentaje >= 50
                                                                          ? 'bg-amber-500'
                                                                          : colab.porcentaje > 0
                                                                            ? 'bg-blue-500'
                                                                            : 'bg-slate-300 dark:bg-slate-700'
                                                                }`}
                                                                style={{ width: `${Math.min(100, colab.porcentaje)}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[40px]">
                                                            {colab.porcentaje}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % OWD Ruta */}
                                                {cv('owd') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_owd_ruta !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        colab.porcentaje_owd_ruta >= 100
                                                                            ? 'bg-emerald-500'
                                                                            : colab.porcentaje_owd_ruta >= 50
                                                                              ? 'bg-amber-500'
                                                                              : 'bg-rose-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, colab.porcentaje_owd_ruta)}%` }}
                                                                />
                                                            </div>
                                                            <span className={`font-bold min-w-[40px] ${
                                                                colab.porcentaje_owd_ruta >= 100
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : colab.porcentaje_owd_ruta >= 50
                                                                      ? 'text-amber-600 dark:text-amber-400'
                                                                      : 'text-rose-600 dark:text-rose-400'
                                                            }`}>
                                                                {colab.porcentaje_owd_ruta_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % Calificaciones Módulos */}
                                                {cv('calificaciones') && (
                                                <TableCell className="text-right">
                                                    {colab.promedio_calificaciones !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        colab.promedio_calificaciones >= 80 || colab.promedio_calificaciones >= 8.0 || colab.promedio_calificaciones >= 4.0
                                                                            ? 'bg-emerald-500'
                                                                            : colab.promedio_calificaciones >= 60 || colab.promedio_calificaciones >= 6.0 || colab.promedio_calificaciones >= 3.0
                                                                              ? 'bg-amber-500'
                                                                              : 'bg-rose-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, colab.promedio_calificaciones > 10 ? colab.promedio_calificaciones : colab.promedio_calificaciones * 20)}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[45px]">
                                                                {colab.promedio_calificaciones_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Resultado Seguridad */}
                                                {cv('res_seguridad') && (
                                                <TableCell className="text-right bg-emerald-50/30 dark:bg-emerald-950/10">
                                                    {colab.resultado !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 h-2.5">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        colab.resultado >= 24.5 ? 'bg-emerald-500'
                                                                        : colab.resultado >= 14   ? 'bg-amber-500'
                                                                        : 'bg-red-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, (colab.resultado / 35) * 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className={`font-black min-w-[45px] text-sm ${
                                                                colab.resultado >= 24.5 ? 'text-emerald-600 dark:text-emerald-400'
                                                                : colab.resultado >= 14   ? 'text-amber-600 dark:text-amber-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                            }`}>{colab.resultado_label}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % DPO Academy */}
                                                {cv('dpo') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                            <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_dpo >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${colab.porcentaje_dpo}%` }} />
                                                        </div>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-extrabold ${colab.porcentaje_dpo >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                                            {colab.porcentaje_dpo_label}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % Ausentismo */}
                                                {cv('ausentismo') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_ausentismo !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                                <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_ausentismo >= 100 ? 'bg-emerald-500' : colab.porcentaje_ausentismo >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                    style={{ width: `${colab.porcentaje_ausentismo}%` }} />
                                                            </div>
                                                            <span className={`font-bold min-w-[40px] ${colab.porcentaje_ausentismo >= 100 ? 'text-emerald-600 dark:text-emerald-400' : colab.porcentaje_ausentismo >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {colab.porcentaje_ausentismo_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % Malas Marcaciones */}
                                                {cv('marcaciones') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                            <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_malas_marcaciones >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${colab.porcentaje_malas_marcaciones}%` }} />
                                                        </div>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-extrabold ${colab.porcentaje_malas_marcaciones >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                                            {colab.porcentaje_malas_marcaciones_label}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* Resultado Gente */}
                                                {cv('res_gente') && (
                                                <TableCell className="text-right bg-amber-50/30 dark:bg-amber-950/10">
                                                    {colab.resultado_asistencia !== null && colab.resultado_asistencia !== undefined ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 h-2.5">
                                                                <div className={`h-full rounded-full transition-all duration-300 ${
                                                                    colab.resultado_asistencia >= 10.5 ? 'bg-emerald-500'
                                                                    : colab.resultado_asistencia >= 6    ? 'bg-amber-500'
                                                                    : 'bg-red-500'
                                                                }`}
                                                                    style={{ width: `${Math.min(100, (colab.resultado_asistencia / 15) * 100)}%` }} />
                                                            </div>
                                                            <span className={`font-black min-w-[45px] text-sm ${
                                                                colab.resultado_asistencia >= 10.5 ? 'text-emerald-600 dark:text-emerald-400'
                                                                : colab.resultado_asistencia >= 6    ? 'text-amber-600 dark:text-amber-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                            }`}>{colab.resultado_asistencia_label}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % Rechazos */}
                                                {cv('rechazos') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_rechazos !== null && colab.porcentaje_rechazos !== undefined ? (
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                                                            colab.porcentaje_rechazos >= 100
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                                        }`}>
                                                            {colab.porcentaje_rechazos_label}
                                                        </span>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % SAC */}
                                                {cv('sac') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                            <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_sac >= 90 ? 'bg-emerald-500' : colab.porcentaje_sac >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${Math.min(100, colab.porcentaje_sac)}%` }} />
                                                        </div>
                                                        <span className={`font-bold min-w-[40px] ${colab.porcentaje_sac >= 90 ? 'text-emerald-600 dark:text-emerald-400' : colab.porcentaje_sac >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                            {colab.porcentaje_sac_label}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % Adherencia Tiempo */}
                                                {cv('adherencia_tiempo') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_adherencia_tiempo !== null && colab.porcentaje_adherencia_tiempo !== undefined ? (
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                                                            colab.porcentaje_adherencia_tiempo >= 100
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                                        }`}>
                                                            {colab.porcentaje_adherencia_tiempo_label}
                                                        </span>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* RMD */}
                                                {cv('rmd') && (
                                                <TableCell className="text-right">
                                                    {colab.promedio_rmd !== null && colab.promedio_rmd !== undefined ? (
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                                                            colab.promedio_rmd >= 100
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                                        }`}>
                                                            {colab.promedio_rmd_label}
                                                        </span>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Resultado Reparto */}
                                                {cv('res_reparto') && (
                                                <TableCell className="text-right bg-rose-50/30 dark:bg-rose-950/10">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 h-2.5">
                                                            <div className={`h-full rounded-full transition-all duration-300 ${
                                                                colab.resultado_reparto >= 24.5 ? 'bg-emerald-500'
                                                                : colab.resultado_reparto >= 10  ? 'bg-amber-500'
                                                                : 'bg-red-500'
                                                            }`}
                                                                style={{ width: `${Math.min(100, (colab.resultado_reparto / 35) * 100)}%` }} />
                                                        </div>
                                                        <span className={`font-black min-w-[45px] text-sm ${
                                                            colab.resultado_reparto >= 24.5 ? 'text-emerald-600 dark:text-emerald-400'
                                                            : colab.resultado_reparto >= 10  ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                        }`}>{colab.resultado_reparto_label}</span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % Adherencia CL Pre Op */}
                                                {cv('cl_pre') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_checklist_pre !== null && colab.porcentaje_checklist_pre !== undefined ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                                <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_checklist_pre >= 90 ? 'bg-emerald-500' : colab.porcentaje_checklist_pre >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                    style={{ width: `${Math.min(100, colab.porcentaje_checklist_pre)}%` }} />
                                                            </div>
                                                            <span className={`font-bold min-w-[40px] ${colab.porcentaje_checklist_pre >= 90 ? 'text-emerald-600 dark:text-emerald-400' : colab.porcentaje_checklist_pre >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {colab.porcentaje_checklist_pre_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % Adherencia CL Post Op */}
                                                {cv('cl_post') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_checklist_post !== null && colab.porcentaje_checklist_post !== undefined ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 h-2">
                                                                <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_checklist_post >= 90 ? 'bg-emerald-500' : colab.porcentaje_checklist_post >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                    style={{ width: `${Math.min(100, colab.porcentaje_checklist_post)}%` }} />
                                                            </div>
                                                            <span className={`font-bold min-w-[40px] ${colab.porcentaje_checklist_post >= 90 ? 'text-emerald-600 dark:text-emerald-400' : colab.porcentaje_checklist_post >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {colab.porcentaje_checklist_post_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400 border-slate-300">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Resultado Flota */}
                                                {cv('res_flota') && (
                                                <TableCell className="text-right bg-blue-50/30 dark:bg-blue-950/10">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 h-2.5">
                                                            <div className={`h-full rounded-full transition-all duration-300 ${
                                                                colab.resultado_flota >= 10.5 ? 'bg-emerald-500'
                                                                : colab.resultado_flota >= 6   ? 'bg-amber-500'
                                                                : 'bg-red-500'
                                                            }`}
                                                                style={{ width: `${Math.min(100, (colab.resultado_flota / 15) * 100)}%` }} />
                                                        </div>
                                                        <span className={`font-black min-w-[45px] text-sm ${
                                                            colab.resultado_flota >= 10.5 ? 'text-emerald-600 dark:text-emerald-400'
                                                            : colab.resultado_flota >= 6   ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                        }`}>{colab.resultado_flota_label}</span>
                                                    </div>
                                                </TableCell>
                                                )}
                                                {/* Calificación Total */}
                                                {cv('total') && (
                                                <TableCell className="text-right bg-purple-50/40 dark:bg-purple-950/20">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 h-3">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        colab.calificacion_total >= 90
                                                                            ? 'bg-emerald-500'
                                                                            : colab.calificacion_total >= 50
                                                                              ? 'bg-orange-500'
                                                                              : 'bg-red-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, colab.calificacion_total)}%` }}
                                                                />
                                                            </div>
                                                            <span className={`font-black min-w-[50px] text-base ${
                                                                colab.calificacion_total >= 90
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : colab.calificacion_total >= 50
                                                                      ? 'text-orange-600 dark:text-orange-400'
                                                                      : 'text-red-600 dark:text-red-400'
                                                            }`}>
                                                                {colab.calificacion_total_label}
                                                            </span>
                                                        </div>
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                            colab.calificacion_total >= 90
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                : colab.calificacion_total >= 50
                                                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                                                                  : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                        }`}>
                                                            {colab.calificacion_total >= 90
                                                                ? 'Sobresaliente'
                                                                : colab.calificacion_total >= 50
                                                                  ? 'En camino'
                                                                  : 'Por mejorar'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between border-t pt-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Página <span className="font-semibold text-slate-700 dark:text-slate-200">{safePage}</span> de{' '}
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{totalPages}</span>
                                    {' '}· {colaboradores.length} registros totales
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setCurrentPage(1)}
                                        disabled={safePage === 1}
                                        title="Primera página"
                                    >
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        title="Página anterior"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    {/* Números de página */}
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-sm select-none">…</span>
                                            ) : (
                                                <Button
                                                    key={p}
                                                    variant={safePage === p ? 'default' : 'outline'}
                                                    size="icon"
                                                    className="h-8 w-8 text-xs"
                                                    onClick={() => setCurrentPage(p as number)}
                                                >
                                                    {p}
                                                </Button>
                                            )
                                        )}

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                        title="Página siguiente"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={safePage === totalPages}
                                        title="Última página"
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function roundNum(num: number): number {
    return Math.round(num * 10) / 10;
}
