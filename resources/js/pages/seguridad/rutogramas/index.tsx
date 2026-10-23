import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArcElement, BarController, BarElement, CategoryScale, Chart as ChartJS, DoughnutController, Legend, LinearScale, Tooltip } from 'chart.js';
import { AlertCircle, Building2, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, ExternalLink, Layers, MapPinned, Navigation, Package, Search, Truck, TrendingUp, Upload, User, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Rutogramas', href: '/modules/seguridad/rutogramas' },
];

const DIAS = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' },
    { key: 'sabado', label: 'Sábado' },
] as const;

const PALETTE = ['#1e88e5', '#29b6f6', '#26c6da', '#43e97b', '#00e676', '#69f0ae', '#40c4ff', '#00e5ff', '#1de9b6', '#76ff03'];
const NIVEL_COLORS = { alta: '#e53935', media: '#ff6d00', baja: '#43a047' } as const;
const CRIT_STORAGE_KEY = 'critData';
const DRIVER_STORAGE_KEY = 'condData';
const ROUTE_STORAGE_KEY = 'rutasData';

type Nivel = 'alta' | 'media' | 'baja';
type Vista = 'rutas' | 'criticidad' | 'conductores' | 'mapa';

interface LugarRuta {
    id?: string | number;
    codigo: string;
    nombre: string;
    ciudad: string;
    barrio: string;
    placa?: string;
    placa_adicional?: string | null;
    doc_tras?: string;
    responsable?: string;
    conductor?: string;
    cliente?: string;
    peso?: string;
    viaje?: number | string;
    hora?: string | null;
}

export interface DestinoViaje {
    municipio: string;
    barrio: string;
    hora?: string | null;
}

export interface ViajePlaneacion {
    id: string;
    viaje_numero: number;
    placa: string;
    placa_adicional?: string | null;
    doc_tras?: string;
    responsable?: string;
    conductor?: string;
    cliente?: string;
    peso?: string;
    destinos: DestinoViaje[];
    municipio: string;
    municipios: string[];
    barrio: string;
    barrios: string[];
    total_destinos: number;
}

interface FechaRegistrada {
    fecha: string;
    dia_semana: string;
    fecha_formateada: string;
    total_viajes?: number;
    total_vehiculos?: number;
    total_lugares: number;
    total_municipios: number;
    total_barrios: number;
}

interface DiaSemanaItem {
    key: string;
    fecha: string;
    diaNombre: string;
    diaMes: string;
    label: string;
    labelCompleto: string;
    esHoy: boolean;
    totalRutas: number;
    totalViajes: number;
}

interface RutogramasProps {
    vista: Vista;
    datosModulacionPorFecha?: Record<string, LugarRuta[]>;
    viajesPorFecha?: Record<string, ViajePlaneacion[]>;
    fechasRegistradas?: FechaRegistrada[];
    fechaInicial?: string;
    /** Conductores con sus rutas del mes desde planeación */
    conductoresMes?: ConductorConRutas[];
    /** Mes actualmente cargado en formato YYYY-MM */
    mesConductoresActual?: string;
    /** Meses con modulaciones disponibles */
    mesesDisponiblesConductores?: string[];
    /** Puntos del mapa de calor generados en el servidor */
    mapaCalorData?: PuntoMapaCalor[];
}

/** Punto del mapa de calor proveniente del servidor */
interface PuntoMapaCalor {
    municipio: string;
    barrio: string;
    lat: number | null;
    lon: number | null;
    criticidad: string;
    total_visitas: number;
    conductores: { nombre: string; cedula: string; visitas: number }[];
    /** true si lat/lon vienen de reparto_clientes; false si se geocodificó por nombre */
    coords_exactas: boolean;
}

interface RutaCritica {
    numero: string;
    ciudad: string;
    poblacion: string;
    frecuencia: string;
    criticidad: string;
}

interface Conductor {
    numero: string;
    cedula: string;
    nombre: string;
    cargo: string;
    edad: string;
    experienciaExterna: string;
    experienciaInterna: string;
    aptitud: string;
    ruta: string;
}

/** Ruta asignada a un conductor dentro del mes, derivada de la planeación */
interface RutaAsignada {
    municipio: string;
    fechas: string[];
    placas: string[];
    total_viajes: number;
}

/** Conductor con sus rutas del mes desde la planeación de modulación */
interface ConductorConRutas {
    numero: number;
    cedula: string;
    nombre: string;
    cargo: string;
    edad: number | null;
    experiencia_externa: string;
    experiencia_interna: string;
    aptitud: string | null;
    total_viajes: number;
    dias_activos: number;
    municipios_unicos: string[];
    rutas: RutaAsignada[];
    licencia_categoria: string | null;
    fecha_vencimiento_licencia: string | null;
}

interface Coordenada {
    lat: number;
    lon: number;
}

interface CiudadMapa extends Coordenada {
    numero: string;
    ciudad: string;
    nivel: Nivel;
    frecuencia: string;
    conductores: string[];
    barrio?: string;
    total_visitas?: number;
    detalles?: PuntoMapaCalor;
}

interface DetalleModal {
    titulo: string;
    descripcion: string;
    filas: { etiqueta: string; valor: string }[];
}

type DatosDiarios = Record<string, LugarRuta[]>;

function normalizar(value: unknown): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function leerColumnas(row: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizar(key), String(value ?? '').trim()]));
}

function obtenerColumna(row: Record<string, string>, ...keys: string[]): string {
    for (const key of keys) {
        const value = row[normalizar(key)];
        if (value) return value;
    }
    return '';
}

function clasificarCriticidad(value: string): Nivel {
    const normalized = normalizar(value);
    if (normalized.includes('alta')) return 'alta';
    if (normalized.includes('media')) return 'media';
    return 'baja';
}

function clasificarRuta(value: string): Nivel {
    const normalized = normalizar(value);
    if (normalized.includes('alta')) return 'alta';
    if (normalized.includes('media')) return 'media';
    return 'baja';
}

function etiquetaNivel(nivel: Nivel): string {
    if (nivel === 'alta') return 'Crítica Alta';
    if (nivel === 'media') return 'Crítica Media';
    return 'Crítica Baja';
}

function parsearRutasDiarias(workbook: import('xlsx').WorkBook, xlsx: typeof import('xlsx')): DatosDiarios {
    const data: DatosDiarios = {};
    workbook.SheetNames.forEach((sheetName) => {
        const day = normalizar(sheetName);
        if (!DIAS.some(({ key }) => key === day)) return;
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        data[day] = rows
            .map((row) => {
                const columns = leerColumnas(row);
                return {
                    codigo: obtenerColumna(columns, 'codigo', 'código'),
                    nombre: obtenerColumna(columns, 'nombre'),
                    ciudad: obtenerColumna(columns, 'ciudad'),
                    barrio: obtenerColumna(columns, 'barrio'),
                };
            })
            .filter((row) => row.nombre || row.ciudad);
    });
    return data;
}

function parsearCriticidad(workbook: import('xlsx').WorkBook, xlsx: typeof import('xlsx')): RutaCritica[] {
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    if (!sheet) throw new Error('El archivo no contiene hojas para leer.');
    return xlsx.utils
        .sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        .map((row) => {
            const columns = leerColumnas(row);
            return {
                numero: obtenerColumna(columns, 'n°', 'n', 'no', '#'),
                ciudad: obtenerColumna(columns, 'ciudad'),
                poblacion: obtenerColumna(columns, 'poblacion', 'población'),
                frecuencia: obtenerColumna(columns, 'frecuencia'),
                criticidad: obtenerColumna(columns, 'criticidad'),
            };
        })
        .filter((row) => row.ciudad);
}

function parsearConductores(workbook: import('xlsx').WorkBook, xlsx: typeof import('xlsx')): Conductor[] {
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    if (!sheet) throw new Error('El archivo no contiene hojas para leer.');
    return xlsx.utils
        .sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        .map((row) => {
            const columns = leerColumnas(row);
            const routeKey = Object.keys(columns).find((key) => key.includes('programar') || key.includes('ruta critic')) ?? '';
            return {
                numero: obtenerColumna(columns, 'no', 'n°', 'n'),
                cedula: obtenerColumna(columns, 'cedula', 'cédula'),
                nombre: obtenerColumna(columns, 'nombre'),
                cargo: obtenerColumna(columns, 'cargo'),
                edad: obtenerColumna(columns, 'edad'),
                experienciaExterna: obtenerColumna(
                    columns,
                    'experiencia validada en conduccion de camiones (externa)',
                    'experiencia validada en conduccion de camiones',
                    'exp. externa',
                    'experiencia externa',
                ),
                experienciaInterna: obtenerColumna(
                    columns,
                    'experiencia total en la operacion (interna)',
                    'experiencia total en la operacion',
                    'exp. interna',
                    'experiencia interna',
                ),
                aptitud: obtenerColumna(columns, 'apto para ser asignado a rutas criticas', 'aptitud', 'apto'),
                ruta: routeKey ? (columns[routeKey] ?? '') : '',
            };
        })
        .filter((row) => row.nombre);
}

function readSaved<T>(key: string, validate: (value: unknown) => value is T): T | null {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(key);
    if (saved === null) return null;
    try {
        const parsed: unknown = JSON.parse(saved);
        if (!validate(parsed)) throw new Error(`El formato guardado para ${key} no es válido.`);
        return parsed;
    } catch (error) {
        console.error(`No se pudieron restaurar los datos de rutogramas (${key}).`, error);
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDailyData(value: unknown): value is DatosDiarios {
    return isRecord(value) && Object.values(value).every(Array.isArray);
}

function isRutaCriticaArray(value: unknown): value is RutaCritica[] {
    return Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.ciudad === 'string');
}

function isConductorArray(value: unknown): value is Conductor[] {
    return Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.nombre === 'string');
}

function agruparRutas(data: LugarRuta[]): Record<string, Record<string, LugarRuta[]>> {
    return data.reduce<Record<string, Record<string, LugarRuta[]>>>((grouped, place) => {
        const city = place.ciudad.trim() || '(Sin ciudad)';
        const neighborhood = place.barrio.trim() || '(Sin barrio)';
        grouped[city] ??= {};
        grouped[city][neighborhood] ??= [];
        grouped[city][neighborhood].push(place);
        return grouped;
    }, {});
}

function countByLevel<T>(data: T[], getLevel: (row: T) => Nivel): Record<Nivel, number> {
    return data.reduce(
        (counts, row) => {
            counts[getLevel(row)] += 1;
            return counts;
        },
        { alta: 0, media: 0, baja: 0 },
    );
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#0f172a', font: { size: 11 } } } },
};

const chartOptionsBar = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { color: '#e0f2fe' }, ticks: { color: '#0369a1', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: '#0f172a', font: { size: 11 } } },
    },
};

function ChartPanel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="relative pb-0" style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    {icon && <span className="text-white/90 shrink-0">{icon}</span>}
                    <span className="text-base font-bold text-white tracking-wide">{title}</span>
                </div>
                {/* Ola inferior */}
                <svg viewBox="0 0 400 28" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{ marginBottom: -1, display: 'block' }} preserveAspectRatio="none">
                    <path d="M0,14 C40,28 80,0 120,14 C160,28 200,0 240,14 C280,28 320,0 360,14 C380,21 390,18 400,14 L400,28 L0,28 Z" fill="white" />
                </svg>
            </div>
            <div className="bg-white dark:bg-card px-4 pb-4 pt-1">
                <div className="h-64">{children}</div>
            </div>
        </div>
    );
}

function NivelBadge({ nivel, children }: { nivel: Nivel; children: React.ReactNode }) {
    return (
        <Badge variant="outline" className="whitespace-nowrap" style={{ color: NIVEL_COLORS[nivel], borderColor: `${NIVEL_COLORS[nivel]}66` }}>
            {children}
        </Badge>
    );
}

