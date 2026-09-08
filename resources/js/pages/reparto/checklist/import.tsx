import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Calendar, CheckCircle2, ChevronDown, ClipboardCheck, FileSpreadsheet, Upload, X, XCircle } from 'lucide-react';
import React, { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Checklist de Vehículos', href: '/modules/reparto/checklist/import' },
];

interface Registro {
    id: number;
    id_form: string;
    estado: string | null;
    fecha: string | null;
    fecha_fin: string | null;
    id_centro: string | null;
    id_regional: string | null;
    regional: string | null;
    centro: string | null;
    operacion: string | null;
    cedula_conductor: string | null;
    placa_vehiculo: string | null;
    odometro: string | null;
    salud_descanso: string | null;
    libre_medicamentos: string | null;
    fugas: string | null;
    testigos_presion_aire: string | null;
    freno_parqueo: string | null;
    kit_reparto: string | null;
    inventario: string | null;
    capacidad_vehiculo: string | null;
    condiciones_operar: string | null;
    documentos_operar: string | null;
    licencia_vigente: string | null;
    licencia_original: string | null;
    tecnomecanica: string | null;
    soat_vigente: string | null;
    kit_totalidad: string | null;
    repuestos_buen_estado: string | null;
    extintor: string | null;
    extintor_vigente: string | null;
    botiquin_condiciones: string | null;
    linterna_condiciones: string | null;
    kit_basico: string | null;
    niveles_totalidad: string | null;
    combustible_suficiente: string | null;
    nivel_combustible: string | null;
    liquido_embrague: string | null;
    refrigerante_estado: string | null;
    aceite_estado: string | null;
    estado_hidraulico: string | null;
    aceite_caja: string | null;
    agua_limpiabrisas: string | null;
    cumple_llantas: string | null;
    bandas_rodamientos: string | null;
    deformaciones_costados: string | null;
    labrado_profundidad: string | null;
    cumple_visibilidad: string | null;
    estado_panoramico: string | null;
    estado_retrovisores: string | null;
    estado_limpiabrisas: string | null;
    estado_cinturones: string | null;
    estado_colapies: string | null;
    cerrar_fuera: string | null;
    estado_dashcam: string | null;
    estado_vidrios: string | null;
    cumple_luces: string | null;
    luces_freno: string | null;
    estado_principales: string | null;
    luces_reserva: string | null;
    luces_direccionales: string | null;
    luces_estacionarias: string | null;
    luces_laterales: string | null;
    estado_pito: string | null;
    estado_pito_reserva: string | null;
    cumple_audible: string | null;
    cumple_carroceria: string | null;
    estado_correas: string | null;
    estado_parales: string | null;
    estado_cortinas: string | null;
    estado_chapas: string | null;
    cumple_carretilla: string | null;
    cuenta_etiqueta: string | null;
    llantas_rodamientos_dos: string | null;
    estado_carretilla_dos: string | null;
    carretilla_dos: string | null;
    etiqueta: string | null;
    estado_rodamiento: string | null;
    estado_carretilla_uno: string | null;
    carretilla_uno: string | null;
    observaciones: string | null;
    firma_conductor: string | null;
    conductor_operar: string | null;
    vehiculo_operar: string | null;
    vehiculo_bitren: string | null;
    estado_bitren: string | null;
    nombre_flota: string | null;
    apellido_flota: string | null;
    firma_responsable: string | null;
    codigo_responsable: string | null;
    estado_form: string | null;
    cumpl: number | null;
    meta_td: number | null;
    tiempo_ejecucion: string | null;
    mes: number | null;
    semana: number | null;
    anio: number | null;
    dia: number | null;
    meta: number | null;
    cumpl_meta: number | null;
}

interface PaginationLink { url: string | null; label: string; active: boolean }
interface Paginator {
    data: Registro[];
    current_page: number; last_page: number;
    per_page: number; total: number;
    from: number | null; to: number | null;
    links: PaginationLink[];
}
interface Props {
    registros: Paginator;
    placas: string[];
    filters: { fecha_desde: string; fecha_hasta: string; placa: string; cedula: string };
    flash: { success?: string; error?: string };
    duplicados: { id_form: string; condicion: string; operacion: string | null; firma_responsable: string | null; placa_vehiculo: string | null; cedula_conductor: string | null; fecha: string | null; regional: string | null; centro: string | null }[];
}

