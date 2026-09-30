import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArcElement, BarController, BarElement, CategoryScale, Chart as ChartJS, DoughnutController, Legend, LinearScale, Tooltip } from 'chart.js';
import { AlertCircle, ChevronDown, MapPinned, Search, Upload, X } from 'lucide-react';
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

const PALETTE = ['#f5a000', '#ffc107', '#ffb300', '#ff8f00', '#e65100', '#ffe082', '#ffca28', '#ffd54f', '#ffab00', '#ff6d00'];
const NIVEL_COLORS = { alta: '#e53935', media: '#ff6d00', baja: '#43a047' } as const;
const CRIT_STORAGE_KEY = 'critData';
const DRIVER_STORAGE_KEY = 'condData';
const ROUTE_STORAGE_KEY = 'rutasData';

type Nivel = 'alta' | 'media' | 'baja';
type Vista = 'rutas' | 'criticidad' | 'conductores' | 'mapa';

interface LugarRuta {
    codigo: string;
    nombre: string;
    ciudad: string;
    barrio: string;
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
    plugins: { legend: { position: 'bottom' as const } },
};

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64">{children}</div>
            </CardContent>
        </Card>
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

export default function RutogramasIndex({ vista }: { vista: Vista }) {
    const [dailyData, setDailyData] = useState<DatosDiarios>({});
    const [dailyFileName, setDailyFileName] = useState('');
    const [criticidad, setCriticidad] = useState<RutaCritica[]>([]);
    const [criticidadFileName, setCriticidadFileName] = useState('');
    const [conductores, setConductores] = useState<Conductor[]>([]);
    const [conductoresFileName, setConductoresFileName] = useState('');
    const [storageLoaded, setStorageLoaded] = useState(false);
    const [error, setError] = useState('');
    const [diaSeleccionado, setDiaSeleccionado] = useState<string>('lunes');
    const [buscarRuta, setBuscarRuta] = useState('');
    const [buscarCiudad, setBuscarCiudad] = useState('');
    const [frecuenciaSeleccionada, setFrecuenciaSeleccionada] = useState('todas');
    const [nivelSeleccionado, setNivelSeleccionado] = useState('todos');
    const [buscarConductor, setBuscarConductor] = useState('');
    const [buscarCedula, setBuscarCedula] = useState('');
    const [nivelConductor, setNivelConductor] = useState('todos');
    const [filtroCriticoRapido, setFiltroCriticoRapido] = useState<Nivel | 'todos'>('todos');
    const [filtroConductorRapido, setFiltroConductorRapido] = useState<Nivel | 'todos'>('todos');
    const [modal, setModal] = useState<DetalleModal | null>(null);

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
                setDiaSeleccionado(DIAS.find(({ key }) => data[key]?.length)?.key ?? 'lunes');
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

    const groupedRoutes = useMemo(() => agruparRutas(dailyData[diaSeleccionado] ?? []), [dailyData, diaSeleccionado]);
    const cityLabels = useMemo(() => Object.keys(groupedRoutes).sort((a, b) => a.localeCompare(b)), [groupedRoutes]);
    const neighborhoodCount = useMemo(
        () => new Set((dailyData[diaSeleccionado] ?? []).map((row) => `${row.ciudad}|${row.barrio}`)).size,
        [dailyData, diaSeleccionado],
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
                            (place) => normalizar(place.nombre).includes(query) || place.codigo.toLowerCase().includes(query),
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

    const fileInput = async (event: React.ChangeEvent<HTMLInputElement>, type: Vista) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) await readWorkbook(file, type);
    };

    const showTopNeighborhoods = () => {
        const counts = Object.values(groupedRoutes).flatMap((neighborhoods) =>
            Object.entries(neighborhoods).map(([name, places]) => [name, places.length] as const),
        );
        const totals = counts.reduce<Record<string, number>>((result, [name, count]) => {
            result[name] = (result[name] ?? 0) + count;
            return result;
        }, {});
        setModal({
            titulo: 'Barrios por cantidad de lugares',
            descripcion: `${Object.keys(totals).length} barrios · ${Object.values(totals).reduce((sum, value) => sum + value, 0)} lugares`,
            filas: Object.entries(totals)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ etiqueta: name, valor: `${count} lugares` })),
        });
    };

    const showCityDetails = (city: string, neighborhoods: Record<string, LugarRuta[]>) => {
        setModal({
            titulo: city,
            descripcion: `${Object.keys(neighborhoods).length} barrios`,
            filas: Object.entries(neighborhoods)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, places]) => ({ etiqueta: name, valor: `${places.length} lugares` })),
        });
    };

    const showNeighborhoodDetails = (city: string, neighborhood: string, places: LugarRuta[]) => {
        setModal({
            titulo: neighborhood,
            descripcion: `${city} · ${places.length} lugares`,
            filas: places.map((place) => ({ etiqueta: place.codigo ? `# ${place.codigo}` : 'Lugar', valor: place.nombre })),
        });
    };

    const showPlaceDetails = (place: LugarRuta) => {
        setModal({
            titulo: place.nombre,
            descripcion: `${place.ciudad || '(Sin ciudad)'} › ${place.barrio || '(Sin barrio)'}`,
            filas: [
                { etiqueta: 'Código', valor: place.codigo || '—' },
                { etiqueta: 'Ciudad', valor: place.ciudad || '—' },
                { etiqueta: 'Barrio', valor: place.barrio || '—' },
            ],
        });
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Rutogramas" />
            <div className="flex flex-1 flex-col gap-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Rutogramas</h1>
                    <p className="text-muted-foreground text-sm">Consulta rutas diarias, criticidad y aptitud de conductores desde archivos Excel.</p>
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
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Rutas Diarias</h2>
                                <p className="text-muted-foreground text-sm">
                                    {dailyFileName ||
                                        (Object.keys(dailyData).length
                                            ? 'Datos guardados en este navegador'
                                            : 'Cargue el Excel con las hojas de lunes a sábado.')}
                                </p>
                            </div>
                            <Label className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-medium">
                                <Upload className="size-4" /> Cargar Excel
                                <input className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => void fileInput(event, 'rutas')} />
                            </Label>
                        </div>
                        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Días de la semana">
                            {DIAS.map(({ key, label }) => {
                                const count = dailyData[key]?.length ?? 0;
                                return (
                                    <Button
                                        key={key}
                                        type="button"
                                        variant={diaSeleccionado === key ? 'default' : 'outline'}
                                        role="tab"
                                        aria-selected={diaSeleccionado === key}
                                        onClick={() => setDiaSeleccionado(key)}
                                    >
                                        {label}
                                        {count > 0 && ` (${count})`}
                                    </Button>
                                );
                            })}
                        </div>
                        {(dailyData[diaSeleccionado]?.length ?? 0) > 0 ? (
                            <>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        [
                                            'Total lugares',
                                            dailyData[diaSeleccionado]?.length ?? 0,
                                            () =>
                                                setModal({
                                                    titulo: 'Lugares por ciudad',
                                                    descripcion: `${cityLabels.length} ciudades`,
                                                    filas: cityLabels.map((city) => ({
                                                        etiqueta: city,
                                                        valor: `${Object.values(groupedRoutes[city]).flat().length} lugares`,
                                                    })),
                                                }),
                                        ],
                                        [
                                            'Ciudades',
                                            cityLabels.length,
                                            () =>
                                                setModal({
                                                    titulo: 'Ciudades',
                                                    descripcion: `${cityLabels.length} ciudades encontradas`,
                                                    filas: cityLabels.map((city) => ({ etiqueta: 'Ciudad', valor: city })),
                                                }),
                                        ],
                                        ['Barrios', neighborhoodCount, showTopNeighborhoods],
                                    ].map(([label, value, action]) => (
                                        <button
                                            type="button"
                                            key={String(label)}
                                            onClick={action as () => void}
                                            className="bg-card rounded-xl border p-5 text-center transition hover:-translate-y-0.5 hover:shadow"
                                        >
                                            <span className="block text-3xl font-bold text-amber-600">{value as number}</span>
                                            <span className="text-muted-foreground text-sm">{label as string}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <ChartPanel title="Lugares por ciudad">
                                        <Doughnut data={dailyCityChart} options={chartOptions} />
                                    </ChartPanel>
                                    <ChartPanel title="Top 8 barrios">
                                        <Bar
                                            data={{
                                                labels: topNeighborhoods.map(([name]) => name),
                                                datasets: [
                                                    { label: 'Lugares', data: topNeighborhoods.map(([, count]) => count), backgroundColor: PALETTE },
                                                ],
                                            }}
                                            options={{ ...chartOptions, indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
                                        />
                                    </ChartPanel>
                                </div>
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                                    <Input
                                        value={buscarRuta}
                                        onChange={(event) => setBuscarRuta(event.target.value)}
                                        className="pl-9"
                                        placeholder="Buscar ciudad, barrio, nombre o código..."
                                    />
                                </div>
                                <div className="space-y-3">
                                    {Object.keys(filteredCities)
                                        .sort((a, b) => a.localeCompare(b))
                                        .map((city) => {
                                            const neighborhoods = filteredCities[city];
                                            const total = Object.values(neighborhoods).reduce((sum, places) => sum + places.length, 0);
                                            return (
                                                <details key={city} className="overflow-hidden rounded-xl border border-amber-300">
                                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-amber-400 px-4 py-3 font-semibold text-amber-950">
                                                        {city}{' '}
                                                        <span className="text-sm font-normal">
                                                            {total} lugares · {Object.keys(neighborhoods).length} barrios
                                                        </span>
                                                    </summary>
                                                    <div className="space-y-3 bg-amber-50 p-3">
                                                        {Object.keys(neighborhoods)
                                                            .sort((a, b) => a.localeCompare(b))
                                                            .map((neighborhood) => {
                                                                const places = neighborhoods[neighborhood];
                                                                return (
                                                                    <details
                                                                        key={neighborhood}
                                                                        className="overflow-hidden rounded-lg border border-amber-200 bg-white"
                                                                    >
                                                                        <summary className="flex cursor-pointer list-none items-center justify-between bg-amber-100 px-3 py-2 font-medium">
                                                                            {neighborhood}
                                                                            <span className="text-muted-foreground text-xs">
                                                                                {places.length} lugares
                                                                            </span>
                                                                        </summary>
                                                                        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                                                            {places.map((place, index) => (
                                                                                <button
                                                                                    type="button"
                                                                                    key={`${place.codigo}-${place.nombre}-${index}`}
                                                                                    onClick={() => showPlaceDetails(place)}
                                                                                    className="flex items-start gap-3 rounded-lg border bg-amber-50 p-3 text-left transition hover:shadow"
                                                                                >
                                                                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                                                                                        {place.nombre
                                                                                            .split(/\s+/)
                                                                                            .slice(0, 2)
                                                                                            .map((word) => word[0] ?? '')
                                                                                            .join('')
                                                                                            .toUpperCase()}
                                                                                    </span>
                                                                                    <span className="min-w-0">
                                                                                        <span className="text-muted-foreground block text-xs">
                                                                                            # {place.codigo || '—'}
                                                                                        </span>
                                                                                        <span className="block font-medium text-amber-800">
                                                                                            {place.nombre || '(Sin nombre)'}
                                                                                        </span>
                                                                                    </span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                        <div className="border-t px-3 py-2">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => showNeighborhoodDetails(city, neighborhood, places)}
                                                                            >
                                                                                Ver detalle del barrio
                                                                            </Button>
                                                                        </div>
                                                                    </details>
                                                                );
                                                            })}
                                                    </div>
                                                    <div className="bg-background border-t px-3 py-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => showCityDetails(city, neighborhoods)}
                                                        >
                                                            Ver resumen de la ciudad
                                                        </Button>
                                                    </div>
                                                </details>
                                            );
                                        })}
                                    {Object.keys(filteredCities).length === 0 && (
                                        <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                                            No se encontraron rutas para esta búsqueda.
                                        </p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-muted-foreground rounded-xl border border-dashed p-12 text-center text-sm">
                                {Object.keys(dailyData).length
                                    ? `No se encontraron rutas para ${DIAS.find(({ key }) => key === diaSeleccionado)?.label}.`
                                    : 'Cargue un Excel que incluya las hojas de lunes a sábado para ver los rutogramas.'}
                            </div>
                        )}
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
                                <Label>Frecuencia</Label>
                                <Select value={frecuenciaSeleccionada} onValueChange={setFrecuenciaSeleccionada}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas</SelectItem>
                                        {frecuencias.map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {value}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1">
                                <Label>Criticidad</Label>
                                <Select value={nivelSeleccionado} onValueChange={setNivelSeleccionado}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todas</SelectItem>
                                        <SelectItem value="alta">Crítica Alta</SelectItem>
                                        <SelectItem value="media">Crítica Media</SelectItem>
                                        <SelectItem value="baja">Crítica Baja</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end justify-between gap-2">
                                <span className="text-muted-foreground pb-2 text-xs">
                                    {filteredCriticidad.length} de {criticidad.length} registros
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setBuscarCiudad('');
                                        setFrecuenciaSeleccionada('todas');
                                        setNivelSeleccionado('todos');
                                        setFiltroCriticoRapido('todos');
                                    }}
                                >
                                    Limpiar
                                </Button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full min-w-[650px] text-sm">
                                <thead className="bg-muted/70">
                                    <tr>
                                        {['N°', 'Ciudad', 'Población', 'Frecuencia', 'Criticidad'].map((header) => (
                                            <th key={header} className="px-4 py-3 text-left font-semibold">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCriticidad.map((row, index) => {
                                        const level = clasificarCriticidad(row.criticidad);
                                        return (
                                            <tr key={`${row.ciudad}-${index}`} className="hover:bg-muted/30 border-t">
                                                <td className="px-4 py-3">{row.numero || index + 1}</td>
                                                <td className="px-4 py-3 font-semibold">{row.ciudad}</td>
                                                <td className="px-4 py-3">{row.poblacion || '—'}</td>
                                                <td className="px-4 py-3">{row.frecuencia || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <NivelBadge nivel={level}>{etiquetaNivel(level)}</NivelBadge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredCriticidad.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-muted-foreground px-4 py-10 text-center">
                                                {criticidad.length
                                                    ? 'Sin rutas para estos filtros.'
                                                    : 'Cargue un archivo Excel para ver las rutas de criticidad.'}
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
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Aptitud de Conductores por Ruta</h2>
                                <p className="text-muted-foreground text-sm">{conductoresFileName || 'Cargue el archivo Excel de conductores.'}</p>
                            </div>
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
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        </div>
                        {conductores.length > 0 && (
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
                                    {filteredConductores.length} de {conductores.length} conductores
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
                    </section>
                )}

                {vista === 'mapa' && (
                    <section className="space-y-5">
                        <div>
                            <h2 className="text-lg font-semibold">Mapa de Calor — Rutas por Criticidad</h2>
                            <p className="text-muted-foreground text-sm">
                                La visualización usa criticidad, frecuencia y conductores por nivel de ruta.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-amber-50/60 p-3 text-sm">
                            {(['alta', 'media', 'baja'] as Nivel[]).map((level) => (
                                <span key={level} className="inline-flex items-center gap-2">
                                    <span className="size-3 rounded-full" style={{ backgroundColor: NIVEL_COLORS[level] }} />
                                    {etiquetaNivel(level)}
                                </span>
                            ))}
                        </div>
                        <RutogramasMap key={criticidad.length} critData={criticidad} driverData={conductores} />
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

function RutogramasMap({ critData, driverData }: { critData: RutaCritica[]; driverData: Conductor[] }) {
    const [mapStatus, setMapStatus] = useState('Cargue los Excel de criticidad y conductores para ver el mapa.');
    const [mapError, setMapError] = useState<string | null>(null);
    const [locations, setLocations] = useState<CiudadMapa[]>([]);
    const [mapModules, setMapModules] = useState<typeof import('react-leaflet') | null>(null);
    const [modal, setModal] = useState<DetalleModal | null>(null);
    const points = useMemo<[number, number, number][]>(
        () => locations.map(({ lat, lon, nivel }) => [lat, lon, nivel === 'alta' ? 1 : nivel === 'media' ? 0.6 : 0.3]),
        [locations],
    );

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
            console.error('No se pudo inicializar el mapa de rutogramas.', cause);
            if (active) setMapError('No fue posible cargar el mapa.');
        });
        return () => {
            active = false;
        };
    }, []);

    const buildMap = useCallback(async () => {
        if (critData.length === 0) {
            setMapError('Cargue primero el archivo de criticidad.');
            return;
        }
        setMapError(null);
        setMapStatus('Geocodificando ciudades...');
        const uniqueCities = [...new Set(critData.map((row) => row.ciudad).filter(Boolean))];
        const saved =
            readSaved<Record<string, Coordenada>>(
                'rutogramas-geocode-cache',
                (value): value is Record<string, Coordenada> =>
                    isRecord(value) &&
                    Object.values(value).every((point) => isRecord(point) && typeof point.lat === 'number' && typeof point.lon === 'number'),
            ) ?? {};
        const coordinates = { ...saved };
        uniqueCities.forEach((city) => {
            const key = normalizar(city);
            const localCoordinates =
                COORDS_NARINO[key] ?? Object.entries(COORDS_NARINO).find(([name]) => key.includes(name) || name.includes(key))?.[1];
            if (!coordinates[key] && localCoordinates) coordinates[key] = localCoordinates;
        });
        const toLookup = uniqueCities.filter((city) => !coordinates[normalizar(city)]);
        let failures = 0;
        for (let index = 0; index < toLookup.length; index += 4) {
            const batch = toLookup.slice(index, index + 4);
            const results = await Promise.all(
                batch.map(async (city) => {
                    try {
                        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(`${city} Nariño Colombia`)}&limit=5`);
                        if (!response.ok) throw new Error(`Photon respondió ${response.status}.`);
                        const result = (await response.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
                        const point = result.features?.find((feature) => {
                            const coords = feature.geometry?.coordinates;
                            return coords && coords[1] >= -4 && coords[1] <= 13 && coords[0] >= -79 && coords[0] <= -66;
                        })?.geometry?.coordinates;
                        return [normalizar(city), point ? { lat: point[1], lon: point[0] } : null] as const;
                    } catch (cause) {
                        failures += 1;
                        console.warn(`No se pudo geocodificar la ciudad ${city}.`, cause);
                        return [normalizar(city), null] as const;
                    }
                }),
            );
            results.forEach(([key, point]) => {
                if (point) coordinates[key] = point;
            });
            setMapStatus(`Geocodificando... ${Math.min(index + batch.length, toLookup.length)} / ${toLookup.length}`);
            if (index + 4 < toLookup.length) await new Promise((resolve) => window.setTimeout(resolve, 400));
        }
        window.localStorage.setItem('rutogramas-geocode-cache', JSON.stringify(coordinates));
        const driversByLevel = countDriversByLevel(driverData);
        const mapped = critData.flatMap((row, index) => {
            const point = coordinates[normalizar(row.ciudad)];
            if (!point) return [];
            const nivel = clasificarCriticidad(row.criticidad);
            return [
                {
                    ...point,
                    numero: row.numero || String(index + 1),
                    ciudad: row.ciudad,
                    nivel,
                    frecuencia: row.frecuencia,
                    conductores: driversByLevel[nivel],
                },
            ];
        });
        setLocations(mapped);
        setMapStatus(
            `${mapped.length} ciudades en el mapa${mapped.length < uniqueCities.length ? `; ${uniqueCities.length - mapped.length} sin coordenadas` : ''}.`,
        );
        if (failures > 0)
            setMapError(`No se pudo geocodificar ${failures} ${failures === 1 ? 'ciudad' : 'ciudades'}; las demás se muestran normalmente.`);
        else if (mapped.length === 0) setMapError('No se encontraron coordenadas para las ciudades del archivo.');
    }, [critData, driverData]);

    useEffect(() => {
        if (critData.length > 0 && locations.length === 0) void buildMap();
    }, [buildMap, critData.length, locations.length]);

    const modules = mapModules;
    if (!modules) {
        return (
            <div className="bg-muted text-muted-foreground flex h-[420px] items-center justify-center rounded-xl text-sm">
                {mapError ?? 'Cargando mapa...'}
            </div>
        );
    }
    const { MapContainer, TileLayer, CircleMarker, Popup, useMap } = modules;
    const center: [number, number] = locations.length ? [locations[0].lat, locations[0].lon] : [1.2136, -77.2811];

    function HeatOverlay() {
        const map = useMap();
        useEffect(() => {
            let layer: import('leaflet').Layer | undefined;
            let active = true;
            const addLayer = async () => {
                const leaflet = await import('leaflet');
                (window as typeof window & { L?: typeof leaflet }).L = leaflet;
                if (!leaflet.heatLayer) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('No fue posible cargar la capa de calor.'));
                        document.head.appendChild(script);
                    });
                }
                const leafletHeat = leaflet as typeof leaflet & {
                    heatLayer?: (
                        values: [number, number, number][],
                        options: { radius: number; blur: number; maxZoom: number; gradient: Record<number, string> },
                    ) => import('leaflet').Layer;
                };
                if (!leafletHeat.heatLayer) throw new Error('La capa de calor de Leaflet no quedó disponible.');
                if (active)
                    layer = leafletHeat
                        .heatLayer(points, { radius: 35, blur: 25, maxZoom: 10, gradient: { 0.3: '#43a047', 0.6: '#ff6d00', 1: '#e53935' } })
                        .addTo(map);
            };
            addLayer().catch((cause: unknown) => {
                console.error('No se pudo cargar la capa de calor.', cause);
                setMapError('No fue posible cargar la capa de calor; los marcadores siguen disponibles.');
            });
            return () => {
                active = false;
                if (layer) map.removeLayer(layer);
            };
        }, [map]);
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm" aria-live="polite">
                    {mapStatus}
                </span>
                <Button type="button" variant="outline" onClick={() => void buildMap()}>
                    <MapPinned className="size-4" />
                    Actualizar mapa
                </Button>
            </div>
            {mapError && (
                <p role="status" className="text-destructive text-sm">
                    {mapError}
                </p>
            )}
            <div className="overflow-hidden rounded-xl border" style={{ height: 560 }}>
                <MapContainer center={center} zoom={9} minZoom={8} maxZoom={16} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {locations.length > 0 && <HeatOverlay />}
                    {locations.map((location, index) => (
                        <CircleMarker
                            key={`${location.ciudad}-${index}`}
                            center={[location.lat, location.lon]}
                            radius={11}
                            pathOptions={{ color: '#fff', weight: 2, fillColor: NIVEL_COLORS[location.nivel], fillOpacity: 0.9 }}
                        >
                            <Popup>
                                <strong>
                                    {location.numero}. {location.ciudad}
                                </strong>
                                <p>
                                    {etiquetaNivel(location.nivel)} · {location.frecuencia || 'Sin frecuencia'}
                                </p>
                                <p>Conductores aptos: {location.conductores.length}</p>
                                {location.conductores.slice(0, 10).map((name) => (
                                    <p key={name}>{name}</p>
                                ))}
                            </Popup>
                        </CircleMarker>
                    ))}
                </MapContainer>
            </div>
            {locations.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {locations.map((location, index) => (
                        <button
                            type="button"
                            key={`${location.ciudad}-card-${index}`}
                            className="hover:bg-muted rounded-lg border p-3 text-left"
                            onClick={() =>
                                setModal({
                                    titulo: `${location.numero}. ${location.ciudad}`,
                                    descripcion: `${location.frecuencia || 'Sin frecuencia'} · ${etiquetaNivel(location.nivel)}`,
                                    filas: [
                                        { etiqueta: 'Criticidad', valor: etiquetaNivel(location.nivel) },
                                        { etiqueta: 'Frecuencia', valor: location.frecuencia || '—' },
                                        ...location.conductores.map((name) => ({ etiqueta: 'Conductor apto', valor: name })),
                                    ],
                                })
                            }
                        >
                            <strong>
                                {location.numero}. {location.ciudad}
                            </strong>
                            <span className="text-muted-foreground block text-xs">
                                {location.frecuencia || 'Sin frecuencia'} · {location.conductores.length} conductores
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {modal && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setModal(null);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="bg-background max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl p-5"
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
                        {modal.filas.map((row, index) => (
                            <div key={`${row.etiqueta}-${index}`} className="flex justify-between gap-3 rounded border p-2 text-sm">
                                <span className="text-muted-foreground">{row.etiqueta}</span>
                                <span className="text-right">{row.valor}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