const COORDS_NARINO: Record<string, Coordenada> = {
    pasto: { lat: 1.2136, lon: -77.2811 },
    'san juan de pasto': { lat: 1.2136, lon: -77.2811 },
    ipiales: { lat: 0.829, lon: -77.644 },
    tumaco: { lat: 1.7993, lon: -78.7559 },
    'san andres de tumaco': { lat: 1.7993, lon: -78.7559 },
    tuquerres: { lat: 1.0867, lon: -77.6157 },
    'la union': { lat: 1.5961, lon: -77.1333 },
    belen: { lat: 1.6167, lon: -77.05 },
    'san bernardo': { lat: 1.5167, lon: -77.0333 },
    'el tambo': { lat: 1.4, lon: -77.4 },
    tambo: { lat: 1.4, lon: -77.4 },
    potosi: { lat: 0.806975, lon: -77.572932 },
    'villa nueva': { lat: 1.0333, lon: -77.4167 },
    villanueva: { lat: 1.0333, lon: -77.4167 },
    aldana: { lat: 0.8667, lon: -77.5833 },
    carlosama: { lat: 0.9, lon: -77.6167 },
    cordoba: { lat: 0.85353, lon: -77.518266 },
    genova: { lat: 1.5333, lon: -77.0833 },
    'san juan': { lat: 0.892582, lon: -77.54772 },
    'villa moreno': { lat: 1.324242, lon: -77.199543 },
    'la josefina': { lat: 0.921767, lon: -77.511029 },
    josefina: { lat: 0.921767, lon: -77.511029 },
    buesaco: { lat: 1.3833, lon: -77.15 },
    berruecos: { lat: 1.5167, lon: -77.1833 },
    'la florida': { lat: 1.3, lon: -77.4167 },
    yacuanquer: { lat: 1.114748, lon: -77.40175 },
    consaca: { lat: 1.208279, lon: -77.465614 },
    bombona: { lat: 1.195903, lon: -77.462775 },
    sandona: { lat: 1.2833, lon: -77.4667 },
    linares: { lat: 1.3667, lon: -77.5333 },
    ancuya: { lat: 1.3167, lon: -77.5 },
    providencia: { lat: 1.15, lon: -77.5167 },
    'el penol': { lat: 1.4667, lon: -77.3833 },
    arboleda: { lat: 1.5667, lon: -77.1 },
    colon: { lat: 1.4833, lon: -77.05 },
    'san pablo': { lat: 1.5167, lon: -77.0167 },
    'san pedro de cartago': { lat: 1.55, lon: -77 },
    'san lorenzo': { lat: 1.5833, lon: -77.2333 },
    taminango: { lat: 1.5667, lon: -77.2667 },
    'el rosario': { lat: 1.5667, lon: -77.25 },
    cumbal: { lat: 0.907593, lon: -77.793416 },
    cumbitara: { lat: 1.55, lon: -77.5 },
    guachucal: { lat: 0.9833, lon: -77.6833 },
    guaitarilla: { lat: 1.131379, lon: -77.549235 },
    iles: { lat: 0.99445, lon: -77.543555 },
    imues: { lat: 1.057117, lon: -77.498897 },
    'imues 1': { lat: 1.057117, lon: -77.498897 },
    obonuco: { lat: 1.193301, lon: -77.306171 },
    'obonuco 1': { lat: 1.193301, lon: -77.306171 },
    'obonuco 2': { lat: 1.193301, lon: -77.306171 },
    jamundino: { lat: 1.182376, lon: -77.257993 },
    'jamundino 1': { lat: 1.182376, lon: -77.257993 },
    'jamundino 2': { lat: 1.179909, lon: -77.25589 },
    'jamundino 3': { lat: 1.181432, lon: -77.257349 },
    leiva: { lat: 1.55, lon: -77.4167 },
    'magui payan': { lat: 1.8333, lon: -77.9167 },
    mallama: { lat: 1, lon: -77.9 },
    mosquera: { lat: 2.5, lon: -78.45 },
    'olaya herrera': { lat: 1.9833, lon: -78.5833 },
    ospina: { lat: 0.95, lon: -77.6333 },
    policarpa: { lat: 1.7, lon: -77.4167 },
    puerres: { lat: 0.884852, lon: -77.504308 },
    pupiales: { lat: 0.870346, lon: -77.638968 },
    ricaurte: { lat: 1.2167, lon: -78 },
    'roberto payan': { lat: 1.8833, lon: -78.2667 },
    samaniego: { lat: 1.3333, lon: -77.5833 },
    sapuyes: { lat: 0.9667, lon: -77.65 },
    talarcan: { lat: 1.5167, lon: -77.3 },
    genoy: { lat: 1.268183, lon: -77.336984 },
    chachawi: { lat: 1.396926, lon: -77.291575 },
    'chachawi 1': { lat: 1.396926, lon: -77.291575 },
    catambuco: { lat: 1.167471, lon: -77.292186 },
    'catambuco 1': { lat: 1.167471, lon: -77.292186 },
    'catambuco 2': { lat: 1.166277, lon: -77.29935 },
    contadero: { lat: 0.907346, lon: -77.547422 },
    chachagui: { lat: 1.357209, lon: -77.281188 },
    'chachagui 1': { lat: 1.357209, lon: -77.281188 },
    funes: { lat: 1.00297, lon: -77.450535 },
    botanilla: { lat: 1.166356, lon: -77.287236 },
    'botanilla 1': { lat: 1.166356, lon: -77.287236 },
    'botanilla 2': { lat: 1.166356, lon: -77.287236 },
    'jose maria hernandez': { lat: 1.166356, lon: -77.287236 },
    'las lajas': { lat: 1.166356, lon: -77.287236 },
    'la laguna': { lat: 1.205183, lon: -77.210837 },
    dolores: { lat: 1.200467, lon: -77.228048 },
    cabrera: { lat: 1.214872, lon: -77.214741 },
    pilcuan: { lat: 1.025879, lon: -77.466626 },
    'la llanada': { lat: 1.3, lon: -77.5833 },
    'la tola': { lat: 2.35, lon: -78.4167 },
    narino: { lat: 1.290676, lon: -77.357857 },
};

function countDriversByLevel(data: Conductor[]): Record<Nivel, string[]> {
    return data.reduce(
        (counts, driver) => {
            counts[clasificarRuta(driver.ruta)].push(driver.nombre);
            return counts;
        },
        { alta: [], media: [], baja: [] } as Record<Nivel, string[]>,
    );
}