// Definición de columnas: [clave del campo, etiqueta del header]
const COLUMNAS: [keyof Registro, string][] = [
    ['id_form',                'ID Form'],
    ['estado',                 'Estado'],
    ['fecha',                  'Fecha'],
    ['fecha_fin',              'Fecha Fin'],
    ['id_centro',              'ID Centro'],
    ['id_regional',            'ID Regional'],
    ['regional',               'Regional'],
    ['centro',                 'Centro'],
    ['operacion',              'Operación'],
    ['cedula_conductor',       'Cédula Conductor'],
    ['placa_vehiculo',         'Placa'],
    ['odometro',               'Odómetro'],
    ['salud_descanso',         'Salud/Descanso'],
    ['libre_medicamentos',     'Libre Medicamentos'],
    ['fugas',                  'Fugas'],
    ['testigos_presion_aire',  'Testigos Presión Aire'],
    ['freno_parqueo',          'Freno Parqueo'],
    ['kit_reparto',            'Kit Reparto'],
    ['inventario',             'Inventario'],
    ['capacidad_vehiculo',     'Capacidad Vehículo'],
    ['condiciones_operar',     'Condiciones Operar'],
    ['documentos_operar',      'Documentos Operar'],
    ['licencia_vigente',       'Licencia Vigente'],
    ['licencia_original',      'Licencia Original'],
    ['tecnomecanica',          'Tecnomecánica'],
    ['soat_vigente',           'SOAT Vigente'],
    ['kit_totalidad',          'Kit Totalidad'],
    ['repuestos_buen_estado',  'Repuestos Buen Estado'],
    ['extintor',               'Extintor'],
    ['extintor_vigente',       'Extintor Vigente'],
    ['botiquin_condiciones',   'Botiquín'],
    ['linterna_condiciones',   'Linterna'],
    ['kit_basico',             'Kit Básico'],
    ['niveles_totalidad',      'Niveles Totalidad'],
    ['combustible_suficiente', 'Combustible Suficiente'],
    ['nivel_combustible',      'Nivel Combustible'],
    ['liquido_embrague',       'Líquido Embrague'],
    ['refrigerante_estado',    'Refrigerante'],
    ['aceite_estado',          'Aceite'],
    ['estado_hidraulico',      'Hidráulico'],
    ['aceite_caja',            'Aceite Caja'],
    ['agua_limpiabrisas',      'Agua Limpiabrisas'],
    ['cumple_llantas',         'Cumple Llantas'],
    ['bandas_rodamientos',     'Bandas/Rodamientos'],
    ['deformaciones_costados', 'Deformaciones'],
    ['labrado_profundidad',    'Labrado'],
    ['cumple_visibilidad',     'Cumple Visibilidad'],
    ['estado_panoramico',      'Panorámico'],
    ['estado_retrovisores',    'Retrovisores'],
    ['estado_limpiabrisas',    'Limpiabrisas'],
    ['estado_cinturones',      'Cinturones'],
    ['estado_colapies',        'Colapies'],
    ['cerrar_fuera',           'Cerrar Fuera'],
    ['estado_dashcam',         'Dashcam'],
    ['estado_vidrios',         'Vidrios'],
    ['cumple_luces',           'Cumple Luces'],
    ['luces_freno',            'Luces Freno'],
    ['estado_principales',     'Luces Principales'],
    ['luces_reserva',          'Luces Reserva'],
    ['luces_direccionales',    'Luces Direccionales'],
    ['luces_estacionarias',    'Luces Estacionarias'],
    ['luces_laterales',        'Luces Laterales'],
    ['estado_pito',            'Pito'],
    ['estado_pito_reserva',    'Pito Reserva'],
    ['cumple_audible',         'Cumple Audible'],
    ['cumple_carroceria',      'Cumple Carrocería'],
    ['estado_correas',         'Correas'],
    ['estado_parales',         'Parales'],
    ['estado_cortinas',        'Cortinas'],
    ['estado_chapas',          'Chapas'],
    ['cumple_carretilla',      'Cumple Carretilla'],
    ['cuenta_etiqueta',        'Cuenta Etiqueta'],
    ['llantas_rodamientos_dos','Llantas Rod. 2'],
    ['estado_carretilla_dos',  'Carretilla 2'],
    ['carretilla_dos',         'Carretilla 2 Estado'],
    ['etiqueta',               'Etiqueta'],
    ['estado_rodamiento',      'Rodamiento'],
    ['estado_carretilla_uno',  'Carretilla 1'],
    ['carretilla_uno',         'Carretilla 1 Estado'],
    ['observaciones',          'Observaciones'],
    ['firma_conductor',        'Firma Conductor'],
    ['conductor_operar',       'Conductor Operar'],
    ['vehiculo_operar',        'Vehículo Operar'],
    ['vehiculo_bitren',        'Vehículo Bitrén'],
    ['estado_bitren',          'Estado Bitrén'],
    ['nombre_flota',           'Nombre Flota'],
    ['apellido_flota',         'Apellido Flota'],
    ['firma_responsable',      'Firma Responsable'],
    ['codigo_responsable',     'Código Responsable'],
    ['estado_form',            'Estado Form'],
    ['cumpl',                  'CUMPL %'],
    ['meta_td',                'Meta TD'],
    ['tiempo_ejecucion',       'T. Ejecución'],
    ['mes',                    'Mes'],
    ['semana',                 'Semana'],
    ['anio',                   'Año'],
    ['dia',                    'Día'],
    ['meta',                   'Meta %'],
    ['cumpl_meta',             'CUMPL Meta'],
];

