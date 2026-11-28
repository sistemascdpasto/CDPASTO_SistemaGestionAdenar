import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Calendar,
    CheckCircle2,
    CheckSquare,
    ChevronDown,
    ChevronUp,
    FileSpreadsheet,
    FileText,
    Filter,
    LoaderCircle,
    MapPin,
    Navigation,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';

// ═════════════════════════════════════════════════════════════════════════════
// Tipos
// ═════════════════════════════════════════════════════════════════════════════

interface ColaboradorOption {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    nombre_completo: string;
    cargo: string;
    area: string | null;
    centro: string | null;
}

interface VehiculoOption {
    placa: string;
    centro: string | null;
}

interface MiembroTripulacion {
    colaborador_id?: number | string;
    cedula: string;
    nombres: string;
    cargo: string;
}

interface Viaje {
    id?: string;
    lugares: string;
    barrio: string;
    destinos?: DestinoViaje[];
    cliente: string;
    peso: string;
}

interface DestinoViaje {
    lugares: string;
    barrio: string;
    hora?: string; // HH:MM opcional — si se indica aparece como "CITA HH:MM"
}

interface ViajeRegistrado {
    viaje: Viaje;
    numero: number;
}

interface RutaFormState {
    id?: number;
    placa: string;
    placa_adicional?: string; // placa extra (se muestra en rojo)
    doc_tras: string;
    cargo: string;
    tripulacion: MiembroTripulacion[];
    viajes: Viaje[];
}

interface ModulacionItemData {
    id: number;
    modulacion_id: number;
    placa: string;
    placa_adicional?: string;
    cargo?: string;
    colaborador_id?: number;
    cedula?: string;
    nombres?: string;
    doc_tras?: string;
    tripulacion?: MiembroTripulacion[];
    viajes?: Viaje[];
}

interface ModulacionNovedadData {
    id: number;
    modulacion_id: number;
    colaborador_id?: number;
    cedula?: string;
    nombres?: string;
    cargo?: string;
    observaciones?: string;
    fijo: boolean;
    permiso: boolean;
    no_asitio: boolean;
    incapacidad: boolean;
    vacaciones: boolean;
}

interface ModulacionData {
    id: number;
    fecha: string;
    ud_programado_por?: string;
    despachado_por_colaborador_id?: number;
    despachado_por_nombre?: string;
    items: ModulacionItemData[];
    novedades: ModulacionNovedadData[];
}

interface FijoInicial {
    colaborador_id?: number;
    cedula?: string;
    nombres?: string;
    cargo?: string;
    observaciones?: string;
    permiso?: boolean;
    no_asitio?: boolean;
    incapacidad?: boolean;
    vacaciones?: boolean;
}

interface Props {
    fecha: string;
    centro?: string; // opcional: centro activo enviado por el backend
    modulacion: ModulacionData | null;
    colaboradores: ColaboradorOption[];
    cargosCatalogo?: string[];
    vehiculos: VehiculoOption[];
    currentUser: string;
    readOnly?: boolean;
    exportExcel?: boolean;
    fijosIniciales?: FijoInicial[];
    isAdmin?: boolean;
}

interface EncabezadoModulacion {
    ud_programado_por?: string | null;
    despachado_por_colaborador_id?: number | null;
    despachado_por_nombre?: string | null;
}

interface ModulacionRespuesta extends EncabezadoModulacion {
    id?: number;
    items?: ModulacionItemData[];
    novedades?: ModulacionNovedadData[];
}

interface CheckFechaResponse {
    exists?: boolean;
    modulacion?: ModulacionRespuesta | null;
    fijosIniciales?: FijoInicial[];
    cargosCatalogo?: string[];
    colaboradores?: ColaboradorOption[];
    vehiculos?: VehiculoOption[];
}

interface UltimaRutaPlacaResponse {
    found: boolean;
    fecha_origen?: string;
    doc_tras?: string | null;
    cargo?: string | null;
    tripulacion?: MiembroTripulacion[];
    viajes?: Viaje[];
}

interface OpcionUbicacion {
    id: string;
    nombre: string;
}

type Centro = 'UC' | 'UD';
type CampoNovedad = 'permiso' | 'no_asitio' | 'incapacidad' | 'vacaciones';

interface ClaveColaborador {
    id: string;
    cedula: string;
}

interface ReferenciaColaborador {
    colaborador_id?: number | string | null;
    cedula?: string | null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Constantes
// ═════════════════════════════════════════════════════════════════════════════

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Planeación ruta', href: '/modules/reparto/modulacion' },
];

// Despachador por defecto
const DESPACHADO_POR_DEFECTO = 'Jhon alexander rojas muñoz 10041925516';

// Acento del módulo Reparto (usado con moderación, igual que en Seguridad)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ACCENT = '#D4102A';

const HEADERS_JSON = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } as const;

const ORDINALES = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];

/** Tipos de novedad: una sola definición para tabla, tarjetas de pendientes y Excel. */
const CAMPOS_NOVEDAD: { campo: CampoNovedad; encabezado: string; etiqueta: string; idSufijo: string; excel: string }[] = [
    { campo: 'permiso', encabezado: 'Permiso', etiqueta: 'Permiso', idSufijo: 'permiso', excel: 'PERMISO' },
    { campo: 'no_asitio', encabezado: 'No Asistio', etiqueta: 'No Asistió', idSufijo: 'no-asistio', excel: 'NO ASISTIO' },
    { campo: 'incapacidad', encabezado: 'Incapacidad', etiqueta: 'Incapacidad', idSufijo: 'incapacidad', excel: 'INCAPACIDAD' },
    { campo: 'vacaciones', encabezado: 'Vacaciones', etiqueta: 'Vacaciones', idSufijo: 'vacaciones', excel: 'VACACIONES' },
];

const NUEVA_NOVEDAD_VACIA = {
    colaborador_id: '',
    cedula: '',
    nombres: '',
    cargo: '',
    observaciones: '',
    permiso: false,
    no_asitio: false,
    incapacidad: false,
    vacaciones: false,
};

// ═════════════════════════════════════════════════════════════════════════════
// Helpers puros
// ═════════════════════════════════════════════════════════════════════════════

const normalizar = (valor: string | null | undefined): string => (valor ?? '').trim().toUpperCase();

const esCentroValido = (centro: string | null | undefined): centro is Centro => centro === 'UC' || centro === 'UD';

const perteneceAlCentro = (centro: string | null | undefined, filtro: string): boolean => normalizar(centro) === normalizar(filtro);

/**
 * REGLA ÚNICA UC/UD: algo es "ajeno" si tiene un centro válido (UC/UD) distinto al centro activo.
 * Se usa para rutas, placas, tripulantes y novedades.
 */
const esCentroAjeno = (centroActivo: string, centro: string | null | undefined): boolean => {
    const c = normalizar(centro);
    return esCentroValido(c) && c !== normalizar(centroActivo);
};

const mismoTexto = (a: string, b: string): boolean => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

const sinTildes = (valor: string): string => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getCsrfToken = (): string =>
    (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';

const fechaLocalHoy = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const leerPlacaDeUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    const placa = new URLSearchParams(window.location.search).get('placa');
    return placa ? placa.toUpperCase() : null;
};

/** Centro activo que viene en la URL (?centro=UC|UD), o '' si no hay uno válido. */
const leerCentroDeUrl = (): Centro | '' => {
    if (typeof window === 'undefined') return '';
    const centro = normalizar(new URLSearchParams(window.location.search).get('centro'));
    return esCentroValido(centro) ? centro : '';
};

// Generador de IDs con respaldo
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const cleanString = (val: unknown, fallback: string = '') => {
    if (val === null || val === undefined || val === 'undefined' || val === 'null') return fallback;
    return String(val);
};

const esPersonalOperativoDeRuta = (area: string | null | undefined): boolean => sinTildes(normalizar(area)) === 'OPERATIVA';

const claveDeColaborador = (col: Pick<ColaboradorOption, 'id' | 'cedula'>): ClaveColaborador => ({
    id: String(col.id).trim(),
    cedula: col.cedula ? String(col.cedula).trim() : '',
});

/** ¿La referencia (miembro de tripulación o novedad) corresponde al colaborador por id o cédula? */
const coincideConColaborador = (ref: ReferenciaColaborador, clave: ClaveColaborador): boolean =>
    Boolean(
        (ref.colaborador_id && String(ref.colaborador_id).trim() === clave.id) ||
            (ref.cedula && clave.cedula !== '' && String(ref.cedula).trim() === clave.cedula),
    );

const crearViajeVacio = (): Viaje => ({ lugares: '', barrio: '', cliente: '', peso: '' });

// Crear ruta en blanco
const createEmptyRoute = (): RutaFormState => ({
    placa: '',
    doc_tras: '',
    cargo: '',
    tripulacion: [],
    viajes: [],
});

const obtenerDestinosViaje = (viaje: Viaje): DestinoViaje[] =>
    viaje.destinos?.length
        ? viaje.destinos
        : viaje.lugares || viaje.barrio
          ? [{ lugares: viaje.lugares, barrio: viaje.barrio }]
          : [];

const viajeTieneDatos = (viaje: Pick<Viaje, 'cliente' | 'peso'>, destinos: DestinoViaje[]): boolean =>
    destinos.some((destino) => destino.lugares.trim() !== '' || destino.barrio.trim() !== '') ||
    viaje.cliente.trim() !== '' ||
    viaje.peso.trim() !== '';

/** Destinos del formulario: los pendientes o, si no hay, el municipio/barrio escrito. */
const construirDestinos = (formulario: Viaje, pendientes: DestinoViaje[]): DestinoViaje[] => {
    if (pendientes.length > 0) return pendientes;
    const lugares = formulario.lugares.trim();
    const barrio = formulario.barrio.trim();
    return lugares || barrio ? [{ lugares, barrio }] : [];
};

/** Campos de un viaje a partir del formulario y sus destinos. */
const camposViaje = (formulario: Viaje, destinos: DestinoViaje[]): Omit<Viaje, 'id'> => ({
    lugares: destinos[0]?.lugares ?? formulario.lugares,
    barrio: destinos[0]?.barrio ?? formulario.barrio,
    destinos: destinos.length > 0 ? destinos : undefined,
    cliente: formulario.cliente || '',
    peso: formulario.peso || '',
});

const combinarViajes = (...listas: Viaje[][]): Viaje[] => {
    const viajes: Viaje[] = [];
    const ids = new Set<string>();

    listas.flat().forEach((viaje) => {
        if (viaje.id && ids.has(viaje.id)) return;
        if (viaje.id) ids.add(viaje.id);
        viajes.push(viaje);
    });

    return viajes;
};

const formatearDestino = (destino: DestinoViaje): string =>
    destino.barrio ? `${destino.lugares} — ${destino.barrio}` : destino.lugares;

const tituloViaje = (numero: number): string => `${ORDINALES[numero - 1] ?? `Viaje ${numero}`} viaje`;

const mapModulacionItems = (items: ModulacionItemData[]): RutaFormState[] =>
    items.map((item) => ({
        id: item.id,
        placa: item.placa,
        placa_adicional: item.placa_adicional ?? '',
        doc_tras: item.doc_tras ?? '',
        cargo: item.cargo ?? '',
        tripulacion: item.tripulacion ?? [],
        viajes: (item.viajes ?? []).map((viaje, index) => ({
            ...viaje,
            lugares: viaje.lugares ?? '',
            barrio: viaje.barrio ?? '',
            destinos: viaje.destinos?.map((destino) => ({
                lugares: destino.lugares ?? '',
                barrio: destino.barrio ?? '',
            })),
            cliente: viaje.cliente ?? '',
            peso: viaje.peso ?? '',
            id: viaje.id ?? `srv-${item.id}-v${index}`,
        })),
    }));

const novedadesDesdeFijos = (fijos: FijoInicial[] | undefined): ModulacionNovedadData[] =>
    (fijos ?? []).map((f, i) => ({
        id: -(i + 1),
        modulacion_id: 0,
        colaborador_id: f.colaborador_id,
        cedula: f.cedula,
        nombres: f.nombres,
        cargo: f.cargo,
        observaciones: f.observaciones ?? '',
        fijo: true,
        permiso: f.permiso ?? false,
        no_asitio: f.no_asitio ?? false,
        incapacidad: f.incapacidad ?? false,
        vacaciones: f.vacaciones ?? false,
    }));

const leerEncabezado = (m: EncabezadoModulacion | null | undefined, currentUser: string) => ({
    udProgramadoPor: cleanString(m?.ud_programado_por, cleanString(currentUser, '')),
    despachadoPorId: m?.despachado_por_colaborador_id ? String(m.despachado_por_colaborador_id) : '',
    despachadoPorNombre: cleanString(m?.despachado_por_nombre, DESPACHADO_POR_DEFECTO),
});

// ═════════════════════════════════════════════════════════════════════════════
// Acceso a la API
// ═════════════════════════════════════════════════════════════════════════════

async function fetchJson(url: string, signal?: AbortSignal): Promise<{ response: Response; json: Record<string, unknown> | null }> {
    const response = await fetch(url, { headers: HEADERS_JSON, credentials: 'same-origin', signal });
    const esJson = response.headers.get('content-type')?.includes('application/json');
    const json = esJson ? ((await response.json()) as Record<string, unknown>) : null;
    return { response, json };
}

/** El centro es SIEMPRE parte de la consulta: el backend solo debe devolver datos de ese centro. */
async function consultarPlaneacion(fecha: string, centro: string, signal?: AbortSignal): Promise<CheckFechaResponse | null> {
    const params = new URLSearchParams({ fecha, centro });

    const res = await fetch(`/modules/reparto/modulacion/check-fecha?${params.toString()}`, {
        headers: HEADERS_JSON,
        credentials: 'same-origin',
        signal,
    });
    if (!res.ok) {
        console.error('Error checkFecha HTTP:', res.status);
        return null;
    }
    return (await res.json()) as CheckFechaResponse;
}

function parseOpcionesUbicacion(value: unknown): OpcionUbicacion[] {
    if (!Array.isArray(value)) {
        throw new Error('El servidor devolvió una lista de ubicaciones con formato inválido.');
    }

    return value.map((opcion: unknown) => {
        if (
            typeof opcion !== 'object' ||
            opcion === null ||
            !('id' in opcion) ||
            !('nombre' in opcion) ||
            (typeof opcion.id !== 'string' && typeof opcion.id !== 'number') ||
            typeof opcion.nombre !== 'string'
        ) {
            throw new Error('El servidor devolvió una ubicación con formato inválido.');
        }

        return { id: String(opcion.id), nombre: opcion.nombre };
    });
}