function obtenerDiasSemana(
    fechaStr: string,
    datosPorFecha: Record<string, LugarRuta[]>,
    viajesPorFecha: Record<string, ViajePlaneacion[]> = {},
): DiaSemanaItem[] {
    const cleanFecha = (fechaStr || new Date().toISOString().slice(0, 10)).split('T')[0];
    const parts = cleanFecha.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = (parseInt(parts[1], 10) || 1) - 1;
    const day = parseInt(parts[2], 10) || 1;
    const baseDate = new Date(year, month, day, 12, 0, 0);

    const dayOfWeek = baseDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);

    const hoyStr = new Date().toISOString().slice(0, 10);
    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dias: DiaSemanaItem[] = [];

    for (let i = 0; i < 6; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const diaNum = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${diaNum}`;

        const totalRutas = datosPorFecha[key]?.length ?? 0;
        const totalViajes = viajesPorFecha[key]?.length ?? 0;

        dias.push({
            key,
            fecha: key,
            diaNombre: nombresDias[i],
            diaMes: `${diaNum}/${m}`,
            label: `${nombresDias[i]} ${diaNum}/${m}`,
            labelCompleto: `${nombresDias[i]} ${diaNum}/${m}/${y}`,
            esHoy: key === hoyStr,
            totalRutas,
            totalViajes,
        });
    }

    return dias;
}

export default function RutogramasIndex({
    vista,
    datosModulacionPorFecha = {},
    viajesPorFecha = {},
    fechasRegistradas = [],
    fechaInicial,
    conductoresMes = [],
    mesConductoresActual,
    mesesDisponiblesConductores = [],
    mapaCalorData = [],
}: RutogramasProps) {
    const [dailyData, setDailyData] = useState<DatosDiarios>({});
    const [dailyFileName, setDailyFileName] = useState('');
    const [modoFuente, setModoFuente] = useState<'modulacion' | 'excel'>('modulacion');
    const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() => {
        if (fechaInicial) return fechaInicial;
        if (fechasRegistradas.length > 0) return fechasRegistradas[0].fecha;
        return new Date().toISOString().slice(0, 10);
    });
    const [criticidad, setCriticidad] = useState<RutaCritica[]>([]);
    const [criticidadFileName, setCriticidadFileName] = useState('');
    const [conductores, setConductores] = useState<Conductor[]>([]);
    const [conductoresFileName, setConductoresFileName] = useState('');
    const [storageLoaded, setStorageLoaded] = useState(false);
    const [error, setError] = useState('');
    const [buscarRuta, setBuscarRuta] = useState('');
    const [buscarCiudad, setBuscarCiudad] = useState('');
    const [frecuenciaSeleccionada, setFrecuenciaSeleccionada] = useState('todas');
    const [nivelSeleccionado, setNivelSeleccionado] = useState('todos');
    const [buscarConductor, setBuscarConductor] = useState('');
    const [buscarCedula, setBuscarCedula] = useState('');
    const [nivelConductor, setNivelConductor] = useState('todos');
    const [filtroCriticoRapido, setFiltroCriticoRapido] = useState<Nivel | 'todos'>('todos');
    const [filtroConductorRapido, setFiltroConductorRapido] = useState<Nivel | 'todos'>('todos');
    const [columnaActiva, setColumnaActiva] = useState<'viajes' | 'vehiculos' | 'municipios' | 'barrios' | null>(null);
    const [viajeSeleccionado, setViajeSeleccionado] = useState<string | null>(null);
    const [municipioSeleccionado, setMunicipioSeleccionado] = useState<string | null>(null);
    const [criticidadManual, setCriticidadManual] = useState<Record<string, Nivel>>({});
    const [filtroMesCriticidad, setFiltroMesCriticidad] = useState<string>('');
    const [filtroFechaCriticidad, setFiltroFechaCriticidad] = useState<string>('');
    const [modal, setModal] = useState<DetalleModal | null>(null);

    // ── Vista Conductores: corte mensual ─────────────────────────────────────
    // El mes seleccionado inicialmente es el que envía el servidor.
    const [mesConductores, setMesConductores] = useState<string>(
        mesConductoresActual ?? new Date().toISOString().slice(0, 7),
    );
    // Aptitud manual por cédula (permite sobreescribir el valor desde Excel)
    const [aptitudManual, setAptitudManual] = useState<Record<string, string>>({});
    // Modo de datos: 'planeacion' (servidor) o 'excel' (fallback manual)
    const [modoConductores, setModoConductores] = useState<'planeacion' | 'excel'>(
        conductoresMes.length > 0 ? 'planeacion' : 'excel',
    );

    useEffect(() => {
        const savedRoutes = readSaved(ROUTE_STORAGE_KEY, isDailyData);
        const savedCriticity = readSaved(CRIT_STORAGE_KEY, isRutaCriticaArray);
        const savedDrivers = readSaved(DRIVER_STORAGE_KEY, isConductorArray);
        if (savedRoutes) setDailyData(savedRoutes);
        if (savedCriticity) setCriticidad(savedCriticity);
        if (savedDrivers) setConductores(savedDrivers);
        setStorageLoaded(true);
    }, []);

    useEffect(() => {
        if (!storageLoaded) return;
        window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(dailyData));
        window.localStorage.setItem(CRIT_STORAGE_KEY, JSON.stringify(criticidad));
        window.localStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(conductores));
    }, [dailyData, criticidad, conductores, storageLoaded]);

    const diasSemana = useMemo(() => {
        return obtenerDiasSemana(fechaSeleccionada, datosModulacionPorFecha, viajesPorFecha);
    }, [fechaSeleccionada, datosModulacionPorFecha, viajesPorFecha]);

    const diaActivo = useMemo(() => {
        return diasSemana.find((d) => d.key === fechaSeleccionada) ?? {
            key: fechaSeleccionada,
            fecha: fechaSeleccionada,
            diaNombre: 'Fecha seleccionada',
            diaMes: fechaSeleccionada,
            label: fechaSeleccionada,
            labelCompleto: fechaSeleccionada,
            esHoy: fechaSeleccionada === new Date().toISOString().slice(0, 10),
            totalRutas: datosModulacionPorFecha[fechaSeleccionada]?.length ?? 0,
            totalViajes: viajesPorFecha[fechaSeleccionada]?.length ?? 0,
        };
    }, [diasSemana, fechaSeleccionada, datosModulacionPorFecha, viajesPorFecha]);

    const viajesActivos = useMemo(() => {
        return viajesPorFecha[fechaSeleccionada] ?? [];
    }, [viajesPorFecha, fechaSeleccionada]);

    const rutasActivas = useMemo(() => {
        if (modoFuente === 'excel') {
            const diaNombre = diaActivo.diaNombre.toLowerCase();
            const normalized = normalizar(diaNombre);
            return dailyData[normalized] ?? [];
        }
        return datosModulacionPorFecha[fechaSeleccionada] ?? [];
    }, [modoFuente, diaActivo, dailyData, datosModulacionPorFecha, fechaSeleccionada]);

    const navegarSemana = (diasOffset: number) => {
        const parts = fechaSeleccionada.split('-');
        const cur = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
        cur.setDate(cur.getDate() + diasOffset);
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        setFechaSeleccionada(`${y}-${m}-${d}`);
    };

    const irAHoy = () => {
        const hoy = new Date().toISOString().slice(0, 10);
        setFechaSeleccionada(hoy);
    };

    const rangoSemanaTexto = useMemo(() => {
        if (!diasSemana.length) return '';
        const inicio = diasSemana[0].diaMes;
        const fin = diasSemana[diasSemana.length - 1].diaMes;
        const y = diasSemana[0].key.split('-')[0];
        return `${inicio} al ${fin}/${y}`;
    }, [diasSemana]);

    const readWorkbook = useCallback(async (file: File, type: Vista) => {
        setError('');
        try {
            const xlsx = await import('xlsx');
            const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
            if (type === 'rutas') {
                const data = parsearRutasDiarias(workbook, xlsx);
                if (Object.keys(data).length === 0) throw new Error('No se encontraron hojas de lunes a sábado en el archivo.');
                setDailyData(data);
                setDailyFileName(file.name);
                setModoFuente('excel');
            } else if (type === 'criticidad') {
                const data = parsearCriticidad(workbook, xlsx);
                setCriticidad(data);
                setCriticidadFileName(file.name);
                setFiltroCriticoRapido('todos');
            } else {
                const data = parsearConductores(workbook, xlsx);
                setConductores(data);
                setConductoresFileName(file.name);
                setFiltroConductorRapido('todos');
            }
        } catch (cause) {
            console.error('Error procesando el Excel de rutogramas.', cause);
            setError(cause instanceof Error ? cause.message : 'No se pudo leer el archivo Excel.');
        }
    }, []);

    const groupedRoutes = useMemo(() => agruparRutas(rutasActivas), [rutasActivas]);
    const cityLabels = useMemo(() => Object.keys(groupedRoutes).sort((a, b) => a.localeCompare(b)), [groupedRoutes]);
    const neighborhoodCount = useMemo(
        () => new Set(rutasActivas.map((row) => `${row.ciudad}|${row.barrio}`)).size,
        [rutasActivas],
    );
    const filteredCities = useMemo(() => {
        const query = normalizar(buscarRuta);
        if (!query) return groupedRoutes;
        return Object.fromEntries(
            Object.entries(groupedRoutes).flatMap(([city, neighborhoods]) => {
                if (normalizar(city).includes(query)) return [[city, neighborhoods]];
                const filteredNeighborhoods = Object.fromEntries(
                    Object.entries(neighborhoods).flatMap(([neighborhood, places]) => {
                        if (normalizar(neighborhood).includes(query)) return [[neighborhood, places]];
                        const filteredPlaces = places.filter(
                            (place) =>
                                normalizar(place.nombre).includes(query) ||
                                (place.codigo && place.codigo.toLowerCase().includes(query)) ||
                                (place.placa && normalizar(place.placa).includes(query)) ||
                                (place.responsable && normalizar(place.responsable).includes(query)) ||
                                (place.cliente && normalizar(place.cliente).includes(query)),
                        );
                        return filteredPlaces.length ? [[neighborhood, filteredPlaces]] : [];
                    }),
                );
                return Object.keys(filteredNeighborhoods).length ? [[city, filteredNeighborhoods]] : [];
            }),
        );
    }, [groupedRoutes, buscarRuta]);

    const criticidadCounts = useMemo(() => countByLevel(criticidad, (row) => clasificarCriticidad(row.criticidad)), [criticidad]);
    const frecuencias = useMemo(
        () => [...new Set(criticidad.map((row) => row.frecuencia).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [criticidad],
    );
    const filteredCriticidad = useMemo(() => {
        const city = normalizar(buscarCiudad);
        return criticidad.filter(
            (row) =>
                (!city || normalizar(row.ciudad).includes(city)) &&
                (frecuenciaSeleccionada === 'todas' || row.frecuencia === frecuenciaSeleccionada) &&
                (nivelSeleccionado === 'todos' || clasificarCriticidad(row.criticidad) === nivelSeleccionado) &&
                (filtroCriticoRapido === 'todos' || clasificarCriticidad(row.criticidad) === filtroCriticoRapido),
        );
    }, [criticidad, buscarCiudad, frecuenciaSeleccionada, nivelSeleccionado, filtroCriticoRapido]);

    const conductorCounts = useMemo(() => countByLevel(conductores, (row) => clasificarRuta(row.ruta)), [conductores]);
    const filteredConductores = useMemo(() => {
        const name = normalizar(buscarConductor);
        const id = buscarCedula.trim();
        return conductores.filter(
            (driver) =>
                (!name || normalizar(driver.nombre).includes(name)) &&
                (!id || driver.cedula.includes(id)) &&
                (nivelConductor === 'todos' || clasificarRuta(driver.ruta) === nivelConductor) &&
                (filtroConductorRapido === 'todos' || clasificarRuta(driver.ruta) === filtroConductorRapido),
        );
    }, [conductores, buscarConductor, buscarCedula, nivelConductor, filtroConductorRapido]);

    // ── Conductores desde planeación: filtrado y criticidad ─────────────────
    /**
     * Determina la criticidad dominante de un conductor buscando sus municipios
     * en la tabla de criticidad cargada por el usuario.
     * Retorna el nivel más alto encontrado, o null si no hay datos de criticidad.
     */
    const criticidadDeConductor = useCallback(
        (municipios: string[]): Nivel | null => {
            if (criticidad.length === 0) return null;
            let alta = 0, media = 0, baja = 0;
            municipios.forEach((mun) => {
                const munNorm = normalizar(mun);
                const match = criticidad.find((r) => normalizar(r.ciudad).includes(munNorm) || munNorm.includes(normalizar(r.ciudad)));
                if (!match) return;
                const nivel = clasificarCriticidad(match.criticidad);
                if (nivel === 'alta') alta++;
                else if (nivel === 'media') media++;
                else baja++;
            });
            if (alta === 0 && media === 0 && baja === 0) return null;
            if (alta > 0) return 'alta';
            if (media > 0) return 'media';
            return 'baja';
        },
        [criticidad],
    );

    const filteredConductoresMes = useMemo(() => {
        const name = normalizar(buscarConductor);
        const id = buscarCedula.trim();
        return conductoresMes.filter((c) => {
            const nivel = criticidadDeConductor(c.municipios_unicos);
            return (
                (!name || normalizar(c.nombre).includes(name)) &&
                (!id || c.cedula.includes(id)) &&
                (nivelConductor === 'todos' || nivel === nivelConductor) &&
                (filtroConductorRapido === 'todos' || nivel === filtroConductorRapido)
            );
        });
    }, [conductoresMes, buscarConductor, buscarCedula, nivelConductor, filtroConductorRapido, criticidadDeConductor]);

    const conductoresMesCounts = useMemo(() => {
        const counts: Record<Nivel, number> = { alta: 0, media: 0, baja: 0 };
        conductoresMes.forEach((c) => {
            const nivel = criticidadDeConductor(c.municipios_unicos);
            if (nivel) counts[nivel]++;
        });
        return counts;
    }, [conductoresMes, criticidadDeConductor]);

    const fileInput = async (event: React.ChangeEvent<HTMLInputElement>, type: Vista) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) await readWorkbook(file, type);
    };


    const dailyCityChart = {
        labels: cityLabels,
        datasets: [
            {
                label: 'Lugares',
                data: cityLabels.map((city) => Object.values(groupedRoutes[city]).reduce((sum, places) => sum + places.length, 0)),
                backgroundColor: PALETTE,
            },
        ],
    };
    const neighborhoodTotals = Object.values(groupedRoutes).reduce<Record<string, number>>((totals, neighborhoods) => {
        Object.entries(neighborhoods).forEach(([name, places]) => {
            totals[name] = (totals[name] ?? 0) + places.length;
        });
        return totals;
    }, {});
    const topNeighborhoods = Object.entries(neighborhoodTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const criticityFrequencyTotals = criticidad.reduce<Record<string, number>>((totals, row) => {
        const key = row.frecuencia || 'Sin frecuencia';
        totals[key] = (totals[key] ?? 0) + 1;
        return totals;
    }, {});
    const topFrequencies = Object.entries(criticityFrequencyTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const vehiculosUnicos = useMemo(() => {
        const placas = new Set<string>();
        viajesActivos.forEach((v) => {
            if (v.placa) placas.add(v.placa);
        });
        if (placas.size === 0) {
            rutasActivas.forEach((r) => {
                if (r.placa) placas.add(r.placa);
            });
        }
        return Array.from(placas).sort();
    }, [viajesActivos, rutasActivas]);

    const filteredViajes = useMemo(() => {
        const query = normalizar(buscarRuta);
        if (!query) return viajesActivos;
        return viajesActivos.filter((v) => {
            return (
                normalizar(v.placa).includes(query) ||
                (v.placa_adicional && normalizar(v.placa_adicional).includes(query)) ||
                (v.responsable && normalizar(v.responsable).includes(query)) ||
                (v.conductor && normalizar(v.conductor).includes(query)) ||
                (v.cliente && normalizar(v.cliente).includes(query)) ||
                (v.doc_tras && normalizar(v.doc_tras).includes(query)) ||
                normalizar(v.municipio).includes(query) ||
                normalizar(v.barrio).includes(query) ||
                v.destinos.some(
                    (d) => normalizar(d.municipio).includes(query) || normalizar(d.barrio).includes(query),
                )
            );
        });
    }, [viajesActivos, buscarRuta]);

    const showPlaceDetails = useCallback((place: LugarRuta) => {
        setModal({
            titulo: `Entrega: ${place.nombre || place.codigo}`,
            descripcion: `${place.ciudad} · ${place.barrio}`,
            filas: [
                { etiqueta: 'Vehículo / Código', valor: place.codigo || place.placa || '—' },
                ...(place.placa ? [{ etiqueta: 'Placa', valor: place.placa + (place.placa_adicional ? ` (+${place.placa_adicional})` : '') }] : []),
                ...(place.viaje ? [{ etiqueta: 'Viaje Nº', valor: `Viaje ${place.viaje}` }] : []),
                ...(place.responsable ? [{ etiqueta: 'Responsable', valor: place.responsable }] : []),
                ...(place.conductor && place.conductor !== place.responsable ? [{ etiqueta: 'Conductor', valor: place.conductor }] : []),
                { etiqueta: 'Municipio', valor: place.ciudad || '—' },
                { etiqueta: 'Barrio', valor: place.barrio || '—' },
                ...(place.cliente ? [{ etiqueta: 'Cliente', valor: place.cliente }] : []),
                ...(place.doc_tras ? [{ etiqueta: 'Doc. Traslado', valor: place.doc_tras }] : []),
                ...(place.peso ? [{ etiqueta: 'Peso', valor: `${place.peso} kg` }] : []),
                ...(place.hora ? [{ etiqueta: 'Hora / Cita', valor: place.hora }] : []),
            ],
        });
    }, []);

    const showViajeDetails = useCallback((viaje: ViajePlaneacion) => {
        setModal({
            titulo: `Viaje #${viaje.viaje_numero} · Vehículo ${viaje.placa}`,
            descripcion: `${viaje.municipio} · ${viaje.barrio}`,
            filas: [
                { etiqueta: 'Vehículo (Placa)', valor: viaje.placa + (viaje.placa_adicional ? ` (+ ${viaje.placa_adicional})` : '') },
                { etiqueta: 'Viaje Nº', valor: `Viaje ${viaje.viaje_numero}` },
                { etiqueta: 'Responsable', valor: viaje.responsable || '—' },
                { etiqueta: 'Conductor', valor: viaje.conductor || '—' },
                ...(viaje.cliente ? [{ etiqueta: 'Cliente', valor: viaje.cliente }] : []),
                ...(viaje.doc_tras ? [{ etiqueta: 'Doc. Traslado', valor: viaje.doc_tras }] : []),
                ...(viaje.peso ? [{ etiqueta: 'Peso', valor: `${viaje.peso} kg` }] : []),
                { etiqueta: 'Municipio(s)', valor: viaje.municipio || '—' },
                { etiqueta: 'Barrios a recorrer', valor: viaje.barrio || '—' },
                { etiqueta: 'Total Paradas / Destinos', valor: String(viaje.total_destinos) },
                ...viaje.destinos.map((d, i) => ({
                    etiqueta: `Parada #${i + 1}`,
                    valor: `${d.municipio} · ${d.barrio}${d.hora ? ` (${d.hora})` : ''}`,
                })),
            ],
        });
    }, []);

    const showCityDetails = useCallback((city: string, neighborhoods: Record<string, LugarRuta[]>) => {
        const totalEntregas = Object.values(neighborhoods).reduce((sum, p) => sum + p.length, 0);
        const barriosList = Object.keys(neighborhoods);
        setModal({
            titulo: `Municipio: ${city}`,
            descripcion: `${totalEntregas} entregas en ${barriosList.length} barrios`,
            filas: [
                { etiqueta: 'Total barrios', valor: String(barriosList.length) },
                { etiqueta: 'Total entregas', valor: String(totalEntregas) },
                ...barriosList.map((b) => ({
                    etiqueta: `Barrio: ${b}`,
                    valor: `${neighborhoods[b].length} entregas (${neighborhoods[b].map((p) => p.placa || p.codigo).filter(Boolean).slice(0, 3).join(', ')})`,
                })),
            ],
        });
    }, []);

    const showNeighborhoodDetails = useCallback((city: string, neighborhood: string, places: LugarRuta[]) => {
        setModal({
            titulo: `Barrio: ${neighborhood}`,
            descripcion: `${city} · ${places.length} entregas`,
            filas: [
                { etiqueta: 'Municipio', valor: city },
                { etiqueta: 'Barrio', valor: neighborhood },
                { etiqueta: 'Total entregas', valor: String(places.length) },
                ...places.map((p, idx) => ({
                    etiqueta: `#${idx + 1} ${p.codigo || p.placa || 'Entrega'}`,
                    valor: `${p.nombre || p.cliente || 'Entrega'}${p.hora ? ` (${p.hora})` : ''}`,
                })),
            ],
        });
    }, []);

    const showTopNeighborhoods = useCallback(() => {
        setModal({
            titulo: 'Top Barrios con más entregas',
            descripcion: `${diaActivo.labelCompleto}`,
            filas: topNeighborhoods.map(([barrio, count]) => ({
                etiqueta: barrio,
                valor: `${count} ${count === 1 ? 'entrega' : 'entregas'}`,
            })),
        });
    }, [diaActivo, topNeighborhoods]);

    // Meses disponibles en los datos (para filtro en criticidad)
    const mesesDisponibles = useMemo(() => {
        const meses = new Set<string>();
        [...Object.keys(datosModulacionPorFecha), ...Object.keys(viajesPorFecha)].forEach((fecha) => {
            if (fecha && fecha.length >= 7) meses.add(fecha.slice(0, 7)); // YYYY-MM
        });
        return Array.from(meses).sort();
    }, [datosModulacionPorFecha, viajesPorFecha]);

    // Municipios únicos con frecuencia y días (para vista criticidad)
    const municipiosUnicos = useMemo(() => {
        // Filtrar fechas según mes o fecha exacta seleccionada
        const fechasPasaFiltro = (fecha: string) => {
            if (filtroFechaCriticidad) return fecha === filtroFechaCriticidad;
            if (filtroMesCriticidad) return fecha.startsWith(filtroMesCriticidad);
            return true;
        };

        // Municipio → set de días de la semana en que aparece (sin repetir)
        const diasPorMun: Record<string, Set<number>> = {};
        const nombreOriginal: Record<string, string> = {};
        const ordenDias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

        Object.entries(datosModulacionPorFecha).forEach(([fecha, rutas]) => {
            if (!fechasPasaFiltro(fecha)) return;
            const d = new Date(fecha + 'T12:00:00');
            const diaSemana = d.getDay(); // 0=Dom … 6=Sáb
            rutas.forEach((r) => {
                const m = r.ciudad?.trim();
                if (!m) return;
                const k = normalizar(m);
                if (!diasPorMun[k]) diasPorMun[k] = new Set();
                diasPorMun[k].add(diaSemana);
                if (!nombreOriginal[k]) nombreOriginal[k] = m;
            });
        });

        Object.entries(viajesPorFecha).forEach(([fecha, viajes]) => {
            if (!fechasPasaFiltro(fecha)) return;
            const d = new Date(fecha + 'T12:00:00');
            const diaSemana = d.getDay();
            viajes.forEach((v) => {
                v.municipios.forEach((m) => {
                    const mt = m?.trim();
                    if (!mt) return;
                    const k = normalizar(mt);
                    if (!diasPorMun[k]) diasPorMun[k] = new Set();
                    diasPorMun[k].add(diaSemana);
                    if (!nombreOriginal[k]) nombreOriginal[k] = mt;
                });
            });
        });

        return Object.entries(diasPorMun)
            .sort((a, b) => b[1].size - a[1].size)
            .map(([k, diasSet]) => ({
                municipio: nombreOriginal[k] ?? k,
                // Ordenar por día de semana (Lun → Sáb) y convertir a nombre
                dias: Array.from(diasSet)
                    .filter((d) => d >= 1 && d <= 6) // excluir domingo
                    .sort((a, b) => a - b)
                    .map((d) => ordenDias[d]),
            }));
    }, [datosModulacionPorFecha, viajesPorFecha, filtroMesCriticidad, filtroFechaCriticidad]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Rutogramas" />
            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-5xl font-extrabold tracking-tight pl-2 border-l-4 border-cyan-500">Rutogramas</h1>
                        <p className="text-muted-foreground text-sm mt-1">Consulta rutas diarias, criticidad y aptitud de conductores desde archivos Excel.</p>
                    </div>
                    {vista === 'rutas' && (
                        <div className="flex flex-wrap items-center gap-2">
                            {Object.keys(dailyData).length > 0 && (
                                <>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={modoFuente === 'modulacion' ? 'default' : 'ghost'}
                                        className="h-9 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                        style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}
                                        onClick={() => setModoFuente('modulacion')}
                                    >
                                        <Truck className="size-3.5 mr-1 text-cyan-300" />
                                        Modulación
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={modoFuente === 'excel' ? 'default' : 'ghost'}
                                        className="h-9 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                        style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}
                                        onClick={() => setModoFuente('excel')}
                                    >
                                        <Layers className="size-3.5 mr-1" />
                                        Excel ({Object.keys(dailyData).length})
                                    </Button>
                                </>
                            )}
                            <Label
                                className="h-9 inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}
                            >
                                <Upload className="size-3.5" /> Cargar Excel
                                <input className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => void fileInput(event, 'rutas')} />
                            </Label>
                        </div>
                    )}
                </div>

                {error && (
                    <div
                        role="alert"
                        className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <span>{error}</span>
                        <button type="button" className="ml-auto" aria-label="Cerrar error" onClick={() => setError('')}>
                            <X className="size-4" />
                        </button>
                    </div>
                )}

                {vista === 'rutas' && (
                    <section className="space-y-5">
                        {/* Barra de navegación de semanas y fecha directa */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 50%, #D1FAE5 100%)' }}>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="size-8 bg-white/50 border-green-300 text-gray-800 hover:bg-white/70 hover:text-gray-900"
                                        onClick={() => navegarSemana(-7)}
                                        title="Semana anterior"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <span className="px-2 text-xs font-semibold text-gray-900 min-w-[170px] text-center">
                                        {rangoSemanaTexto ? `Semana: ${rangoSemanaTexto}` : 'Semana'}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="size-8 bg-white/50 border-green-300 text-gray-800 hover:bg-white/70 hover:text-gray-900"
                                        onClick={() => navegarSemana(7)}
                                        title="Semana siguiente"
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs font-medium text-gray-900 hover:bg-white/40 hover:text-gray-900"
                                    onClick={irAHoy}
                                >
                                    <Calendar className="size-3.5 mr-1 text-green-700" />
                                    Hoy
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-700 whitespace-nowrap">Fecha:</span>
                                    <Input
                                        type="date"
                                        value={fechaSeleccionada}
                                        onChange={(e) => e.target.value && setFechaSeleccionada(e.target.value)}
                                        className="h-8 w-[140px] text-xs font-mono bg-white/50 border-green-300 text-gray-900"
                                    />
                                </div>
                                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-white/50 border-green-300 text-gray-900 hover:bg-white/70 hover:text-gray-900">
                                    <a href={`/modules/reparto/modulacion?fecha=${fechaSeleccionada}&readOnly=true`}>
                                        <ExternalLink className="size-3.5" />
                                        Ver en Modulación
                                    </a>
                                </Button>
                                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-white/50 border-green-300 text-gray-900 hover:bg-white/70 hover:text-gray-900">
                                    <a href="/modules/reparto/modulacion-historial">
                                        <Truck className="size-3.5 text-green-700" />
                                        Historial de Rutas
                                    </a>
                                </Button>
                            </div>
                        </div>

                        {/* Botones de días de la semana con fechas - ocupan toda la fila con misma forma */}
                        <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6" role="tablist" aria-label="Días de la semana con fechas">
                                {diasSemana.map((dia) => {
                                    const isSelected = fechaSeleccionada === dia.key;
                                    return (
                                        <button
                                            key={dia.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={isSelected}
                                            onClick={() => setFechaSeleccionada(dia.key)}
                                            className={`relative flex items-center justify-center w-full h-14 text-base font-medium transition-all outline-none cursor-pointer border-0
                                                ${isSelected
                                                    ? 'text-white border-b-4 border-[#76ff03]'
                                                    : 'text-cyan-200 hover:text-white border-b-4 border-transparent hover:bg-white/10'
                                                }`}
                                        >
                                            {dia.diaNombre}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {viajesActivos.length > 0 || rutasActivas.length > 0 ? (
                            <>
                                {/* Métricas KPI */}
                                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                                    {/* Card: Viajes */}
                                    <button
                                        type="button"
                                        onClick={() => setColumnaActiva(columnaActiva === 'viajes' ? null : 'viajes')}
                                        className={`flex items-center gap-3 rounded-xl bg-white border p-4 text-left transition cursor-pointer hover:shadow-md ${columnaActiva === 'viajes' ? 'border-sky-400 ring-1 ring-sky-400 shadow-md' : 'border-slate-200'}`}
                                    >
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm">
                                            <Navigation className="size-6 text-white" />
                                        </span>
                                        <span>
                                            <span className="block text-2xl font-bold text-slate-800">{viajesActivos.length}</span>
                                            <span className="block text-xs text-slate-500 mt-0.5 leading-snug">Viajes Planificados</span>
                                        </span>
                                    </button>

                                    {/* Card: Vehículos */}
                                    <button
                                        type="button"
                                        onClick={() => setColumnaActiva(columnaActiva === 'vehiculos' ? null : 'vehiculos')}
                                        className={`flex items-center gap-3 rounded-xl bg-white border p-4 text-left transition cursor-pointer hover:shadow-md ${columnaActiva === 'vehiculos' ? 'border-sky-400 ring-1 ring-sky-400 shadow-md' : 'border-slate-200'}`}
                                    >
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-400 shadow-sm">
                                            <Truck className="size-6 text-white" />
                                        </span>
                                        <span>
                                            <span className="block text-2xl font-bold text-slate-800">{vehiculosUnicos.length}</span>
                                            <span className="block text-xs text-slate-500 mt-0.5 leading-snug">Vehículos Asignados</span>
                                        </span>
                                    </button>

                                    {/* Card: Municipios */}
                                    <button
                                        type="button"
                                        onClick={() => setColumnaActiva(columnaActiva === 'municipios' ? null : 'municipios')}
                                        className={`flex items-center gap-3 rounded-xl bg-white border p-4 text-left transition cursor-pointer hover:shadow-md ${columnaActiva === 'municipios' ? 'border-sky-400 ring-1 ring-sky-400 shadow-md' : 'border-slate-200'}`}
                                    >
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 shadow-sm">
                                            <MapPinned className="size-6 text-white" />
                                        </span>
                                        <span>
                                            <span className="block text-2xl font-bold text-slate-800">{cityLabels.length}</span>
                                            <span className="block text-xs text-slate-500 mt-0.5 leading-snug">Municipios Destino</span>
                                        </span>
                                    </button>

                                    {/* Card: Barrios */}
                                    <button
                                        type="button"
                                        onClick={() => setColumnaActiva(columnaActiva === 'barrios' ? null : 'barrios')}
                                        className={`flex items-center gap-3 rounded-xl bg-white border p-4 text-left transition cursor-pointer hover:shadow-md ${columnaActiva === 'barrios' ? 'border-sky-400 ring-1 ring-sky-400 shadow-md' : 'border-slate-200'}`}
                                    >
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 shadow-sm">
                                            <Package className="size-6 text-white" />
                                        </span>
                                        <span>
                                            <span className="block text-2xl font-bold text-slate-800">{neighborhoodCount}</span>
                                            <span className="block text-xs text-slate-500 mt-0.5 leading-snug">Barrios Cubiertos</span>
                                        </span>
                                    </button>
                                </div>

                                {/* Gráficos */}
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <ChartPanel title="Lugares por municipio" icon={<User className="size-4" />}>
                                        <Doughnut
                                            data={{
                                                labels: cityLabels,
                                                datasets: [{
                                                    label: 'Lugares',
                                                    data: cityLabels.map((city) => Object.values(groupedRoutes[city]).reduce((sum, places) => sum + places.length, 0)),
                                                    backgroundColor: ['rgba(0,0,0,0)'],
                                                    borderWidth: 0,
                                                }],
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                cutout: '65%',
                                                plugins: {
                                                    legend: { position: 'bottom' as const, labels: { color: '#334155', font: { size: 11 } } },
                                                    tooltip: { enabled: true },
                                                },
                                            }}
                                            plugins={[{
                                                id: 'donutGradient',
                                                beforeDatasetsDraw(chart) {
                                                    const { ctx, chartArea } = chart;
                                                    if (!chartArea) return;
                                                    const cx = (chartArea.left + chartArea.right) / 2;
                                                    const cy = (chartArea.top + chartArea.bottom) / 2;
                                                    const r = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) / 2;
                                                    const inner = r * 0.65;
                                                    // Dibujar arco con gradiente cónico
                                                    ctx.save();
                                                    const grad = ctx.createConicGradient ? ctx.createConicGradient(-Math.PI / 2, cx, cy) : null;
                                                    ctx.beginPath();
                                                    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
                                                    ctx.arc(cx, cy, inner, Math.PI * 2, 0, true);
                                                    ctx.closePath();
                                                    if (grad) {
                                                        grad.addColorStop(0, '#1e88e5');
                                                        grad.addColorStop(0.5, '#29b6f6');
                                                        grad.addColorStop(1, '#76ff03');
                                                        ctx.fillStyle = grad;
                                                    } else {
                                                        // fallback radial gradient
                                                        const rg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, inner * 0.2, cx, cy, r);
                                                        rg.addColorStop(0, '#29b6f6');
                                                        rg.addColorStop(1, '#76ff03');
                                                        ctx.fillStyle = rg;
                                                    }
                                                    ctx.fill();
                                                    ctx.restore();
                                                },
                                                afterDatasetsDraw(chart) {
                                                    const { ctx, chartArea } = chart;
                                                    if (!chartArea) return;
                                                    const cx = (chartArea.left + chartArea.right) / 2;
                                                    const cy = (chartArea.top + chartArea.bottom) / 2;
                                                    const total = (chart.data.datasets[0]?.data as number[])?.reduce((a: number, b: number) => a + b, 0) ?? 0;
                                                    const minDim = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
                                                    ctx.save();
                                                    ctx.textAlign = 'center';
                                                    ctx.textBaseline = 'middle';
                                                    ctx.font = `bold ${minDim / 6}px sans-serif`;
                                                    ctx.fillStyle = '#1e293b';
                                                    ctx.fillText(String(total), cx, cy - minDim / 18);
                                                    ctx.font = `${minDim / 11}px sans-serif`;
                                                    ctx.fillStyle = '#64748b';
                                                    ctx.fillText('Total', cx, cy + minDim / 9);
                                                    ctx.restore();
                                                },
                                            }]}
                                        />
                                    </ChartPanel>
                                    <ChartPanel title="Top 8 barrios" icon={<Layers className="size-4" />}>
                                        <Bar
                                            data={{
                                                labels: topNeighborhoods.map(([name]) => name),
                                                datasets: [{
                                                    label: 'Lugares',
                                                    data: topNeighborhoods.map(([, count]) => count),
                                                    backgroundColor: 'rgba(0,0,0,0)',
                                                    borderRadius: 4,
                                                    borderSkipped: false,
                                                }],
                                            }}
                                            options={{ ...chartOptionsBar, indexAxis: 'y' as const }}
                                            plugins={[{
                                                id: 'barGradient',
                                                afterDatasetsDraw(chart) {
                                                    const { ctx, chartArea, scales } = chart;
                                                    if (!chartArea || !scales['x'] || !scales['y']) return;
                                                    const xScale = scales['x'];
                                                    const yScale = scales['y'];
                                                    const data = chart.data.datasets[0]?.data as number[];
                                                    if (!data) return;
                                                    data.forEach((val, i) => {
                                                        const yPos = yScale.getPixelForValue(i);
                                                        const barH = yScale.width ? Math.max(yScale.getPixelForValue(0) - yScale.getPixelForValue(1) - 4, 14) : 20;
                                                        const xStart = xScale.getPixelForValue(0);
                                                        const xEnd = xScale.getPixelForValue(val);
                                                        if (xEnd <= xStart) return;
                                                        const grad = ctx.createLinearGradient(xStart, 0, xEnd, 0);
                                                        grad.addColorStop(0, '#1e88e5');
                                                        grad.addColorStop(0.5, '#29b6f6');
                                                        grad.addColorStop(1, '#76ff03');
                                                        ctx.save();
                                                        ctx.fillStyle = grad;
                                                        const h = barH * 0.65;
                                                        const radius = 4;
                                                        const x = xStart;
                                                        const y = yPos - h / 2;
                                                        const w = xEnd - xStart;
                                                        ctx.beginPath();
                                                        ctx.moveTo(x + radius, y);
                                                        ctx.lineTo(x + w - radius, y);
                                                        ctx.arcTo(x + w, y, x + w, y + h, radius);
                                                        ctx.lineTo(x + w, y + h - radius);
                                                        ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
                                                        ctx.lineTo(x + radius, y + h);
                                                        ctx.arcTo(x, y + h, x, y + h - radius, radius);
                                                        ctx.lineTo(x, y + radius);
                                                        ctx.arcTo(x, y, x + radius, y, radius);
                                                        ctx.closePath();
                                                        ctx.fill();
                                                        ctx.restore();
                                                    });
                                                },
                                            }]}
                                        />
                                    </ChartPanel>
                                </div>

                                {/* Barra de búsqueda */}
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <div className="relative w-full sm:w-80">
                                        <Search className="text-muted-foreground absolute top-2 size-4 left-2.5" />
                                        <Input
                                            value={buscarRuta}
                                            onChange={(event) => setBuscarRuta(event.target.value)}
                                            className="h-8 pl-8 text-xs"
                                            placeholder="Buscar vehículo, conductor, municipio, barrio..."
                                        />
                                    </div>
                                </div>

                                {/* Tabla de columnas expandibles */}
                                {(() => {
                                    // Derivar vehículos únicos de los viajes filtrados
                                    const vehiculosDeViajes = Array.from(new Set(filteredViajes.map((v) => v.placa))).sort();
                                    // Viajes del vehículo seleccionado
                                    const viajesDelVehiculo = viajeSeleccionado
                                        ? filteredViajes.filter((v) => v.placa === viajeSeleccionado)
                                        : [];
                                    // Municipios del vehículo seleccionado
                                    const municipiosDelVehiculo = Array.from(
                                        new Set(viajesDelVehiculo.flatMap((v) => v.municipios))
                                    ).sort();
                                    // Barrios del municipio seleccionado
                                    const barriosDelMunicipio = municipioSeleccionado
                                        ? Array.from(
                                              new Set(
                                                  viajesDelVehiculo
                                                      .flatMap((v) => v.destinos)
                                                      .filter((d) => normalizar(d.municipio) === normalizar(municipioSeleccionado))
                                                      .map((d) => d.barrio)
                                                      .filter(Boolean)
                                              )
                                          ).sort()
                                        : [];

                                    const colBase = 'flex flex-col transition-all duration-200 overflow-hidden' +
                                        ' [border-right:1px_solid_rgba(255,255,255,0.15)] last:[border-right:none]';
                                    const colNormal = 'w-1/4 min-w-[120px]';
                                    const colExpanded = 'flex-1';
                                    const colHidden = 'hidden';

                                    const isExpanded = (col: typeof columnaActiva) => columnaActiva === col;
                                    const isHidden = (col: typeof columnaActiva) => columnaActiva !== null && columnaActiva !== col;

                                    const headerCls = (col: typeof columnaActiva, active: boolean) =>
                                        `flex items-center justify-between px-3 py-2.5 cursor-pointer select-none border-b border-white/20 text-xs font-semibold transition-colors text-white hover:brightness-110`;

                                    // Inline style for active header to match the dark-blue gradient
                                    const headerStyle = (active: boolean): React.CSSProperties =>
                                        active
                                            ? { background: 'linear-gradient(135deg, #0f2744 0%, #0e4a62 60%, #1a7a6e 100%)' }
                                            : { background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' };

                                    const rowCls = (selected: boolean) =>
                                        `px-3 py-2 text-xs cursor-pointer border-b border-slate-100 transition-colors ${selected ? 'bg-cyan-100 text-cyan-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`;

                                    return (
                                        <div className="rounded-xl overflow-hidden shadow-sm" style={{ minHeight: 280, border: '1px solid #1e5f74' }}>
                                            <div className="flex" style={{ minHeight: 280, '--divide-color': 'rgba(255,255,255,0.2)' } as React.CSSProperties}>

                                                {/* COL 1: Viajes */}
                                                <div className={`${colBase} ${isHidden('viajes') ? colHidden : isExpanded('viajes') ? colExpanded : colNormal}`}>
                                                    <div
                                                        className={headerCls('viajes', isExpanded('viajes'))}
                                                        style={headerStyle(isExpanded('viajes'))}
                                                        onClick={() => setColumnaActiva(isExpanded('viajes') ? null : 'viajes')}
                                                    >
                                                        <span>Viajes ({filteredViajes.length})</span>
                                                        <ChevronRight className={`size-3.5 transition-transform ${isExpanded('viajes') ? 'rotate-90' : ''}`} />
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        {filteredViajes.map((v) => (
                                                            <div
                                                                key={v.id}
                                                                className={rowCls(viajeSeleccionado === v.placa)}
                                                                onClick={() => {
                                                                    setViajeSeleccionado(viajeSeleccionado === v.placa ? null : v.placa);
                                                                    setMunicipioSeleccionado(null);
                                                                    setColumnaActiva(null);
                                                                }}
                                                            >
                                                                <span className="font-mono font-semibold">Viaje #{v.viaje_numero}</span>
                                                                {isExpanded('viajes') && (
                                                                    <div className="mt-0.5 text-muted-foreground text-[11px]">
                                                                        {v.placa} · {v.responsable || v.conductor || '—'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {filteredViajes.length === 0 && (
                                                            <p className="p-4 text-xs text-muted-foreground text-center">Sin viajes</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* COL 2: Vehículos */}
                                                <div className={`${colBase} ${isHidden('vehiculos') ? colHidden : isExpanded('vehiculos') ? colExpanded : colNormal}`}>
                                                    <div
                                                        className={headerCls('vehiculos', isExpanded('vehiculos'))}
                                                        style={headerStyle(isExpanded('vehiculos'))}
                                                        onClick={() => setColumnaActiva(isExpanded('vehiculos') ? null : 'vehiculos')}
                                                    >
                                                        <span>Vehículos ({vehiculosDeViajes.length})</span>
                                                        <ChevronRight className={`size-3.5 transition-transform ${isExpanded('vehiculos') ? 'rotate-90' : ''}`} />
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        {vehiculosDeViajes.map((placa) => (
                                                            <div
                                                                key={placa}
                                                                className={rowCls(viajeSeleccionado === placa)}
                                                                onClick={() => {
                                                                    setViajeSeleccionado(viajeSeleccionado === placa ? null : placa);
                                                                    setMunicipioSeleccionado(null);
                                                                    setColumnaActiva(null);
                                                                }}
                                                            >
                                                                <span className="font-mono">{placa}</span>
                                                                {isExpanded('vehiculos') && (() => {
                                                                    const viaj = filteredViajes.filter((v) => v.placa === placa);
                                                                    return (
                                                                        <div className="mt-0.5 text-muted-foreground text-[11px]">
                                                                            {viaj.length} {viaj.length === 1 ? 'viaje' : 'viajes'} · {viaj[0]?.responsable || viaj[0]?.conductor || '—'}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ))}
                                                        {vehiculosDeViajes.length === 0 && (
                                                            <p className="p-4 text-xs text-muted-foreground text-center">Sin vehículos</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* COL 3: Municipios */}
                                                <div className={`${colBase} ${isHidden('municipios') ? colHidden : isExpanded('municipios') ? colExpanded : colNormal}`}>
                                                    <div
                                                        className={headerCls('municipios', isExpanded('municipios'))}
                                                        style={headerStyle(isExpanded('municipios'))}
                                                        onClick={() => setColumnaActiva(isExpanded('municipios') ? null : 'municipios')}
                                                    >
                                                        <span>Municipios ({municipiosDelVehiculo.length || cityLabels.length})</span>
                                                        <ChevronRight className={`size-3.5 transition-transform ${isExpanded('municipios') ? 'rotate-90' : ''}`} />
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        {(viajeSeleccionado ? municipiosDelVehiculo : cityLabels).map((mun) => (
                                                            <div
                                                                key={mun}
                                                                className={rowCls(municipioSeleccionado === mun)}
                                                                onClick={() => {
                                                                    setMunicipioSeleccionado(municipioSeleccionado === mun ? null : mun);
                                                                    setColumnaActiva(null);
                                                                }}
                                                            >
                                                                {mun}
                                                            </div>
                                                        ))}
                                                        {!viajeSeleccionado && cityLabels.length === 0 && (
                                                            <p className="p-4 text-xs text-muted-foreground text-center">Seleccione un vehículo</p>
                                                        )}
                                                        {viajeSeleccionado && municipiosDelVehiculo.length === 0 && (
                                                            <p className="p-4 text-xs text-muted-foreground text-center">Sin municipios</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* COL 4: Barrios */}
                                                <div className={`${colBase} ${isHidden('barrios') ? colHidden : isExpanded('barrios') ? colExpanded : colNormal}`}>
                                                    <div
                                                        className={headerCls('barrios', isExpanded('barrios'))}
                                                        style={headerStyle(isExpanded('barrios'))}
                                                        onClick={() => setColumnaActiva(isExpanded('barrios') ? null : 'barrios')}
                                                    >
                                                        <span>Barrios ({barriosDelMunicipio.length})</span>
                                                        <ChevronRight className={`size-3.5 transition-transform ${isExpanded('barrios') ? 'rotate-90' : ''}`} />
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        {barriosDelMunicipio.map((barrio) => (
                                                            <div key={barrio} className={rowCls(false)}>
                                                                {barrio}
                                                            </div>
                                                        ))}
                                                        {municipioSeleccionado && barriosDelMunicipio.length === 0 && (
                                                            <p className="p-4 text-xs text-muted-foreground text-center">Sin barrios</p>
                                                        )}
                                                        {!municipioSeleccionado && (
                                                            <p className="p-4 text-xs text-muted-foreground text-center">Seleccione un municipio</p>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })()}

                            </>
                        ) : null}
                    </section>
                )}

                {vista === 'criticidad' && (
                    <section className="space-y-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Rutas de Criticidad</h2>
                                <p className="text-muted-foreground text-sm">{criticidadFileName || 'Cargue el archivo Excel de criticidad.'}</p>
                            </div>
                            <Label className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-medium">
                                <Upload className="size-4" /> Cargar Excel Criticidad
                                <input
                                    className="sr-only"
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={(event) => void fileInput(event, 'criticidad')}
                                />
                            </Label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {(
                                [
                                    ['Total rutas', criticidad.length, 'todos'],
                                    ['Crítica Alta', criticidadCounts.alta, 'alta'],
                                    ['Crítica Media', criticidadCounts.media, 'media'],
                                    ['Crítica Baja', criticidadCounts.baja, 'baja'],
                                ] as [string, number, Nivel | 'todos'][]
                            ).map(([label, count, level]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setFiltroCriticoRapido(level)}
                                    className={`rounded-xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow ${filtroCriticoRapido === level ? 'ring-2 ring-amber-500' : ''}`}
                                >
                                    <span className="block text-3xl font-bold" style={{ color: level === 'todos' ? '#b37000' : NIVEL_COLORS[level] }}>
                                        {count}
                                    </span>
                                    <span className="text-muted-foreground text-sm">{label}</span>
                                </button>
                            ))}
                        </div>
                        {criticidad.length > 0 && (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <ChartPanel title="Distribución por criticidad">
                                    <Doughnut
                                        data={{
                                            labels: ['Crítica Alta', 'Crítica Media', 'Crítica Baja'],
                                            datasets: [
                                                {
                                                    data: [criticidadCounts.alta, criticidadCounts.media, criticidadCounts.baja],
                                                    backgroundColor: [NIVEL_COLORS.alta, NIVEL_COLORS.media, NIVEL_COLORS.baja],
                                                },
                                            ],
                                        }}
                                        options={chartOptions}
                                    />
                                </ChartPanel>
                                <ChartPanel title="Ciudades por frecuencia">
                                    <Bar
                                        data={{
                                            labels: topFrequencies.map(([frequency]) => frequency),
                                            datasets: [
                                                { label: 'Ciudades', data: topFrequencies.map(([, count]) => count), backgroundColor: PALETTE },
                                            ],
                                        }}
                                        options={{ ...chartOptions, indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
                                    />
                                </ChartPanel>
                            </div>
                        )}
                        <div className="grid gap-3 rounded-xl border bg-amber-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="grid gap-1">
                                <Label htmlFor="filter-city">Ciudad</Label>
                                <Input
                                    id="filter-city"
                                    value={buscarCiudad}
                                    onChange={(event) => setBuscarCiudad(event.target.value)}
                                    placeholder="Buscar ciudad..."
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label>Mes</Label>
                                <Select
                                    value={filtroMesCriticidad || 'todos'}
                                    onValueChange={(v) => { setFiltroMesCriticidad(v === 'todos' ? '' : v); setFiltroFechaCriticidad(''); }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los meses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los meses</SelectItem>
                                        {mesesDisponibles.map((m) => {
                                            const [y, mo] = m.split('-');
                                            const nombre = new Date(Number(y), Number(mo) - 1, 1)
                                                .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                                            return <SelectItem key={m} value={m}>{nombre}</SelectItem>;
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1">
                                <Label>Fecha exacta</Label>
                                <Input
                                    type="date"
                                    value={filtroFechaCriticidad}
                                    onChange={(e) => { setFiltroFechaCriticidad(e.target.value); setFiltroMesCriticidad(''); }}
                                    className="text-xs font-mono"
                                />
                            </div>
                            <div className="flex items-end justify-between gap-2">
                                <span className="text-muted-foreground pb-2 text-xs">
                                    {municipiosUnicos.length} municipio{municipiosUnicos.length !== 1 ? 's' : ''}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setBuscarCiudad('');
                                        setFrecuenciaSeleccionada('todas');
                                        setNivelSeleccionado('todos');
                                        setFiltroCriticoRapido('todos');
                                        setFiltroMesCriticidad('');
                                        setFiltroFechaCriticidad('');
                                    }}
                                >
                                    Limpiar
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full min-w-[500px] text-sm table-fixed">
                                <colgroup>
                                    <col className="w-12" />
                                    <col className="w-1/3" />
                                    <col className="w-1/3" />
                                    <col className="w-1/3" />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}>
                                        {['N°', 'Ciudad', 'Días que sale', 'Criticidad'].map((header) => (
                                            <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-white">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {municipiosUnicos
                                        .filter((row) => {
                                            const q = normalizar(buscarCiudad);
                                            return !q || normalizar(row.municipio).includes(q);
                                        })
                                        .map((row, index) => {
                                            const key = normalizar(row.municipio);
                                            const nivel: Nivel = criticidadManual[key] ?? 'baja';
                                            return (
                                                <tr key={key} className="border-t hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-2.5 text-xs text-slate-400">{index + 1}</td>
                                                    <td className="px-4 py-2.5 text-slate-800">{row.municipio}</td>
                                                    <td className="px-4 py-2.5 text-xs text-black">
                                                        {row.dias.join(', ')}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={nivel}
                                                            onChange={(e) =>
                                                                setCriticidadManual((prev) => ({
                                                                    ...prev,
                                                                    [key]: e.target.value as Nivel,
                                                                }))
                                                            }
                                                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-300"
                                                        >
                                                            <option value="alta">Crítica Alta</option>
                                                            <option value="media">Crítica Media</option>
                                                            <option value="baja">Crítica Baja</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {municipiosUnicos.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-muted-foreground px-4 py-10 text-center text-xs">
                                                Los municipios se generan automáticamente desde las rutas cargadas en la vista principal.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {vista === 'conductores' && (
                    <section className="space-y-5">

                        {/* ── Encabezado y toggle de fuente ──────────────────────────────── */}
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Conductores por Corte Mensual</h2>
                                <p className="text-muted-foreground text-sm">
                                    {modoConductores === 'planeacion'
                                        ? `Rutas asignadas desde planeación · ${conductoresMes.length} conductores activos`
                                        : conductoresFileName || 'Cargue el archivo Excel de conductores.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Toggle fuente */}
                                {conductoresMes.length > 0 && (
                                    <>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={modoConductores === 'planeacion' ? 'default' : 'ghost'}
                                            className="h-9 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                            style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}
                                            onClick={() => setModoConductores('planeacion')}
                                        >
                                            <Truck className="size-3.5 mr-1 text-cyan-300" />
                                            Planeación
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={modoConductores === 'excel' ? 'default' : 'ghost'}
                                            className="h-9 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                            style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}
                                            onClick={() => setModoConductores('excel')}
                                        >
                                            <Layers className="size-3.5 mr-1" />
                                            Excel
                                        </Button>
                                    </>
                                )}
                                <Label className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-medium">
                                    <Upload className="size-4" /> Cargar Excel Conductores
                                    <input
                                        className="sr-only"
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={(event) => void fileInput(event, 'conductores')}
                                    />
                                </Label>
                            </div>
                        </div>

                        {/* ── Selector de corte mensual (solo en modo planeación) ─────── */}
                        {modoConductores === 'planeacion' && (
                            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 p-3">
                                <Calendar className="size-4 text-slate-500 shrink-0" />
                                <span className="text-sm font-medium text-slate-700">Corte mensual:</span>
                                <Select
                                    value={mesConductores}
                                    onValueChange={(val) => {
                                        setMesConductores(val);
                                        router.get(
                                            window.location.pathname,
                                            { mes: val },
                                            { preserveState: false, preserveScroll: false },
                                        );
                                    }}
                                >
                                    <SelectTrigger className="w-44 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(mesesDisponiblesConductores.length > 0
                                            ? mesesDisponiblesConductores
                                            : [mesConductores]
                                        ).map((m) => {
                                            const [y, mo] = m.split('-');
                                            const label = new Date(parseInt(y), parseInt(mo) - 1, 1)
                                                .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                                            return (
                                                <SelectItem key={m} value={m}>
                                                    {label.charAt(0).toUpperCase() + label.slice(1)}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <span className="text-xs text-slate-500">
                                    {conductoresMes.length} conductor{conductoresMes.length !== 1 ? 'es' : ''} · {
                                        conductoresMes.reduce((s, c) => s + c.total_viajes, 0)
                                    } viajes totales
                                </span>
                            </div>
                        )}

                        {/* ── KPIs ───────────────────────────────────────────────────────── */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {modoConductores === 'planeacion' ? (
                                <>
                                    {(
                                        [
                                            ['Total conductores', conductoresMes.length, 'todos'],
                                            ['Crítica Alta', conductoresMesCounts.alta, 'alta'],
                                            ['Crítica Media', conductoresMesCounts.media, 'media'],
                                            ['Sin criticidad / Baja', conductoresMesCounts.baja, 'baja'],
                                        ] as [string, number, Nivel | 'todos'][]
                                    ).map(([label, count, level]) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setFiltroConductorRapido(level)}
                                            className={`rounded-xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow ${filtroConductorRapido === level ? 'ring-2 ring-amber-500' : ''}`}
                                        >
                                            <span className="block text-3xl font-bold" style={{ color: level === 'todos' ? '#b37000' : NIVEL_COLORS[level] }}>
                                                {count}
                                            </span>
                                            <span className="text-muted-foreground text-sm">{label}</span>
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {(
                                        [
                                            ['Total conductores', conductores.length, 'todos'],
                                            ['Aptos crítica alta', conductorCounts.alta, 'alta'],
                                            ['Aptos crítica media', conductorCounts.media, 'media'],
                                            ['Aptos no crítica', conductorCounts.baja, 'baja'],
                                        ] as [string, number, Nivel | 'todos'][]
                                    ).map(([label, count, level]) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setFiltroConductorRapido(level)}
                                            className={`rounded-xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow ${filtroConductorRapido === level ? 'ring-2 ring-amber-500' : ''}`}
                                        >
                                            <span className="block text-3xl font-bold" style={{ color: level === 'todos' ? '#b37000' : NIVEL_COLORS[level] }}>
                                                {count}
                                            </span>
                                            <span className="text-muted-foreground text-sm">{label}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* ── Gráfico distribución (excel mode) ─────────────────────────── */}
                        {modoConductores === 'excel' && conductores.length > 0 && (
                            <ChartPanel title="Distribución por tipo de ruta">
                                <Doughnut
                                    data={{
                                        labels: ['Crítica Alta', 'Crítica Media', 'No Crítica / Baja'],
                                        datasets: [
                                            {
                                                data: [conductorCounts.alta, conductorCounts.media, conductorCounts.baja],
                                                backgroundColor: [NIVEL_COLORS.alta, NIVEL_COLORS.media, NIVEL_COLORS.baja],
                                            },
                                        ],
                                    }}
                                    options={chartOptions}
                                />
                            </ChartPanel>
                        )}

                        {/* ── Gráfico distribución (planeación mode) ───────────────────── */}
                        {modoConductores === 'planeacion' && conductoresMes.length > 0 && (
                            <ChartPanel title="Distribución de conductores por criticidad de rutas">
                                <Doughnut
                                    data={{
                                        labels: ['Crítica Alta', 'Crítica Media', 'Sin criticidad / Baja'],
                                        datasets: [
                                            {
                                                data: [conductoresMesCounts.alta, conductoresMesCounts.media, conductoresMesCounts.baja],
                                                backgroundColor: [NIVEL_COLORS.alta, NIVEL_COLORS.media, NIVEL_COLORS.baja],
                                            },
                                        ],
                                    }}
                                    options={chartOptions}
                                />
                            </ChartPanel>
                        )}

                        {/* ── Barra de filtros ──────────────────────────────────────────── */}
                        <div className="grid gap-3 rounded-xl border bg-amber-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="grid gap-1">
                                <Label htmlFor="filter-driver-name">Nombre</Label>
                                <Input
                                    id="filter-driver-name"
                                    value={buscarConductor}
                                    onChange={(event) => setBuscarConductor(event.target.value)}
                                    placeholder="Buscar nombre..."
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="filter-driver-id">Cédula</Label>
                                <Input
                                    id="filter-driver-id"
                                    value={buscarCedula}
                                    onChange={(event) => setBuscarCedula(event.target.value)}
                                    placeholder="Buscar cédula..."
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label>Criticidad</Label>
                                <Select value={nivelConductor} onValueChange={setNivelConductor}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todas</SelectItem>
                                        <SelectItem value="alta">Crítica Alta</SelectItem>
                                        <SelectItem value="media">Crítica Media</SelectItem>
                                        <SelectItem value="baja">No Crítica / Baja</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end justify-between gap-2">
                                <span className="text-muted-foreground pb-2 text-xs">
                                    {modoConductores === 'planeacion'
                                        ? `${filteredConductoresMes.length} de ${conductoresMes.length} conductores`
                                        : `${filteredConductores.length} de ${conductores.length} conductores`}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setBuscarConductor('');
                                        setBuscarCedula('');
                                        setNivelConductor('todos');
                                        setFiltroConductorRapido('todos');
                                    }}
                                >
                                    Limpiar
                                </Button>
                            </div>
                        </div>

                        {/* ══ TABLA MODO PLANEACIÓN ════════════════════════════════════════ */}
                        {modoConductores === 'planeacion' && (
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e5f74 60%, #2a9d8f 100%)' }}>
                                            {[
                                                'N°',
                                                'Cédula',
                                                'Nombre',
                                                'Cargo',
                                                'Edad',
                                                'Exp. externa',
                                                'Exp. interna',
                                                'Lic. conducción',
                                                'Venc. licencia',
                                                'Aptitud',
                                                'Criticidad',
                                                'Rutas asignadas',
                                                'Días activos',
                                                'Ciudades asignadas',
                                            ].map((header) => (
                                                <th key={header} className="px-3 py-3 text-left text-xs font-semibold text-white">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredConductoresMes.map((conductor) => {
                                            const nivel = criticidadDeConductor(conductor.municipios_unicos);
                                            const aptitudKey = conductor.cedula || conductor.nombre;
                                            const aptitudValor = aptitudManual[aptitudKey] ?? conductor.aptitud ?? '';
                                            const aptitudNorm = normalizar(aptitudValor);
                                            const isApto = aptitudNorm.includes('apto') && !aptitudNorm.includes('no apto');
                                            return (
                                                <tr key={`${conductor.cedula}-${conductor.numero}`} className="hover:bg-muted/30 border-t">
                                                    <td className="px-3 py-3 text-slate-500">{conductor.numero}</td>
                                                    <td className="px-3 py-3 font-mono text-xs">{conductor.cedula || '—'}</td>
                                                    <td className="px-3 py-3 font-semibold">{conductor.nombre}</td>
                                                    <td className="px-3 py-3 text-xs text-slate-600">{conductor.cargo || '—'}</td>
                                                    <td className="px-3 py-3 text-center">{conductor.edad ?? '—'}</td>
                                                    <td className="px-3 py-3 text-center">{conductor.experiencia_externa}</td>
                                                    <td className="px-3 py-3 text-center">{conductor.experiencia_interna}</td>
                                                    {/* Licencia de conducción — categoría más alta */}
                                                    <td className="px-3 py-3 text-center">
                                                        {conductor.licencia_categoria
                                                            ? <Badge variant="outline" className="font-mono text-xs">{conductor.licencia_categoria}</Badge>
                                                            : <span className="text-slate-400">—</span>}
                                                    </td>
                                                    {/* Vencimiento de licencia */}
                                                    <td className="px-3 py-3 text-center">
                                                        {conductor.fecha_vencimiento_licencia
                                                            ? (() => {
                                                                const hoy = new Date(); hoy.setHours(0,0,0,0);
                                                                const venc = new Date(conductor.fecha_vencimiento_licencia + 'T00:00:00');
                                                                const dias = Math.round((venc.getTime() - hoy.getTime()) / 86400000);
                                                                const color = dias < 0 ? 'text-red-600 font-semibold' : dias <= 30 ? 'text-amber-600 font-semibold' : 'text-emerald-700';
                                                                return <span className={`text-xs ${color}`}>{conductor.fecha_vencimiento_licencia}</span>;
                                                              })()
                                                            : <span className="text-slate-400">—</span>}
                                                    </td>
                                                    {/* Aptitud: editable manualmente */}
                                                    <td className="px-3 py-3">
                                                        {aptitudValor ? (
                                                            <Badge variant={isApto ? 'default' : 'destructive'}>
                                                                {isApto ? 'APTO' : aptitudValor}
                                                            </Badge>
                                                        ) : (
                                                            <select
                                                                value=""
                                                                onChange={(e) =>
                                                                    setAptitudManual((prev) => ({
                                                                        ...prev,
                                                                        [aptitudKey]: e.target.value,
                                                                    }))
                                                                }
                                                                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-300"
                                                            >
                                                                <option value="" disabled>Definir…</option>
                                                                <option value="APTO">APTO</option>
                                                                <option value="NO APTO">NO APTO</option>
                                                            </select>
                                                        )}
                                                    </td>
                                                    {/* Criticidad */}
                                                    <td className="px-3 py-3">
                                                        {nivel ? (
                                                            <NivelBadge nivel={nivel}>{etiquetaNivel(nivel)}</NivelBadge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">
                                                                {criticidad.length ? 'Sin match' : 'Cargue criticidad'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* Rutas asignadas: total viajes + municipios */}
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <TrendingUp className="size-3.5 text-slate-400 shrink-0" />
                                                            <span className="font-semibold">{conductor.total_viajes}</span>
                                                            <span className="text-muted-foreground text-xs">viajes</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <Building2 className="size-3.5 text-slate-400 shrink-0" />
                                                            <span className="text-xs text-slate-600">{conductor.municipios_unicos.length} municipios</span>
                                                        </div>
                                                    </td>
                                                    {/* Días activos */}
                                                    <td className="px-3 py-3 text-center">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                            <Calendar className="size-3" />
                                                            {conductor.dias_activos}
                                                        </span>
                                                    </td>
                                                    {/* Ciudades asignadas: lista expandible */}
                                                    <td className="px-3 py-3 max-w-[220px]">
                                                        {conductor.rutas.length > 0 ? (
                                                            <details>
                                                                <summary className="flex cursor-pointer list-none items-center gap-1 text-amber-700 text-xs">
                                                                    <ChevronDown className="size-3.5" />
                                                                    {conductor.rutas.length} ruta{conductor.rutas.length !== 1 ? 's' : ''}
                                                                </summary>
                                                                <div className="bg-muted/50 mt-2 space-y-1.5 rounded-md p-2 max-h-44 overflow-y-auto">
                                                                    {conductor.rutas.map((ruta, ri) => {
                                                                        const nivelRuta = criticidad.length
                                                                            ? criticidadDeConductor([ruta.municipio])
                                                                            : null;
                                                                        return (
                                                                            <div key={`${ruta.municipio}-${ri}`} className="text-xs border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                    <strong className="text-slate-800">{ruta.municipio}</strong>
                                                                                    {nivelRuta && (
                                                                                        <span
                                                                                            className="rounded px-1 py-0.5 text-[10px] font-medium"
                                                                                            style={{ background: `${NIVEL_COLORS[nivelRuta]}22`, color: NIVEL_COLORS[nivelRuta] }}
                                                                                        >
                                                                                            {etiquetaNivel(nivelRuta)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-muted-foreground mt-0.5">
                                                                                    {ruta.total_viajes} viaje{ruta.total_viajes !== 1 ? 's' : ''} · {ruta.fechas.length} día{ruta.fechas.length !== 1 ? 's' : ''}
                                                                                    {ruta.placas.length > 0 && ` · ${ruta.placas.join(', ')}`}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </details>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">Sin rutas</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredConductoresMes.length === 0 && (
                                            <tr>
                                                <td colSpan={14} className="text-muted-foreground px-4 py-10 text-center">
                                                    {conductoresMes.length
                                                        ? 'Sin conductores para estos filtros.'
                                                        : 'No hay modulaciones registradas para este mes.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ══ TABLA MODO EXCEL (fallback) ══════════════════════════════════ */}
                        {modoConductores === 'excel' && (
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="w-full min-w-[1050px] text-sm">
                                    <thead className="bg-muted/70">
                                        <tr>
                                            {[
                                                'N°',
                                                'Cédula',
                                                'Nombre',
                                                'Cargo',
                                                'Edad',
                                                'Exp. externa',
                                                'Exp. interna',
                                                'Aptitud',
                                                'Programar a rutas',
                                                'Ciudades asignadas',
                                            ].map((header) => (
                                                <th key={header} className="px-3 py-3 text-left font-semibold">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredConductores.map((driver, index) => {
                                            const level = clasificarRuta(driver.ruta);
                                            const assignedCities = criticidad.filter((row) => clasificarCriticidad(row.criticidad) === level);
                                            const aptitude = normalizar(driver.aptitud);
                                            const isApto = aptitude.includes('apto') && !aptitude.includes('no apto');
                                            return (
                                                <tr key={`${driver.cedula}-${index}`} className="hover:bg-muted/30 border-t">
                                                    <td className="px-3 py-3">{driver.numero || index + 1}</td>
                                                    <td className="px-3 py-3">{driver.cedula || '—'}</td>
                                                    <td className="px-3 py-3 font-semibold">{driver.nombre}</td>
                                                    <td className="px-3 py-3">{driver.cargo || '—'}</td>
                                                    <td className="px-3 py-3">{driver.edad || '—'}</td>
                                                    <td className="px-3 py-3">{driver.experienciaExterna || '—'}</td>
                                                    <td className="px-3 py-3">{driver.experienciaInterna || '—'}</td>
                                                    <td className="px-3 py-3">
                                                        <Badge variant={isApto ? 'default' : 'destructive'}>
                                                            {isApto ? 'APTO' : driver.aptitud || '—'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <NivelBadge nivel={level}>{driver.ruta || etiquetaNivel(level)}</NivelBadge>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {criticidad.length ? (
                                                            <details>
                                                                <summary className="flex cursor-pointer list-none items-center gap-1 text-amber-700">
                                                                    <ChevronDown className="size-4" />
                                                                    {assignedCities.length} ciudades
                                                                </summary>
                                                                <div className="bg-muted/50 mt-2 space-y-1 rounded-md p-2">
                                                                    {assignedCities.length ? (
                                                                        assignedCities.map((city, cityIndex) => (
                                                                            <div key={`${city.ciudad}-${cityIndex}`} className="text-xs">
                                                                                <strong>{city.ciudad}</strong> · {city.frecuencia || '—'} ·{' '}
                                                                                {city.criticidad || etiquetaNivel(level)}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-muted-foreground text-xs">
                                                                            Sin ciudades cargadas para este nivel.
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </details>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">Cargue criticidad</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredConductores.length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="text-muted-foreground px-4 py-10 text-center">
                                                    {conductores.length
                                                        ? 'Sin conductores para estos filtros.'
                                                        : 'Cargue un archivo Excel para ver conductores.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {vista === 'mapa' && (
                    <section className="space-y-5">
                        <div>
                            <h2 className="text-lg font-semibold">Mapa de Calor — Rutas por Criticidad</h2>
                            <p className="text-muted-foreground text-sm">
                                Lugares visitados desde planeación, criticidad de la ruta y conductores asignados.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-amber-50/60 p-3 text-sm">
                            {(['alta', 'media', 'baja'] as Nivel[]).map((level) => (
                                <span key={level} className="inline-flex items-center gap-2">
                                    <span className="size-3 rounded-full" style={{ backgroundColor: NIVEL_COLORS[level] }} />
                                    {etiquetaNivel(level)}
                                </span>
                            ))}
                            <span className="ml-auto text-muted-foreground text-xs">
                                {mapaCalorData.length} lugar{mapaCalorData.length !== 1 ? 'es' : ''} desde planeación
                            </span>
                        </div>
                        <RutogramasMap serverData={mapaCalorData} />
                    </section>
                )}
            </div>

            {modal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setModal(null);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="rutogramas-modal-title"
                        className="bg-background max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl p-5 shadow-xl"
                    >
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h2 id="rutogramas-modal-title" className="text-lg font-semibold">
                                    {modal.titulo}
                                </h2>
                                <p className="text-muted-foreground text-sm">{modal.descripcion}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" aria-label="Cerrar" onClick={() => setModal(null)}>
                                <X className="size-4" />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {modal.filas.map((row, index) => (
                                <div
                                    key={`${row.etiqueta}-${index}`}
                                    className="bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                                >
                                    <span className="text-muted-foreground">{row.etiqueta}</span>
                                    <span className="text-right font-medium">{row.valor}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

function RutogramasMap({ serverData }: { serverData: PuntoMapaCalor[] }) {
    const [mapStatus, setMapStatus] = useState<string>('');
    const [mapError, setMapError] = useState<string | null>(null);
    const [locations, setLocations] = useState<CiudadMapa[]>([]);
    const [mapModules, setMapModules] = useState<typeof import('react-leaflet') | null>(null);
    const [modal, setModal] = useState<DetalleModal | null>(null);
    const [filtroCrit, setFiltroCrit] = useState<Nivel | 'todos'>('todos');
    const [buscarLugar, setBuscarLugar] = useState('');

    // ── Cargar Leaflet una sola vez ──────────────────────────────────────────
    useEffect(() => {
        let active = true;
        const loadMap = async () => {
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }
            const leaflet = await import('leaflet');
            const modules = await import('react-leaflet');
            leaflet.Icon.Default.mergeOptions({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
            if (active) setMapModules(modules);
        };
        loadMap().catch((cause: unknown) => {
            console.error('No se pudo inicializar el mapa.', cause);
            if (active) setMapError('No fue posible cargar el mapa.');
        });
        return () => { active = false; };
    }, []);

    // ── Geocodificar puntos sin coordenadas usando COORDS_NARINO + Photon ───
    const buildLocations = useCallback(async () => {
        if (serverData.length === 0) {
            setMapStatus('Sin datos de planeación para mostrar.');
            setLocations([]);
            return;
        }

        setMapError(null);
        setMapStatus('Preparando puntos del mapa...');

        // Separar puntos con y sin coordenadas del servidor
        const conCoords: CiudadMapa[] = [];
        const sinCoords: PuntoMapaCalor[] = [];

        serverData.forEach((punto) => {
            if (punto.lat !== null && punto.lon !== null) {
                conCoords.push({
                    lat: punto.lat,
                    lon: punto.lon,
                    numero: '',
                    ciudad: punto.municipio,
                    nivel: clasificarCriticidad(punto.criticidad),
                    frecuencia: `${punto.total_visitas} visita${punto.total_visitas !== 1 ? 's' : ''}`,
                    conductores: punto.conductores.map((c) => c.nombre),
                    barrio: punto.barrio,
                    total_visitas: punto.total_visitas,
                    detalles: punto,
                });
            } else {
                sinCoords.push(punto);
            }
        });

        // Para los sin coords intentar COORDS_NARINO primero
        const saved =
            readSaved<Record<string, Coordenada>>(
                'rutogramas-geocode-cache',
                (value): value is Record<string, Coordenada> =>
                    isRecord(value) &&
                    Object.values(value).every((p) => isRecord(p) && typeof p.lat === 'number' && typeof p.lon === 'number'),
            ) ?? {};
        const coordinates: Record<string, Coordenada> = { ...saved };

        sinCoords.forEach((punto) => {
            const key = normalizar(punto.municipio);
            const local = COORDS_NARINO[key] ?? Object.entries(COORDS_NARINO).find(([k]) => key.includes(k) || k.includes(key))?.[1];
            if (local && !coordinates[key]) coordinates[key] = local;
        });

        // Geocodificar los que todavía no tienen coords
        const toLookup = [...new Set(sinCoords.map((p) => p.municipio).filter((m) => !coordinates[normalizar(m)]))];
        let failures = 0;

        for (let i = 0; i < toLookup.length; i += 4) {
            const batch = toLookup.slice(i, i + 4);
            const results = await Promise.all(
                batch.map(async (city) => {
                    try {
                        const resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(`${city} Nariño Colombia`)}&limit=5`);
                        if (!resp.ok) throw new Error(`Photon ${resp.status}`);
                        const data = (await resp.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
                        const pt = data.features?.find((f) => {
                            const c = f.geometry?.coordinates;
                            return c && c[1] >= -4 && c[1] <= 13 && c[0] >= -79 && c[0] <= -66;
                        })?.geometry?.coordinates;
                        return [normalizar(city), pt ? { lat: pt[1], lon: pt[0] } : null] as const;
                    } catch {
                        failures++;
                        return [normalizar(city), null] as const;
                    }
                }),
            );
            results.forEach(([key, pt]) => { if (pt) coordinates[key] = pt; });
            setMapStatus(`Geocodificando… ${Math.min(i + batch.length, toLookup.length)} / ${toLookup.length}`);
            if (i + 4 < toLookup.length) await new Promise((r) => window.setTimeout(r, 350));
        }

        window.localStorage.setItem('rutogramas-geocode-cache', JSON.stringify(coordinates));

        // Agregar geocodificados
        sinCoords.forEach((punto) => {
            const coords = coordinates[normalizar(punto.municipio)];
            if (!coords) return;
            conCoords.push({
                lat: coords.lat,
                lon: coords.lon,
                numero: '',
                ciudad: punto.municipio,
                nivel: clasificarCriticidad(punto.criticidad),
                frecuencia: `${punto.total_visitas} visita${punto.total_visitas !== 1 ? 's' : ''}`,
                conductores: punto.conductores.map((c) => c.nombre),
                barrio: punto.barrio,
                total_visitas: punto.total_visitas,
                detalles: punto,
            });
        });

        setLocations(conCoords);
        const sinCoordsFinal = sinCoords.filter((p) => !coordinates[normalizar(p.municipio)]);
        setMapStatus(
            `${conCoords.length} lugar${conCoords.length !== 1 ? 'es' : ''} en el mapa` +
            (sinCoordsFinal.length > 0 ? `; ${sinCoordsFinal.length} sin coordenadas` : '') +
            '.',
        );
        if (failures > 0) setMapError(`No se pudo geocodificar ${failures} municipio${failures !== 1 ? 's' : ''}; los demás se muestran.`);
    }, [serverData]);

    useEffect(() => {
        void buildLocations();
    }, [buildLocations]);

    // ── Filtros del mapa ─────────────────────────────────────────────────────
    const locationsFiltradas = useMemo(() => {
        const q = normalizar(buscarLugar);
        return locations.filter((loc) => {
            const nivelOk = filtroCrit === 'todos' || loc.nivel === filtroCrit;
            const busqOk = !q || normalizar(loc.ciudad).includes(q) || normalizar(loc.barrio ?? '').includes(q);
            return nivelOk && busqOk;
        });
    }, [locations, filtroCrit, buscarLugar]);

    const conteoNivel = useMemo(() => {
        const c: Record<Nivel, number> = { alta: 0, media: 0, baja: 0 };
        locations.forEach((l) => c[l.nivel]++);
        return c;
    }, [locations]);

    if (!mapModules) {
        return (
            <div className="bg-muted text-muted-foreground flex h-[420px] items-center justify-center rounded-xl text-sm">
                {mapError ?? 'Cargando mapa…'}
            </div>
        );
    }

    const { MapContainer, TileLayer, CircleMarker, Popup, useMap } = mapModules;
    const center: [number, number] = locationsFiltradas.length
        ? [locationsFiltradas[0].lat, locationsFiltradas[0].lon]
        : [1.2136, -77.2811];

    function HeatOverlay() {
        const map = useMap();
        const filteredPoints = useMemo<[number, number, number][]>(
            () => locationsFiltradas.map(({ lat, lon, nivel }) => [lat, lon, nivel === 'alta' ? 1 : nivel === 'media' ? 0.6 : 0.3]),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [locationsFiltradas.length],
        );
        useEffect(() => {
            let layer: import('leaflet').Layer | undefined;
            let active = true;
            const add = async () => {
                const L = await import('leaflet');
                (window as typeof window & { L?: typeof L }).L = L;
                const LH = L as typeof L & { heatLayer?: (pts: [number, number, number][], opts: object) => import('leaflet').Layer };
                if (!LH.heatLayer) {
                    await new Promise<void>((res, rej) => {
                        const s = document.createElement('script');
                        s.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
                        s.onload = () => res();
                        s.onerror = () => rej(new Error('leaflet.heat no disponible'));
                        document.head.appendChild(s);
                    });
                }
                if (!LH.heatLayer) throw new Error('heatLayer ausente');
                if (active) layer = LH.heatLayer(filteredPoints, { radius: 35, blur: 25, maxZoom: 10, gradient: { 0.3: '#43a047', 0.6: '#ff6d00', 1: '#e53935' } }).addTo(map);
            };
            add().catch(() => setMapError('No se pudo cargar la capa de calor; los marcadores siguen activos.'));
            return () => { active = false; if (layer) map.removeLayer(layer); };
        }, [map, filteredPoints]);
        return null;
    }

    return (
        <div className="space-y-4">
            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    className="w-52"
                    placeholder="Buscar municipio o barrio…"
                    value={buscarLugar}
                    onChange={(e) => setBuscarLugar(e.target.value)}
                />
                <div className="flex gap-1">
                    {(['todos', 'alta', 'media', 'baja'] as const).map((nivel) => (
                        <button
                            key={nivel}
                            type="button"
                            onClick={() => setFiltroCrit(nivel)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filtroCrit === nivel ? 'text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                            style={filtroCrit === nivel && nivel !== 'todos' ? { backgroundColor: NIVEL_COLORS[nivel], borderColor: NIVEL_COLORS[nivel] } : filtroCrit === nivel ? { backgroundColor: '#334155', borderColor: '#334155' } : {}}
                        >
                            {nivel === 'todos' ? 'Todos' : etiquetaNivel(nivel)}
                            {nivel !== 'todos' && <span className="ml-1 opacity-80">({conteoNivel[nivel]})</span>}
                        </button>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void buildLocations()}>
                    <MapPinned className="size-4 mr-1" /> Actualizar
                </Button>
                <span className="ml-auto text-muted-foreground text-xs" aria-live="polite">{mapStatus}</span>
            </div>

            {mapError && <p role="status" className="text-destructive text-sm">{mapError}</p>}

            {/* Mapa */}
            <div className="overflow-hidden rounded-xl border" style={{ height: 560 }}>
                <MapContainer center={center} zoom={9} minZoom={7} maxZoom={16} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {locationsFiltradas.length > 0 && <HeatOverlay />}
                    {locationsFiltradas.map((loc, idx) => {
                        const punto = loc.detalles;
                        return (
                            <CircleMarker
                                key={`${loc.ciudad}-${idx}`}
                                center={[loc.lat, loc.lon]}
                                radius={10 + Math.min((loc.total_visitas ?? 1), 10)}
                                pathOptions={{ color: '#fff', weight: 2, fillColor: NIVEL_COLORS[loc.nivel], fillOpacity: 0.9 }}
                            >
                                <Popup maxWidth={280}>
                                    <div className="space-y-1 text-sm">
                                        <p className="font-bold text-base leading-tight">{loc.ciudad}</p>
                                        {punto?.barrio && !punto.barrio.startsWith('(') && (
                                            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                                                Barrio: {punto.barrio}
                                            </p>
                                        )}
                                        <p className="mt-1">
                                            <span
                                                className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                                                style={{ backgroundColor: NIVEL_COLORS[loc.nivel] }}
                                            >
                                                {etiquetaNivel(loc.nivel)}
                                            </span>
                                        </p>
                                        <p className="text-gray-700 text-xs">
                                            Visitas registradas: <strong>{punto?.total_visitas ?? '—'}</strong>
                                        </p>
                                        {punto && (
                                            <p className="text-xs" style={{ color: punto.coords_exactas ? '#16a34a' : '#d97706' }}>
                                                {punto.coords_exactas ? '📍 Ubicación exacta (clientes)' : '⚠ Ubicación aproximada (municipio)'}
                                            </p>
                                        )}
                                        {punto && punto.conductores.length > 0 && (
                                            <div className="mt-1 border-t pt-1">
                                                <p className="font-semibold text-xs mb-0.5">Conductores que fueron:</p>
                                                <ul className="space-y-0.5">
                                                    {punto.conductores.slice(0, 8).map((c, i) => (
                                                        <li key={i} className="flex justify-between gap-2 text-xs">
                                                            <span className="truncate">{c.nombre}</span>
                                                            <span className="text-gray-400 shrink-0">{c.visitas}×</span>
                                                        </li>
                                                    ))}
                                                    {punto.conductores.length > 8 && (
                                                        <li className="text-xs text-gray-400">+{punto.conductores.length - 8} más…</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Cards resumen */}
            {locationsFiltradas.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {locationsFiltradas.map((loc, idx) => {
                        const punto = loc.detalles;
                        return (
                            <button
                                type="button"
                                key={`card-${idx}`}
                                className="hover:bg-muted rounded-lg border p-3 text-left transition"
                                onClick={() =>
                                    setModal({
                                        titulo: `${loc.ciudad}${punto?.barrio ? ` — ${punto.barrio}` : ''}`,
                                        descripcion: `${etiquetaNivel(loc.nivel)} · ${loc.frecuencia}`,
                                        filas: [
                                            { etiqueta: 'Municipio', valor: loc.ciudad },
                                            { etiqueta: 'Barrio', valor: punto?.barrio || '—' },
                                            { etiqueta: 'Criticidad', valor: etiquetaNivel(loc.nivel) },
                                            { etiqueta: 'Visitas registradas', valor: String(punto?.total_visitas ?? '—') },
                                            ...(punto?.conductores ?? []).map((c) => ({
                                                etiqueta: `Conductor (${c.visitas}×)`,
                                                valor: c.nombre,
                                            })),
                                        ],
                                    })
                                }
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <strong className="truncate text-sm">{loc.ciudad}</strong>
                                    <span
                                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                                        style={{ backgroundColor: NIVEL_COLORS[loc.nivel] }}
                                    >
                                        {etiquetaNivel(loc.nivel)}
                                    </span>
                                </div>
                                {punto?.barrio && <span className="block text-xs text-muted-foreground truncate">{punto.barrio}</span>}
                                <span className="block text-xs text-muted-foreground mt-0.5">
                                    {loc.frecuencia} · {punto?.conductores.length ?? 0} conductor{(punto?.conductores.length ?? 0) !== 1 ? 'es' : ''}
                                    {punto && !punto.coords_exactas && <span className="text-amber-500"> · aprox.</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Modal detalle */}
            {modal && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
                    role="presentation"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="bg-background max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl p-5 shadow-xl"
                    >
                        <div className="flex justify-between">
                            <div>
                                <h3 className="font-semibold">{modal.titulo}</h3>
                                <p className="text-muted-foreground text-sm">{modal.descripcion}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setModal(null)} aria-label="Cerrar">
                                <X className="size-4" />
                            </Button>
                        </div>
                        {modal.filas.map((row, i) => (
                            <div key={`${row.etiqueta}-${i}`} className="flex justify-between gap-3 rounded border p-2 text-sm">
                                <span className="text-muted-foreground">{row.etiqueta}</span>
                                <span className="text-right font-medium">{row.valor}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
