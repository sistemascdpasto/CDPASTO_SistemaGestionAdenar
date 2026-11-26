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
import { Award, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Filter, IdCard, Medal, Search, ShieldCheck, Trophy, UserRound, Users, X } from 'lucide-react';
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

const ANIO_ACTUAL = new Date().getFullYear();
const MES_ACTUAL  = new Date().getMonth() + 1; // 1-based

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
    dias_rechazos: number | null;
    porcentaje_sac: number;
    porcentaje_sac_label: string;
    porcentaje_adherencia_tiempo: number | null;
    porcentaje_adherencia_tiempo_label: string;
    promedio_rmd: number | null;
    promedio_rmd_label: string;
    porcentaje_checklist_pre: number | null;
    porcentaje_checklist_pre_label: string;
    promedio_checklist_pre: number | null;
    porcentaje_checklist_post: number | null;
    porcentaje_checklist_post_label: string;
    promedio_checklist_post: number | null;
    resultado_reparto: number;
    resultado_reparto_label: string;
    resultado_flota: number;
    resultado_flota_label: string;
    calificacion_total: number;
    calificacion_total_label: string;
    foto_url: string | null;
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
    umbral_checklist?: number;
}

const parseCargosFilter = (filterStr?: string): string[] => {
    if (!filterStr || filterStr === 'todos') return [];
    return filterStr.split(',').map((s) => s.trim()).filter(Boolean);
};