// Nombres de mes por número
const MESES_NOMBRES: Record<number, string> = {
    1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio',
    7:'Julio', 8:'Agosto', 9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre',
};

// Campos que son porcentaje (ya vienen multiplicados ×100 desde el backend)
const PCT_FIELDS = new Set(['cumpl', 'meta', 'cumpl_meta']);

// Campos que son fechas
const FECHA_FIELDS = new Set(['fecha', 'fecha_fin']);

// Columnas fijas (no se ocultan)
const FIXED_COLS = new Set<keyof Registro>(['id_form', 'fecha', 'placa_vehiculo', 'cedula_conductor']);

export default function ChecklistImport({ registros, placas, filters, flash, duplicados }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showDuplicados, setShowDuplicados] = useState(true);

    const [fechaDesde, setFechaDesde]       = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta]       = useState(filters.fecha_hasta ?? '');
    const [placaInput, setPlacaInput]       = useState(filters.placa ?? '');
    const [placa, setPlaca]                 = useState(filters.placa ?? '');
    const [showPlacaList, setShowPlacaList] = useState(false);

    // Columnas visibles — persisten en localStorage entre sesiones
    const STORAGE_KEY = 'checklist_cols_visibles';
    const [colsVisibles, setColsVisibles] = useState<Set<keyof Registro>>(() => {
        try {
            const guardadas = localStorage.getItem(STORAGE_KEY);
            if (guardadas) {
                const arr = JSON.parse(guardadas) as string[];
                // Siempre incluir las fijas aunque no estén guardadas
                const todas = new Set<keyof Registro>([
                    ...Array.from(FIXED_COLS),
                    ...arr.filter((k) => COLUMNAS.some(([c]) => c === k)),
                ] as (keyof Registro)[]);
                return todas;
            }
        } catch {}
        return new Set(COLUMNAS.map(([k]) => k));
    });
    const [showColPicker, setShowColPicker] = useState(false);

    const toggleCol = (k: keyof Registro) => {
        if (FIXED_COLS.has(k)) return;
        setColsVisibles((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            // Guardar en localStorage inmediatamente
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
            } catch {}
            return next;
        });
    };

    const columnasMostradas = COLUMNAS.filter(([k]) => colsVisibles.has(k));

    const placasFiltradas = placaInput
        ? placas.filter((p) => p.toLowerCase().includes(placaInput.toLowerCase()))
        : placas;

    const applyFilters = (overrides: Record<string, string> = {}) => {
        router.get(
            route('reparto.checklist.import.index'),
            { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, placa, ...overrides },
            { preserveState: true, preserveScroll: true },
        );
    };

    const selectPlaca = (p: string) => {
        setPlaca(p); setPlacaInput(p); setShowPlacaList(false);
        applyFilters({ placa: p });
    };
    const clearPlaca = () => {
        setPlaca(''); setPlacaInput('');
        applyFilters({ placa: '' });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const fd = new FormData();
        fd.append('archivo', file);
        router.post(route('reparto.checklist.import.store'), fd as any, {
            onSuccess: () => { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; },
            onError:   () => setIsUploading(false),
        });
    };

    const fmt = (campo: keyof Registro, val: any): string => {
        if (val === null || val === undefined || val === '') return '—';

        // Fechas → dd/mm/yyyy  (soporta "2026-01-08", "2026-01-08 00:00:00" y "2026-01-08T00:00:00.000000Z")
        if (FECHA_FIELDS.has(campo)) {
            const soloFecha = String(val).split('T')[0].split(' ')[0]; // quita hora e ISO timezone
            const [y, m, d] = soloFecha.split('-');
            return `${d}/${m}/${y}`;
        }

        // Porcentajes → ya vienen ×100 del backend
        if (PCT_FIELDS.has(campo)) {
            const n = Number(val);
            return isNaN(n) ? String(val) : `${n % 1 === 0 ? n : n.toFixed(2)}%`;
        }

        // Mes → nombre del mes
        if (campo === 'mes') {
            const n = Number(val);
            return !isNaN(n) && MESES_NOMBRES[n] ? MESES_NOMBRES[n] : String(val);
        }

        // Tiempo de ejecución → ya viene como HH:MM:SS del backend
        if (campo === 'tiempo_ejecucion') return String(val);

        return String(val);
    };

    const cumplColor = (v: number | null) => {
        if (v === null) return 'text-muted-foreground';
        if (v >= 90) return 'text-green-700 font-semibold';
        if (v >= 70) return 'text-amber-700 font-semibold';
        return 'text-red-700 font-semibold';
    };

    const hayFiltros = fechaDesde || fechaHasta || placa;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Checklist de Vehículos" />

            <div className="space-y-4 p-4 md:p-6 max-w-full mx-auto">

                {/* Flash */}
                {flash.success && (
                    <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">
                        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
                        <p className="text-sm font-medium">{flash.success}</p>
                    </div>
                )}
                {flash.error && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                        <XCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
                        <p className="text-sm font-medium">{flash.error}</p>
                    </div>
                )}

                {/* Tabla de duplicados omitidos */}
                {duplicados.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <button
                            type="button"
                            onClick={() => setShowDuplicados((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/15"
                        >
                            <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                                <XCircle className="h-4 w-4 text-amber-600" />
                                {duplicados.length} registro{duplicados.length !== 1 ? 's' : ''} omitido{duplicados.length !== 1 ? 's' : ''} por duplicado — ya existían en la base de datos
                            </span>
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                                {showDuplicados ? 'Ocultar' : 'Ver detalle'}
                                <ChevronDown className={`size-3.5 transition-transform ${showDuplicados ? 'rotate-180' : ''}`} />
                            </span>
                        </button>
                        {showDuplicados && (
                            <div className="overflow-x-auto border-t border-amber-200">
                                <table className="w-full text-xs">
                                    <thead className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold">#</th>
                                            <th className="px-3 py-2 text-left font-semibold">ID Form (Excel)</th>
                                            <th className="px-3 py-2 text-left font-semibold">Condición de duplicado</th>
                                            <th className="px-3 py-2 text-left font-semibold">Operación</th>
                                            <th className="px-3 py-2 text-left font-semibold">Firma Responsable</th>
                                            <th className="px-3 py-2 text-left font-semibold">Placa</th>
                                            <th className="px-3 py-2 text-left font-semibold">Cédula Conductor</th>
                                            <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                                            <th className="px-3 py-2 text-left font-semibold">Regional</th>
                                            <th className="px-3 py-2 text-left font-semibold">Centro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {duplicados.map((d, i) => (
                                            <tr key={`${d.id_form}-${i}`} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}>
                                                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                                <td className="px-3 py-1.5 font-mono font-semibold text-amber-800">{d.id_form}</td>
                                                <td className="px-3 py-1.5 text-muted-foreground text-xs">{d.condicion}</td>
                                                <td className="px-3 py-1.5">
                                                    {d.operacion
                                                        ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${d.operacion.toLowerCase().includes('retorno') ? 'bg-muted text-foreground' : 'bg-orange-100 text-orange-700'}`}>{d.operacion}</span>
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-1.5 text-foreground">{d.firma_responsable || '—'}</td>
                                                <td className="px-3 py-1.5 font-mono">{d.placa_vehiculo || '—'}</td>
                                                <td className="px-3 py-1.5 font-mono">{d.cedula_conductor || '—'}</td>
                                                <td className="px-3 py-1.5">{d.fecha ? d.fecha.split(' ')[0].split('-').reverse().join('/') : '—'}</td>
                                                <td className="px-3 py-1.5">{d.regional || '—'}</td>
                                                <td className="px-3 py-1.5">{d.centro || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Encabezado */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
                            Checklist de Vehículos
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {registros.total} registro{registros.total !== 1 ? 's' : ''} importado{registros.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {/* Selector de columnas */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                onClick={() => setShowColPicker((v) => !v)}
                                className="text-muted-foreground border-input"
                            >
                                Columnas ({columnasMostradas.length}/{COLUMNAS.length})
                            </Button>
                            {showColPicker && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-lg shadow-md p-3 w-72 max-h-[70vh] overflow-y-auto">
                                        <p className="text-xs font-semibold text-muted-foreground mb-2">Mostrar / ocultar columnas</p>
                                        <div className="space-y-1">
                                            {COLUMNAS.map(([k, label]) => (
                                                <label key={k} className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60 ${FIXED_COLS.has(k) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={colsVisibles.has(k)}
                                                        onChange={() => toggleCol(k)}
                                                        disabled={FIXED_COLS.has(k)}
                                                        className=""
                                                    />
                                                    {label}
                                                    {FIXED_COLS.has(k) && <span className="text-xs text-muted-foreground ml-auto">fija</span>}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploading ? 'Procesando...' : 'Subir Excel'}
                        </Button>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                    </div>
                </div>

                {/* Filtros */}
                <Card className="shadow-sm border bg-card">
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                            {/* Placa */}
                            <div className="relative">
                                <Label className="text-xs font-semibold text-muted-foreground">Placa</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type="text" placeholder="Buscar placa..."
                                        value={placaInput}
                                        onChange={(e) => { setPlacaInput(e.target.value); setPlaca(''); setShowPlacaList(true); }}
                                        onFocus={() => setShowPlacaList(true)}
                                        className="pr-7 font-mono uppercase" autoComplete="off"
                                    />
                                    {placaInput && (
                                        <button type="button" onClick={clearPlaca} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                {showPlacaList && placasFiltradas.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                                        {placasFiltradas.map((p) => (
                                            <button key={p} type="button" onMouseDown={() => selectPlaca(p)}
                                                className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted/50 dark:hover:bg-muted">{p}</button>
                                        ))}
                                    </div>
                                )}
                                {showPlacaList && <div className="fixed inset-0 z-40" onClick={() => setShowPlacaList(false)} />}
                            </div>

                            {/* Desde */}
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-1" />Desde
                                </Label>
                                <Input type="date" value={fechaDesde} className="mt-1"
                                    onChange={(e) => { setFechaDesde(e.target.value); applyFilters({ fecha_desde: e.target.value }); }} />
                            </div>

                            {/* Hasta */}
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-1" />Hasta
                                </Label>
                                <Input type="date" value={fechaHasta} className="mt-1"
                                    onChange={(e) => { setFechaHasta(e.target.value); applyFilters({ fecha_hasta: e.target.value }); }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabla */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                            Registros
                            {registros.from !== null && (
                                <Badge variant="secondary" className="ml-2">
                                    {registros.from}–{registros.to} de {registros.total}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 p-0">
                        {/* Scroll horizontal completo */}
                        <div className="overflow-x-auto">
                            <Table className="text-xs whitespace-nowrap">
                                <TableHeader className="bg-muted/50 sticky top-0">
                                    <TableRow>
                                        {columnasMostradas.map(([k, label]) => (
                                            <TableHead key={k} className="font-semibold px-3 py-2 text-xs border-r last:border-r-0">
                                                {label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {registros.data.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={columnasMostradas.length} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                                                    <span>
                                                        {hayFiltros
                                                            ? 'No se encontraron registros con ese criterio.'
                                                            : 'No hay registros importados aún. Sube un archivo Excel para comenzar.'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        registros.data.map((r) => (
                                            <TableRow key={r.id} className="hover:bg-muted/50/40 dark:hover:bg-muted/40">
                                                {columnasMostradas.map(([k]) => {
                                                    const val = r[k];
                                                    const texto = fmt(k, val);
                                                    // Color especial para CUMPL
                                                    const esColor = k === 'cumpl' && val !== null;
                                                    return (
                                                        <TableCell key={k} className={`px-3 py-1.5 border-r last:border-r-0 ${esColor ? cumplColor(val as number) : 'text-foreground'}`}>
                                                            {texto}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {registros.last_page > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Página {registros.current_page} de {registros.last_page}
                                </p>
                                <div className="flex gap-1 flex-wrap">
                                    {registros.links.map((link, i) => (
                                        <Button
                                            key={i} size="sm"
                                            variant={link.active ? 'default' : 'outline'}
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                            className={`h-8 min-w-[2rem] px-2 text-xs ${link.active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </AppLayout>
    );
}