async function guardarReferenciaUbicacion(url: string, payload: Record<string, string>): Promise<OpcionUbicacion> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...HEADERS_JSON,
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify(payload),
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const json = isJson ? ((await response.json()) as { data?: unknown; message?: unknown }) : null;

    if (!response.ok) {
        throw new Error(
            typeof json?.message === 'string'
                ? json.message
                : response.status === 419
                  ? 'La sesión ha expirado. Por favor recargue la página.'
                  : `El servidor respondió HTTP ${response.status}.`,
        );
    }

    if (!json || !json.data) {
        throw new Error('El servidor devolvió una respuesta sin datos.');
    }

    return parseOpcionesUbicacion([json.data])[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// Exportación a Excel (función pura, fuera del componente)
// ═════════════════════════════════════════════════════════════════════════════

type RangoExcel = { s: { r: number; c: number }; e: { r: number; c: number } };

const EXCEL_COLORES = {
    AZUL_OSCURO: '1F3864', // Encabezados (fondo azul marino)
    AZUL_CLARO_NOMBRES: 'B4C6E7', // Fondo columna NOMBRE en novedades
    CONDUCTOR: '4472C4', // Azul
    RESPONSABLE: 'FFD700', // Amarillo
    TEXTO_RESPONSABLE: '1565C0', // Texto azul para Responsable de Reparto
    AUXILIAR: 'D9D9D9', // Gris
    OTRO_CARGO: 'FFFFFF', // Blanco
    PLACA: '000000', // Fondo placa principal
    PLACA_ADICIONAL: 'CC0000', // Fondo placa adicional
};

const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Color según cargo (no por posición). */
const colorPorCargo = (cargo: string): string => {
    if (cargo.includes('CONDUCTOR')) return EXCEL_COLORES.CONDUCTOR;
    if (cargo.includes('RESPONSABLE')) return EXCEL_COLORES.RESPONSABLE;
    if (cargo.includes('AUXILIAR')) return EXCEL_COLORES.AUXILIAR;
    return EXCEL_COLORES.OTRO_CARGO;
};

const etiquetaViajeExcel = (indice: number): string =>
    indice === 0 ? '1ER VIAJE' : indice === 1 ? '2DO VIAJE' : `${indice + 1}° VIAJE`;

const contenidoViajeExcel = (viaje: Viaje | undefined): string => {
    if (!viaje) return '';
    return obtenerDestinosViaje(viaje)
        .map((destino) => {
            const municipio = destino.lugares.trim().toLocaleUpperCase('es');
            const barrio = destino.barrio.trim().toLocaleUpperCase('es');
            const hora = destino.hora?.trim() ?? '';
            const citaLinea = hora ? `\nCITA ${hora}` : '';

            if (sinTildes(municipio) === 'PASTO') return barrio ? `• ${barrio}${citaLinea}` : '';
            if (!municipio && !barrio) return '';
            return `• ${municipio}${barrio ? `\n  BARRIOS: ${barrio}` : ''}${citaLinea}`;
        })
        .filter(Boolean)
        .join('\n');
};

const crearCelda = (v: unknown, s?: XLSX.CellStyle): XLSX.CellObject => {
    const value: XLSX.CellObject['v'] =
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v instanceof Date ? v : String(v ?? '');
    const t: 's' | 'n' | 'b' = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's';
    const out: XLSX.CellObject = { t, v: value };
    if (s) out.s = s;
    return out;
};

interface ExportarExcelParams {
    rutas: RutaFormState[];
    novedades: ModulacionNovedadData[];
    fechaTexto: string;
    centro: string;
    udProgramadoPor: string;
    despachadoPorNombre: string;
    totalRutas: number;
}

function exportarPlaneacionExcel({ rutas, novedades, fechaTexto, centro, udProgramadoPor, despachadoPorNombre, totalRutas }: ExportarExcelParams) {
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};
    const merges: RangoExcel[] = [];

    const setCell = (r: number, c: number, v: unknown, s?: XLSX.CellStyle) => {
        ws[XLSX.utils.encode_cell({ r, c })] = crearCelda(v, s);
    };
    const merge = (r1: number, c1: number, r2: number, c2: number) => {
        if (r1 !== r2 || c1 !== c2) merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    };
    /** Escribe `valor` en la primera fila, celdas vacías con el mismo estilo en el resto y combina verticalmente. */
    const llenarBloque = (fila: number, col: number, numFilas: number, valor: unknown, estilo: XLSX.CellStyle) => {
        for (let f = 0; f < numFilas; f++) setCell(fila + f, col, f === 0 ? valor : '', estilo);
        merge(fila, col, fila + numFilas - 1, col);
    };

    // ─── Estilos ────────────────────────────────────────────────
    const BORDER_THIN = {
        top: { style: 'thin' as const, color: { rgb: 'FF000000' } },
        bottom: { style: 'thin' as const, color: { rgb: 'FF000000' } },
        left: { style: 'thin' as const, color: { rgb: 'FF000000' } },
        right: { style: 'thin' as const, color: { rgb: 'FF000000' } },
    };
    const FONT_HEADER = { bold: true, color: { rgb: 'FFFFFF' }, sz: 14, name: 'Calibri' };
    const FONT_BODY = { sz: 14, name: 'Calibri', color: { rgb: '000000' } };
    const FONT_BODY_BOLD = { ...FONT_BODY, bold: true };
    const FONT_BLANCO_BOLD = { sz: 14, name: 'Calibri', bold: true, color: { rgb: 'FFFFFF' } };
    const ALIGN_CENTER = { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true };
    const ALIGN_LEFT = { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true };
    const relleno = (rgb: string) => ({ patternType: 'solid' as const, fgColor: { rgb } });

    const estiloAzul: XLSX.CellStyle = { fill: relleno(EXCEL_COLORES.AZUL_OSCURO), border: BORDER_THIN };
    const styleHeaderBase: XLSX.CellStyle = { ...estiloAzul, font: FONT_HEADER, alignment: ALIGN_CENTER };
    const styleHeaderRotated = (deg: number): XLSX.CellStyle => ({
        ...styleHeaderBase,
        alignment: { ...ALIGN_CENTER, textRotation: deg },
    });
    const estiloPlacaPrincipal: XLSX.CellStyle = { font: FONT_BLANCO_BOLD, fill: relleno(EXCEL_COLORES.PLACA), alignment: ALIGN_CENTER, border: BORDER_THIN };
    const estiloPlacaAdicional: XLSX.CellStyle = { ...estiloPlacaPrincipal, fill: relleno(EXCEL_COLORES.PLACA_ADICIONAL) };
    const estiloDocTras: XLSX.CellStyle = { font: FONT_BODY_BOLD, alignment: { ...ALIGN_CENTER, textRotation: 60 }, border: BORDER_THIN };
    const estiloCentrado: XLSX.CellStyle = { font: FONT_BODY, alignment: ALIGN_CENTER, border: BORDER_THIN };
    const estiloCentradoBold: XLSX.CellStyle = { font: FONT_BODY_BOLD, alignment: ALIGN_CENTER, border: BORDER_THIN };
    const estiloViaje: XLSX.CellStyle = { font: FONT_BODY_BOLD, alignment: ALIGN_LEFT, border: BORDER_THIN };
    const estiloNombreNovedad: XLSX.CellStyle = { fill: relleno(EXCEL_COLORES.AZUL_CLARO_NOMBRES), font: FONT_BODY, alignment: ALIGN_LEFT, border: BORDER_THIN };

    // ─── Columnas ───────────────────────────────────────────────
    const maxViajes = Math.max(1, ...rutas.map((r) => (r.viajes || []).length));
    const COL = { PLACA: 0, DOC_TRAS: 1, TRIP_COLOR: 2, TRIP_NOMBRE: 3, REUNION: 4, PRIMER_VIAJE: 5 };
    const COL_CLIENTE = COL.PRIMER_VIAJE + maxViajes;
    const COL_PESO = COL_CLIENTE + 1;
    const TOTAL_COLS = COL_PESO + 1;

    // ─── Fecha (en hora LOCAL para evitar desfase UTC) ──────────
    const fechaDate = new Date(`${fechaTexto || fechaLocalHoy()}T00:00:00`);
    const textoFecha = `${DIAS_SEMANA[fechaDate.getDay()] ?? ''} ${fechaDate.getDate()} ${MESES[fechaDate.getMonth()] ?? ''} ${fechaDate.getFullYear()}`;
    const textoRutas = `${totalRutas} RUTA${totalRutas === 1 ? '' : 'S'} - ${textoFecha}`;

    // ─── Filas 0 y 1: cantidad de rutas, PROGRAMADO POR y DESPACHADO POR ───
    for (let c = 0; c < TOTAL_COLS; c++) {
        setCell(0, c, '', estiloAzul);
        setCell(1, c, '', estiloAzul);
    }
    setCell(0, 0, textoRutas, styleHeaderBase);
    setCell(0, COL.PRIMER_VIAJE, `PROGRAMADO POR **${(udProgramadoPor || '').toUpperCase()}**`, styleHeaderBase);
    setCell(1, COL.PRIMER_VIAJE, `DESPACHADO POR **${(despachadoPorNombre || '').toUpperCase()}**`, styleHeaderBase);
    merge(0, 0, 1, COL.REUNION);
    merge(0, COL.PRIMER_VIAJE, 0, COL_PESO);
    merge(1, COL.PRIMER_VIAJE, 1, COL_PESO);

    // ─── Fila 2: encabezados ────────────────────────────────────
    setCell(2, COL.PLACA, 'PLACA', styleHeaderBase);
    setCell(2, COL.DOC_TRAS, 'DOC.T RAS', styleHeaderRotated(60));
    setCell(2, COL.TRIP_COLOR, '', styleHeaderBase);
    setCell(2, COL.TRIP_NOMBRE, 'TRIPULACION', styleHeaderBase);
    setCell(2, COL.REUNION, 'REUNION', styleHeaderRotated(90));
    for (let v = 0; v < maxViajes; v++) setCell(2, COL.PRIMER_VIAJE + v, etiquetaViajeExcel(v), styleHeaderBase);
    setCell(2, COL_CLIENTE, 'CLIENTE', styleHeaderRotated(90));
    setCell(2, COL_PESO, 'PESO', styleHeaderRotated(90));

    // ─── Filas de rutas (una fila por tripulante) ───────────────
    const rowHeights: { hpt: number }[] = [{ hpt: 30 }, { hpt: 30 }, { hpt: 66 }];
    let currentRow = 3;

    rutas.forEach((r) => {
        const tripulacion = r.tripulacion || [];
        const viajes = r.viajes || [];
        const r0 = currentRow;

        const cantidadClientes = parseInt(viajes.find((v) => v.cliente.trim() !== '')?.cliente ?? '', 10) || 0;
        const pesoRuta = parseFloat(viajes.find((v) => v.peso.trim() !== '')?.peso ?? '') || 0;
        const numFilasMerge = Math.max(tripulacion.length, 1);
        // La placa adicional agrega UNA fila extra al final, visible solo en la columna de placa
        const placaAdicional = normalizar(r.placa_adicional);
        const numFilasPlaca = placaAdicional ? numFilasMerge + 1 : numFilasMerge;

        // PLACA principal (fondo negro) + placa adicional en su propia fila (fondo rojo)
        llenarBloque(r0, COL.PLACA, numFilasMerge, normalizar(r.placa), estiloPlacaPrincipal);
        if (placaAdicional) setCell(r0 + numFilasMerge, COL.PLACA, placaAdicional, estiloPlacaAdicional);

        llenarBloque(r0, COL.DOC_TRAS, numFilasPlaca, r.doc_tras || '', estiloDocTras);

        // TRIPULANTES: columna de color + nombre
        for (let t = 0; t < numFilasPlaca; t++) {
            const cargo = (tripulacion[t]?.cargo || '').toUpperCase();
            const nombre = (tripulacion[t]?.nombres || '').toUpperCase();
            const colorTexto = cargo.includes('RESPONSABLE') ? { color: { rgb: EXCEL_COLORES.TEXTO_RESPONSABLE } } : {};

            setCell(r0 + t, COL.TRIP_COLOR, '', { fill: relleno(colorPorCargo(cargo)), border: BORDER_THIN });
            setCell(r0 + t, COL.TRIP_NOMBRE, nombre, {
                font: { ...FONT_BODY_BOLD, ...colorTexto },
                alignment: ALIGN_LEFT,
                border: BORDER_THIN,
            });
        }

        llenarBloque(r0, COL.REUNION, numFilasPlaca, '', estiloCentrado);

        for (let v = 0; v < maxViajes; v++) {
            llenarBloque(r0, COL.PRIMER_VIAJE + v, numFilasPlaca, contenidoViajeExcel(viajes[v]), estiloViaje);
        }

        llenarBloque(r0, COL_CLIENTE, numFilasPlaca, cantidadClientes > 0 ? cantidadClientes : '', estiloCentradoBold);
        llenarBloque(r0, COL_PESO, numFilasPlaca, pesoRuta > 0 ? parseFloat(pesoRuta.toFixed(1)) : '', estiloCentradoBold);

        // Alturas
        const maxLineasDestino = Math.max(
            1,
            ...viajes.map((viaje) =>
                obtenerDestinosViaje(viaje).reduce(
                    (total, d) => total + Number(Boolean(d.lugares.trim())) + Number(Boolean(d.barrio.trim())),
                    0,
                ),
            ),
        );
        const alturaFila = Math.min(409, Math.max(28, Math.ceil((maxLineasDestino * 22 + 10) / numFilasMerge)));
        for (let t = 0; t < numFilasMerge; t++) rowHeights.push({ hpt: alturaFila });
        if (placaAdicional) rowHeights.push({ hpt: 28 });

        currentRow += numFilasPlaca;
    });

    // ─── Tabla de NOVEDADES, 2 filas debajo de las rutas ────────
    // [0-1] NOMBRE (merge) · [2-3] OBSERVACIONES (merge) · [4..7] tipos de novedad
    const COL_NOV = { NOMBRE: 0, OBS: 2, PRIMER_TIPO: 4 };
    const TOTAL_COLS_NOV = COL_NOV.PRIMER_TIPO + CAMPOS_NOVEDAD.length;
    const rowInicioNovedades = currentRow + 2;
    const rowDatosNovedades = rowInicioNovedades + 1;

    const celdaDoble = (fila: number, col: number, valor: unknown, estilo: XLSX.CellStyle) => {
        setCell(fila, col, valor, estilo);
        setCell(fila, col + 1, '', estilo);
        merge(fila, col, fila, col + 1);
    };

    celdaDoble(rowInicioNovedades, COL_NOV.NOMBRE, 'NOMBRE', styleHeaderBase);
    celdaDoble(rowInicioNovedades, COL_NOV.OBS, 'OBSERVACIONES', styleHeaderBase);
    CAMPOS_NOVEDAD.forEach(({ excel }, i) => setCell(rowInicioNovedades, COL_NOV.PRIMER_TIPO + i, excel, styleHeaderBase));

    novedades.forEach((novedad, i) => {
        const r = rowDatosNovedades + i;
        celdaDoble(r, COL_NOV.NOMBRE, (novedad.nombres || '').trim().toLocaleUpperCase('es'), estiloNombreNovedad);
        celdaDoble(r, COL_NOV.OBS, novedad.observaciones || '', estiloNombreNovedad);
        CAMPOS_NOVEDAD.forEach(({ campo }, j) => setCell(r, COL_NOV.PRIMER_TIPO + j, novedad[campo] ? 'X' : '', estiloCentradoBold));
    });

    while (rowHeights.length < rowInicioNovedades) rowHeights.push({ hpt: 16 });
    rowHeights.push({ hpt: 28 });
    novedades.forEach((n) => {
        rowHeights.push({ hpt: Math.min(90, Math.max(28, Math.ceil((n.observaciones || '').length / 50) * 22)) });
    });

    // ─── Configuración final de la hoja ─────────────────────────
    const lastRowNovedades = rowDatosNovedades + Math.max(novedades.length - 1, 0);
    ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(currentRow + 1, lastRowNovedades), c: Math.max(TOTAL_COLS, TOTAL_COLS_NOV) - 1 },
    });
    ws['!merges'] = merges;

    const colWidths: { wch: number }[] = [{ wch: 18 }, { wch: 16 }, { wch: 3 }, { wch: 46 }, { wch: 11 }];
    for (let v = 0; v < maxViajes; v++) colWidths.push({ wch: 36 });
    colWidths.push({ wch: 16 }, { wch: 12 });
    while (colWidths.length < 10) colWidths.push({ wch: 11 });
    ws['!cols'] = colWidths;
    ws['!rows'] = rowHeights;

    XLSX.utils.book_append_sheet(wb, ws, 'Planeación de Ruta');
    XLSX.writeFile(wb, `Planeacion_Ruta_${centro}_${fechaTexto || fechaLocalHoy()}.xlsx`);
}

// ═════════════════════════════════════════════════════════════════════════════
// Subcomponentes de destinos
// ═════════════════════════════════════════════════════════════════════════════

function ListaDestinos({ destinos }: { destinos: DestinoViaje[] }) {
    return (
        <ul className="space-y-1">
            {destinos.map((destino, i) => (
                <li key={`${destino.lugares}-${destino.barrio}-${i}`} className="break-words">
                    <span className="mr-1" aria-hidden="true">•</span>
                    {formatearDestino(destino)}
                </li>
            ))}
        </ul>
    );
}

function ListaHoras({ destinos, prefijo }: { destinos: DestinoViaje[]; prefijo: string }) {
    return (
        <ul className="space-y-1">
            {destinos.map((destino, i) => (
                <li key={`${prefijo}-${i}`}>
                    {destino.hora ? <span className="font-semibold">{destino.hora}</span> : <span className="text-muted-foreground">—</span>}
                </li>
            ))}
        </ul>
    );
}

interface NarinoMunicipioInputProps {
    value: string;
    onChange: (val: string) => void;
    barrio: string;
    onBarrioChange: (val: string) => void;
    horaDestino: string;
    onHoraDestinoChange: (val: string) => void;
    puedeAgregarViaje: boolean;
    viajesRegistrados: ViajeRegistrado[];
    destinosPendientes: DestinoViaje[];
    numeroViajePendiente: number;
    onDestinoAgregado: (destino: DestinoViaje) => void;
    onEliminarDestinoPendiente: (destinoIndex: number) => void;
    onEliminarViaje?: (viajeIndex: number) => void;
}