export default function PlanPremiacionIndex({ colaboradores, top3: _top3, peores2: _peores2 = [], cargos = [], filters, puede_editar = false }: Props) {
    const [mes, setMes] = useState<number>(filters.mes || new Date().getMonth() + 1);
    const [anio, setAnio] = useState<number>(filters.anio || new Date().getFullYear());
    const [search, setSearch] = useState<string>(filters.search || '');
    const [formulasAbiertas, setFormulasAbiertas] = useState<boolean>(false);
    const [podioVisible, setPodioVisible] = useState<boolean>(true);
    const [estado] = useState<string>(filters.estado || 'todos');
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
        { key: 'cl_pre',            label: 'CL Pre (7.5%)',              pilar: 'FLOTA' },
        { key: 'cl_post',           label: 'CL Post (7.5%)',             pilar: 'FLOTA' },
        { key: 'res_flota',         label: 'Resultado Flota',            pilar: 'FLOTA' },
        { key: 'total',             label: 'TOTAL 100%',                 pilar: 'TOTAL' },
    ];

    const STORAGE_KEY = 'plan-premiacion:cols-visibles';
    const allKeys = COLUMNAS_DEF.map(c => c.key);

    // Columnas visibles la primera vez que alguien abre el módulo (sin
    // preferencia guardada todavía). Con las 17 columnas de métricas a la
    // vez la tabla generaba un scroll horizontal muy notorio; por defecto
    // se deja solo el resultado de cada pilar + el total, y el detalle de
    // cada métrica se activa desde el selector "Columnas".
    const DEFAULT_VISIBLE_KEYS: ColKey[] = ['res_seguridad', 'res_gente', 'res_reparto', 'res_flota', 'total'];

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

        return new Set(DEFAULT_VISIBLE_KEYS);
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...colsVisibles]));
    }, [colsVisibles]);

    const toggleCol = (key: ColKey) => {
        setColsVisibles(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
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
            void (e.target as HTMLInputElement).blur();
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
        // Si el año seleccionado es el actual y el mes actual supera el mes actual,
        // lo recortamos al mes actual para no mostrar meses futuros.
        const mesFinal = (a === ANIO_ACTUAL && mes > MES_ACTUAL) ? MES_ACTUAL : mes;
        if (mesFinal !== mes) setMes(mesFinal);
        handleFilter(mesFinal, a, search, estado, selectedCargos);
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

    const handleToggleChecklist = (colaboradorId: number, tipo: 'pre' | 'post', e: React.MouseEvent) => {
        e.stopPropagation();
        if (!puede_editar) return;
        router.post(
            '/modules/gente/plan-premiacion/toggle-checklist',
            {
                colaborador_id: colaboradorId,
                mes,
                anio,
                tipo,
            },
            { preserveScroll: true }
        );
    };

    const handleToggleAusentismo = (colaboradorId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!puede_editar) return;
        router.post(
            '/modules/gente/plan-premiacion/toggle-ausentismo',
            {
                colaborador_id: colaboradorId,
                mes,
                anio,
            },
            { preserveScroll: true }
        );
    };

    const getCargoLabel = () => {
        if (selectedCargos.length === 0) return 'Todos los Cargos';
        if (selectedCargos.length === 1) return selectedCargos[0];
        return `${selectedCargos.length} Cargos seleccionados`;
    };

    const cargoParam = selectedCargos.length > 0 ? selectedCargos.join(',') : '';
    const exportUrl = [
        `/modules/gente/plan-premiacion/exportar`,
        `?mes=${mes}`,
        `&anio=${anio}`,
        `&meses_checklist=${mes}`,
        search ? `&search=${encodeURIComponent(search)}` : '',
        estado && estado !== 'todos' ? `&estado=${encodeURIComponent(estado)}` : '',
        cargoParam ? `&cargo=${encodeURIComponent(cargoParam)}` : '',
    ].join('');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Plan Premiación - Módulo Gente" />

            <div className="space-y-6 p-6">
                {/* Header Banner */}
                {/* ── Card Título ───────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-sm shrink-0"
                                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                            >
                                <Trophy className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    Plan Premiación
                                </h1>
                                
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end shrink-0">
                            {/* Botones de acción */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Selector de columnas */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30 gap-1.5"
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline">Columnas</span>
                                            <span className="sm:hidden">Cols.</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60 max-h-96 overflow-y-auto">
                                        <DropdownMenuLabel className="text-xs">Mostrar / ocultar columnas</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {['SEGURIDAD', 'GENTE', 'REPARTO', 'FLOTA', 'TOTAL'].map(pilar => (
                                            <div key={pilar}>
                                                <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground py-1">{pilar}</DropdownMenuLabel>
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
                                                className="w-full rounded text-[11px] text-muted-foreground hover:text-foreground underline text-center py-0.5 transition-colors"
                                            >
                                                Mostrar todas
                                            </button>
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Exportar */}
                                <Button
                                    asChild
                                    size="sm"
                                    className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                                    variant="outline"
                                >
                                    <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                        <span className="hidden sm:inline">Exportar Excel</span>
                                        <span className="sm:hidden">Exp.</span>
                                    </a>
                                </Button>
                            </div>

                            {/* Fórmulas colapsables */}
                            <div className="w-full max-w-xs sm:max-w-sm">
                                <button
                                    type="button"
                                    onClick={() => setFormulasAbiertas(v => !v)}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors mb-1"
                                >
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${formulasAbiertas ? 'rotate-180' : ''}`} />
                                    {formulasAbiertas ? 'Ocultar fórmulas' : 'Ver fórmulas de cálculo'}
                                </button>
                                {formulasAbiertas && (
                                    <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-muted/40 dark:bg-muted/20 text-[11px]">
                                        <table className="w-full">
                                            <thead className="sticky top-0 bg-muted dark:bg-muted/80 z-10">
                                                <tr className="border-b border-border/60">
                                                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Indicador</th>
                                                    <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-12">Peso</th>
                                                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Regla</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="bg-emerald-50/60 dark:bg-emerald-950/20">
                                                    <td colSpan={3} className="px-3 py-1 font-bold text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                        <ShieldCheck className="h-3 w-3" /> Seguridad — 35 pts
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-400">ACI</td><td className="px-2 py-1 text-center text-muted-foreground">10%</td><td className="px-3 py-1 text-muted-foreground">Realizadas ÷ 4 × 100</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-400">OWD Ruta</td><td className="px-2 py-1 text-center text-muted-foreground">15%</td><td className="px-3 py-1 text-muted-foreground">Sin NO OK = 100% | Con NO OK = 0%</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-400">Calificaciones</td><td className="px-2 py-1 text-center text-muted-foreground">10%</td><td className="px-3 py-1 text-muted-foreground">Promedio de notas por módulo</td></tr>
                                                <tr className="bg-amber-50/60 dark:bg-amber-950/20">
                                                    <td colSpan={3} className="px-3 py-1 font-bold text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> Gente — 15 pts
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-amber-600 dark:text-amber-400">DPO Academy</td><td className="px-2 py-1 text-center text-muted-foreground">5%</td><td className="px-3 py-1 text-muted-foreground">Sin registro = 100% | En listado = 0%</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-amber-600 dark:text-amber-400">Ausentismo</td><td className="px-2 py-1 text-center text-muted-foreground">5%</td><td className="px-3 py-1 text-muted-foreground">Sin incapacidad = 100% | Con incapacidad = 0%</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-amber-600 dark:text-amber-400">Malas Marcaciones</td><td className="px-2 py-1 text-center text-muted-foreground">5%</td><td className="px-3 py-1 text-muted-foreground">Sin corrección = 100% | Con corrección = 0%</td></tr>
                                                <tr className="bg-rose-50/60 dark:bg-rose-950/20">
                                                    <td colSpan={3} className="px-3 py-1 font-bold text-[10px] text-rose-700 dark:text-rose-400 flex items-center gap-1">
                                                        <Medal className="h-3 w-3" /> Reparto — 35 pts
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-rose-700 dark:text-rose-400">Rechazos</td><td className="px-2 py-1 text-center text-muted-foreground">11%</td><td className="px-3 py-1 text-muted-foreground">&lt;2.0%=100% · 2.0–2.39%=80% · ≥2.4%=0%</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-rose-700 dark:text-rose-400">SAC</td><td className="px-2 py-1 text-center text-muted-foreground">8%</td><td className="px-3 py-1 text-muted-foreground">Sin casos = 100% | Con casos = 0%</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-rose-700 dark:text-rose-400">Adherencia Tiempo</td><td className="px-2 py-1 text-center text-muted-foreground">8%</td><td className="px-3 py-1 text-muted-foreground">≥ 83% = 100% | &lt; 83% = 0%</td></tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-rose-700 dark:text-rose-400">RMD</td><td className="px-2 py-1 text-center text-muted-foreground">8%</td><td className="px-3 py-1 text-muted-foreground">Promedio ≥ 4 = 100% | &lt; 4 = 0%</td></tr>
                                                <tr className="bg-blue-50/60 dark:bg-blue-950/20">
                                                    <td colSpan={3} className="px-3 py-1 font-bold text-[10px] text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Flota — 15 pts (solo conductores)
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40 hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-blue-700 dark:text-blue-400">Checklist Pre</td><td className="px-2 py-1 text-center text-muted-foreground">7.5%</td><td className="px-3 py-1 text-muted-foreground">Default Aprobado (100%)</td></tr>
                                                <tr className="hover:bg-muted/30"><td className="px-3 py-1 font-semibold text-blue-700 dark:text-blue-400">Checklist Post</td><td className="px-2 py-1 text-center text-muted-foreground">7.5%</td><td className="px-3 py-1 text-muted-foreground">Default Aprobado (100%)</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Filtros ───────────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                            Filtros de búsqueda
                        </span>
                        {(search || selectedCargos.length > 0) && (
                            <button
                                type="button"
                                onClick={() => { setSearch(''); setSelectedCargos([]); }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:underline cursor-pointer transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 w-full">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Año</label>
                            <Select value={String(anio)} onValueChange={handleAnioChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar Año" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ANIOS.map((a) => (
                                        <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="mb-1                
 block text-[11px] font-medium text-muted-foreground">Mes</label>
                            <Select value={String(mes)} onValueChange={handleMesChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar Mes" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MESES.filter((m) => anio < ANIO_ACTUAL || m.value <= MES_ACTUAL).map((m) => (
                                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Buscar Colaborador</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Nombre, apellido, cédula..."
                                    value={search}
                                    onChange={handleSearchChange}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {cargos.length > 0 && (
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Cargo</label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between text-sm font-normal truncate">
                                            <span className="truncate">{getCargoLabel()}</span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto">
                                        <DropdownMenuCheckboxItem
                                            checked={selectedCargos.length === 0}
                                            onCheckedChange={() => handleToggleCargo('todos')}
                                            className="text-xs font-medium"
                                        >
                                            Todos los Cargos
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        {cargos.map((c) => (
                                            <DropdownMenuCheckboxItem
                                                key={c}
                                                checked={selectedCargos.includes(c)}
                                                onCheckedChange={() => handleToggleCargo(c)}
                                                className="text-xs"
                                            >
                                                {c}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>


                {/* ── Podio por Cargo ──────────────────────────────────────────── */}
                {colaboradores.length > 0 && (() => {
                    const CARGOS_PODIO = [
                        { key: 'Conductor',              label: 'Conductores' },
                        { key: 'Responsable de Reparto', label: 'Responsables de Reparto' },
                        { key: 'Auxiliar de Reparto',    label: 'Auxiliares de Reparto' },
                    ];

                    const topPorCargo = CARGOS_PODIO.map(({ key, label }) => {
                        const filtered = colaboradores
                            .filter(c => c.cargo.toLowerCase().includes(key.toLowerCase()))
                            .sort((a, b) => b.calificacion_total - a.calificacion_total)
                            .slice(0, 2);
                        return { label, ganadores: filtered };
                    });

                    if (!topPorCargo.some(g => g.ganadores.length > 0)) return null;

                    const Reconocimiento = ({ item, puesto }: { item: ColaboradorItem; puesto: 1 | 2 }) => {
                        const primero = puesto === 1;
                        return (
                            <div className={`rounded-xl border p-3 ${primero ? 'border-green-200 bg-green-50/60 dark:border-green-800/50 dark:bg-green-950/20' : 'border-orange-200 bg-orange-50/60 dark:border-orange-800/50 dark:bg-orange-950/20'}`}>
                                <div className="flex items-center gap-3">
                                    {item.foto_url ? (
                                        <img
                                            src={item.foto_url}
                                            alt={item.nombre_completo}
                                            className="h-14 w-14 shrink-0 rounded-full object-cover border-2 border-white shadow-sm"
                                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="h-14 w-14 shrink-0 rounded-full bg-white dark:bg-muted flex items-center justify-center shadow-sm">
                                            <UserRound className="h-7 w-7 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-xs font-semibold ${primero ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                                {primero ? '1.er lugar' : '2.º lugar'}
                                            </span>
                                            {primero
                                                ? <Trophy className="h-4 w-4 text-green-700 dark:text-green-400" />
                                                : <Medal className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                            }
                                        </div>
                                        <p className="font-semibold text-sm text-foreground truncate">{item.nombre_completo}</p>
                                        <p className="text-xs text-muted-foreground truncate">{item.cargo}</p>
                                        <div className="flex items-center justify-between gap-2 mt-2">
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <IdCard className="h-3.5 w-3.5 shrink-0" />
                                                {item.cedula}
                                            </span>
                                            <span className={`text-sm font-bold ${primero ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                                {item.calificacion_total_label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-6 py-6">
                            <div className="flex items-center justify-between gap-2 mb-5">
                                <div className="flex items-center gap-2">
                                    <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-base font-semibold text-foreground">Reconocimiento del Mes</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPodioVisible(v => !v)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${podioVisible ? 'rotate-180' : ''}`} />
                                    {podioVisible ? 'Ocultar' : 'Mostrar'}
                                </button>
                            </div>
                            {podioVisible && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {topPorCargo.map(({ label, ganadores }) => (
                                    <div key={label} className="rounded-xl border border-border/60 bg-background p-3 space-y-3">
                                        <h3 className="text-sm font-bold text-foreground">{label}</h3>
                                        {ganadores[0]
                                            ? <Reconocimiento item={ganadores[0]} puesto={1} />
                                            : <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">Sin datos</div>
                                        }
                                        {ganadores[1]
                                            ? <Reconocimiento item={ganadores[1]} puesto={2} />
                                            : <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">Sin datos</div>
                                        }
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                    );
                })()}

                {/* Gráfico de Barras del Mes */}
                <GraficoBarrasMes colaboradores={colaboradores} mes={mes} anio={anio} />

                {/* Tabla Principal */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <CardTitle className="text-base font-semibold">
                                Lista de Colaboradores ({colaboradores.length})
                                {totalPages > 1 && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        — mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, colaboradores.length)} de {colaboradores.length}
                                    </span>
                                )}
                            </CardTitle>

                            {/* Control de registros por página */}
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
                                                    ? 'bg-foreground text-background border-transparent'
                                                    : 'bg-card text-muted-foreground border-sidebar-border/70 hover:bg-muted/60 dark:border-sidebar-border dark:text-muted-foreground'
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
                                    <TableRow className="border-b border-sidebar-border/70 bg-muted">
                                        <TableHead rowSpan={2} className="align-middle font-bold text-foreground">Nombre</TableHead>
                                        <TableHead rowSpan={2} className="align-middle font-bold text-foreground">Cargo</TableHead>

                                        {colSpanSeguridad > 0 && (
                                            <TableHead colSpan={colSpanSeguridad} className="text-center font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 border-x border-emerald-200 dark:border-emerald-800/50 py-2 text-xs">
                                                SEGURIDAD 35%
                                            </TableHead>
                                        )}
                                        {colSpanGente > 0 && (
                                            <TableHead colSpan={colSpanGente} className="text-center font-bold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 border-x border-amber-200 dark:border-amber-800/50 py-2 text-xs">
                                                GENTE 15%
                                            </TableHead>
                                        )}
                                        {colSpanReparto > 0 && (
                                            <TableHead colSpan={colSpanReparto} className="text-center font-bold text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/60 border-x border-rose-200 dark:border-rose-800/50 py-2 text-xs">
                                                REPARTO 35%
                                            </TableHead>
                                        )}
                                        {colSpanFlota > 0 && (
                                            <TableHead colSpan={colSpanFlota} className="text-center font-bold text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/60 border-x border-blue-200 dark:border-blue-800/50 py-2 text-xs">
                                                FLOTA 15%
                                            </TableHead>
                                        )}
                                        {cv('total') && (
                                            <TableHead rowSpan={2} className="text-center font-bold text-purple-800 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/60 border-x border-purple-200 dark:border-purple-800/50 py-2 text-xs align-middle">
                                                TOTAL 100%
                                            </TableHead>
                                        )}
                                    </TableRow>

                                    {/* Fila 2: Subcolumnas de Métricas */}
                                    <TableRow className="border-b border-sidebar-border/70 bg-muted/40 text-xs">
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

                                        {cv('cl_pre')    && <TableHead className="w-36 text-right bg-blue-50/40 dark:bg-blue-950/20">CL Pre <span className="text-blue-600 font-bold">(7.5%)</span></TableHead>}
                                        {cv('cl_post')   && <TableHead className="w-36 text-right bg-blue-50/40 dark:bg-blue-950/20">CL Post <span className="text-blue-600 font-bold">(7.5%)</span></TableHead>}
                                        {cv('res_flota') && <TableHead className="w-32 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30">Resultado</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {colaboradores.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={2 + colsVisibles.size} className="py-8 text-center text-muted-foreground">
                                                No se encontraron colaboradores para el filtro seleccionado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedColabs.map((colab) => (
                                            <TableRow key={colab.id} className="cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-colors">
                                                <TableCell className="font-semibold text-foreground">
                                                    <a
                                                        href={`/modules/gente/plan-premiacion/${colab.id}?mes=${mes}&anio=${anio}`}
                                                        className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                                    >
                                                        {colab.nombre_completo}
                                                    </a>
                                                </TableCell>

                                                <TableCell className="text-foreground">
                                                    {colab.cargo}
                                                </TableCell>

                                                {/* % ACI */}
                                                {cv('aci') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 overflow-hidden rounded-full bg-muted h-2">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${
                                                                    colab.aci_realizadas >= 4
                                                                        ? 'bg-emerald-500'
                                                                        : colab.aci_realizadas > 0
                                                                            ? 'bg-amber-500'
                                                                            : 'bg-muted-foreground/30'
                                                                }`}
                                                                style={{ width: `${Math.min(100, (colab.aci_realizadas / 4) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`font-bold min-w-[40px] ${
                                                            colab.aci_realizadas >= 4
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : colab.aci_realizadas > 0
                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                    : 'text-muted-foreground'
                                                        }`}>
                                                            {colab.aci_realizadas}/4
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % OWD Ruta */}
                                                {cv('owd') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_owd_ruta !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-muted h-2">
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
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % Calificaciones Módulos */}
                                                {cv('calificaciones') && (
                                                <TableCell className="text-right">
                                                    {colab.promedio_calificaciones !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-muted h-2">
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
                                                            <span className="font-bold text-foreground min-w-[45px]">
                                                                {colab.promedio_calificaciones_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Resultado Seguridad */}
                                                {cv('res_seguridad') && (
                                                <TableCell className="text-right bg-emerald-50/30 dark:bg-emerald-950/10">
                                                    {colab.resultado !== null ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-20 overflow-hidden rounded-full bg-muted h-2.5">
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
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % DPO Academy */}
                                                {cv('dpo') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
                                                            <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_dpo >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${colab.porcentaje_dpo}%` }} />
                                                        </div>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-extrabold ${colab.porcentaje_dpo >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                                            {colab.porcentaje_dpo_label}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % Ausentismo — toggle manual Aprobado/No Aprobado */}
                                                {cv('ausentismo') && (
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={!puede_editar}
                                                            onClick={(e) => handleToggleAusentismo(colab.id, e)}
                                                            title={puede_editar ? `Haz clic para cambiar a ${colab.porcentaje_ausentismo !== null && colab.porcentaje_ausentismo >= 100 ? '0%' : '100%'}` : undefined}
                                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                                                                colab.porcentaje_ausentismo !== null && colab.porcentaje_ausentismo >= 100
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
                                                                    : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50'
                                                            } ${puede_editar ? 'cursor-pointer hover:scale-105 shadow-xs' : 'cursor-default'}`}
                                                        >
                                                            {colab.porcentaje_ausentismo_label}
                                                        </button>
                                                    </div>
                                                </TableCell>
                                                )}

                                                {/* % Malas Marcaciones */}
                                                {cv('marcaciones') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
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
                                                            <div className="w-20 overflow-hidden rounded-full bg-muted h-2.5">
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
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % Rechazos — verde < 2.0% · naranja 2.0–2.39% · rojo ≥ 2.4% */}
                                                {cv('rechazos') && (
                                                <TableCell className="text-right">
                                                    {colab.porcentaje_rechazos !== null && colab.porcentaje_rechazos !== undefined ? (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
                                                                    <div className={`h-full rounded-full transition-all duration-300 ${
                                                                        colab.porcentaje_rechazos < 2.0
                                                                            ? 'bg-emerald-500'
                                                                            : colab.porcentaje_rechazos < 2.4
                                                                                ? 'bg-amber-500'
                                                                                : 'bg-rose-500'
                                                                    }`}
                                                                        style={{ width: `${Math.min(100, Math.max(0, (1 - colab.porcentaje_rechazos / 4.8) * 100))}%` }} />
                                                                </div>
                                                                <span className={`font-bold min-w-[40px] ${
                                                                    colab.porcentaje_rechazos < 2.0
                                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                                        : colab.porcentaje_rechazos < 2.4
                                                                            ? 'text-amber-600 dark:text-amber-400'
                                                                            : 'text-rose-600 dark:text-rose-400'
                                                                }`}>
                                                                    {colab.porcentaje_rechazos_label}
                                                                </span>
                                                            </div>
                                                            {colab.dias_rechazos != null && (
                                                                <span className="text-[10px] text-muted-foreground">{colab.dias_rechazos} días</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* % SAC */}
                                                {cv('sac') && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
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
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
                                                                <div className={`h-full rounded-full transition-all duration-300 ${colab.porcentaje_adherencia_tiempo >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                    style={{ width: `${Math.min(100, colab.porcentaje_adherencia_tiempo)}%` }} />
                                                            </div>
                                                            <span className={`font-bold min-w-[40px] ${colab.porcentaje_adherencia_tiempo >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {colab.porcentaje_adherencia_tiempo_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* RMD */}
                                                {cv('rmd') && (
                                                <TableCell className="text-right">
                                                    {colab.promedio_rmd !== null && colab.promedio_rmd !== undefined ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
                                                                <div className={`h-full rounded-full transition-all duration-300 ${colab.promedio_rmd >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                    style={{ width: `${Math.min(100, colab.promedio_rmd)}%` }} />
                                                            </div>
                                                            <span className={`font-bold min-w-[40px] ${colab.promedio_rmd >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {colab.promedio_rmd_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Resultado Reparto */}
                                                {cv('res_reparto') && (
                                                <TableCell className="text-right bg-rose-50/30 dark:bg-rose-950/10">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 overflow-hidden rounded-full bg-muted h-2.5">
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

                                                {/* Checklist Pre — solo conductores, binario Aprobado/No Aprobado (Default Aprobado) */}
                                                {cv('cl_pre') && (
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    {colab.porcentaje_checklist_pre !== null && colab.porcentaje_checklist_pre !== undefined ? (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <button
                                                                type="button"
                                                                disabled={!puede_editar}
                                                                onClick={(e) => handleToggleChecklist(colab.id, 'pre', e)}
                                                                title={puede_editar ? `Haz clic para cambiar a ${colab.porcentaje_checklist_pre >= 100 ? 'No Aprobado' : 'Aprobado'}` : undefined}
                                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                                                                    colab.porcentaje_checklist_pre >= 100
                                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
                                                                        : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50'
                                                                } ${puede_editar ? 'cursor-pointer hover:scale-105 shadow-xs' : 'cursor-default'}`}
                                                            >
                                                                {colab.porcentaje_checklist_pre_label}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Checklist Post — solo conductores, binario Aprobado/No Aprobado (Default Aprobado) */}
                                                {cv('cl_post') && (
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    {colab.porcentaje_checklist_post !== null && colab.porcentaje_checklist_post !== undefined ? (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <button
                                                                type="button"
                                                                disabled={!puede_editar}
                                                                onClick={(e) => handleToggleChecklist(colab.id, 'post', e)}
                                                                title={puede_editar ? `Haz clic para cambiar a ${colab.porcentaje_checklist_post >= 100 ? 'No Aprobado' : 'Aprobado'}` : undefined}
                                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                                                                    colab.porcentaje_checklist_post >= 100
                                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
                                                                        : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50'
                                                                } ${puede_editar ? 'cursor-pointer hover:scale-105 shadow-xs' : 'cursor-default'}`}
                                                            >
                                                                {colab.porcentaje_checklist_post_label}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>
                                                )}

                                                {/* Resultado Flota */}
                                                {cv('res_flota') && (
                                                <TableCell className="text-right bg-blue-50/30 dark:bg-blue-950/10">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 overflow-hidden rounded-full bg-muted h-2.5">
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
                                                            <div className="w-24 overflow-hidden rounded-full bg-muted h-3">
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
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                                <p className="text-sm text-muted-foreground">
                                    Página <span className="font-semibold text-foreground">{safePage}</span> de{' '}
                                    <span className="font-semibold text-foreground">{totalPages}</span>
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
                                                <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm select-none">…</span>
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
        </AppLayout>
    );
}