function NarinoMunicipioInput({
    value,
    onChange,
    barrio,
    onBarrioChange,
    horaDestino,
    onHoraDestinoChange,
    puedeAgregarViaje,
    viajesRegistrados,
    destinosPendientes,
    numeroViajePendiente,
    onDestinoAgregado,
    onEliminarDestinoPendiente,
    onEliminarViaje,
}: NarinoMunicipioInputProps) {
    const baseId = useId();
    const [municipioInput, setMunicipioInput] = useState(value);
    const [barrioInput, setBarrioInput] = useState(barrio);
    const ultimoMunicipioRef = useRef(value);
    const ultimoBarrioRef = useRef(barrio);
    const [municipios, setMunicipios] = useState<OpcionUbicacion[]>([]);
    const [barrios, setBarrios] = useState<OpcionUbicacion[]>([]);
    const [barriosReloadToken, setBarriosReloadToken] = useState(0);
    const [municipiosLoading, setMunicipiosLoading] = useState(true);
    const [barriosLoading, setBarriosLoading] = useState(false);
    const [municipioGuardando, setMunicipioGuardando] = useState(false);
    const [barrioGuardando, setBarrioGuardando] = useState(false);
    const [ubicacionesError, setUbicacionesError] = useState('');

    // Sincronizar inputs locales cuando el padre cambia el valor
    useEffect(() => {
        if (ultimoMunicipioRef.current !== value) {
            ultimoMunicipioRef.current = value;
            setMunicipioInput(value);
        }
    }, [value]);

    useEffect(() => {
        if (ultimoBarrioRef.current !== barrio) {
            ultimoBarrioRef.current = barrio;
            setBarrioInput(barrio);
        }
    }, [barrio]);

    // Cargar catálogo de municipios
    useEffect(() => {
        const controller = new AbortController();
        const loadUbicaciones = async () => {
            try {
                const { response, json } = await fetchJson(route('reparto.modulacion.referencias.municipios'), controller.signal);
                if (!response.ok || !json) {
                    const detalle = typeof json?.message === 'string' ? json.message : `el servidor respondió HTTP ${response.status}`;
                    throw new Error(`No se pudieron cargar los municipios: ${detalle}`);
                }
                if (controller.signal.aborted) return;
                setMunicipios(parseOpcionesUbicacion(json.data));
                setUbicacionesError('');
            } catch (error) {
                if (controller.signal.aborted) return;
                setUbicacionesError(error instanceof Error ? error.message : 'No se pudieron cargar las ubicaciones.');
            } finally {
                if (!controller.signal.aborted) setMunicipiosLoading(false);
            }
        };

        void loadUbicaciones();
        return () => controller.abort();
    }, []);

    const municipioSeleccionado = municipios.find((m) => mismoTexto(m.nombre, municipioInput.trim()));
    const municipioSeleccionadoId = municipioSeleccionado?.id;
    const barrioNuevo = barrioInput.trim() !== '' && !barrios.some((opcion) => mismoTexto(opcion.nombre, barrioInput.trim()));

    // Cargar barrios del municipio seleccionado
    useEffect(() => {
        if (!municipioSeleccionadoId) {
            setBarrios([]);
            setBarriosLoading(false);
            return;
        }

        const controller = new AbortController();
        const loadBarrios = async () => {
            setBarrios([]);
            setUbicacionesError('');
            setBarriosLoading(true);
            try {
                const { response, json } = await fetchJson(
                    route('reparto.modulacion.referencias.barrios', { municipio_id: municipioSeleccionadoId }),
                    controller.signal,
                );
                if (!response.ok || !json) throw new Error('No se pudieron cargar los barrios del municipio.');
                let data = json.data;
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    data = (data as { data?: unknown }).data;
                }
                const opcionesBarrios = parseOpcionesUbicacion(data);
                if (!controller.signal.aborted) setBarrios(opcionesBarrios);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setUbicacionesError(error instanceof Error ? error.message : 'No se pudieron cargar los barrios.');
                }
            } finally {
                if (!controller.signal.aborted) setBarriosLoading(false);
            }
        };

        void loadBarrios();
        return () => controller.abort();
    }, [municipioSeleccionadoId, barriosReloadToken]);

    /** Devuelve el municipio del catálogo, lo registra si no existe, o crea uno local si falla el registro. */
    const resolverMunicipio = async (nombre: string): Promise<{ municipio: OpcionUbicacion; registrado: boolean }> => {
        if (municipioSeleccionado) return { municipio: municipioSeleccionado, registrado: false };
        try {
            const municipio = await guardarReferenciaUbicacion(route('reparto.modulacion.referencias.municipios.registrar'), { nombre });
            return { municipio, registrado: true };
        } catch (err) {
            console.warn('No se pudo registrar la referencia del municipio en el catálogo:', err);
            return { municipio: { id: nombre.toLowerCase().replace(/\s+/g, '-'), nombre }, registrado: false };
        }
    };

    const fijarMunicipio = (municipio: OpcionUbicacion) => {
        setMunicipios((actuales) => [
            ...actuales.filter((o) => o.id !== municipio.id && !mismoTexto(o.nombre, municipio.nombre)),
            municipio,
        ]);
        setMunicipioInput(municipio.nombre);
        ultimoMunicipioRef.current = municipio.nombre;
        onChange(municipio.nombre);
    };

    const limpiarBarrio = () => {
        setBarrioInput('');
        ultimoBarrioRef.current = '';
        onBarrioChange('');
    };

    const nuevoDestino = (lugares: string, nombreBarrio: string): DestinoViaje => ({
        lugares,
        barrio: nombreBarrio,
        hora: horaDestino.trim() || undefined,
    });

    const agregarMunicipioAlViaje = async () => {
        const nombreMunicipio = municipioInput.trim();
        if (!nombreMunicipio) return;

        setMunicipioGuardando(true);
        setUbicacionesError('');
        try {
            const { municipio } = await resolverMunicipio(nombreMunicipio);
            fijarMunicipio(municipio);
            setBarriosReloadToken((token) => token + 1);
            onDestinoAgregado(nuevoDestino(municipio.nombre, ''));
            limpiarBarrio();
        } catch (error) {
            setUbicacionesError(error instanceof Error ? error.message : 'No se pudo agregar el municipio al viaje.');
        } finally {
            setMunicipioGuardando(false);
        }
    };

    const agregarBarrio = async () => {
        const nombreMunicipio = municipioInput.trim();
        const nombreBarrio = barrioInput.trim();
        if (!nombreMunicipio || !nombreBarrio) return;

        setBarrioGuardando(true);
        setUbicacionesError('');
        try {
            const { municipio, registrado } = await resolverMunicipio(nombreMunicipio);
            if (registrado) fijarMunicipio(municipio);

            let barrioNombreFinal = nombreBarrio;
            try {
                const barrioGuardado = await guardarReferenciaUbicacion(route('reparto.modulacion.referencias.barrios.registrar'), {
                    municipio_id: municipio.id,
                    nombre: nombreBarrio,
                });
                setBarrios((actuales) => [...actuales.filter((a) => !mismoTexto(a.nombre, barrioGuardado.nombre)), barrioGuardado]);
                barrioNombreFinal = barrioGuardado.nombre;
            } catch (err) {
                console.warn('No se pudo registrar la referencia del barrio en el catálogo:', err);
            }

            if (!puedeAgregarViaje) {
                setUbicacionesError('Barrio procesado. Seleccione una placa y pulse + nuevamente para agregarlo al viaje.');
                return;
            }

            limpiarBarrio();
            onDestinoAgregado(nuevoDestino(municipio.nombre, barrioNombreFinal));
        } catch (error) {
            setUbicacionesError(error instanceof Error ? error.message : 'No se pudo agregar el barrio.');
        } finally {
            setBarrioGuardando(false);
        }
    };

    const tituloBotonBarrio = !municipioInput.trim()
        ? 'Agregue primero el municipio'
        : !puedeAgregarViaje
          ? 'Guardar barrio en catálogo; seleccione una placa para agregarlo al viaje'
          : barrioNuevo
            ? 'Guardar barrio y agregar destino a la planeación'
            : 'Agregar destino a la planeación';

    const mensajeAyuda = barriosLoading
        ? 'Cargando barrios del municipio...'
        : value.trim() && municipioSeleccionado && barrios.length === 0
          ? 'No hay barrios en el catálogo. Puede escribir uno y se guardará con la ruta.'
          : value.trim() && !municipioSeleccionado
            ? 'El municipio y el barrio escritos se guardarán al guardar la ruta.'
            : '';

    const hayDestinos = viajesRegistrados.length > 0 || destinosPendientes.length > 0;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
                <Label htmlFor={`${baseId}-departamento`} className="text-xs font-medium text-foreground">Departamento</Label>
                <Input
                    id={`${baseId}-departamento`}
                    name={`${baseId}-departamento`}
                    type="text"
                    value="Nariño"
                    readOnly
                    className="mt-0.5 h-10 bg-muted text-sm font-medium text-muted-foreground"
                />
            </div>
            <div>
                <Label htmlFor={`${baseId}-municipio`} className="text-xs font-medium text-foreground">Municipio / Destino</Label>
                <div className="mt-0.5 flex gap-2">
                    <Input
                        id={`${baseId}-municipio`}
                        name={`${baseId}-municipio`}
                        list={`${baseId}-municipios-list`}
                        value={municipioInput}
                        onChange={(event) => {
                            setMunicipioInput(event.target.value);
                            ultimoMunicipioRef.current = event.target.value;
                            onChange(event.target.value);
                            onBarrioChange('');
                        }}
                        placeholder={municipiosLoading ? 'Cargando...' : 'Municipio'}
                        className="h-10 text-sm"
                        autoComplete="off"
                    />
                    {municipioInput.trim() && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Agregar municipio al viaje"
                            title={
                                municipioSeleccionado
                                    ? 'Agregar municipio existente al viaje'
                                    : 'Guardar municipio en el catálogo y agregarlo al viaje'
                            }
                            disabled={municipioGuardando || municipiosLoading}
                            onClick={() => void agregarMunicipioAlViaje()}
                        >
                            {municipioGuardando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        </Button>
                    )}
                </div>
                <datalist id={`${baseId}-municipios-list`}>
                    {municipios.map((municipio) => (
                        <option key={municipio.id} value={municipio.nombre} />
                    ))}
                </datalist>
                {!municipioInput.trim() && value.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                        Municipio: <span className="font-medium text-foreground">{value}</span>
                    </p>
                )}
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor={`${baseId}-barrio`} className="text-xs font-medium text-foreground">Barrio</Label>
                <div className="mt-0.5 flex gap-2">
                    <Input
                        id={`${baseId}-barrio`}
                        name={`${baseId}-barrio`}
                        list={`${baseId}-barrios-list`}
                        value={barrioInput}
                        onChange={(event) => {
                            setBarrioInput(event.target.value);
                            ultimoBarrioRef.current = event.target.value;
                            onBarrioChange(event.target.value);
                        }}
                        disabled={!municipioInput.trim()}
                        placeholder={municipioInput.trim() ? 'Barrio' : 'Primero el municipio'}
                        className="h-10 text-sm"
                        autoComplete="off"
                    />
                    {barrioInput.trim() && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Agregar destino a la planeación"
                            title={tituloBotonBarrio}
                            disabled={!municipioInput.trim() || barrioGuardando}
                            onClick={() => void agregarBarrio()}
                        >
                            {barrioGuardando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        </Button>
                    )}
                </div>
                <datalist id={`${baseId}-barrios-list`}>
                    {barrios.map((opcion) => (
                        <option key={opcion.id} value={opcion.nombre} />
                    ))}
                </datalist>
            </div>

            {/* Hora de cita — opcional */}
            <div className="grid gap-1.5">
                <Label htmlFor={`${baseId}-hora`} className="text-xs font-medium text-foreground">
                    Hora de cita <span className="text-muted-foreground/60">(opcional)</span>
                </Label>
                <Input
                    id={`${baseId}-hora`}
                    name={`${baseId}-hora`}
                    type="time"
                    value={horaDestino}
                    onChange={(e) => onHoraDestinoChange(e.target.value)}
                    className="mt-0.5 h-10 w-full text-sm"
                />
            </div>

            {/* Tabla de destinos registrados / pendientes y mensajes */}
            <div className="col-span-4 space-y-1.5">
                {hayDestinos && (
                    <div className="overflow-hidden rounded-md border border-border/70 text-xs" aria-live="polite">
                        <p className="border-b border-border/70 px-3 py-2 font-medium text-foreground">
                            Destinos de la ruta ({viajesRegistrados.length + (destinosPendientes.length > 0 ? 1 : 0)} viajes)
                        </p>
                        <table className="w-full table-fixed border-collapse">
                            <thead>
                                <tr className="bg-muted/60 text-left text-[11px] font-semibold tracking-wide text-foreground uppercase">
                                    <th scope="col" className="w-1/5 border-r border-b border-border/70 px-3 py-2">Viaje</th>
                                    <th scope="col" className="border-r border-b border-border/70 px-3 py-2">Municipio y barrio</th>
                                    <th scope="col" className="w-20 border-b border-border/70 px-3 py-2">Hora</th>
                                    {onEliminarViaje && <th scope="col" className="w-8 border-b border-border/70" />}
                                </tr>
                            </thead>
                            <tbody>
                                {viajesRegistrados.map((registro, viajeIndex) => {
                                    const destinos = obtenerDestinosViaje(registro.viaje);
                                    return (
                                        <tr key={registro.viaje.id ?? `viaje-registrado-${viajeIndex}`} className="border-b border-border/50 last:border-0">
                                            <th scope="row" className="border-r border-border/70 px-3 py-2 text-left align-top font-medium text-foreground">
                                                Viaje {registro.numero}
                                            </th>
                                            <td className="border-r border-border/70 px-3 py-2 text-foreground">
                                                <ListaDestinos destinos={destinos} />
                                            </td>
                                            <td className="px-3 py-2 align-top text-foreground">
                                                <ListaHoras destinos={destinos} prefijo="hora" />
                                            </td>
                                            {onEliminarViaje && (
                                                <td className="px-1 py-2 align-top text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => onEliminarViaje(viajeIndex)}
                                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                                        title={`Eliminar viaje ${registro.numero}`}
                                                        aria-label={`Eliminar viaje ${registro.numero}`}
                                                    >
                                                        <X className="size-3.5" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {destinosPendientes.length > 0 && (
                                    <tr className="border-b border-border/50 last:border-0">
                                        <th scope="row" className="border-r border-border/70 px-3 py-2 text-left align-top font-medium text-foreground">
                                            Viaje {numeroViajePendiente} (en edición)
                                        </th>
                                        <td className="border-r border-border/70 px-3 py-2 text-foreground">
                                            <ul className="space-y-1">
                                                {destinosPendientes.map((destino, destinoIndex) => (
                                                    <li key={`${destino.lugares}-${destino.barrio}-${destinoIndex}`} className="flex items-center justify-between gap-2">
                                                        <span className="min-w-0 break-words">
                                                            <span className="mr-1" aria-hidden="true">•</span>
                                                            {formatearDestino(destino)}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-5 shrink-0 text-muted-foreground hover:text-destructive"
                                                            aria-label={`Quitar ${destino.lugares}, ${destino.barrio} del viaje en edición`}
                                                            title="Quitar destino"
                                                            onClick={() => onEliminarDestinoPendiente(destinoIndex)}
                                                        >
                                                            <X className="size-3" />
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="px-3 py-2 align-top text-foreground">
                                            <ListaHoras destinos={destinosPendientes} prefijo="hora-p" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {!barrioInput.trim() && barrio.trim() && (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                        Barrio agregado a este viaje: <span className="font-medium text-foreground">{barrio}</span>
                    </p>
                )}
                <p className="text-xs text-muted-foreground" aria-live="polite">{mensajeAyuda}</p>
            </div>
            {ubicacionesError && <p role="alert" className="col-span-4 text-xs text-destructive">{ubicacionesError}</p>}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// Página principal
// ═════════════════════════════════════════════════════════════════════════════

export default function ModulacionIndex({
    fecha: initialFecha,
    centro: centroProp = '',
    modulacion,
    colaboradores: colaboradoresIniciales = [],
    cargosCatalogo = [],
    vehiculos = [],
    currentUser,
    readOnly = false,
    exportExcel = false,
    fijosIniciales = [],
    isAdmin = false,
}: Props) {
    // ─── Estado general ──────────────────────────────────────────────────────
    // Modo edición: false por defecto si se llega en modo lectura
    const [isEditing, setIsEditing] = useState(() => !readOnly);

    // Fecha seleccionada — usar fecha LOCAL (no UTC) para evitar desfase de zona horaria
    const [fechaTexto, setFechaTexto] = useState<string>(() =>
        modulacion?.fecha ? String(modulacion.fecha) : initialFecha ? String(initialFecha) : fechaLocalHoy(),
    );
    const [activeModulacionId, setActiveModulacionId] = useState<number | null>(modulacion?.id ?? null);
    const [colaboradores, setColaboradores] = useState<ColaboradorOption[]>(colaboradoresIniciales);
    const [vehiculosState, setVehiculos] = useState<VehiculoOption[]>(vehiculos);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [cargosCatalogoActualizados, setCargosCatalogoActualizados] = useState<string[]>(cargosCatalogo);

    // Encabezado: UD Programado por / Despachado por
    const encabezadoInicial = leerEncabezado(modulacion, currentUser);
    const [udProgramadoPor, setUdProgramadoPor] = useState<string>(encabezadoInicial.udProgramadoPor);
    const [despachadoPorId, setDespachadoPorId] = useState<string>(encabezadoInicial.despachadoPorId);
    const [despachadoPorNombre, setDespachadoPorNombre] = useState<string>(encabezadoInicial.despachadoPorNombre);

    // Dropdowns
    const [showDespachadorDropdown, setShowDespachadorDropdown] = useState(false);
    const [placaSearch, setPlacaSearch] = useState('');
    const [showPlacaDropdown, setShowPlacaDropdown] = useState(false);
    const [placaAdicionalSearch, setPlacaAdicionalSearch] = useState('');
    const [showPlacaAdicionalDropdown, setShowPlacaAdicionalDropdown] = useState(false);

    // Card de Personal Pendiente por Programar
    const [isPendientesCardOpen, setIsPendientesCardOpen] = useState(false);

    // Estado de carga al precargar datos de una placa del día anterior
    const [placaPrecargando, setPlacaPrecargando] = useState(false);

    // Flag para saber si la consulta de fecha fue iniciada manualmente por el usuario
    const userInitiatedDateChange = useRef(false);
    const dateCheckController = useRef<AbortController | null>(null);

    // Formulario de ruta / viaje
    const [currentRoute, setCurrentRoute] = useState<RutaFormState>(createEmptyRoute());
    const [currentViajeForm, setCurrentViajeForm] = useState<Viaje>(crearViajeVacio());
    const [destinosViajePendientes, setDestinosViajePendientes] = useState<DestinoViaje[]>([]);
    const [horaDestinoPendiente, setHoraDestinoPendiente] = useState<string>('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingViajeIndex, setEditingViajeIndex] = useState<number | null>(null);

    // Rutas
    const [rutas, setRutas] = useState<RutaFormState[]>(() => mapModulacionItems(modulacion?.items ?? []));
    const [rutasGuardadas, setRutasGuardadas] = useState<RutaFormState[]>(() => mapModulacionItems(modulacion?.items ?? []));

    // Filtros
    const [filterTablePlaca, setFilterTablePlaca] = useState<string>(() => leerPlacaDeUrl() ?? 'todas');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cargoFilter, setCargoFilter] = useState<string>('todos');
    // El centro activo nace de la prop o de ?centro= (Historial siempre lo envía)
    const [filterCentro, setFilterCentro] = useState<string>(() => {
        const centroDeProp = normalizar(centroProp);
        return esCentroValido(centroDeProp) ? centroDeProp : leerCentroDeUrl();
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Novedades — estado local unificado (servidor + fijos iniciales + pendientes nuevas)
    const [novedadesLocal, setNovedadesLocal] = useState<ModulacionNovedadData[]>(() =>
        modulacion?.novedades?.length ? [...modulacion.novedades] : novedadesDesdeFijos(fijosIniciales),
    );
    // Fijos iniciales (id < 0) que el usuario eliminó explícitamente — no deben re-propagarse al guardar
    const [fijosExcluidos, setFijosExcluidos] = useState<ModulacionNovedadData[]>([]);
    const [nuevaNovedad, setNuevaNovedad] = useState(NUEVA_NOVEDAD_VACIA);
    const [novedadColaboradorSearch, setNovedadColaboradorSearch] = useState('');
    const [showNovedadColaboradorDropdown, setShowNovedadColaboradorDropdown] = useState(false);

    // ─── Helpers con estado ──────────────────────────────────────────────────
    const centroSeleccionado = esCentroValido(filterCentro);

    /** ¿Este centro es ajeno al centro activo? (regla única UC/UD) */
    const esAjeno = useCallback((centro: string | null | undefined) => esCentroAjeno(filterCentro, centro), [filterCentro]);

    const aplicarEncabezado = useCallback((e: ReturnType<typeof leerEncabezado>) => {
        setUdProgramadoPor(e.udProgramadoPor);
        setDespachadoPorId(e.despachadoPorId);
        setDespachadoPorNombre(e.despachadoPorNombre);
    }, []);

    const resetFormularioViaje = useCallback(() => {
        setCurrentViajeForm(crearViajeVacio());
        setDestinosViajePendientes([]);
        setHoraDestinoPendiente('');
    }, []);

    const limpiarRutaEnEdicion = useCallback(() => {
        setCurrentRoute(createEmptyRoute());
        resetFormularioViaje();
        setEditingIndex(null);
        setEditingViajeIndex(null);
    }, [resetFormularioViaje]);

    const vehiculoDePlaca = useCallback(
        (placa: string) => vehiculosState.find((v) => normalizar(v.placa) === normalizar(placa)),
        [vehiculosState],
    );

    /** Centro UC/UD del vehículo, o '' si no aplica. */
    const centroDePlaca = useCallback(
        (placa: string): Centro | '' => {
            const centro = normalizar(vehiculoDePlaca(placa)?.centro);
            return esCentroValido(centro) ? centro : '';
        },
        [vehiculoDePlaca],
    );

    /** Una ruta es del centro activo si ni su placa ni su placa adicional pertenecen al otro centro. */
    const rutaEsDelCentro = useCallback(
        (ruta: RutaFormState) => ![ruta.placa, ruta.placa_adicional ?? ''].some((p) => p && esAjeno(vehiculoDePlaca(p)?.centro)),
        [esAjeno, vehiculoDePlaca],
    );

    /** Un miembro de tripulación es ajeno si su colaborador (por id o cédula) pertenece al otro centro. */
    const miembroEsAjeno = useCallback(
        (miembro: MiembroTripulacion) =>
            esAjeno(colaboradores.find((c) => coincideConColaborador(miembro, claveDeColaborador(c)))?.centro),
        [colaboradores, esAjeno],
    );

    const aplicarCatalogos = (data: CheckFechaResponse) => {
        if (Array.isArray(data.cargosCatalogo)) setCargosCatalogoActualizados(data.cargosCatalogo);
        if (Array.isArray(data.colaboradores)) setColaboradores(data.colaboradores);
        if (Array.isArray(data.vehiculos)) setVehiculos(data.vehiculos);
    };

    const aplicarPlaneacionExistente = (m: ModulacionRespuesta, rutasExistentes: RutaFormState[]) => {
        setActiveModulacionId(m.id ?? null);
        setRutasGuardadas(rutasExistentes);
        setRutas(rutasExistentes);
        if (Array.isArray(m.novedades)) setNovedadesLocal([...m.novedades]);
    };

    const aplicarSinPlaneacion = (data: CheckFechaResponse) => {
        setActiveModulacionId(null);
        setRutas([]);
        setRutasGuardadas([]);
        setNovedadesLocal(novedadesDesdeFijos(data.fijosIniciales));
    };

    // ─── Efectos ─────────────────────────────────────────────────────────────
    // Sincronizar isEditing cuando cambia readOnly desde las props de Inertia
    useEffect(() => {
        if (readOnly) setIsEditing(false);
    }, [readOnly]);

    useEffect(() => setColaboradores(colaboradoresIniciales), [colaboradoresIniciales]);
    useEffect(() => setVehiculos(vehiculos), [vehiculos]);
    useEffect(() => setCargosCatalogoActualizados(cargosCatalogo), [cargosCatalogo]);
    useEffect(() => () => dateCheckController.current?.abort(), []);

    // Encabezado al recibir una nueva modulación
    useEffect(() => {
        setActiveModulacionId(modulacion?.id ?? null);
        if (!modulacion) return;

        if (modulacion.fecha) setFechaTexto(String(modulacion.fecha));
        aplicarEncabezado(leerEncabezado(readOnly ? modulacion : null, currentUser));

        // Notificar SOLO cuando el usuario estaba creando o cambiando de fecha explícitamente
        if (modulacion.fecha && userInitiatedDateChange.current) {
            userInitiatedDateChange.current = false;
            alert(
                readOnly
                    ? `La fecha ${modulacion.fecha} ya tiene una planeación registrada. Se han precargado los datos.`
                    : `La fecha ${modulacion.fecha} ya tiene una planeación. La pantalla quedó vacía.`,
            );
        }
    }, [modulacion, currentUser, readOnly, aplicarEncabezado]);

    // Rutas y formulario al recibir una nueva modulación
    useEffect(() => {
        limpiarRutaEnEdicion();
        const rutasIniciales = mapModulacionItems(modulacion?.items ?? []);
        setRutasGuardadas(rutasIniciales);
        setRutas(rutasIniciales);
        setIsEditing(!readOnly);

        const placaUrl = leerPlacaDeUrl();
        if (placaUrl) setFilterTablePlaca(placaUrl);

        // Si todavía no hay centro, tomarlo de la URL (nunca pisar el que el usuario ya eligió)
        setFilterCentro((prev) => prev || leerCentroDeUrl());
    }, [modulacion, readOnly, limpiarRutaEnEdicion]);

    // Novedades al recibir una nueva modulación o fijos iniciales
    useEffect(() => {
        if (modulacion?.novedades?.length) {
            setNovedadesLocal([...modulacion.novedades]);
        } else if (!modulacion) {
            setNovedadesLocal(novedadesDesdeFijos(fijosIniciales));
        } else {
            setNovedadesLocal([]);
        }
    }, [modulacion, fijosIniciales, readOnly]);

    // Centro detectado a partir de las rutas cargadas
    const centrosEnRutas = useMemo(() => {
        const set = new Set<Centro>();
        rutas.forEach((r) => {
            const c = centroDePlaca(r.placa);
            if (c) set.add(c);
        });
        return set;
    }, [rutas, centroDePlaca]);
    const centroDetectado: Centro | '' = centrosEnRutas.size === 1 ? [...centrosEnRutas][0] : '';
    const centroBloqueado = centrosEnRutas.size > 0;

    // Fijar automáticamente el centro si todas las rutas son del mismo (también en modo lectura)
    useEffect(() => {
        if (centroDetectado && !filterCentro) setFilterCentro(centroDetectado);
    }, [centroDetectado, filterCentro]);

    // BLINDAJE: con centro activo, ninguna ruta del otro centro puede permanecer en el estado
    useEffect(() => {
        if (!centroSeleccionado) return;
        setRutas((prev) => (prev.every(rutaEsDelCentro) ? prev : prev.filter(rutaEsDelCentro)));
    }, [rutas, centroSeleccionado, rutaEsDelCentro]);

    // Mantener ?centro= en la URL para que recargar o compartir el enlace conserve el centro
    useEffect(() => {
        if (!centroSeleccionado || typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (url.searchParams.get('centro') === filterCentro) return;
        url.searchParams.set('centro', filterCentro);
        window.history.replaceState(window.history.state, '', url);
    }, [centroSeleccionado, filterCentro]);

    // ─── Carga de planeación (fecha + centro) ────────────────────────────────
    /** Deja la pantalla en blanco: todo lo que depende de fecha/centro se reinicia junto. */
    const reiniciarPlaneacion = () => {
        setActiveModulacionId(null);
        setRutas([]);
        setRutasGuardadas([]);
        limpiarRutaEnEdicion();
        setFilterTablePlaca('todas');
        setSearchQuery('');
        setCargoFilter('todos');
        setNuevaNovedad(NUEVA_NOVEDAD_VACIA);
        setNovedadColaboradorSearch('');
        setNovedadesLocal([]);
        aplicarEncabezado(leerEncabezado(null, currentUser));
    };

    /** ÚNICO cargador: lo usan el cambio de fecha y el cambio de centro. Solo trae/muestra datos del centro dado. */
    const cargarPlaneacion = async (fecha: string, centro: string, notificar = false) => {
        if (!fecha || !esCentroValido(centro)) return;

        dateCheckController.current?.abort();
        const controller = new AbortController();
        dateCheckController.current = controller;

        reiniciarPlaneacion();

        try {
            const data = await consultarPlaneacion(fecha, centro, controller.signal);
            if (!data || controller.signal.aborted) return;

            aplicarCatalogos(data);

            if (data.exists && data.modulacion) {
                const rutasDelCentro = mapModulacionItems(data.modulacion.items ?? []).filter(
                    (r) => !esCentroAjeno(centro, vehiculoDePlaca(r.placa)?.centro),
                );
                aplicarPlaneacionExistente(data.modulacion, rutasDelCentro);
                if (readOnly) {
                    aplicarEncabezado(leerEncabezado(data.modulacion, currentUser));
                    if (notificar) alert(`La fecha ${fecha} ya tiene una planeación registrada. Se han precargado los datos.`);
                }
            } else {
                aplicarSinPlaneacion(data);
            }

            if (!readOnly) setIsEditing(true);
        } catch (err) {
            if (controller.signal.aborted) return;
            console.error('Error al consultar la planeación:', err);
        }
    };

    const handleFechaChange = async (newFecha: string) => {
        setFechaTexto(newFecha);
        await cargarPlaneacion(newFecha, filterCentro, true);
    };

    const handleCentroChange = async (val: string) => {
        if (!esCentroValido(val) || val === filterCentro) return;
        setFilterCentro(val);
        await cargarPlaneacion(fechaTexto, val);
    };

    // ─── COLABORADORES FIJOS ─────────────────────────────────────────────────
    const fijosColaboradorIds = useMemo(() => {
        const ids = new Set<string>();
        if (readOnly && modulacion?.novedades) {
            modulacion.novedades.forEach((nov) => {
                if (!nov.fijo) return;
                if (nov.colaborador_id) ids.add(String(nov.colaborador_id).trim());
                if (nov.cedula) ids.add(`cedula:${String(nov.cedula).trim()}`);
            });
        }
        return ids;
    }, [modulacion?.novedades, readOnly]);

    // ─── Ruta en edición ─────────────────────────────────────────────────────
    /** Actualiza la ruta del formulario y, si se está editando una ruta de la tabla, también esa fila. */
    const actualizarRutaActual = (cambios: Partial<RutaFormState>) => {
        const updated = { ...currentRoute, ...cambios };
        setCurrentRoute(updated);
        if (editingIndex !== null && editingIndex >= 0) {
            setRutas((prev) => prev.map((ruta, i) => (i === editingIndex ? updated : ruta)));
        }
    };

    const handleCurrentRouteFieldChange = (field: keyof RutaFormState, value: RutaFormState[keyof RutaFormState]) => {
        actualizarRutaActual({ [field]: value } as Partial<RutaFormState>);
    };

    // BOTÓN EDITAR VIAJE INDIVIDUAL EN LA TABLA
    const handleEditViajeIndividual = (rutaIndex: number, viajeIndex: number) => {
        const routeToEdit = rutas[rutaIndex];
        const viajeToEdit = routeToEdit?.viajes?.[viajeIndex];
        if (!routeToEdit || !viajeToEdit) return;

        const destinosToEdit = obtenerDestinosViaje(viajeToEdit);

        setCurrentRoute({
            ...routeToEdit,
            doc_tras: routeToEdit.doc_tras ?? '',
            cargo: routeToEdit.cargo ?? '',
            tripulacion: [...(routeToEdit.tripulacion ?? [])],
            viajes: [...(routeToEdit.viajes ?? [])],
        });
        // Precargar el viaje específico en el formulario
        setCurrentViajeForm({
            lugares: viajeToEdit.lugares ?? '',
            barrio: viajeToEdit.barrio ?? '',
            cliente: viajeToEdit.cliente ?? '',
            peso: viajeToEdit.peso ?? '',
        });
        setDestinosViajePendientes(destinosToEdit);
        setHoraDestinoPendiente(destinosToEdit[0]?.hora ?? '');
        setEditingIndex(rutaIndex);
        setEditingViajeIndex(viajeIndex);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** Mensaje de error si la placa pertenece al otro centro, o null si es válida. */
    const validarMezclaCentros = (placa: string): string | null =>
        esAjeno(vehiculoDePlaca(placa)?.centro)
            ? `No se puede agregar esta ruta. La placa ${normalizar(placa)} pertenece al centro ${centroDePlaca(placa)}, pero la planeación es del centro ${filterCentro}. No se pueden mezclar UC y UD.`
            : null;

    const handlePlacaChange = async (newPlaca: string) => {
        const placaUpper = normalizar(newPlaca);
        if (!centroSeleccionado || placaUpper === normalizar(currentRoute.placa)) return;

        const errorCentro = validarMezclaCentros(placaUpper);
        if (errorCentro) {
            alert(errorCentro);
            return;
        }

        const resetFiltrosTripulacion = () => {
            setSearchQuery('');
            setCargoFilter('todos');
        };

        // Si ya existe la placa en la planeación de hoy, cargarla directamente
        const rutaExistenteIndex = rutas.findIndex((ruta) => normalizar(ruta.placa) === placaUpper);
        if (rutaExistenteIndex >= 0) {
            const rutaExistente = rutas[rutaExistenteIndex];
            setCurrentRoute({
                ...rutaExistente,
                tripulacion: [...rutaExistente.tripulacion],
                viajes: [...rutaExistente.viajes],
            });
            setEditingIndex(rutaExistenteIndex);
            setEditingViajeIndex(null);
            resetFormularioViaje();
            resetFiltrosTripulacion();
            return;
        }

        // Placa nueva para hoy → intentar precargar la tripulación del día anterior (del mismo centro)
        setPlacaPrecargando(true);
        let rutaPrevia: UltimaRutaPlacaResponse | null = null;
        try {
            const params = new URLSearchParams({ placa: placaUpper, fecha: fechaTexto, centro: filterCentro });
            const res = await fetch(`/modules/reparto/modulacion/ultima-ruta-placa?${params.toString()}`, {
                headers: HEADERS_JSON,
                credentials: 'same-origin',
            });
            if (res.ok) {
                const data = (await res.json()) as UltimaRutaPlacaResponse;
                if (data.found) rutaPrevia = data;
            }
        } catch {
            // Si falla la consulta, continuamos con formulario vacío — no bloqueamos al usuario
        } finally {
            setPlacaPrecargando(false);
        }

        // Los viajes, clientes y peso son nuevos cada día: solo se mantiene la tripulación y el cargo.
        const tripulacionPrecargada = (Array.isArray(rutaPrevia?.tripulacion) ? rutaPrevia.tripulacion : [])
            .map((miembro) => ({
                miembro,
                colaborador: colaboradores.find((actual) => coincideConColaborador(miembro, claveDeColaborador(actual))),
            }))
            // Solo tripulantes del centro activo (si no están en el catálogo no se puede determinar y se conservan)
            .filter(({ colaborador }) => !colaborador || perteneceAlCentro(colaborador.centro, filterCentro))
            .map(({ miembro, colaborador }) =>
                colaborador
                    ? {
                          ...miembro,
                          colaborador_id: colaborador.id,
                          cedula: colaborador.cedula || miembro.cedula,
                          nombres: colaborador.nombre_completo || miembro.nombres,
                          cargo: colaborador.cargo,
                      }
                    : miembro,
            );

        setCurrentRoute({
            placa: placaUpper,
            doc_tras: '', // el documento de transporte es nuevo cada día
            cargo: tripulacionPrecargada[0]?.cargo ?? rutaPrevia?.cargo ?? '',
            tripulacion: tripulacionPrecargada,
            viajes: [],
        });
        setEditingIndex(null);
        setEditingViajeIndex(null);
        resetFiltrosTripulacion();
        resetFormularioViaje();
    };

    // ─── Tripulación ─────────────────────────────────────────────────────────
    // Colaboradores asignados a otras rutas (excluyendo la ruta actual en edición)
    const assignedCollaboratorsSet = useMemo(() => {
        const set = new Set<string>();
        rutas.forEach((r, idx) => {
            if (idx === editingIndex) return;
            (r.tripulacion ?? []).forEach((m) => {
                if (m.colaborador_id !== undefined && m.colaborador_id !== null && String(m.colaborador_id).trim() !== '') {
                    set.add(`id:${String(m.colaborador_id).trim()}`);
                }
                if (m.cedula && String(m.cedula).trim() !== '') set.add(`cedula:${String(m.cedula).trim()}`);
            });
        });
        return set;
    }, [rutas, editingIndex]);

    const estaEnOtraRuta = useCallback(
        (clave: ClaveColaborador) =>
            assignedCollaboratorsSet.has(`id:${clave.id}`) || (clave.cedula !== '' && assignedCollaboratorsSet.has(`cedula:${clave.cedula}`)),
        [assignedCollaboratorsSet],
    );

    const estaEnRutaActual = useCallback(
        (clave: ClaveColaborador) => currentRoute.tripulacion.some((m) => coincideConColaborador(m, clave)),
        [currentRoute.tripulacion],
    );

    const isCollaboratorAlreadyAssigned = useCallback(
        (col: ColaboradorOption) => {
            const clave = claveDeColaborador(col);
            return !estaEnRutaActual(clave) && estaEnOtraRuta(clave);
        },
        [estaEnRutaActual, estaEnOtraRuta],
    );

    // MANEJO DE CHECKLIST DE TRIPULACIÓN
    const handleToggleChecklistMember = (col: ColaboradorOption) => {
        const clave = claveDeColaborador(col);

        if (estaEnRutaActual(clave)) {
            actualizarRutaActual({ tripulacion: currentRoute.tripulacion.filter((m) => !coincideConColaborador(m, clave)) });
            return;
        }

        if (esAjeno(col.centro)) {
            alert(`El colaborador "${col.nombre_completo}" pertenece al centro ${normalizar(col.centro)} y esta planeación es del centro ${filterCentro}.`);
            return;
        }

        if (isCollaboratorAlreadyAssigned(col)) {
            alert(`El colaborador "${col.nombre_completo}" ya se encuentra asignado a otra ruta para hoy.`);
            return;
        }

        actualizarRutaActual({
            tripulacion: [
                ...currentRoute.tripulacion,
                { colaborador_id: col.id, cedula: col.cedula || '', nombres: col.nombre_completo || '', cargo: col.cargo || '' },
            ],
        });
    };

    // ─── Viajes ──────────────────────────────────────────────────────────────
    const handleViajeFormChange = (field: keyof Viaje, value: string) => {
        setCurrentViajeForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddViaje = (e?: React.FormEvent | React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();

        if (showPlacaDropdown && placaSearch.trim() !== '') {
            alert('Seleccione una placa existente de la lista.');
            return;
        }
        // El centro es obligatorio SIEMPRE (también al editar desde el historial)
        if (!centroSeleccionado) {
            alert('Seleccione primero el centro (UC o UD) antes de agregar rutas.');
            return;
        }
        if (!currentRoute.placa.trim()) {
            alert('Por favor ingrese una Placa para la ruta.');
            return;
        }
        // La placa debe pertenecer al centro activo
        const errorCentro = validarMezclaCentros(currentRoute.placa);
        if (errorCentro) {
            alert(errorCentro);
            return;
        }

        const destinos = construirDestinos(currentViajeForm, destinosViajePendientes);
        const viajeFormLleno = viajeTieneDatos(currentViajeForm, destinos);

        if (!viajeFormLleno && editingViajeIndex === null) {
            alert('Por favor ingrese al menos un dato en Destino, Barrio, Cliente o Peso para agregar el viaje.');
            return;
        }

        // ── Editar un viaje existente (solo cuando se inició desde su acción de edición) ──
        if (editingViajeIndex !== null && editingIndex !== null) {
            const updatedViajes = [...(currentRoute.viajes || [])];
            if (editingViajeIndex < 0 || editingViajeIndex >= updatedViajes.length) {
                alert('No se encontró el viaje que está intentando editar.');
                return;
            }

            if (viajeFormLleno) {
                updatedViajes[editingViajeIndex] = { ...updatedViajes[editingViajeIndex], ...camposViaje(currentViajeForm, destinos) };
            } else {
                updatedViajes.splice(editingViajeIndex, 1);
            }

            const updatedRoute: RutaFormState = {
                ...currentRoute,
                tripulacion: [...(currentRoute.tripulacion || [])],
                viajes: updatedViajes,
            };
            const rutaQuedaSinViajes = updatedViajes.length === 0;
            const nextRutas = rutaQuedaSinViajes
                ? rutas.filter((_, i) => i !== editingIndex)
                : rutas.map((ruta, i) => (i === editingIndex ? updatedRoute : ruta));

            setRutas(nextRutas);
            if (rutaQuedaSinViajes) {
                setCurrentRoute(createEmptyRoute());
                setEditingIndex(null);
            } else {
                setCurrentRoute(updatedRoute);
            }

            guardarBatchEnBD(nextRutas, { isAutoSave: true, readOnlyMode: false });
            return;
        }

        // ── Agregar viaje, también cuando la placa ya tiene otros viajes en la tabla ──
        const newViaje: Viaje = { id: generateId(), ...camposViaje(currentViajeForm, destinos) };
        const existingIdx = rutas.findIndex((route) => normalizar(route.placa) === normalizar(currentRoute.placa));
        const routeToUpdate = existingIdx >= 0 ? rutas[existingIdx] : currentRoute;
        const updatedRoute: RutaFormState = {
            ...routeToUpdate,
            ...currentRoute,
            tripulacion: [...(currentRoute.tripulacion || routeToUpdate.tripulacion || [])],
            viajes: combinarViajes(routeToUpdate.viajes ?? [], currentRoute.viajes ?? [], [newViaje]),
        };

        const nextRutas = existingIdx >= 0
            ? rutas.map((ruta, i) => (i === existingIdx ? updatedRoute : ruta))
            : [...rutas, updatedRoute];

        setRutas(nextRutas);
        setCurrentRoute(updatedRoute);
        setEditingViajeIndex(null);
        setEditingIndex(editingIndex ?? (existingIdx >= 0 ? existingIdx : nextRutas.length - 1));

        guardarBatchEnBD(nextRutas, { isAutoSave: true, readOnlyMode: false });
    };

    const handleRemoveViajeIndividual = (placa: string, viajeId: string | undefined, viajeIndex: number) => {
        if (!confirm('¿Está seguro de eliminar este viaje?')) return;

        const placaNormalizada = normalizar(placa);
        const ruta = rutas.find((item) => normalizar(item.placa) === placaNormalizada);
        if (!ruta) return;

        const viajesRestantes = ruta.viajes.filter((viaje, index) => (viajeId ? viaje.id !== viajeId : index !== viajeIndex));

        const aplicarEliminacion = () => {
            setRutas(
                viajesRestantes.length > 0
                    ? rutas.map((item) => (normalizar(item.placa) === placaNormalizada ? { ...item, viajes: viajesRestantes } : item))
                    : rutas.filter((item) => normalizar(item.placa) !== placaNormalizada),
            );

            if (normalizar(currentRoute.placa) !== placaNormalizada) return;
            if (viajesRestantes.length > 0) {
                setCurrentRoute((prev) => ({ ...prev, viajes: viajesRestantes }));
            } else {
                limpiarRutaEnEdicion();
            }
        };

        // Si el viaje ya está guardado en BD, eliminarlo en el servidor primero
        const viajesGuardados = ruta.id ? rutasGuardadas.find((item) => item.id === ruta.id)?.viajes ?? [] : [];
        const viajeGuardadoIndex = viajesGuardados.findIndex((viaje, index) =>
            viajeId ? viaje.id === viajeId || `srv-${ruta.id}-v${index}` === viajeId : index === viajeIndex,
        );

        if (ruta.id && ruta.viajes[viajeIndex] && viajeGuardadoIndex >= 0) {
            router.delete(route('reparto.modulacion.destroyViaje', { id: ruta.id, viajeIndex: viajeGuardadoIndex }), {
                data: { return_fecha: fechaTexto, return_read_only: readOnly, centro: filterCentro, return_centro: filterCentro },
                preserveScroll: true,
                preserveState: true,
                onSuccess: aplicarEliminacion,
            });
            return;
        }

        aplicarEliminacion();
    };

    // ─── Novedades visibles (solo del centro activo) ─────────────────────────
    const novedadesVisibles = useMemo(
        () =>
            novedadesLocal.filter(
                (nov) => !esAjeno(colaboradores.find((c) => coincideConColaborador(nov, claveDeColaborador(c)))?.centro),
            ),
        [novedadesLocal, colaboradores, esAjeno],
    );

    // ─── Guardado ────────────────────────────────────────────────────────────
    /** Punto único de control UC/UD antes de guardar (final o autoguardado). Devuelve el error o null. */
    const validarPlaneacionDelCentro = (finalRutas: RutaFormState[]): string | null => {
        if (!centroSeleccionado) return 'Seleccione el centro (UC o UD) antes de guardar la planeación.';

        const rutaAjena = finalRutas.find((r) => !rutaEsDelCentro(r));
        if (rutaAjena) {
            return `La placa ${normalizar(rutaAjena.placa)} no pertenece al centro ${filterCentro}. No se pueden mezclar UC y UD en una misma planeación.`;
        }

        const miembroAjeno = finalRutas.flatMap((r) => r.tripulacion ?? []).find(miembroEsAjeno);
        if (miembroAjeno) {
            return `El colaborador "${miembroAjeno.nombres}" no pertenece al centro ${filterCentro}. Quítelo de la tripulación antes de guardar.`;
        }

        return null;
    };

    const guardarBatchEnBD = (finalRutas: RutaFormState[], options: { isAutoSave?: boolean; readOnlyMode?: boolean } = {}) => {
        const { isAutoSave = false, readOnlyMode = false } = options;

        const errorCentro = validarPlaneacionDelCentro(finalRutas);
        if (errorCentro) {
            alert(errorCentro);
            return;
        }

        if (finalRutas.length === 0) {
            alert('Por favor ingrese al menos una ruta con Placa antes de guardar la planeación.');
            return;
        }

        setIsSubmitting(true);

        const novedadesPayload = novedadesVisibles.map((nov) => ({
            ...(nov.id < 0 ? {} : { id: nov.id }),
            colaborador_id: nov.colaborador_id ?? null,
            cedula: nov.cedula ?? null,
            nombres: nov.nombres ?? null,
            cargo: nov.cargo ?? null,
            observaciones: nov.observaciones ?? null,
            fijo: Boolean(nov.fijo),
            permiso: Boolean(nov.permiso),
            no_asitio: Boolean(nov.no_asitio),
            incapacidad: Boolean(nov.incapacidad),
            vacaciones: Boolean(nov.vacaciones),
        }));

        // Fijos iniciales que el usuario eliminó explícitamente: se envían con fijo=false
        // para que queden en BD y sincronizarFijosAnteriores no los vuelva a propagar
        const excluidos = fijosExcluidos.map((nov) => ({
            colaborador_id: nov.colaborador_id ?? null,
            cedula: nov.cedula ?? null,
            nombres: nov.nombres ?? null,
            cargo: nov.cargo ?? null,
            observaciones: null,
            fijo: false,
            fijo_rescate: false,
            fijo_taller: false,
            permiso: false,
            no_asitio: false,
            incapacidad: false,
            vacaciones: false,
        }));

        const payload = {
            modulacion_id: activeModulacionId,
            fecha: fechaTexto,
            centro: filterCentro,
            ud_programado_por: udProgramadoPor,
            despachado_por_colaborador_id: despachadoPorId ? Number(despachadoPorId) : null,
            despachado_por_nombre: despachadoPorNombre,
            rutas: finalRutas,
            novedades: novedadesPayload,
            read_only: readOnlyMode,
        };

        if (!isAutoSave) {
            // Guardado final completo — usa Inertia router.post para la redirección
            router.post(route('reparto.modulacion.storeBatch'), payload as unknown as Record<string, unknown>, {
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => {
                    setIsSubmitting(false);
                    alert('Planeación ruta guardada correctamente.');
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    console.error('Error al guardar planeación en la base de datos:', errs);
                    alert(errs.rutas || Object.values(errs)[0] || 'Error al guardar en la base de datos. Verifique los campos requeridos.');
                },
            });
            return;
        }

        // Auto-guardado vía AJAX (fetch) — NO recarga la página, preserva el estado del formulario
        fetch('/modules/reparto/modulacion/batch-api', {
            method: 'POST',
            headers: { ...HEADERS_JSON, 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        })
            .then(async (res) => {
                const isJson = res.headers.get('content-type')?.includes('application/json');
                const data = isJson ? await res.json() : null;

                if (!res.ok) {
                    const msg = data?.message || data?.errors?.rutas || 'Error al auto-guardar en la base de datos.';
                    console.error('Error al auto-guardar:', msg);
                    alert(msg);
                    return;
                }

                // Actualizar el ID de la modulación si fue creada por primera vez
                if (data?.modulacion_id && !activeModulacionId) setActiveModulacionId(data.modulacion_id);

                // Sincronizar rutas locales con los IDs y viajes del servidor
                if (data?.modulacion?.items) {
                    const rutasFrescas = mapModulacionItems(data.modulacion.items);
                    const buscarFresca = (placa: string) => rutasFrescas.find((fresh) => normalizar(fresh.placa) === normalizar(placa));

                    setRutasGuardadas(rutasFrescas);
                    setRutas((prev) =>
                        prev.map((ruta) => {
                            const match = buscarFresca(ruta.placa);
                            return match ? { ...ruta, id: match.id, viajes: match.viajes } : ruta;
                        }),
                    );
                    setCurrentRoute((prev) => {
                        const match = buscarFresca(prev.placa);
                        return match ? { ...prev, id: match.id } : prev;
                    });
                }

                if (data?.modulacion?.novedades) {
                    // Al recibir novedades del servidor, conservar las eliminaciones locales pendientes:
                    // si una novedad no existe en novedadesLocal actual (fue eliminada) no la restauramos
                    setNovedadesLocal((prevLocal) => {
                        const idsLocales = new Set(prevLocal.map((n) => n.id));
                        const novedadesServidor = (data.modulacion!.novedades ?? []).filter(
                            (n) => idsLocales.has(n.id),
                        );
                        const pendientes = prevLocal.filter((n) => n.id < 0);
                        const idsServidor = new Set(novedadesServidor.map((n) => n.id));
                        const pendientesSinDuplicar = pendientes.filter((n) => !idsServidor.has(n.id));
                        return [...novedadesServidor, ...pendientesSinDuplicar];
                    });
                }

                // Limpiar formulario de viaje después del auto-guardado exitoso
                resetFormularioViaje();
                setEditingViajeIndex(null);
            })
            .catch((err) => console.error('Error de red al auto-guardar:', err))
            .finally(() => setIsSubmitting(false));
    };

    // GUARDAR PLANEACIÓN DE RUTA COMPLETA (TODAS LAS RUTAS + NOVEDADES)
    const handleGuardarTodo = () => {
        const finalRutas = [...rutas];

        if (currentRoute.placa.trim()) {
            const cv = currentViajeForm;
            const viajes = [...(currentRoute.viajes ?? [])];
            const destinos = construirDestinos(cv, destinosViajePendientes);
            const viajeFormTieneDatos = viajeTieneDatos(cv, destinos);

            if (editingViajeIndex !== null && editingViajeIndex >= 0 && editingViajeIndex < viajes.length) {
                if (viajeFormTieneDatos) {
                    viajes[editingViajeIndex] = { ...viajes[editingViajeIndex], ...camposViaje(cv, destinos) };
                } else {
                    viajes.splice(editingViajeIndex, 1);
                }
            } else if (viajeFormTieneDatos) {
                const yaExisteEnArray = viajes.some(
                    (v) =>
                        v.lugares === cv.lugares &&
                        v.barrio === cv.barrio &&
                        String(v.cliente ?? '') === String(cv.cliente ?? '') &&
                        String(v.peso ?? '') === String(cv.peso ?? ''),
                );
                if (!yaExisteEnArray) viajes.push({ id: generateId(), ...camposViaje(cv, destinos) });
            }

            const currentRouteFinal: RutaFormState = { ...currentRoute, viajes };
            const editandoRutaValida = editingIndex !== null && editingIndex >= 0 && editingIndex < finalRutas.length;

            if (!editandoRutaValida) {
                finalRutas.push(currentRouteFinal);
            } else if (editingViajeIndex !== null && viajes.length === 0) {
                finalRutas.splice(editingIndex, 1);
            } else {
                finalRutas[editingIndex] = currentRouteFinal;
            }
        }

        // La validación UC/UD (centro obligatorio, placas y tripulantes) corre dentro de guardarBatchEnBD.
        // Tripulación contiene SOLO los miembros asignados explícitamente a cada ruta.
        guardarBatchEnBD(finalRutas, { isAutoSave: false, readOnlyMode: true });
    };

    // ─── Colaboradores del centro activo ─────────────────────────────────────
    // El back ya envía solo los colaboradores del centro activo — se usan directamente
    const colaboradoresDelCentro = centroSeleccionado ? colaboradores : [];

    const colaboradoresOperativos = useMemo(
        () => colaboradoresDelCentro.filter((col) => esPersonalOperativoDeRuta(col.area)),
        [colaboradoresDelCentro],
    );

    // ─── Novedades ───────────────────────────────────────────────────────────
    const handleNuevaNovedadSelectColaborador = (val: string) => {
        if (!val) {
            setNuevaNovedad((prev) => ({ ...prev, colaborador_id: '', cedula: '', nombres: '', cargo: '' }));
            setNovedadColaboradorSearch('');
            return;
        }
        const col = colaboradoresOperativos.find((c) => String(c.id) === val);
        if (!col) return;

        setNuevaNovedad((prev) => ({
            ...prev,
            colaborador_id: String(col.id),
            cedula: col.cedula || '',
            nombres: col.nombre_completo || '',
            cargo: col.cargo || '',
        }));
        setNovedadColaboradorSearch(`${col.nombre_completo ?? ''} (${col.cedula ?? ''})`);
        setShowNovedadColaboradorDropdown(false);
    };

    const colaboradoresOperativosNovedad = useMemo(() => {
        const query = novedadColaboradorSearch.trim().toLocaleLowerCase();
        return colaboradoresOperativos
            .filter(
                (col) =>
                    !query ||
                    (col.nombre_completo ?? '').toLocaleLowerCase().includes(query) ||
                    (col.cedula ?? '').toLocaleLowerCase().includes(query),
            )
            .slice(0, 20);
    }, [colaboradoresOperativos, novedadColaboradorSearch]);

    const handleAgregarNovedadTabla2 = () => {
        if (!centroSeleccionado) {
            alert('Seleccione primero el centro (UC o UD).');
            return;
        }
        if (!nuevaNovedad.nombres.trim()) {
            alert('Por favor seleccione un colaborador.');
            return;
        }

        // Verificar duplicado por cédula o colaborador_id
        const yaExiste = novedadesLocal.some(
            (n) =>
                (nuevaNovedad.cedula && n.cedula === nuevaNovedad.cedula) ||
                (nuevaNovedad.colaborador_id && String(n.colaborador_id) === nuevaNovedad.colaborador_id),
        );
        if (yaExiste) {
            alert('Este colaborador ya está en la tabla de novedades.');
            return;
        }

        // Agregar localmente con id temporal negativo (no existe en BD todavía)
        setNovedadesLocal((prev) => [
            ...prev,
            {
                id: -Date.now(),
                modulacion_id: activeModulacionId ?? 0,
                colaborador_id: nuevaNovedad.colaborador_id ? Number(nuevaNovedad.colaborador_id) : undefined,
                cedula: nuevaNovedad.cedula,
                nombres: nuevaNovedad.nombres,
                cargo: nuevaNovedad.cargo,
                observaciones: nuevaNovedad.observaciones,
                fijo: false,
                permiso: nuevaNovedad.permiso,
                no_asitio: nuevaNovedad.no_asitio,
                incapacidad: nuevaNovedad.incapacidad,
                vacaciones: nuevaNovedad.vacaciones,
            },
        ]);

        setNuevaNovedad(NUEVA_NOVEDAD_VACIA);
        setNovedadColaboradorSearch('');
    };

    const handleNovedadChange = (id: number, field: keyof ModulacionNovedadData, value: ModulacionNovedadData[keyof ModulacionNovedadData]) => {
        setNovedadesLocal((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
    };

    // Las novedades se guardan junto con las rutas en "Guardar Planeación de Ruta"
    const handleDeleteNovedad = (id: number) => {
        const esPendiente = id < 0; // Fila nunca guardada — solo quitar del estado local
        if (!esPendiente && !confirm('¿Desea eliminar este colaborador de la tabla de novedades?')) return;

        // Quitar del estado inmediatamente (optimistic update)
        const novedadOriginal = novedadesLocal.find((n) => n.id === id);
        setNovedadesLocal((prev) => prev.filter((n) => n.id !== id));

        if (esPendiente) {
            // Fijo inicial (nunca guardado): registrar como excluido para que al guardar
            // quede en BD con fijo=false y no sea re-propagado por sincronizarFijosAnteriores
            if (novedadOriginal) {
                setFijosExcluidos((prev) => {
                    const yaExiste = prev.some((n) => n.id === id);
                    return yaExiste ? prev : [...prev, { ...novedadOriginal, fijo: false, fijo_rescate: false, fijo_taller: false }];
                });
            }
            return;
        }

        // Eliminar en BD — si falla, restaurar la fila
        fetch(`${route('reparto.modulacion.destroyNovedad', id)}?centro=${encodeURIComponent(filterCentro)}`, {
            method: 'DELETE',
            headers: { ...HEADERS_JSON, 'X-CSRF-TOKEN': getCsrfToken() },
            credentials: 'same-origin',
        })
            .then((res) => {
                if (!res.ok && novedadOriginal) {
                    setNovedadesLocal((prev) => {
                        const yaExiste = prev.some((n) => n.id === novedadOriginal.id);
                        return yaExiste ? prev : [...prev, novedadOriginal];
                    });
                }
            })
            .catch((err) => {
                console.error('Error al eliminar novedad:', err);
                if (novedadOriginal) {
                    setNovedadesLocal((prev) => {
                        const yaExiste = prev.some((n) => n.id === novedadOriginal.id);
                        return yaExiste ? prev : [...prev, novedadOriginal];
                    });
                }
            });
    };

    // ─── Checklist de tripulación ────────────────────────────────────────────
    const isFiltering = useMemo(
        () => searchQuery.trim() !== '' || cargoFilter !== 'todos' || centroSeleccionado,
        [searchQuery, cargoFilter, centroSeleccionado],
    );

    const { selectedColaboradores, unselectedColaboradores } = useMemo(() => {
        const selected: ColaboradorOption[] = [];
        const unselected: ColaboradorOption[] = [];
        const q = searchQuery.toLowerCase().trim();

        // colaboradoresOperativos ya contiene SOLO el centro activo
        colaboradoresOperativos.forEach((col) => {
            const clave = claveDeColaborador(col);
            const miembroGuardado = currentRoute.tripulacion.find((m) => coincideConColaborador(m, clave));
            if (miembroGuardado) {
                selected.push({ ...col, cargo: miembroGuardado.cargo ?? col.cargo });
                return;
            }

            const matchesCargo = cargoFilter === 'todos' || col.cargo === cargoFilter;
            const matchesSearch = !q || col.nombre_completo?.toLowerCase().includes(q) || col.cedula?.includes(q);

            if (matchesCargo && matchesSearch && !isCollaboratorAlreadyAssigned(col)) unselected.push(col);
        });

        // Miembros de la tripulación que no están en el catálogo del centro (se muestran para poder quitarlos)
        currentRoute.tripulacion.forEach((m) => {
            const yaIncluido = selected.some((s) => coincideConColaborador(m, claveDeColaborador(s)));
            if (yaIncluido) return;
            selected.push({
                id: m.colaborador_id ? Number(m.colaborador_id) : -(Math.abs(parseInt(m.cedula || '0', 10)) || 1),
                cedula: m.cedula || '',
                nombres: m.nombres || '',
                apellidos: '',
                nombre_completo: m.nombres || 'Colaborador',
                cargo: m.cargo || '',
                area: null,
                centro: colaboradores.find((c) => coincideConColaborador(m, claveDeColaborador(c)))?.centro ?? null,
            });
        });

        return { selectedColaboradores: selected, unselectedColaboradores: unselected };
    }, [colaboradoresOperativos, colaboradores, cargoFilter, searchQuery, currentRoute.tripulacion, isCollaboratorAlreadyAssigned]);

    const allChecklistColaboradores = [...selectedColaboradores, ...unselectedColaboradores];

    const baseColaboradoresOperativos = useMemo(
        () => (colaboradoresOperativos.length > 0 ? colaboradoresOperativos : colaboradoresDelCentro),
        [colaboradoresOperativos, colaboradoresDelCentro],
    );

    const cargosOperativos = useMemo(
        () =>
            Array.from(new Set(baseColaboradoresOperativos.map((col) => col.cargo.trim()).filter(Boolean))).sort((a, b) =>
                a.localeCompare(b),
            ),
        [baseColaboradoresOperativos],
    );

    // ─── Personal pendiente por programar ────────────────────────────────────
    const personalFaltantePorProgramar = useMemo(
        () =>
            baseColaboradoresOperativos.map((col) => {
                const clave = claveDeColaborador(col);
                const enOtraRuta = estaEnOtraRuta(clave);
                const enRutaActual = estaEnRutaActual(clave);
                const nov = novedadesVisibles.find((n) => coincideConColaborador(n, clave));

                const tiposNovedad = nov ? CAMPOS_NOVEDAD.filter(({ campo }) => nov[campo]).map(({ etiqueta }) => etiqueta) : [];
                const esBloqueante = tiposNovedad.length > 0;
                if (nov && !esBloqueante && nov.observaciones) tiposNovedad.push(`Obs: ${nov.observaciones}`);

                return {
                    ...col,
                    enOtraRuta,
                    enRutaActual,
                    novedad: nov,
                    tipoNovedadStr: tiposNovedad.join(', '),
                    esBloqueante,
                    faltaProgramar: !enOtraRuta && !enRutaActual,
                };
            }),
        [baseColaboradoresOperativos, estaEnOtraRuta, estaEnRutaActual, novedadesVisibles],
    );

    const personalPendiente = useMemo(
        () => personalFaltantePorProgramar.filter((item) => item.faltaProgramar),
        [personalFaltantePorProgramar],
    );

    const statsPendientes = useMemo(() => {
        const contar = (fn: (p: (typeof personalFaltantePorProgramar)[number]) => boolean) => personalFaltantePorProgramar.filter(fn).length;
        return {
            total: personalFaltantePorProgramar.length,
            programados: contar((p) => p.enOtraRuta || p.enRutaActual),
            pendientes: contar((p) => p.faltaProgramar),
            disponibles: contar((p) => p.faltaProgramar && !p.esBloqueante),
            conNovedad: contar((p) => p.faltaProgramar && p.esBloqueante),
        };
    }, [personalFaltantePorProgramar]);

    // ─── Placas ──────────────────────────────────────────────────────────────
    // El back ya envía solo los vehículos del centro activo — se usan directamente
    const vehiculosFiltradosPorCentro = centroSeleccionado ? vehiculosState : [];

    /** ¿La placa ya es placa principal de otra ruta (distinta de la que se edita)? */
    const placaUsadaEnOtraRuta = (placaUpper: string) =>
        rutas.some((ruta, index) => index !== editingIndex && normalizar(ruta.placa) === placaUpper);

    const placasDisponibles = vehiculosFiltradosPorCentro.filter((vehiculo) => {
        const placaUpper = normalizar(vehiculo.placa);
        return placaUpper === normalizar(currentRoute.placa) || !placaUsadaEnOtraRuta(placaUpper);
    });
    const placasCoincidentes = placasDisponibles.filter((v) => normalizar(v.placa).includes(normalizar(placaSearch)));

    // Placa adicional: excluye la principal de la ruta actual y las asignadas en otras rutas
    const placasDisponiblesAdicional = vehiculosFiltradosPorCentro.filter((vehiculo) => {
        const placaUpper = normalizar(vehiculo.placa);
        if (placaUpper === normalizar(currentRoute.placa)) return false;
        if (placaUpper === normalizar(currentRoute.placa_adicional)) return true;
        return !placaUsadaEnOtraRuta(placaUpper);
    });
    const placasAdicionalCoincidentes = placasDisponiblesAdicional.filter((v) =>
        normalizar(v.placa).includes(normalizar(placaAdicionalSearch)),
    );

    // RUTAS EN LA TABLA — siempre solo las del centro activo (creación, edición e historial); sin centro, ninguna
    const filteredRutasTable = useMemo(
        () => (centroSeleccionado ? rutas.filter(rutaEsDelCentro) : []),
        [rutas, centroSeleccionado, rutaEsDelCentro],
    );

    // LISTA ÚNICA DE PLACAS (solo del centro activo)
    const uniquePlacasInRutas = useMemo(
        () => Array.from(new Set(filteredRutasTable.filter((r) => r.placa).map((r) => r.placa.toUpperCase()))),
        [filteredRutasTable],
    );

    // Solo las rutas con doc. transporte lleno (para el contador de rutas)
    const rutasConDocTransporte = useMemo(
        () => filteredRutasTable.filter((r) => r.doc_tras?.trim()),
        [filteredRutasTable],
    );

    // Desplazar automáticamente hacia la fila resaltada si viene seleccionada una placa
    useEffect(() => {
        if (!filterTablePlaca || filterTablePlaca === 'todas') return;
        const timer = setTimeout(() => {
            document.getElementById(`ruta-row-${normalizar(filterTablePlaca)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
        return () => clearTimeout(timer);
    }, [filterTablePlaca, rutas]);

    // ─── Exportar Excel ──────────────────────────────────────────────────────
    const handleExportExcel = () => {
        if (!centroSeleccionado) {
            alert('Seleccione el centro (UC o UD) antes de exportar.');
            return;
        }
        if (filteredRutasTable.length === 0) {
            alert(`No hay rutas del centro ${filterCentro} para exportar con los filtros seleccionados.`);
            return;
        }
        exportarPlaneacionExcel({
            rutas: filteredRutasTable,
            novedades: novedadesVisibles,
            fechaTexto,
            centro: filterCentro,
            udProgramadoPor,
            despachadoPorNombre,
            totalRutas: rutasConDocTransporte.length,
        });
    };

    // La exportación automática (desde Historial) espera a tener centro válido para no exportar nada mezclado
    const exportacionAutomaticaRealizada = useRef(false);
    useEffect(() => {
        if (!exportExcel || !centroSeleccionado || exportacionAutomaticaRealizada.current) return;
        exportacionAutomaticaRealizada.current = true;
        handleExportExcel();
        // La exportación se solicita una sola vez al abrir esta planeación desde Historial.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exportExcel, centroSeleccionado]);

    // ─── Valores derivados para el render ────────────────────────────────────
    const numeroViajeEnFormulario = editingViajeIndex !== null ? editingViajeIndex + 1 : (currentRoute.viajes?.length || 0) + 1;
    const tituloViajeFormulario = editingViajeIndex !== null ? `${tituloViaje(numeroViajeEnFormulario)} (editando)` : tituloViaje(numeroViajeEnFormulario);
    const columnasNovedades = 7 + (isAdmin ? 1 : 0) + (isEditing ? 1 : 0);

    const despachadoresFiltrados = colaboradores.filter((c) => {
        const q = despachadoPorNombre.toLowerCase().trim();
        if (!q) return true;
        return `${c.nombre_completo} ${c.cedula || ''}`.toLowerCase().includes(q) || Boolean(c.cedula?.includes(q));
    });

    const mensajeTablaVacia = !centroSeleccionado
        ? 'Seleccione un centro (UC o UD) para ver la planeación.'
        : rutas.length === 0
          ? 'No hay rutas registradas. Complete el formulario y presione Guardar ruta.'
          : 'No hay rutas que coincidan con los filtros aplicados.';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Planeación ruta de" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card px-8 py-6 shadow-sm">
                    <div className="flex flex-col gap-4">
                        {/* Fila 1: ícono + título + botón Excel */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm sm:h-16 sm:w-16"
                                    style={{ background: 'linear-gradient(135deg, rgb(6, 78, 59) 0%, rgb(4, 120, 87) 60%, rgb(5, 150, 105) 100%)' }}
                                >
                                    <MapPin className="h-7 w-7 text-white" />
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                    Planeación de ruta{centroSeleccionado && (
                                        <span className="ml-2 text-emerald-600">{filterCentro}</span>
                                    )}
                                </h1>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleExportExcel}
                                disabled={!centroSeleccionado}
                                className="h-8 shrink-0 border-green-300 text-xs text-green-700 hover:bg-green-50"
                            >
                                <FileSpreadsheet className="mr-1 h-3.5 w-3.5 sm:mr-1.5" />
                                <span className="hidden sm:inline">Exportar Excel</span>
                                <span className="sm:hidden">Excel</span>
                            </Button>
                        </div>

                        {/* Fila 2: Programado Por y Despachado Por debajo del título */}
                        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border/50 pt-3">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="ud_programado_por" className="w-36 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                                    UD Programado Por:
                                </Label>
                                <Input
                                    id="ud_programado_por"
                                    type="text"
                                    placeholder="Nombre del usuario programador"
                                    value={udProgramadoPor}
                                    onChange={(e) => setUdProgramadoPor(e.target.value)}
                                    className="h-8 w-40 min-w-0 bg-background text-xs sm:w-56"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="despachado_por" className="w-36 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                                    Despachado Por:
                                </Label>
                                <div className="relative w-40 sm:w-56">
                                    <Input
                                        id="despachado_por"
                                        type="text"
                                        value={despachadoPorNombre}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setDespachadoPorNombre(val);
                                            setShowDespachadorDropdown(true);
                                            const found = colaboradores.find(
                                                (c) =>
                                                    c.nombre_completo.toLowerCase() === val.toLowerCase() ||
                                                    `${c.nombre_completo} ${c.cedula}`.toLowerCase() === val.toLowerCase(),
                                            );
                                            setDespachadoPorId(found ? String(found.id) : '');
                                        }}
                                        onBlur={() => setTimeout(() => setShowDespachadorDropdown(false), 150)}
                                        placeholder="Busque o escriba el nombre..."
                                        autoComplete="off"
                                        className="h-8 bg-background text-xs"
                                    />
                                    {showDespachadorDropdown && (
                                        <div className="absolute top-full right-0 left-0 z-10 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-input bg-popover shadow-lg">
                                            {despachadoresFiltrados.map((c) => (
                                                <div
                                                    key={c.id}
                                                    onMouseDown={() => {
                                                        setDespachadoPorNombre(`${c.nombre_completo} ${c.cedula}`);
                                                        setDespachadoPorId(String(c.id));
                                                        setShowDespachadorDropdown(false);
                                                    }}
                                                    className="cursor-pointer border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-muted"
                                                >
                                                    <div className="font-medium text-foreground">{c.nombre_completo}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        CC: {c.cedula || '—'} · Área: {c.area || '—'} · Cargo: {c.cargo || '—'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Toggle UC / UD — esquina inferior derecha de la card */}
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Centro:</span>
                            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50">
                                {(['UC', 'UD'] as const).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => void handleCentroChange(c)}
                                        className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                                            filterCentro === c
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Filtros de centro, fecha y placa ───────────────────── */}
                {/* Se muestran al editar y, en modo lectura, mientras no haya centro definido */}
                {(isEditing || !centroSeleccionado) && (
                    <div className="grid grid-cols-1 gap-4 rounded-xl border border-sidebar-border/70 bg-card p-4 sm:grid-cols-3 dark:border-sidebar-border">
                        {/* 1. CENTRO — primero, porque condiciona todo lo demás */}
                        <div>
                            <Label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
                                <Filter className="size-3.5 text-emerald-600" />
                                Centro <span className="text-red-500">*</span>
                                {centroBloqueado && filterCentro && (
                                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">— fijado en {filterCentro}</span>
                                )}
                            </Label>
                            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50">
                                {(['UC', 'UD'] as const).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => void handleCentroChange(c)}
                                        className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                                            filterCentro === c
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>

                        </div>

                        {/* 2. FECHA — solo habilitado cuando hay centro */}
                        <div>
                            <Label htmlFor="filtro-fecha" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                                Fecha de la planeación
                                {!filterCentro && <span className="ml-1 text-[10px] font-normal text-muted-foreground">— seleccione centro primero</span>}
                            </Label>
                            <Input
                                id="filtro-fecha"
                                type="date"
                                value={fechaTexto}
                                onChange={(e) => {
                                    if (!filterCentro) {
                                        alert('Seleccione primero el centro (UC o UD) antes de elegir la fecha.');
                                        return;
                                    }
                                    void handleFechaChange(e.target.value);
                                }}
                                disabled={!filterCentro}
                                className="h-10 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                title={!filterCentro ? 'Seleccione primero el centro UC o UD' : ''}
                            />
                            {activeModulacionId && rutasGuardadas.length > 0 && rutas.length === 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                        setRutas(rutasGuardadas);
                                        setCurrentRoute(createEmptyRoute());
                                        setCurrentViajeForm(crearViajeVacio());
                                    }}
                                >
                                    Cargar planeación guardada
                                </Button>
                            )}
                        </div>

                        {/* 3. PLACA */}
                        <div>
                            <Label htmlFor="filtro-placa" className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
                                <Filter className="size-3.5 text-emerald-600" />
                                Buscar por placa
                            </Label>
                            <Select value={filterTablePlaca} onValueChange={setFilterTablePlaca}>
                                <SelectTrigger id="filtro-placa" className="h-10 w-full text-sm">
                                    <SelectValue placeholder="-- Seleccionar Placa a resaltar --" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">-- Mostrar todas (Sin resaltar) --</SelectItem>
                                    {uniquePlacasInRutas.map((placa) => (
                                        <SelectItem key={placa} value={placa}>
                                            Placa: {placa}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* ── Formulario nueva / editar salida ─────────────────────── */}
                <form onSubmit={handleAddViaje} className="space-y-4" style={{ display: !readOnly || isEditing ? 'block' : 'none' }}>
                    {/* Card 1: Datos generales y Tripulación */}
                    <div className="space-y-6 rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <div className="flex items-center gap-2 border-b border-border pb-3">
                            <MapPin className="size-4 text-emerald-600" />
                            <span className="font-semibold text-foreground">Datos de ruta</span>
                            {editingIndex !== null && currentRoute.placa && (
                                <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: '#16a34a', color: '#16a34a' }}>
                                    Editando #{editingIndex + 1} · {currentRoute.placa}
                                </Badge>
                            )}
                        </div>

                        {/* ── Sección 1: Datos Generales de la Salida ── */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Placa */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="placa-ruta" className="text-xs font-medium">Placa</Label>
                                <div className="relative">
                                    <Input
                                        id="placa-ruta"
                                        name="placa"
                                        type="text"
                                        value={showPlacaDropdown ? placaSearch : currentRoute.placa}
                                        onFocus={() => {
                                            if (!centroSeleccionado) return;
                                            setPlacaSearch('');
                                            setShowPlacaDropdown(true);
                                        }}
                                        onChange={(e) => {
                                            if (!centroSeleccionado) return;
                                            setPlacaSearch(e.target.value);
                                            setShowPlacaDropdown(true);
                                        }}
                                        onBlur={() =>
                                            setTimeout(() => {
                                                setShowPlacaDropdown(false);
                                                setPlacaSearch('');
                                            }, 150)
                                        }
                                        placeholder={centroSeleccionado ? 'Escriba para buscar una placa...' : '⚠ Seleccione UC o UD primero...'}
                                        autoComplete="off"
                                        disabled={!centroSeleccionado}
                                        className="h-10 font-mono text-sm uppercase"
                                    />
                                    {showPlacaDropdown && centroSeleccionado && (
                                        <div className="absolute top-full right-0 left-0 z-20 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-input bg-popover shadow-lg">
                                            {placasCoincidentes.map((vehiculo) => (
                                                <div
                                                    key={vehiculo.placa}
                                                    onMouseDown={() => {
                                                        void handlePlacaChange(vehiculo.placa);
                                                        setPlacaSearch('');
                                                        setShowPlacaDropdown(false);
                                                    }}
                                                    className="cursor-pointer border-b border-border px-3 py-2 font-mono text-sm last:border-b-0 hover:bg-muted"
                                                >
                                                    {vehiculo.placa}
                                                    {vehiculo.centro && <span className="ml-2 text-xs text-muted-foreground">{vehiculo.centro}</span>}
                                                </div>
                                            ))}
                                            {placasCoincidentes.length === 0 && (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">No hay placas existentes que coincidan.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Indicador precarga placa día anterior */}
                            {placaPrecargando && (
                                <div className="col-span-full flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    Cargando datos del día anterior para esta placa…
                                </div>
                            )}

                            {/* Documento Transporte */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="documento-transporte" className="text-xs font-medium">Documento Transporte</Label>
                                <Input
                                    id="documento-transporte"
                                    name="doc_tras"
                                    type="text"
                                    placeholder="Ej: 8008417408"
                                    value={currentRoute.doc_tras ?? ''}
                                    onChange={(e) => handleCurrentRouteFieldChange('doc_tras', e.target.value)}
                                    className="h-10 font-mono text-sm"
                                    required
                                />
                            </div>

                            {/* Placa Adicional — solo visible al editar una ruta existente */}
                            {editingIndex !== null && (
                                <div className="grid gap-1.5">
                                    <Label htmlFor="placa-adicional" className="text-xs font-medium">
                                        Placa Adicional <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="placa-adicional"
                                            name="placa_adicional"
                                            type="text"
                                            value={showPlacaAdicionalDropdown ? placaAdicionalSearch : (currentRoute.placa_adicional ?? '')}
                                            onFocus={() => {
                                                setPlacaAdicionalSearch('');
                                                setShowPlacaAdicionalDropdown(true);
                                            }}
                                            onChange={(e) => {
                                                setPlacaAdicionalSearch(e.target.value.toUpperCase());
                                                setShowPlacaAdicionalDropdown(true);
                                            }}
                                            onBlur={() =>
                                                setTimeout(() => {
                                                    setShowPlacaAdicionalDropdown(false);
                                                    setPlacaAdicionalSearch('');
                                                }, 150)
                                            }
                                            placeholder="Buscar placa libre..."
                                            autoComplete="off"
                                            className="h-10 font-mono text-sm text-red-600 uppercase placeholder:text-muted-foreground placeholder:normal-case"
                                        />
                                        {currentRoute.placa_adicional?.trim() && !showPlacaAdicionalDropdown && (
                                            <button
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleCurrentRouteFieldChange('placa_adicional', '');
                                                }}
                                                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                aria-label="Limpiar placa adicional"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                        {showPlacaAdicionalDropdown && (
                                            <div className="absolute top-full right-0 left-0 z-20 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-input bg-popover shadow-lg">
                                                {placasAdicionalCoincidentes.map((vehiculo) => (
                                                    <div
                                                        key={vehiculo.placa}
                                                        onMouseDown={() => {
                                                            handleCurrentRouteFieldChange('placa_adicional', vehiculo.placa.toUpperCase());
                                                            setPlacaAdicionalSearch('');
                                                            setShowPlacaAdicionalDropdown(false);
                                                        }}
                                                        className="cursor-pointer border-b border-border px-3 py-2 font-mono text-sm font-semibold text-red-600 last:border-b-0 hover:bg-muted"
                                                    >
                                                        {vehiculo.placa}
                                                        {vehiculo.centro && <span className="ml-2 text-xs font-normal text-muted-foreground">{vehiculo.centro}</span>}
                                                    </div>
                                                ))}
                                                {placasAdicionalCoincidentes.length === 0 && (
                                                    <p className="px-3 py-2 text-sm text-muted-foreground">No hay placas libres que coincidan.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {currentRoute.placa_adicional?.trim() && (
                                        <p className="text-xs text-red-500">
                                            Se mostrará en rojo debajo de <span className="font-semibold">{currentRoute.placa}</span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Sección 2: Tripulación de la Ruta ── */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-2">
                                <Users className="size-4 text-emerald-600" />
                                <span className="font-semibold text-foreground">Tripulación de la Ruta</span>
                            </div>
                            <div className="space-y-3 border-t border-border/60 pt-4">
                                {/* Filtros */}
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="buscar-tripulacion" className="flex items-center gap-1 text-xs font-medium text-foreground">
                                            <Search className="size-3 text-emerald-600" />
                                            Buscar Nombre o Cédula
                                        </Label>
                                        <Input
                                            id="buscar-tripulacion"
                                            name="buscar_tripulacion"
                                            type="text"
                                            placeholder="Escriba para filtrar colaboradores..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="h-10 text-sm"
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="filtrar-cargo" className="flex items-center gap-1 text-xs font-medium text-foreground">
                                            <Filter className="size-3 text-emerald-600" />
                                            Filtrar por Cargo
                                        </Label>
                                        <Select value={cargoFilter} onValueChange={setCargoFilter}>
                                            <SelectTrigger id="filtrar-cargo" className="h-10 w-full text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">-- Todos los Cargos --</SelectItem>
                                                {cargosOperativos.map((cg) => (
                                                    <SelectItem key={cg} value={cg}>
                                                        {cg}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Checklist */}
                                {centroSeleccionado && isFiltering && (
                                    <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-background p-3">
                                        <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-foreground">
                                            <CheckSquare className="size-3.5 text-emerald-600" />
                                            Resultados del filtro ({allChecklistColaboradores.length})
                                        </p>
                                        {allChecklistColaboradores.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                                                {allChecklistColaboradores.map((col) => {
                                                    const clave = claveDeColaborador(col);
                                                    const isChecked = estaEnRutaActual(clave);
                                                    const isFijo = fijosColaboradorIds.has(clave.id) || (clave.cedula !== '' && fijosColaboradorIds.has(`cedula:${clave.cedula}`));
                                                    const bloqueado = isFijo && isChecked;
                                                    const claseEstado = isChecked
                                                        ? isFijo
                                                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                                                            : 'border-primary/40 bg-primary/5'
                                                        : 'border-border hover:bg-muted/50';

                                                    return (
                                                        <label
                                                            key={`col-item-${col.id ?? col.cedula}`}
                                                            htmlFor={`check-${col.id ?? col.cedula}`}
                                                            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors select-none ${claseEstado} ${bloqueado ? 'cursor-not-allowed opacity-80' : ''}`}
                                                        >
                                                            <Checkbox
                                                                id={`check-${col.id ?? col.cedula}`}
                                                                checked={isChecked}
                                                                disabled={bloqueado}
                                                                onCheckedChange={() => !isFijo && handleToggleChecklistMember(col)}
                                                                className="mt-0.5 shrink-0"
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-semibold text-foreground">{String(col.nombre_completo ?? '')}</p>
                                                                {col.cedula && <p className="font-mono text-[10px] text-muted-foreground">Cédula: {col.cedula}</p>}
                                                                {col.cargo && <p className="truncate text-[10px] text-muted-foreground">Cargo: {col.cargo}</p>}
                                                            </div>
                                                            {bloqueado && <Badge className="shrink-0 bg-emerald-600 px-1.5 py-0 text-[9px] text-white">FIJO</Badge>}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="py-4 text-center text-xs text-muted-foreground">
                                                No se encontraron colaboradores libres que coincidan con el filtro.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Card: Personal pendiente por programar a las rutas ── */}
                    <div className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                            <div className="flex items-center gap-2">
                                <Users className="size-4 text-emerald-600" />
                                <span className="text-sm font-bold text-foreground">Personal Pendiente por Programar en Rutas</span>
                                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                    {statsPendientes.pendientes > 0 ? `${statsPendientes.pendientes} sin programar` : 'Todos programados'}
                                </Badge>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsPendientesCardOpen((v) => !v)}
                                className="size-8 p-0"
                                title={isPendientesCardOpen ? 'Ocultar personal pendiente' : 'Mostrar personal pendiente'}
                            >
                                {isPendientesCardOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </Button>
                        </div>

                        {isPendientesCardOpen && (
                            <div className="pt-1">
                                {personalPendiente.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 py-6 text-center text-muted-foreground">
                                        <CheckCircle2 className="mb-1 size-8 text-emerald-500" />
                                        <p className="text-sm font-medium text-foreground">¡Todo el personal operativo ha sido programado!</p>
                                        <p className="text-xs text-muted-foreground">No quedan colaboradores pendientes por asignar a las rutas de hoy.</p>
                                    </div>
                                ) : (
                                    <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                        {personalPendiente.map((col) => (
                                            <div
                                                key={`pendiente-${col.id ?? col.cedula}`}
                                                className={`flex flex-col justify-between rounded-lg border p-3 text-xs transition-all ${
                                                    col.esBloqueante
                                                        ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
                                                        : 'border-border bg-background hover:border-sidebar-border hover:shadow-xs'
                                                }`}
                                            >
                                                <div className="space-y-1">
                                                    <p className="truncate text-xs font-semibold text-foreground" title={col.nombre_completo}>
                                                        {col.nombre_completo}
                                                    </p>
                                                    {col.cargo && (
                                                        <p className="truncate text-[11px] text-muted-foreground" title={col.cargo}>
                                                            {col.cargo}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Card 2: Viajes de la Ruta */}
                    <div className="space-y-6 rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <div className="flex items-center gap-2 border-b border-border pb-3">
                            <MapPin className="size-4 text-emerald-600" />
                            <span className="font-semibold text-foreground">Viajes de la Ruta</span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Navigation className="size-4 text-emerald-600" />
                                <span className="font-semibold text-foreground">{tituloViajeFormulario}</span>
                            </div>

                            <div key={`viaje-form-group-${currentRoute.placa || 'empty'}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <NarinoMunicipioInput
                                        value={String(currentViajeForm.lugares ?? '')}
                                        onChange={(val) => {
                                            handleViajeFormChange('lugares', val);
                                            if (editingViajeIndex === null) setHoraDestinoPendiente('');
                                        }}
                                        barrio={String(currentViajeForm.barrio ?? '')}
                                        onBarrioChange={(val) => {
                                            handleViajeFormChange('barrio', val);
                                            if (editingViajeIndex === null) setHoraDestinoPendiente('');
                                        }}
                                        horaDestino={horaDestinoPendiente}
                                        onHoraDestinoChange={setHoraDestinoPendiente}
                                        puedeAgregarViaje={Boolean(currentRoute.placa.trim())}
                                        viajesRegistrados={currentRoute.viajes.flatMap((viaje, indice) =>
                                            indice === editingViajeIndex ? [] : [{ viaje, numero: indice + 1 }],
                                        )}
                                        destinosPendientes={destinosViajePendientes}
                                        numeroViajePendiente={numeroViajeEnFormulario}
                                        onDestinoAgregado={(destino) =>
                                            setDestinosViajePendientes((actuales) => {
                                                // Si el municipio ya estaba sin barrio, se completa con el barrio nuevo
                                                const municipioSinBarrio = destino.barrio
                                                    ? actuales.findIndex((a) => mismoTexto(a.lugares, destino.lugares) && a.barrio.trim() === '')
                                                    : -1;
                                                if (municipioSinBarrio >= 0) {
                                                    return actuales.map((a, index) => (index === municipioSinBarrio ? destino : a));
                                                }
                                                const duplicado = actuales.some(
                                                    (a) => mismoTexto(a.lugares, destino.lugares) && mismoTexto(a.barrio, destino.barrio),
                                                );
                                                return duplicado ? actuales : [...actuales, destino];
                                            })
                                        }
                                        onEliminarDestinoPendiente={(destinoIndex) => {
                                            const destinosActualizados = destinosViajePendientes.filter((_, index) => index !== destinoIndex);
                                            setDestinosViajePendientes(destinosActualizados);
                                            if (destinosActualizados.length === 0 && editingViajeIndex !== null) {
                                                setCurrentViajeForm((formulario) => ({ ...formulario, lugares: '', barrio: '' }));
                                            }
                                        }}
                                        onEliminarViaje={(viajeIndex) => {
                                            // Eliminar el viaje registrado en la posición viajeIndex
                                            const viajesActualizados = currentRoute.viajes.filter((_, i) => i !== viajeIndex);
                                            const rutaActualizada = { ...currentRoute, viajes: viajesActualizados };
                                            setCurrentRoute(rutaActualizada);
                                            if (editingIndex !== null && editingIndex >= 0) {
                                                setRutas((prev) => {
                                                    const lista = [...prev];
                                                    if (lista[editingIndex]) lista[editingIndex] = rutaActualizada;
                                                    return lista;
                                                });
                                            }
                                        }}
                                    />
                                </div>

                                {/* Cliente */}
                                <div className="grid gap-1.5">
                                    <Label htmlFor="cliente-viaje" className="text-xs font-medium text-muted-foreground">Cliente</Label>
                                    <Input
                                        id="cliente-viaje"
                                        name="cliente"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={String(currentViajeForm.cliente ?? '')}
                                        onChange={(e) => handleViajeFormChange('cliente', e.target.value)}
                                        placeholder="Ingrese el número de cliente"
                                        className="mt-0.5 h-10 text-sm"
                                    />
                                </div>

                                {/* Peso (Toneladas) */}
                                <div className="grid gap-1.5">
                                    <Label htmlFor="peso-viaje" className="text-xs font-medium text-muted-foreground">Peso (Toneladas)</Label>
                                    <Input
                                        id="peso-viaje"
                                        name="peso"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Ej: 1.5"
                                        value={String(currentViajeForm.peso ?? '')}
                                        onChange={(e) => handleViajeFormChange('peso', e.target.value)}
                                        className="h-10 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Botón Agregar viaje / Actualizar */}
                        <div className="flex justify-end gap-2 border-t border-border pt-4">
                            <Button
                                type="button"
                                onClick={(e) => handleAddViaje(e)}
                                variant="outline"
                                className="h-8 gap-1.5 border-green-300 px-3 text-xs text-green-700 hover:bg-green-50"
                            >
                                {editingViajeIndex !== null ? (
                                    <>
                                        <Save className="size-4" />
                                        Actualizar
                                    </>
                                ) : (
                                    <>
                                        <Plus className="size-4" />
                                        Agregar viaje{destinosViajePendientes.length > 0 ? ` (${destinosViajePendientes.length} destinos)` : ''}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>

                {/* ── Tabla planeación de ruta ────────────────────────────── */}
                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-border/70 bg-white/90 px-5 py-3 dark:border-sidebar-border dark:bg-card">
                        <div className="flex items-center gap-2">
                            <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold text-emerald-950 dark:text-emerald-100">Planeación de Ruta</span>
                            {centroSeleccionado && (
                                <Badge variant="outline" className="font-mono text-xs border-emerald-500/40 text-emerald-600">
                                    {filterCentro}
                                </Badge>
                            )}
                            {filteredRutasTable.length > 0 && (
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    ({rutasConDocTransporte.length} ruta{rutasConDocTransporte.length !== 1 ? 's' : ''})
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-10 text-center">#</TableHead>
                                    <TableHead className="font-semibold">Placa</TableHead>
                                    <TableHead className="font-semibold">Doc. Transporte</TableHead>
                                    <TableHead className="font-semibold">Tripulación</TableHead>
                                    <TableHead className="font-semibold">Viajes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRutasTable.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-12 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <FileText className="size-8 opacity-30" style={{ color: '#059669' }} />
                                                <p className="text-sm">{mensajeTablaVacia}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRutasTable.map((item, idx) => {
                                        const rutaIndex = rutas.indexOf(item);
                                        const tripMembers = item.tripulacion ?? [];
                                        const viajesList = item.viajes ?? [];
                                        const isSelectedPlaca = normalizar(item.placa) === normalizar(filterTablePlaca);

                                        return (
                                            <TableRow
                                                key={item.id ?? `ruta-${item.placa}-${idx}`}
                                                id={`ruta-row-${item.placa?.toUpperCase()}`}
                                                className={
                                                    isSelectedPlaca
                                                        ? 'border-l-4 border-l-sky-500 bg-sky-100/80 align-top transition-colors hover:bg-sky-100/90 dark:bg-sky-950/60'
                                                        : 'align-top hover:bg-muted/30'
                                                }
                                            >
                                                <TableCell className="text-center text-sm font-medium">{idx + 1}</TableCell>

                                                <TableCell className="text-sm font-semibold text-foreground">
                                                    {item.placa}
                                                    {item.placa_adicional?.trim() && (
                                                        <span className="block font-mono font-bold text-red-600">{normalizar(item.placa_adicional)}</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-sm text-foreground">{item.doc_tras || '—'}</TableCell>

                                                <TableCell className="text-sm text-foreground">
                                                    {tripMembers.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {tripMembers.map((m, mIdx) => (
                                                                <div key={`trip-${m.colaborador_id ?? m.cedula}-${mIdx}`} className="flex items-start gap-2">
                                                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
                                                                    <div className="space-y-0.5">
                                                                        <p>{m.cedula || '—'}</p>
                                                                        <p>{m.nombres || 'Sin nombre'}</p>
                                                                        <p>{m.cargo || '—'}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-sm text-foreground">
                                                    {viajesList.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {viajesList.map((v, vIdx) => {
                                                                const destinos = obtenerDestinosViaje(v);
                                                                return (
                                                                    <div key={v.id ?? `viaje-${vIdx}`} className="border-b border-border/50 pb-2 last:border-0">
                                                                        <p className="mb-1.5 text-xs font-semibold" style={{ color: '#059669' }}>Viaje {vIdx + 1}</p>
                                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_auto] sm:items-start">
                                                                            <div className="space-y-1">
                                                                                {(destinos.length > 0 ? destinos : [{ lugares: '', barrio: '' } as DestinoViaje]).map((destino, destinoIdx) => (
                                                                                    <div key={`${destino.lugares}-${destino.barrio}-${destinoIdx}`}>
                                                                                        <p><span className="font-medium">Municipio:</span> {destino.lugares || '—'}</p>
                                                                                        <p><span className="font-medium">Barrio:</span> {destino.barrio || '—'}</p>
                                                                                        {destino.hora && (
                                                                                            <p className="font-semibold text-amber-600 dark:text-amber-400">Cita: {destino.hora}</p>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                            <p><span className="font-medium">Cliente:</span> {v.cliente || '—'}</p>
                                                                            <p><span className="font-medium">Peso:</span> {v.peso ? `${v.peso} ton` : '—'}</p>
                                                                            <div className="flex items-center gap-1 sm:justify-end">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    aria-label={`Editar viaje ${vIdx + 1} de la ruta ${item.placa}`}
                                                                                    onClick={() => handleEditViajeIndividual(rutaIndex, vIdx)}
                                                                                    className="size-6 hover:bg-accent/10"
                                                                                    style={{ color: '#059669' }}
                                                                                >
                                                                                    <Pencil className="size-3" />
                                                                                </Button>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    aria-label={`Eliminar viaje ${vIdx + 1} de la ruta ${item.placa}`}
                                                                                    onClick={() => handleRemoveViajeIndividual(item.placa, v.id, vIdx)}
                                                                                    className="size-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                                >
                                                                                    <Trash2 className="size-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* ── Tabla novedades ──────────────────────────────────────── */}
                {(isEditing || novedadesVisibles.length > 0) && (
                    <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <div className="flex items-center gap-2 border-b border-sidebar-border/70 bg-muted/30 px-5 py-3 dark:border-sidebar-border">
                            <MapPin className="size-4 text-emerald-600" />
                            <span className="font-semibold text-foreground">Novedades de Colaboradores</span>
                            {novedadesVisibles.length > 0 && <Badge variant="secondary">{novedadesVisibles.length}</Badge>}
                        </div>

                        <div className="space-y-4 p-4">
                            {/* Formulario agregar colaborador — solo en modo edición */}
                            {isEditing && (
                                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                                    <div className="grid gap-1.5 sm:col-span-4">
                                        <div className="relative">
                                            <Input
                                                id="nueva-novedad-colaborador"
                                                type="text"
                                                role="combobox"
                                                aria-expanded={showNovedadColaboradorDropdown}
                                                aria-controls="novedad-colaboradores-operativos"
                                                autoComplete="off"
                                                placeholder={centroSeleccionado ? 'Escriba nombre o cédula' : '⚠ Seleccione UC o UD primero...'}
                                                disabled={!centroSeleccionado}
                                                value={novedadColaboradorSearch}
                                                onFocus={() => setShowNovedadColaboradorDropdown(true)}
                                                onChange={(event) => {
                                                    setNovedadColaboradorSearch(event.target.value);
                                                    setNuevaNovedad((prev) => ({ ...prev, colaborador_id: '', cedula: '', nombres: '', cargo: '' }));
                                                    setShowNovedadColaboradorDropdown(true);
                                                }}
                                                onBlur={() => window.setTimeout(() => setShowNovedadColaboradorDropdown(false), 150)}
                                                className="h-10 w-full text-sm"
                                            />
                                            {showNovedadColaboradorDropdown && (
                                                <div
                                                    id="novedad-colaboradores-operativos"
                                                    role="listbox"
                                                    className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                                >
                                                    {colaboradoresOperativosNovedad.length > 0 ? (
                                                        colaboradoresOperativosNovedad.map((col) => (
                                                            <button
                                                                key={col.id}
                                                                type="button"
                                                                role="option"
                                                                aria-selected={nuevaNovedad.colaborador_id === String(col.id)}
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => handleNuevaNovedadSelectColaborador(String(col.id))}
                                                                className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                                            >
                                                                {`${col.nombre_completo ?? ''} (${col.cedula ?? ''})`}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <p className="px-2 py-2 text-sm text-muted-foreground">No se encontraron colaboradores del área Operativa.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5 sm:col-span-5">
                                        <Label htmlFor="nueva-novedad-observaciones" className="text-xs text-muted-foreground">Observaciones</Label>
                                        <Input
                                            id="nueva-novedad-observaciones"
                                            name="observaciones"
                                            type="text"
                                            placeholder="Notas adicionales..."
                                            value={nuevaNovedad.observaciones}
                                            onChange={(e) => setNuevaNovedad((prev) => ({ ...prev, observaciones: e.target.value }))}
                                            className="h-10 text-sm"
                                        />
                                    </div>

                                    <div className="sm:col-span-3 flex items-end justify-end">
                                        <Button type="button" onClick={handleAgregarNovedadTabla2} variant="outline" className="h-10 w-full gap-1.5 text-sm border-green-300 text-green-700 hover:bg-green-50">
                                            <Plus className="size-4" />
                                            Agregar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto rounded-lg border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="font-semibold">Identificación</TableHead>
                                            <TableHead className="font-semibold">Nombres</TableHead>
                                            <TableHead className="font-semibold">Observaciones</TableHead>
                                            {isAdmin && <TableHead className="text-center font-semibold">Fijo</TableHead>}
                                            {CAMPOS_NOVEDAD.map(({ campo, encabezado }) => (
                                                <TableHead key={campo} className="text-center font-semibold">{encabezado}</TableHead>
                                            ))}
                                            {isEditing && <TableHead className="w-16 text-right font-semibold">Eliminar</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {novedadesVisibles.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={columnasNovedades} className="py-8 text-center text-sm text-muted-foreground">
                                                    No hay colaboradores en novedades. Use el formulario de arriba para agregar uno.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            novedadesVisibles.map((nov) => {
                                                const nombreAria = nov.nombres ?? nov.cedula ?? nov.id;
                                                const celdaCheck = (campo: CampoNovedad | 'fijo', etiqueta: string, idSufijo: string) => (
                                                    <TableCell key={campo} className="text-center">
                                                        {isEditing ? (
                                                            <Checkbox
                                                                id={`novedad-${nov.id}-${idSufijo}`}
                                                                aria-label={`${etiqueta}: ${nombreAria}`}
                                                                checked={Boolean(nov[campo])}
                                                                onCheckedChange={(c) => handleNovedadChange(nov.id, campo, Boolean(c))}
                                                            />
                                                        ) : (
                                                            <span>{nov[campo] ? '✓' : '—'}</span>
                                                        )}
                                                    </TableCell>
                                                );

                                                return (
                                                    <TableRow key={nov.id} className={nov.fijo ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}>
                                                        <TableCell className="font-mono text-sm">{nov.cedula ?? '—'}</TableCell>
                                                        <TableCell className="text-sm font-medium">{nov.nombres ?? '—'}</TableCell>
                                                        <TableCell className="text-sm">
                                                            {isEditing ? (
                                                                <Input
                                                                    id={`novedad-${nov.id}-observaciones`}
                                                                    name={`novedad-${nov.id}-observaciones`}
                                                                    type="text"
                                                                    value={nov.observaciones ?? ''}
                                                                    onChange={(e) => handleNovedadChange(nov.id, 'observaciones', e.target.value)}
                                                                    placeholder="Observaciones..."
                                                                    className="h-8 text-sm"
                                                                />
                                                            ) : (
                                                                <span>{nov.observaciones ?? '—'}</span>
                                                            )}
                                                        </TableCell>
                                                        {isAdmin && celdaCheck('fijo', 'Fijo', 'fijo')}
                                                        {CAMPOS_NOVEDAD.map(({ campo, etiqueta, idSufijo }) => celdaCheck(campo, etiqueta, idSufijo))}
                                                        {isEditing && (
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => handleDeleteNovedad(nov.id)}
                                                                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Botón guardar todo y exportar Excel ──────────────────── */}
                {isEditing && (
                    <div className="flex items-center justify-end gap-3 border-t border-sidebar-border/70 pt-4 dark:border-sidebar-border">
                        <Button type="button" onClick={handleExportExcel} disabled={!centroSeleccionado} variant="outline" size="lg" className="gap-2">
                            <FileSpreadsheet className="size-5 text-emerald-600" />
                            Exportar Excel
                        </Button>
                        <Button type="button" size="lg" disabled={isSubmitting || !centroSeleccionado} onClick={handleGuardarTodo} className="gap-2 px-8">
                            <Save className="size-4" />
                            Guardar planeación de ruta
                        </Button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}