import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Calendar,
    CheckSquare,
    FileSpreadsheet,
    FileText,
    Filter,
    LoaderCircle,
    MapPin,
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

interface ColaboradorOption {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    nombre_completo: string;
    cargo: string;
    area: string | null;
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
}

interface ViajeRegistrado {
    viaje: Viaje;
    numero: number;
}

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

interface RutaFormState {
    id?: number;
    placa: string;
    doc_tras: string;
    cargo: string;
    tripulacion: MiembroTripulacion[];
    viajes: Viaje[];
}

interface ModulacionItemData {
    id: number;
    modulacion_id: number;
    placa: string;
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
    fijo_rescate: boolean;
    fijo_taller: boolean;
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
    fijo_rescate?: boolean;
    fijo_taller?: boolean;
}

interface Props {
    fecha: string;
    modulacion: ModulacionData | null;
    colaboradores: ColaboradorOption[];
    vehiculos: string[];
    currentUser: string;
    readOnly?: boolean;
    exportExcel?: boolean;
    fijosIniciales?: FijoInicial[];
}

const esPersonalOperativoDeRuta = (area: string | null | undefined): boolean =>
    (area ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase() === 'OPERATIVA';

const mapModulacionItems = (items: ModulacionItemData[]): RutaFormState[] =>
    items.map((item) => ({
        id: item.id,
        placa: item.placa,
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

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Planeación de ruta', href: '/modules/reparto/modulacion' },
];

// Despachador por defecto
const DESPACHADO_POR_DEFECTO = 'Jhon alexander rojas muñoz 10041925516';

// Acento del módulo Reparto (usado con moderación, igual que en Seguridad)
const ACCENT = '#D4102A';

// Generador de IDs con respaldo
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

interface OpcionUbicacion {
    id: string;
    nombre: string;
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

async function guardarReferenciaUbicacion(
    url: string,
    payload: Record<string, string>,
): Promise<OpcionUbicacion> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '',
            'X-Requested-With': 'XMLHttpRequest',
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

function NarinoMunicipioInput({
    value,
    onChange,
    barrio,
    onBarrioChange,
    cliente,
    onClienteChange,
    puedeAgregarViaje,
    viajesRegistrados,
    destinosPendientes,
    numeroViajePendiente,
    onDestinoAgregado,
    onEliminarDestinoPendiente,
}: {
    value: string;
    onChange: (val: string) => void;
    barrio: string;
    onBarrioChange: (val: string) => void;
    cliente: string;
    onClienteChange: (val: string) => void;
    puedeAgregarViaje: boolean;
    viajesRegistrados: ViajeRegistrado[];
    destinosPendientes: DestinoViaje[];
    numeroViajePendiente: number;
    onDestinoAgregado: (destino: DestinoViaje) => void;
    onEliminarDestinoPendiente: (destinoIndex: number) => void;
}) {
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

    useEffect(() => {
        const controller = new AbortController();
        const loadUbicaciones = async () => {
            try {
                const municipiosResponse = await fetch(route('reparto.modulacion.referencias.municipios'), {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    signal: controller.signal,
                });
                const isJson = municipiosResponse.headers.get('content-type')?.includes('application/json');
                if (!municipiosResponse.ok || !isJson) {
                    const respuestaError = isJson
                        ? ((await municipiosResponse.json()) as { message?: unknown })
                        : null;
                    const detalle =
                        typeof respuestaError?.message === 'string'
                            ? respuestaError.message
                            : `el servidor respondió HTTP ${municipiosResponse.status}`;
                    throw new Error(`No se pudieron cargar los municipios: ${detalle}`);
                }
                const municipiosJson = (await municipiosResponse.json()) as { data?: unknown };

                if (controller.signal.aborted) return;
                setMunicipios(parseOpcionesUbicacion(municipiosJson.data));
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

    const municipioSeleccionado = municipios.find((municipio) =>
        municipio.nombre.localeCompare(municipioInput.trim(), 'es', { sensitivity: 'base' }) === 0,
    );
    const municipioSeleccionadoId = municipioSeleccionado?.id;
    const barrioNuevo = barrioInput.trim() !== '' && !barrios.some(
        (opcion) => opcion.nombre.localeCompare(barrioInput.trim(), 'es', { sensitivity: 'base' }) === 0,
    );

    const agregarMunicipioAlViaje = async () => {
        const nombreMunicipio = municipioInput.trim();
        if (!nombreMunicipio) return;

        setMunicipioGuardando(true);
        setUbicacionesError('');
        try {
            let municipio = municipioSeleccionado;
            if (!municipio) {
                try {
                    municipio = await guardarReferenciaUbicacion(
                        route('reparto.modulacion.referencias.municipios.registrar'),
                        { nombre: nombreMunicipio },
                    );
                } catch (err) {
                    console.warn('No se pudo registrar la referencia del municipio en el catálogo:', err);
                    municipio = {
                        id: nombreMunicipio.toLowerCase().replace(/\s+/g, '-'),
                        nombre: nombreMunicipio,
                    };
                }
            }

            setMunicipios((actuales) => [
                ...actuales.filter((opcion) => opcion.id !== municipio.id),
                municipio,
            ]);
            setBarriosReloadToken((token) => token + 1);
            onDestinoAgregado({ lugares: municipio.nombre, barrio: '' });
            setMunicipioInput(municipio.nombre);
            ultimoMunicipioRef.current = municipio.nombre;
            onChange(municipio.nombre);
            setBarrioInput('');
            ultimoBarrioRef.current = '';
            onBarrioChange('');
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
            let municipio = municipioSeleccionado;
            if (!municipio) {
                try {
                    const municipioGuardado = await guardarReferenciaUbicacion(
                        route('reparto.modulacion.referencias.municipios.registrar'),
                        { nombre: nombreMunicipio },
                    );
                    setMunicipios((actuales) => [
                        ...actuales.filter(
                            (opcion) => opcion.nombre.localeCompare(municipioGuardado.nombre, 'es', { sensitivity: 'base' }) !== 0,
                        ),
                        municipioGuardado,
                    ]);
                    municipio = municipioGuardado;
                    setMunicipioInput(municipioGuardado.nombre);
                    ultimoMunicipioRef.current = municipioGuardado.nombre;
                    onChange(municipioGuardado.nombre);
                } catch (err) {
                    console.warn('No se pudo registrar el municipio:', err);
                    municipio = {
                        id: nombreMunicipio.toLowerCase().replace(/\s+/g, '-'),
                        nombre: nombreMunicipio,
                    };
                }
            }

            let barrioNombreFinal = nombreBarrio;
            try {
                const barrioGuardado = await guardarReferenciaUbicacion(
                    route('reparto.modulacion.referencias.barrios.registrar'),
                    { municipio_id: municipio.id, nombre: nombreBarrio },
                );
                setBarrios((actuales) => [
                    ...actuales.filter(
                        (actual) => actual.nombre.localeCompare(barrioGuardado.nombre, 'es', { sensitivity: 'base' }) !== 0,
                    ),
                    barrioGuardado,
                ]);
                barrioNombreFinal = barrioGuardado.nombre;
            } catch (err) {
                console.warn('No se pudo registrar la referencia del barrio en el catálogo:', err);
            }

            if (!puedeAgregarViaje) {
                setUbicacionesError('Barrio procesado. Seleccione una placa y pulse + nuevamente para agregarlo al viaje.');
                return;
            }

            setBarrioInput('');
            ultimoBarrioRef.current = '';
            onBarrioChange('');
            onDestinoAgregado({ lugares: municipio.nombre, barrio: barrioNombreFinal });
        } catch (error) {
            setUbicacionesError(error instanceof Error ? error.message : 'No se pudo agregar el barrio.');
        } finally {
            setBarrioGuardando(false);
        }
    };

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
                const response = await fetch(
                    route('reparto.modulacion.referencias.barrios', { municipio_id: municipioSeleccionadoId }),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        signal: controller.signal,
                    },
                );
                const isJson = response.headers.get('content-type')?.includes('application/json');
                if (!response.ok || !isJson) throw new Error('No se pudieron cargar los barrios del municipio.');
                const json = (await response.json()) as { data?: unknown; api_disponible?: unknown };
                let data = json.data;
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    const respuestaAnidada = data as { data?: unknown };
                    data = respuestaAnidada.data;
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

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <Label htmlFor={`${baseId}-departamento`} className="text-xs font-medium text-muted-foreground">Departamento</Label>
                <Input
                    id={`${baseId}-departamento`}
                    name={`${baseId}-departamento`}
                    type="text"
                    value="Nariño"
                    readOnly
                    className="h-10 text-sm mt-0.5 bg-muted font-medium text-muted-foreground"
                />
            </div>
            <div>
                <Label htmlFor={`${baseId}-municipio`} className="text-xs font-medium text-muted-foreground">Municipio / Destino</Label>
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
                        placeholder={municipiosLoading ? 'Cargando municipios...' : 'Seleccione o escriba un municipio'}
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
                        Municipio agregado a este viaje: <span className="font-medium text-foreground">{value}</span>
                    </p>
                )}
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor={`${baseId}-barrio`} className="text-xs font-medium text-muted-foreground">Barrio</Label>
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
                        placeholder={municipioInput.trim() ? 'Seleccione o escriba un barrio' : 'Escriba primero el municipio'}
                        className="h-10 text-sm"
                        autoComplete="off"
                    />
                    {barrioInput.trim() && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Agregar destino a la planeación"
                            title={
                                !municipioInput.trim()
                                    ? 'Agregue primero el municipio'
                                    : !puedeAgregarViaje
                                      ? 'Guardar barrio en catálogo; seleccione una placa para agregarlo al viaje'
                                      : barrioNuevo
                                        ? 'Guardar barrio y agregar destino a la planeación'
                                        : 'Agregar destino a la planeación'
                            }
                            disabled={!municipioInput.trim() || barrioGuardando}
                            onClick={() => void agregarBarrio()}
                        >
                            {barrioGuardando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        </Button>
                    )}
                </div>
                <datalist id={`${baseId}-barrios-list`}>
                    {barrios.map((opcion) => <option key={opcion.id} value={opcion.nombre} />)}
                </datalist>
                {(viajesRegistrados.length > 0 || destinosPendientes.length > 0) && (
                    <div className="mt-1 overflow-hidden rounded-md border border-border/70 bg-muted/30 text-xs" aria-live="polite">
                        <p className="border-b border-border/70 px-3 py-2 font-medium text-foreground">
                            Destinos de la ruta ({viajesRegistrados.length + (destinosPendientes.length > 0 ? 1 : 0)} viajes)
                        </p>
                        <table className="w-full table-fixed border-collapse">
                            <thead>
                                <tr className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    <th scope="col" className="w-1/4 border-b border-r border-border/70 px-3 py-2">Viaje</th>
                                    <th scope="col" className="border-b border-border/70 px-3 py-2">Municipio y barrio</th>
                                </tr>
                            </thead>
                            <tbody>
                            {viajesRegistrados.map((viaje, viajeIndex) => (
                                <tr key={viaje.viaje.id ?? `viaje-registrado-${viajeIndex}`} className="border-b border-border/50 last:border-0">
                                    <th scope="row" className="border-r border-border/70 px-3 py-2 text-left align-top font-medium text-foreground">
                                        Viaje {viaje.numero}
                                    </th>
                                    <td className="px-3 py-2 text-muted-foreground">
                                        <ul className="space-y-1">
                                        {obtenerDestinosViaje(viaje.viaje).map((destino, destinoIndex) => (
                                            <li key={`${destino.lugares}-${destino.barrio}-${destinoIndex}`} className="break-words">
                                                <span className="mr-1 text-foreground" aria-hidden="true">•</span>
                                                {destino.barrio ? `${destino.lugares} — ${destino.barrio}` : destino.lugares}
                                            </li>
                                        ))}
                                        </ul>
                                    </td>
                                </tr>
                            ))}
                            {destinosPendientes.length > 0 && (
                                <tr className="border-b border-border/50 last:border-0 bg-primary/5">
                                    <th scope="row" className="border-r border-border/70 px-3 py-2 text-left align-top font-medium text-foreground">
                                        Viaje {numeroViajePendiente} (en edición)
                                    </th>
                                    <td className="px-3 py-2 text-muted-foreground">
                                        <ul className="space-y-1">
                                        {destinosPendientes.map((destino, destinoIndex) => (
                                            <li key={`${destino.lugares}-${destino.barrio}-${destinoIndex}`} className="flex items-center justify-between gap-2">
                                                <span className="min-w-0 break-words">
                                                    <span className="mr-1 text-foreground" aria-hidden="true">•</span>
                                                {destino.barrio ? `${destino.lugares} — ${destino.barrio}` : destino.lugares}
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
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {barriosLoading
                        ? 'Cargando barrios del municipio...'
                        : value.trim() && municipioSeleccionado && barrios.length === 0
                          ? 'No hay barrios en el catálogo. Puede escribir uno y se guardará con la ruta.'
                          : value.trim() && !municipioSeleccionado
                            ? 'El municipio y el barrio escritos se guardarán al guardar la ruta.'
                            : ''}
                </p>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor={`${baseId}-cliente`} className="text-xs font-medium text-muted-foreground">Cliente</Label>
                <Input
                    id={`${baseId}-cliente`}
                    name="cliente"
                    type="number"
                    min="0"
                    step="1"
                    value={cliente}
                    onChange={(event) => onClienteChange(event.target.value)}
                    placeholder="Ingrese el número de cliente"
                    className="mt-0.5 h-10 text-sm"
                />
            </div>
            {ubicacionesError && <p role="alert" className="text-xs text-destructive sm:col-span-2">{ubicacionesError}</p>}
        </div>
    );
}

const cleanString = (val: unknown, fallback: string = '') => {
    if (val === null || val === undefined || val === 'undefined' || val === 'null') return fallback;
    return String(val);
};

export default function ModulacionIndex({
    fecha: initialFecha,
    modulacion,
    colaboradores = [],
    vehiculos = [],
    currentUser,
    readOnly = false,
    exportExcel = false,
    fijosIniciales = [],
}: Props) {
    // Modo edición: false por defecto si se llega en modo lectura
    const [isEditing, setIsEditing] = useState(() => !readOnly);
    
    // Sincronizar isEditing cuando cambia readOnly desde las props de Inertia
    useEffect(() => {
        if (readOnly) {
            setIsEditing(false);
        }
    }, [readOnly]);
    
    // Fecha seleccionada con Calendario — usar fecha LOCAL (no UTC) para evitar desfase de zona horaria
    const [fechaTexto, setFechaTexto] = useState<string>(() => {
        const fromModulacion = modulacion?.fecha ? String(modulacion.fecha) : null;
        const fromInitial = initialFecha ? String(initialFecha) : null;
        if (fromModulacion) return fromModulacion;
        if (fromInitial) return fromInitial;
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [activeModulacionId, setActiveModulacionId] = useState<number | null>(modulacion?.id ?? null);

    // UD Programado por
    const [udProgramadoPor, setUdProgramadoPor] = useState<string>(() =>
        cleanString(modulacion?.ud_programado_por, cleanString(currentUser, ''))
    );

    // Despachado Por (Colaborador) -> Precargado con 'Jhon alexander rojas muñoz 10041925516'
    const [despachadoPorId, setDespachadoPorId] = useState<string>(
        modulacion?.despachado_por_colaborador_id ? String(modulacion.despachado_por_colaborador_id) : ''
    );
    const [despachadoPorNombre, setDespachadoPorNombre] = useState<string>(() =>
        cleanString(modulacion?.despachado_por_nombre, DESPACHADO_POR_DEFECTO)
    );
    const [showDespachadorDropdown, setShowDespachadorDropdown] = useState(false);
    const [placaSearch, setPlacaSearch] = useState('');
    const [showPlacaDropdown, setShowPlacaDropdown] = useState(false);

    // Flag para saber si la consulta de fecha fue iniciada manualmente por el usuario al crear/cambiar fecha
    const userInitiatedDateChange = React.useRef(false);
    const dateCheckController = useRef<AbortController | null>(null);

    useEffect(() => () => dateCheckController.current?.abort(), []);

    useEffect(() => {
        setActiveModulacionId(modulacion?.id ?? null);
        if (modulacion) {
            if (modulacion.fecha) setFechaTexto(String(modulacion.fecha));
            if (readOnly) {
                setUdProgramadoPor(cleanString(modulacion.ud_programado_por, cleanString(currentUser, '')));
                if (modulacion.despachado_por_colaborador_id)
                    setDespachadoPorId(String(modulacion.despachado_por_colaborador_id));
                setDespachadoPorNombre(cleanString(modulacion.despachado_por_nombre, DESPACHADO_POR_DEFECTO));
            } else {
                setUdProgramadoPor(cleanString(currentUser, ''));
                setDespachadoPorId('');
                setDespachadoPorNombre(DESPACHADO_POR_DEFECTO);
            }

            // Notificar ALERTA SOLO cuando el usuario estaba creando o cambiando de fecha explícitamente
            if (modulacion.fecha && userInitiatedDateChange.current) {
                userInitiatedDateChange.current = false;
                alert(readOnly
                    ? `La fecha ${modulacion.fecha} ya tiene una planeación registrada. Se han precargado los datos.`
                    : `La fecha ${modulacion.fecha} ya tiene una planeación. La pantalla quedó vacía.`);
            }
        }
    }, [modulacion, currentUser, readOnly]);

    // Función para cambiar la fecha consultando la base de datos vía API en tiempo real sin redirigir la página
    const handleFechaChange = async (newFecha: string) => {
        setFechaTexto(newFecha);
        if (!newFecha) return;

        dateCheckController.current?.abort();
        const controller = new AbortController();
        dateCheckController.current = controller;

        setActiveModulacionId(null);
        setRutas([]);
        setCurrentRoute(createEmptyRoute());
        setCurrentViajeForm({ lugares: '', barrio: '', cliente: '', peso: '' });
        setDestinosViajePendientes([]);
        setEditingIndex(null);
        setEditingViajeIndex(null);
        setFilterTablePlaca('todas');
        setNovedadesLocal([]);
        setUdProgramadoPor(cleanString(currentUser, ''));
        setDespachadoPorId('');
        setDespachadoPorNombre(DESPACHADO_POR_DEFECTO);

        try {
            const res = await fetch(`/modules/reparto/modulacion/check-fecha?fecha=${encodeURIComponent(newFecha)}`, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
                signal: controller.signal,
            });
            if (!res.ok) {
                console.error('Error checkFecha HTTP:', res.status);
                return;
            }
            const data = await res.json() as {
                exists?: boolean;
                modulacion?: {
                    id?: number;
                    ud_programado_por?: string | null;
                    despachado_por_colaborador_id?: number | null;
                    despachado_por_nombre?: string | null;
                    items?: Array<{
                        id?: number;
                        modulacion_id?: number;
                        placa?: string;
                        doc_tras?: string | null;
                        cargo?: string | null;
                        tripulacion?: MiembroTripulacion[];
                        viajes?: Array<Partial<Viaje> & { id?: string }>;
                    }>;
                    novedades?: ModulacionNovedadData[];
                } | null;
                fijosIniciales?: Array<{
                    colaborador_id?: number;
                    cedula?: string;
                    nombres?: string;
                    cargo?: string;
                    fijo_rescate?: boolean;
                    fijo_taller?: boolean;
                }>;
            };
            if (controller.signal.aborted) return;
            if (data.exists && data.modulacion) {
                setActiveModulacionId(data.modulacion.id ?? null);
                const rutasExistentes = mapModulacionItems(data.modulacion.items ?? []);
                setRutasGuardadas(rutasExistentes);
                setRutas(readOnly ? rutasExistentes : []);

                if (Array.isArray(data.modulacion.novedades)) {
                    setNovedadesLocal(readOnly ? [...data.modulacion.novedades] : []);
                }

                if (!readOnly) setIsEditing(true);

                if (readOnly) {
                    setUdProgramadoPor(cleanString(data.modulacion.ud_programado_por, cleanString(currentUser, '')));
                    if (data.modulacion.despachado_por_colaborador_id) {
                        setDespachadoPorId(String(data.modulacion.despachado_por_colaborador_id));
                    }
                    setDespachadoPorNombre(cleanString(data.modulacion.despachado_por_nombre, DESPACHADO_POR_DEFECTO));
                    alert(`La fecha ${newFecha} ya tiene una planeación registrada. Se han precargado los datos.`);
                } else {
                    alert(`La fecha ${newFecha} ya tiene una planeación. La pantalla quedó vacía; puede cargarla manualmente para editarla.`);
                }
            } else {
                setActiveModulacionId(null);
                setRutas([]);
                setRutasGuardadas([]);
                if (Array.isArray(data.fijosIniciales) && data.fijosIniciales.length > 0) {
                    setNovedadesLocal(
                        data.fijosIniciales.map((f, i) => ({
                            id: -(i + 1),
                            modulacion_id: 0,
                            colaborador_id: f.colaborador_id,
                            cedula: f.cedula,
                            nombres: f.nombres,
                            cargo: f.cargo,
                            observaciones: '',
                            fijo: true,
                            fijo_rescate: Boolean(f.fijo_rescate),
                            fijo_taller: Boolean(f.fijo_taller),
                            permiso: false,
                            no_asitio: false,
                            incapacidad: false,
                            vacaciones: false,
                        }))
                    );
                } else {
                    setNovedadesLocal([]);
                }
                if (!readOnly) setIsEditing(true);
            }
        } catch (err) {
            if (controller.signal.aborted) return;
            console.error('Error al verificar planeación por fecha:', err);
        }
    };

    // Crear ruta en blanco
    const createEmptyRoute = (): RutaFormState => ({
        placa: '',
        doc_tras: '',
        cargo: '',
        tripulacion: [],
        viajes: [],
    });

    const [currentRoute, setCurrentRoute] = useState<RutaFormState>(createEmptyRoute());
    const [currentViajeForm, setCurrentViajeForm] = useState<Viaje>({
        lugares: '',
        barrio: '',
        cliente: '',
        peso: '',
    });
    const [destinosViajePendientes, setDestinosViajePendientes] = useState<DestinoViaje[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingViajeIndex, setEditingViajeIndex] = useState<number | null>(null);

    // Rutas guardadas en la lista
    const [rutas, setRutas] = useState<RutaFormState[]>(() => {
        return readOnly ? mapModulacionItems(modulacion?.items ?? []) : [];
    });
    const [rutasGuardadas, setRutasGuardadas] = useState<RutaFormState[]>(() =>
        mapModulacionItems(modulacion?.items ?? []),
    );

    useEffect(() => {
        setCurrentRoute(createEmptyRoute());
        setCurrentViajeForm({ lugares: '', barrio: '', cliente: '', peso: '' });
        setDestinosViajePendientes([]);
        setEditingIndex(null);
        setEditingViajeIndex(null);

        const rutasIniciales = mapModulacionItems(modulacion?.items ?? []);
        setRutasGuardadas(rutasIniciales);
        if (readOnly) {
            setRutas(rutasIniciales);
            setIsEditing(false);
        } else if (modulacion) {
            setRutas([]);
            setIsEditing(true);
        } else {
            setRutas([]);
            setIsEditing(true);
        }
    }, [modulacion, readOnly]);

    // Filtros de la Tabla Planeación de Ruta (Solo Filtro por Placa)
    const [filterTablePlaca, setFilterTablePlaca] = useState<string>('todas');

    // Filtros de búsqueda para el Checklist de tripulación
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cargoFilter, setCargoFilter] = useState<string>('todos');

    // COLABORADORES FIJOS
    const fijosColaboradorIds = useMemo(() => {
        const ids = new Set<string>();
        if (readOnly && modulacion?.novedades) {
            modulacion.novedades.forEach((nov) => {
                if (nov.fijo && nov.colaborador_id) {
                    ids.add(String(nov.colaborador_id).trim());
                }
                if (nov.fijo && nov.cedula) {
                    ids.add(`cedula:${String(nov.cedula).trim()}`);
                }
            });
        }
        return ids;
    }, [modulacion?.novedades, readOnly]);

    // BOTÓN EDITAR VIAJE INDIVIDUAL EN LA TABLA
    const handleEditViajeIndividual = (rutaIndex: number, viajeIndex: number) => {
        const routeToEdit = rutas[rutaIndex];
        if (!routeToEdit) return;
        const viajes = Array.isArray(routeToEdit.viajes) ? routeToEdit.viajes : [];
        if (viajes.length === 0 || viajeIndex >= viajes.length) return;

        const viajeToEdit = viajes[viajeIndex];
        setCurrentRoute({
            id: routeToEdit.id,
            placa: routeToEdit.placa,
            doc_tras: routeToEdit.doc_tras ?? '',
            cargo: routeToEdit.cargo ?? '',
            tripulacion: Array.isArray(routeToEdit.tripulacion) ? [...routeToEdit.tripulacion] : [],
            viajes: Array.isArray(routeToEdit.viajes) ? [...routeToEdit.viajes] : [],
        });
        // Precargar el viaje específico en el formulario
        setCurrentViajeForm({
            lugares: viajeToEdit.lugares ?? '',
            barrio: viajeToEdit.barrio ?? '',
            cliente: viajeToEdit.cliente ?? '',
            peso: viajeToEdit.peso ?? '',
        });
        setDestinosViajePendientes(viajeToEdit.destinos ?? []);
        setEditingIndex(rutaIndex);
        setEditingViajeIndex(viajeIndex); // Establecer índice del viaje específico
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCurrentRouteFieldChange = (field: keyof RutaFormState, value: RutaFormState[keyof RutaFormState]) => {
        setCurrentRoute((prev) => {
            const updated = { ...prev, [field]: value };
            if (editingIndex !== null && editingIndex >= 0) {
                setRutas((prevRutas) => {
                    const list = [...prevRutas];
                    if (list[editingIndex]) {
                        list[editingIndex] = updated;
                    }
                    return list;
                });
            }
            return updated;
        });
    };

    const handlePlacaChange = (newPlaca: string) => {
        const placaUpper = newPlaca.trim().toUpperCase();
        const currentPlacaUpper = currentRoute.placa.trim().toUpperCase();

        if (placaUpper === currentPlacaUpper) return;

        const rutaExistenteIndex = rutas.findIndex(
            (ruta) => ruta.placa.trim().toUpperCase() === placaUpper,
        );
        const rutaExistente = rutaExistenteIndex >= 0 ? rutas[rutaExistenteIndex] : null;

        setCurrentRoute(rutaExistente
            ? {
                ...rutaExistente,
                tripulacion: [...rutaExistente.tripulacion],
                viajes: [...rutaExistente.viajes],
            }
            : {
                placa: placaUpper,
                doc_tras: '',
                cargo: '',
                tripulacion: [],
                viajes: [],
            });
        setEditingIndex(rutaExistente ? rutaExistenteIndex : null);
        setEditingViajeIndex(null);
        setCurrentViajeForm({
            lugares: '',
            barrio: '',
            cliente: '',
            peso: '',
        });
        setDestinosViajePendientes([]);
        setSearchQuery('');
        setCargoFilter('todos');
    };

    // OBTENER LISTA DE COLABORADORES ASIGNADOS (EXCLUYENDO LA RUTA ACTUAL EN EDICIÓN)
    const assignedCollaboratorsSet = useMemo(() => {
        const set = new Set<string>();
        rutas.forEach((r, idx) => {
            if (editingIndex !== null && idx === editingIndex) return;
            if (Array.isArray(r.tripulacion)) {
                r.tripulacion.forEach((m) => {
                    if (m.colaborador_id !== undefined && m.colaborador_id !== null && String(m.colaborador_id).trim() !== '') {
                        set.add(`id:${String(m.colaborador_id).trim()}`);
                    }
                    if (m.cedula && String(m.cedula).trim() !== '') {
                        set.add(`cedula:${String(m.cedula).trim()}`);
                    }
                });
            }
        });
        return set;
    }, [rutas, editingIndex]);

    const isCollaboratorAlreadyAssigned = useCallback((col: ColaboradorOption) => {
        const colIdStr = String(col.id).trim();
        const colCedStr = col.cedula ? String(col.cedula).trim() : '';

        const isSelectedInCurrent = currentRoute.tripulacion.some(
            (m) =>
                (m.colaborador_id && String(m.colaborador_id).trim() === colIdStr) ||
                (m.cedula && colCedStr !== '' && String(m.cedula).trim() === colCedStr)
        );
        if (isSelectedInCurrent) return false;

        return (
            assignedCollaboratorsSet.has(`id:${colIdStr}`) ||
            (colCedStr !== '' && assignedCollaboratorsSet.has(`cedula:${colCedStr}`))
        );
    }, [assignedCollaboratorsSet, currentRoute.tripulacion]);

    // MANEJO DE CHECKLIST DE TRIPULACIÓN
    const handleToggleChecklistMember = (col: ColaboradorOption) => {
        const colIdStr = String(col.id).trim();
        const colCedStr = col.cedula ? String(col.cedula).trim() : '';

        const trip = [...currentRoute.tripulacion];
        const existingIdx = trip.findIndex(
            (m) =>
                (m.colaborador_id && String(m.colaborador_id).trim() === colIdStr) ||
                (m.cedula && colCedStr !== '' && String(m.cedula).trim() === colCedStr)
        );

        if (existingIdx >= 0) {
            trip.splice(existingIdx, 1);
        } else {
            if (isCollaboratorAlreadyAssigned(col)) {
                alert(`El colaborador "${col.nombre_completo}" ya se encuentra asignado a otra ruta para hoy.`);
                return;
            }
            trip.push({
                colaborador_id: col.id,
                cedula: col.cedula || '',
                nombres: col.nombre_completo || '',
                cargo: col.cargo || '',
            });
        }

        setCurrentRoute((prev) => {
            const updated = { ...prev, tripulacion: trip };
            if (editingIndex !== null && editingIndex >= 0) {
                setRutas((prevRutas) => {
                    const list = [...prevRutas];
                    if (list[editingIndex]) {
                        list[editingIndex] = updated;
                    }
                    return list;
                });
            }
            return updated;
        });
    };

    // MANEJO DE VIAJE FORMULARIO Y AGREGAR VIAJE
    const handleViajeFormChange = (field: keyof Viaje, value: string) => {
        setCurrentViajeForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddViaje = (e?: React.FormEvent | React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            if ('stopPropagation' in e) e.stopPropagation();
        }
        if (showPlacaDropdown && placaSearch.trim() !== '') {
            alert('Seleccione una placa existente de la lista.');
            return;
        }
        if (!currentRoute.placa || currentRoute.placa.trim() === '') {
            alert('Por favor ingrese una Placa para la ruta.');
            return;
        }

        const cv = currentViajeForm;
        const destinos = destinosViajePendientes.length > 0
            ? destinosViajePendientes
            : cv.lugares.trim() || cv.barrio.trim()
              ? [{ lugares: cv.lugares.trim(), barrio: cv.barrio.trim() }]
              : [];
        const viajeFormLleno = viajeTieneDatos(cv, destinos);

        if (!viajeFormLleno && editingViajeIndex === null) {
            alert('Por favor ingrese al menos un dato en Destino, Barrio, Cliente o Peso para agregar el viaje.');
            return;
        }

        let updatedRoute: RutaFormState;

        // Solo reemplaza un viaje cuando se inició desde su acción de edición.
        if (editingViajeIndex !== null && editingIndex !== null) {
            const updatedViajes = [...(currentRoute.viajes || [])];

            if (editingViajeIndex < 0 || editingViajeIndex >= updatedViajes.length) {
                alert('No se encontró el viaje que está intentando editar.');
                return;
            }

            if (viajeFormLleno) {
                updatedViajes[editingViajeIndex] = {
                    ...updatedViajes[editingViajeIndex],
                    lugares: destinos[0]?.lugares ?? cv.lugares,
                    barrio: destinos[0]?.barrio ?? cv.barrio,
                    destinos: destinos.length > 0 ? destinos : undefined,
                    cliente: cv.cliente || '',
                    peso: cv.peso || '',
                };
            } else {
                updatedViajes.splice(editingViajeIndex, 1);
            }

            updatedRoute = {
                ...currentRoute,
                tripulacion: [...(currentRoute.tripulacion || [])],
                viajes: updatedViajes,
            };

            const rutaQuedaSinViajes = updatedViajes.length === 0;
            setRutas((prev) => {
                if (editingIndex < 0 || editingIndex >= prev.length) return prev;
                if (rutaQuedaSinViajes) return prev.filter((_, index) => index !== editingIndex);

                const updated = [...prev];
                updated[editingIndex] = updatedRoute;
                return updated;
            });

            if (rutaQuedaSinViajes) {
                setCurrentRoute(createEmptyRoute());
                setEditingIndex(null);
            } else {
                setCurrentRoute(updatedRoute);
            }
            // Limpiar el formulario de viaje después de actualizar
            setCurrentViajeForm({
                lugares: '',
                barrio: '',
                cliente: '',
                peso: '',
            });
            setDestinosViajePendientes([]);
            setEditingViajeIndex(null); // Resetear índice de viaje
            alert(
                viajeFormLleno
                    ? 'Viaje actualizado correctamente'
                    : rutaQuedaSinViajes
                      ? 'El viaje vacío y su ruta se eliminaron correctamente'
                      : 'Viaje vacío eliminado correctamente',
            );
            return;
        }

        // Agregar viaje, también cuando la placa ya tiene otros viajes en la tabla.
        const newViaje: Viaje = {
            id: generateId(),
            lugares: destinos[0]?.lugares ?? cv.lugares,
            barrio: destinos[0]?.barrio ?? cv.barrio,
            destinos: destinos.length > 0 ? destinos : undefined,
            cliente: cv.cliente || '',
            peso: cv.peso || '',
        };

        const existingRouteIndex = rutas.findIndex(
            (route) => route.placa.trim().toUpperCase() === currentRoute.placa.trim().toUpperCase(),
        );
        const routeIndex = editingIndex ?? (existingRouteIndex >= 0 ? existingRouteIndex : rutas.length);
        setRutas((prev) => {
            const updated = [...prev];
            const existingIdx = updated.findIndex(
                (route) => route.placa.trim().toUpperCase() === currentRoute.placa.trim().toUpperCase(),
            );
            const routeToUpdate = existingIdx >= 0 ? updated[existingIdx] : currentRoute;
            const updatedRoute: RutaFormState = {
                ...routeToUpdate,
                ...currentRoute,
                tripulacion: [...(currentRoute.tripulacion || routeToUpdate.tripulacion || [])],
                viajes: combinarViajes(routeToUpdate.viajes ?? [], currentRoute.viajes ?? [], [newViaje]),
            };

            if (existingIdx >= 0) {
                updated[existingIdx] = updatedRoute;
            } else {
                updated.push(updatedRoute);
            }
            return updated;
        });

        setCurrentRoute((prev) => ({
            ...prev,
            ...currentRoute,
            viajes: combinarViajes(prev.viajes ?? [], currentRoute.viajes ?? [], [newViaje]),
        }));
        setCurrentViajeForm({
            lugares: '',
            barrio: '',
            cliente: '',
            peso: '',
        });
        setDestinosViajePendientes([]);
        setEditingViajeIndex(null);
        setEditingIndex(routeIndex);
    };

    const handleRemoveViajeIndividual = (placa: string, viajeId: string | undefined, viajeIndex: number) => {
        if (!confirm('¿Está seguro de eliminar este viaje?')) return;

        const placaNormalizada = placa.trim().toUpperCase();
        const ruta = rutas.find((item) => item.placa.trim().toUpperCase() === placaNormalizada);
        if (!ruta) return;

        const viajeActual = ruta.viajes[viajeIndex];
        const viajeGuardadoIndex = ruta.id
            ? (rutasGuardadas.find((item) => item.id === ruta.id)?.viajes ?? [])
                .findIndex((viaje, index) =>
                    viajeId
                        ? viaje.id === viajeId || `srv-${ruta.id}-v${index}` === viajeId
                        : index === viajeIndex,
                )
            : -1;

        if (ruta.id && viajeActual && viajeGuardadoIndex >= 0) {
            router.delete(route('reparto.modulacion.destroyViaje', {
                id: ruta.id,
                viajeIndex: viajeGuardadoIndex,
            }), {
                data: {
                    return_fecha: fechaTexto,
                    return_read_only: readOnly,
                },
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    const viajesActualizados = ruta.viajes.filter((viaje) =>
                        viajeId ? viaje.id !== viajeId : viaje !== viajeActual,
                    );
                    const rutasActualizadas = viajesActualizados.length > 0
                        ? rutas.map((item) =>
                            item.placa.trim().toUpperCase() === placaNormalizada
                                ? { ...item, viajes: viajesActualizados }
                                : item,
                        )
                        : rutas.filter((item) => item.placa.trim().toUpperCase() !== placaNormalizada);

                    setRutas(rutasActualizadas);
                    if (currentRoute.placa.trim().toUpperCase() === placaNormalizada) {
                        if (viajesActualizados.length > 0) {
                            setCurrentRoute((prev) => ({ ...prev, viajes: viajesActualizados }));
                        } else {
                            setCurrentRoute(createEmptyRoute());
                            setEditingIndex(null);
                            setEditingViajeIndex(null);
                            setCurrentViajeForm({ lugares: '', barrio: '', cliente: '', peso: '' });
                            setDestinosViajePendientes([]);
                        }
                    }
                },
            });
            return;
        }

        const viajes = ruta.viajes.filter((viaje, index) =>
            viajeId ? viaje.id !== viajeId : index !== viajeIndex,
        );
        const rutasActualizadas = viajes.length > 0
            ? rutas.map((item) =>
                item.placa.trim().toUpperCase() === placaNormalizada ? { ...item, viajes } : item,
            )
            : rutas.filter((item) => item.placa.trim().toUpperCase() !== placaNormalizada);

        setRutas(rutasActualizadas);

        if (currentRoute.placa.trim().toUpperCase() === placaNormalizada) {
            if (viajes.length > 0) {
                setCurrentRoute((prev) => ({ ...prev, viajes }));
            } else {
                setCurrentRoute(createEmptyRoute());
                setEditingIndex(null);
                setEditingViajeIndex(null);
                setCurrentViajeForm({ lugares: '', barrio: '', cliente: '', peso: '' });
                setDestinosViajePendientes([]);
            }
        }
    };

    // GUARDAR PLANEACIÓN DE RUTA COMPLETA (TODAS LAS RUTAS + NOVEDADES)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleGuardarTodo = () => {
        const finalRutas = [...rutas];

        if (currentRoute.placa && currentRoute.placa.trim() !== '') {
            const viajes = Array.isArray(currentRoute.viajes) ? [...currentRoute.viajes] : [];
            const cv = currentViajeForm;
            const destinos = destinosViajePendientes.length > 0
                ? destinosViajePendientes
                : cv.lugares.trim() || cv.barrio.trim()
                  ? [{ lugares: cv.lugares.trim(), barrio: cv.barrio.trim() }]
                  : [];
            const viajeFormTieneDatos = viajeTieneDatos(cv, destinos);

            if (editingViajeIndex !== null && editingViajeIndex >= 0 && editingViajeIndex < viajes.length) {
                if (viajeFormTieneDatos) {
                    const viajeOriginal = viajes[editingViajeIndex];
                    viajes[editingViajeIndex] = {
                        ...viajeOriginal,
                        lugares: destinos[0]?.lugares ?? cv.lugares,
                        barrio: destinos[0]?.barrio ?? cv.barrio,
                        destinos: destinos.length > 0 ? destinos : undefined,
                        cliente: cv.cliente || '',
                        peso: cv.peso || '',
                    };
                } else {
                    viajes.splice(editingViajeIndex, 1);
                }
            } else if (viajeFormTieneDatos) {
                const yaExisteEnArray = viajes.some((v) => {
                    return (
                        (v.lugares === cv.lugares) &&
                        (v.barrio === cv.barrio) &&
                        (String(v.cliente ?? '') === String(cv.cliente ?? '')) &&
                        (String(v.peso ?? '') === String(cv.peso ?? ''))
                    );
                });
                if (!yaExisteEnArray) {
                    viajes.push({
                        id: generateId(),
                        lugares: destinos[0]?.lugares ?? cv.lugares,
                        barrio: destinos[0]?.barrio ?? cv.barrio,
                        destinos: destinos.length > 0 ? destinos : undefined,
                        cliente: cv.cliente || '',
                        peso: cv.peso || '',
                    });
                }
            }

            const currentRouteFinal: RutaFormState = {
                ...currentRoute,
                viajes,
            };

            if (editingIndex !== null && editingIndex >= 0 && editingIndex < finalRutas.length) {
                if (editingViajeIndex !== null && viajes.length === 0) {
                    finalRutas.splice(editingIndex, 1);
                } else {
                    finalRutas[editingIndex] = currentRouteFinal;
                }
            } else {
                finalRutas.push(currentRouteFinal);
            }
        }

        // NO se inyectan colaboradores fijos ni novedades en la tripulación de finalRutas.
        // Tripulación contiene SOLO los miembros asignados explícitamente a cada ruta.

        if (finalRutas.length === 0) {
            alert('Por favor ingrese al menos una ruta con Placa antes de guardar la planeación.');
            return;
        }

        setIsSubmitting(true);

        // Preparar novedades para enviar en lote
        // - Las que tienen id real: actualizar checkboxes
        // - Las que tienen id negativo (pendientes): crear nuevas en el backend
        const novedadesPayload = novedadesLocal.map((nov) => {
            const isNew = nov.id < 0;
            return {
                ...(isNew ? {} : { id: nov.id }),
                colaborador_id: nov.colaborador_id ?? null,
                cedula: nov.cedula ?? null,
                nombres: nov.nombres ?? null,
                cargo: nov.cargo ?? null,
                observaciones: nov.observaciones ?? null,
                fijo_rescate: Boolean(nov.fijo_rescate),
                fijo_taller: Boolean(nov.fijo_taller),
                fijo: Boolean(nov.fijo_rescate) || Boolean(nov.fijo_taller),
                permiso: Boolean(nov.permiso),
                no_asitio: Boolean(nov.no_asitio),
                incapacidad: Boolean(nov.incapacidad),
                vacaciones: Boolean(nov.vacaciones),
            };
        });

        router.post(
            route('reparto.modulacion.storeBatch'),
            {
                modulacion_id: activeModulacionId,
                fecha: fechaTexto,
                ud_programado_por: udProgramadoPor,
                despachado_por_colaborador_id: despachadoPorId ? Number(despachadoPorId) : null,
                despachado_por_nombre: despachadoPorNombre,
                rutas: finalRutas as unknown as Record<string, unknown>[],
                novedades: novedadesPayload,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => {
                    setIsSubmitting(false);
                    alert('Planeación de ruta guardada correctamente.');
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    console.error('Error al guardar planeación:', errs);
                    const msg =
                        errs.rutas ||
                        Object.values(errs)[0] ||
                        'Error al guardar la planeación. Verifique los campos requeridos.';
                    alert(msg);
                },
            }
        );
    };

    // TABLA 2: NOVEDADES — estado local unificado (servidor + fijos iniciales + pendientes nuevas)
    const [novedadesLocal, setNovedadesLocal] = useState<ModulacionNovedadData[]>(() => {
        // Cargar novedades guardadas del servidor siempre que existan,
        // tanto en modo lectura como en modo edición.
        if (modulacion?.novedades && modulacion.novedades.length > 0) {
            return [...modulacion.novedades];
        }
        if (fijosIniciales && fijosIniciales.length > 0) {
            return fijosIniciales.map((f, i) => ({
                id: -(i + 1),
                modulacion_id: 0,
                colaborador_id: f.colaborador_id,
                cedula: f.cedula,
                nombres: f.nombres,
                cargo: f.cargo,
                observaciones: '',
                fijo: true,
                fijo_rescate: Boolean(f.fijo_rescate),
                fijo_taller: Boolean(f.fijo_taller),
                permiso: false,
                no_asitio: false,
                incapacidad: false,
                vacaciones: false,
            }));
        }
        return [];
    });

    // Sincronizar novedades cuando cambia modulacion o fijosIniciales
    useEffect(() => {
        // Cargar novedades del servidor siempre que existan (lectura y edición).
        if (modulacion?.novedades && modulacion.novedades.length > 0) {
            setNovedadesLocal([...modulacion.novedades]);
        } else if (!modulacion && fijosIniciales && fijosIniciales.length > 0) {
            setNovedadesLocal(
                fijosIniciales.map((f, i) => ({
                    id: -(i + 1),
                    modulacion_id: 0,
                    colaborador_id: f.colaborador_id,
                    cedula: f.cedula,
                    nombres: f.nombres,
                    cargo: f.cargo,
                    observaciones: '',
                    fijo: true,
                    fijo_rescate: Boolean(f.fijo_rescate),
                    fijo_taller: Boolean(f.fijo_taller),
                    permiso: false,
                    no_asitio: false,
                    incapacidad: false,
                    vacaciones: false,
                }))
            );
        } else {
            setNovedadesLocal([]);
        }
    }, [modulacion, fijosIniciales, readOnly]);

    // Para compatibilidad con el payload de storeBatch — mantiene los cambios de checkboxes
    // FORMULARIO DE INGRESO A TABLA 2
    const [nuevaNovedad, setNuevaNovedad] = useState({
        colaborador_id: '',
        cedula: '',
        nombres: '',
        cargo: '',
        observaciones: '',
        fijo_rescate: false,
        fijo_taller: false,
        permiso: false,
        no_asitio: false,
        incapacidad: false,
        vacaciones: false,
    });
    const [novedadColaboradorSearch, setNovedadColaboradorSearch] = useState('');
    const [showNovedadColaboradorDropdown, setShowNovedadColaboradorDropdown] = useState(false);

    const handleNuevaNovedadSelectColaborador = (val: string) => {
        if (!val) {
            setNuevaNovedad((prev) => ({
                ...prev,
                colaborador_id: '',
                cedula: '',
                nombres: '',
                cargo: '',
            }));
            setNovedadColaboradorSearch('');
            return;
        }
        const col = colaboradores.find((c) => String(c.id) === val && esPersonalOperativoDeRuta(c.area));
        if (col) {
            setNuevaNovedad((prev) => ({
                ...prev,
                colaborador_id: String(col.id),
                cedula: col.cedula || '',
                nombres: col.nombre_completo || '',
                cargo: col.cargo || '',
            }));
            setNovedadColaboradorSearch(`${col.nombre_completo ?? ''} (${col.cedula ?? ''})`);
            setShowNovedadColaboradorDropdown(false);
        }
    };

    const colaboradoresOperativosNovedad = colaboradores
        .filter((col) => esPersonalOperativoDeRuta(col.area))
        .filter((col) => {
            const query = novedadColaboradorSearch.trim().toLocaleLowerCase();
            return !query ||
                (col.nombre_completo ?? '').toLocaleLowerCase().includes(query) ||
                (col.cedula ?? '').toLocaleLowerCase().includes(query);
        })
        .slice(0, 20);

    const handleAgregarNovedadTabla2 = () => {
        if (!nuevaNovedad.nombres || nuevaNovedad.nombres.trim() === '') {
            alert('Por favor seleccione un colaborador.');
            return;
        }

        // Verificar duplicado por cédula o colaborador_id
        const yaExiste = novedadesLocal.some((n) =>
            (nuevaNovedad.cedula && n.cedula === nuevaNovedad.cedula) ||
            (nuevaNovedad.colaborador_id && String(n.colaborador_id) === nuevaNovedad.colaborador_id)
        );
        if (yaExiste) {
            alert('Este colaborador ya está en la tabla de novedades.');
            return;
        }

        // Agregar localmente con id temporal negativo (no existe en BD todavía)
        const tempId = -(Date.now());
        const nuevaFila: ModulacionNovedadData = {
            id: tempId,
            modulacion_id: activeModulacionId ?? 0,
            colaborador_id: nuevaNovedad.colaborador_id ? Number(nuevaNovedad.colaborador_id) : undefined,
            cedula: nuevaNovedad.cedula,
            nombres: nuevaNovedad.nombres,
            cargo: nuevaNovedad.cargo,
            observaciones: nuevaNovedad.observaciones,
            fijo: nuevaNovedad.fijo_rescate || nuevaNovedad.fijo_taller,
            fijo_rescate: nuevaNovedad.fijo_rescate,
            fijo_taller: nuevaNovedad.fijo_taller,
            permiso: nuevaNovedad.permiso,
            no_asitio: nuevaNovedad.no_asitio,
            incapacidad: nuevaNovedad.incapacidad,
            vacaciones: nuevaNovedad.vacaciones,
        };

        setNovedadesLocal((prev) => [...prev, nuevaFila]);

        // Limpiar formulario
        setNuevaNovedad({
            colaborador_id: '',
            cedula: '',
            nombres: '',
            cargo: '',
            observaciones: '',
            fijo_rescate: false,
            fijo_taller: false,
            permiso: false,
            no_asitio: false,
            incapacidad: false,
            vacaciones: false,
        });
    };

    const handleNovedadChange = (id: number, field: keyof ModulacionNovedadData, value: ModulacionNovedadData[keyof ModulacionNovedadData]) => {
        setNovedadesLocal((prev) =>
            prev.map((n) => n.id === id ? { ...n, [field]: value } : n)
        );
    };

    // handleSaveNovedad eliminado: las novedades se guardan junto con las rutas en "Guardar Planeación de Ruta"


    const handleDeleteNovedad = (id: number) => {
        if (id < 0) {
            // Fila pendiente (nunca guardada) — solo quitar del estado local
            setNovedadesLocal((prev) => prev.filter((n) => n.id !== id));
            return;
        }
        if (confirm('¿Desea eliminar este colaborador de la tabla de novedades?')) {
            setNovedadesLocal((prev) => prev.filter((n) => n.id !== id));
            router.delete(route('reparto.modulacion.destroyNovedad', id), {
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    // SEPARACIÓN Y FILTRADO ESTRICTO DE COLABORADORES
    const isFiltering = useMemo(() => {
        return searchQuery.trim() !== '' || cargoFilter !== 'todos';
    }, [searchQuery, cargoFilter]);

    const { selectedColaboradores, unselectedColaboradores } = useMemo(() => {
        const selected: ColaboradorOption[] = [];
        const unselected: ColaboradorOption[] = [];

        colaboradores.filter((col) => esPersonalOperativoDeRuta(col.area)).forEach((col) => {
            const colIdStr = String(col.id).trim();
            const colCedStr = col.cedula ? String(col.cedula).trim() : '';

            const isCheckedInCurrent = currentRoute.tripulacion.some(
                (m) =>
                    (m.colaborador_id && String(m.colaborador_id).trim() === colIdStr) ||
                    (m.cedula && colCedStr !== '' && String(m.cedula).trim() === colCedStr)
            );

            if (isCheckedInCurrent) {
                selected.push(col);
                return;
            }

            // Solo mostrar colaboradores libres no seleccionados cuando el usuario está filtrando
            if (isFiltering) {
                const matchesCargo = cargoFilter === 'todos' || col.cargo === cargoFilter;
                const q = searchQuery.toLowerCase().trim();
                const matchesSearch =
                    !q ||
                    (col.nombre_completo && col.nombre_completo.toLowerCase().includes(q)) ||
                    (col.cedula && col.cedula.includes(q));

                if (matchesCargo && matchesSearch) {
                    const isAssignedElsewhere = isCollaboratorAlreadyAssigned(col);
                    if (!isAssignedElsewhere) {
                        unselected.push(col);
                    }
                }
            }
        });

        currentRoute.tripulacion.forEach((m) => {
            const mIdStr = m.colaborador_id ? String(m.colaborador_id).trim() : '';
            const mCedStr = m.cedula ? String(m.cedula).trim() : '';

            const foundInSelected = selected.some(
                (s) =>
                    (mIdStr !== '' && String(s.id).trim() === mIdStr) ||
                    (mCedStr !== '' && s.cedula && String(s.cedula).trim() === mCedStr)
            );
            if (!foundInSelected) {
                selected.push({
                    id: m.colaborador_id ? Number(m.colaborador_id) : -(Math.abs(parseInt(m.cedula || '0', 10)) || 1),
                    cedula: m.cedula || '',
                    nombres: m.nombres || '',
                    apellidos: '',
                    nombre_completo: m.nombres || 'Colaborador',
                    cargo: m.cargo || '',
                    area: null,
                });
            }
        });

        return { selectedColaboradores: selected, unselectedColaboradores: unselected };
    }, [colaboradores, cargoFilter, searchQuery, currentRoute.tripulacion, isCollaboratorAlreadyAssigned, isFiltering]);

    const allChecklistColaboradores = [...selectedColaboradores, ...unselectedColaboradores];
    const cargosOperativos = Array.from(
        new Set(
            colaboradores
                .filter((col) => esPersonalOperativoDeRuta(col.area))
                .map((col) => col.cargo)
                .filter(Boolean),
        ),
    ).sort((a, b) => a.localeCompare(b));
    const placasDisponibles = vehiculos.filter((vehiculo) => {
        const placaUpper = String(vehiculo).toUpperCase();
        if (placaUpper === currentRoute.placa.toUpperCase()) return true;
        return !rutas.some((ruta, index) => {
            if (editingIndex !== null && index === editingIndex) return false;
            return String(ruta.placa).toUpperCase() === placaUpper;
        });
    });
    const placasCoincidentes = placasDisponibles.filter((vehiculo) =>
        String(vehiculo).toUpperCase().includes(placaSearch.trim().toUpperCase()),
    );

    // LISTA ÚNICA DE PLACAS
    const uniquePlacasInRutas = useMemo(() => {
        const set = new Set<string>();
        rutas.forEach((r) => {
            if (r.placa) set.add(r.placa.toUpperCase());
        });
        return Array.from(set);
    }, [rutas]);

    // RUTAS FILTRADAS EN LA TABLA PLANEACIÓN DE RUTA
    const filteredRutasTable = useMemo(() => {
        return rutas.filter((r) => {
            const matchesPlaca =
                filterTablePlaca === 'todas' || !filterTablePlaca
                    ? true
                    : r.placa.toUpperCase() === filterTablePlaca.toUpperCase();

            return matchesPlaca;
        });
    }, [rutas, filterTablePlaca]);

    // FUNCIÓN PARA EXPORTAR A EXCEL — Formato exacto según plantilla con estilos
    const handleExportExcel = () => {
        if (filteredRutasTable.length === 0) {
            alert('No hay rutas para exportar con los filtros seleccionados.');
            return;
        }

        const wb = XLSX.utils.book_new();

        // ─── Paleta y estilos base ──────────────────────────────────
        const AZUL_OSCURO = '1F3864';       // Encabezados (fondo azul marino)
        const AZUL_CLARO_NOMBRES = 'B4C6E7'; // Fondo columna NOMBRE en novedades
        const AZUL_CARGO_1 = '4472C4';      // 1er tripulante
        const AZUL_CLARO_CARGO_2 = 'FFD700'; // 2do tripulante (amarillo)
        const AZUL_TEXTO_CARGO_2 = '1565C0'; // Texto azul claro fuerte para el 2do tripulante
        const GRIS_CARGO_3 = 'D9D9D9';      // 3er tripulante
        const BLANCO_CARGO_4 = 'FFFFFF';    // 4to tripulante
        const NEGRO_PLACA = '000000';       // Fondo columna placa
        const BORDER_THIN = {
            top: { style: 'thin' as const, color: { rgb: 'FF000000' } },
            bottom: { style: 'thin' as const, color: { rgb: 'FF000000' } },
            left: { style: 'thin' as const, color: { rgb: 'FF000000' } },
            right: { style: 'thin' as const, color: { rgb: 'FF000000' } },
        };

        const FONT_HEADER = {
            bold: true,
            color: { rgb: 'FFFFFF' },
            sz: 11,
            name: 'Calibri',
        };
        const FONT_BODY = { sz: 11, name: 'Calibri', color: { rgb: '000000' } };
        const FONT_BODY_BOLD_BLACK = { sz: 11, name: 'Calibri', bold: true, color: { rgb: '000000' } };
        const FONT_PLACA = { sz: 12, name: 'Calibri', bold: true, color: { rgb: 'FFFFFF' } };

        const ALIGN_CENTER = { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true };
        const ALIGN_LEFT = { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true };
        // ─── Determinar máximo de viajes y tripulantes ──────────────
        let maxViajes = 1;
        let maxTripulantes = 1;
        filteredRutasTable.forEach((r) => {
            const numViajes = (r.viajes || []).length;
            const numTrip = (r.tripulacion || []).length;
            if (numViajes > maxViajes) maxViajes = numViajes;
            if (numTrip > maxTripulantes) maxTripulantes = numTrip;
        });

        // Estructura de columnas (SECCIÓN RUTAS, 1 fila por ruta):
        // [A] placa, [B] DOC.T RAS, [C] OBSERVACIONES (NUEVA),
        // [D] TRIPULACION (multi-linea), [E] REUNION,
        // [F..F+n-1] 1ER/2DO VIAJE..., [G+n] CLIENTE, [H+n] peso
        //
        // SECCIÓN NOVEDADES (1 fila por novedad, 1 sola columna A, NO merge cols):
        // [A] IDENTIFICACIÓN / NOMBRE (multi-linea), [B] OBSERVACIONES,
        // [C] FIJO RESCATE, [D] FIJO TALLER, [E] PERMISO, [F] NO ASISTIO,
        // [G] INCAPACIDAD, [H] VACACIONES

        const cell = (
            v: unknown,
            opts: {
                s?: XLSX.CellStyle;
                t?: 's' | 'n' | 'b';
            } = {}
        ): XLSX.CellObject => {
            let type: 's' | 'n' | 'b' = opts.t ?? 's';
            const value: XLSX.CellObject['v'] =
                typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v instanceof Date
                    ? v
                    : String(v ?? '');
            if (typeof value === 'number') {
                type = 'n';
            } else if (typeof value === 'boolean') {
                type = 'b';
            }
            const out: XLSX.CellObject = { t: type, v: value };
            if (opts.s) out.s = opts.s;
            return out;
        };

        const emptyCell = (s?: XLSX.CellStyle): XLSX.CellObject => cell('', { s });

        const styleHeaderBase: XLSX.CellStyle = {
            fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
            font: FONT_HEADER,
            alignment: ALIGN_CENTER,
            border: BORDER_THIN,
        };
        const styleHeaderRotated = (deg: number): XLSX.CellStyle => ({
            ...styleHeaderBase,
            alignment: {
                ...ALIGN_CENTER,
                textRotation: deg,
            },
        });
        // ─── Construir hoja ──────────────────────────────────────────
        // Usamos un objeto plano { A1: cell, B1: cell, ... } para control total
        const wsData: Record<string, XLSX.CellObject> = {};
        const setCell = (r: number, c: number, val: XLSX.CellObject) => {
            const addr = XLSX.utils.encode_cell({ r, c });
            wsData[addr] = val;
        };

        // Índice de columnas (base 0)
        const COL = {
            PLACA: 0,
            DOC_TRAS: 1,
            TRIP_COLOR: 2,
            TRIP_NOMBRE: 3,
            REUNION: 4,
            PRIMER_VIAJE: 5,
        };
        const LAST_VIAJE_COL = COL.PRIMER_VIAJE + maxViajes - 1;
        const COL_CLIENTE = LAST_VIAJE_COL + 1;
        const COL_PESO = COL_CLIENTE + 1;
        const TOTAL_COLS = Math.max(COL_PESO + 1, 6);
        const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

        // Parsear fecha en HORA LOCAL para evitar desfase por zona horaria UTC
        // fechaTexto viene como 'YYYY-MM-DD' (sin hora); sin time part JS lo interpreta como UTC
        const fechaString = fechaTexto
            ? `${fechaTexto}T00:00:00`
            : new Date().toISOString().split('T')[0] + 'T00:00:00';
        const fechaDate = new Date(fechaString);
        const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
        const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const diaStr = DIAS_SEMANA[fechaDate.getDay()] ?? '';
        const mesStr = MESES[fechaDate.getMonth()] ?? '';
        const textoFecha = `${diaStr} ${fechaDate.getDate()} ${mesStr} ${fechaDate.getFullYear()}`;
        const totalRutas = filteredRutasTable.length;
        const textoRutas = `${totalRutas} RUTA${totalRutas === 1 ? '' : 'S'} - ${textoFecha}`;

        // ─── Fila 0 (r=0): Cantidad de rutas en A:E + PROGRAMADO POR en viajes ───
        const textoProgramado = `PROGRAMADO POR **${(udProgramadoPor || '').toUpperCase()}**`;
        // Merge PROGRAMADO POR sobre columnas de viajes + cliente + peso
        const mergeRow0Header = {
            s: { r: 0, c: COL.PRIMER_VIAJE },
            e: { r: 0, c: COL_PESO },
        };
        // Merge A:E (0..4) para la cantidad de rutas + fecha, combinando 2 filas (0 y 1)
        const mergeRutas = { s: { r: 0, c: 0 }, e: { r: 1, c: 4 } };
        for (let c = 0; c < TOTAL_COLS; c++) {
            if (c >= 0 && c <= 4) {
                if (c === 0) {
                    setCell(0, c, cell(textoRutas, {
                        s: {
                            fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
                            font: { ...FONT_HEADER, sz: 14 },
                            alignment: { ...ALIGN_CENTER },
                            border: BORDER_THIN,
                        },
                    }));
                } else {
                    setCell(0, c, emptyCell({
                        fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
                        border: BORDER_THIN,
                    }));
                }
            } else if (c === COL.PRIMER_VIAJE) {
                setCell(0, c, cell(textoProgramado, {
                    s: {
                        fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
                        font: { ...FONT_HEADER, sz: 12 },
                        alignment: ALIGN_CENTER,
                        border: BORDER_THIN,
                    },
                }));
            } else {
                setCell(0, c, emptyCell({
                    fill: c >= COL.PRIMER_VIAJE
                        ? { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } }
                        : undefined,
                    border: BORDER_THIN,
                }));
            }
        }

        // ─── Fila 1 (r=1): DESPACHADO POR ──────────────
        const textoDespachado = `DESPACHADO POR **${(despachadoPorNombre || '').toUpperCase()}**`;
        const mergeRow1Header = {
            s: { r: 1, c: COL.PRIMER_VIAJE },
            e: { r: 1, c: COL_PESO },
        };
        for (let c = 0; c < TOTAL_COLS; c++) {
            if (c >= COL.PRIMER_VIAJE) {
                if (c === COL.PRIMER_VIAJE) {
                    setCell(1, c, cell(textoDespachado, {
                        s: {
                            fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
                            font: { ...FONT_HEADER, sz: 12 },
                            alignment: ALIGN_CENTER,
                            border: BORDER_THIN,
                        },
                    }));
                } else {
                    setCell(1, c, emptyCell({
                        fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
                        border: BORDER_THIN,
                    }));
                }
            } else {
                setCell(1, c, emptyCell({
                    fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
                    border: BORDER_THIN,
                }));
            }
        }

        // ─── Fila 2 (r=2): Encabezados ───────────────────────────────
        setCell(2, COL.PLACA, cell('PLACA', { s: styleHeaderBase }));
        setCell(2, COL.DOC_TRAS, cell('DOC.T RAS', { s: styleHeaderRotated(60) }));
        setCell(2, COL.TRIP_COLOR, cell('', { s: styleHeaderBase }));
        setCell(2, COL.TRIP_NOMBRE, cell('TRIPULACION', { s: styleHeaderBase }));
        setCell(2, COL.REUNION, cell('REUNION', { s: styleHeaderRotated(90) }));
        // Viajes
        for (let v = 0; v < maxViajes; v++) {
            const label = maxViajes === 1
                ? '1ER VIAJE'
                : v === 0
                ? '1ER VIAJE'
                : v === 1
                ? '2DO VIAJE'
                : `${v + 1}° VIAJE`;
            setCell(2, COL.PRIMER_VIAJE + v, cell(label, { s: styleHeaderBase }));
        }
        setCell(2, COL_CLIENTE, cell('CLIENTE', { s: styleHeaderRotated(90) }));
        setCell(2, COL_PESO, cell('PESO', { s: styleHeaderRotated(90) }));
        // Llenar columnas restantes con bordes
        for (let c = COL_PESO + 1; c < TOTAL_COLS; c++) {
            setCell(2, c, cell('', {
                s: {
                    font: FONT_BODY,
                    alignment: ALIGN_CENTER,
                    border: BORDER_THIN,
                },
            }));
        }

        // ─── Filas de datos de rutas ─── filas separadas por tripulante con columna de color y nombre
        let currentRow = 3;
        filteredRutasTable.forEach((r) => {
            const tripulacion = r.tripulacion || [];
            const viajes = r.viajes || [];
            const r0 = currentRow;

            const clienteSeleccionado = viajes.find((viaje) => viaje.cliente.trim() !== '')?.cliente ?? '';
            const pesoSeleccionado = viajes.find((viaje) => viaje.peso.trim() !== '')?.peso ?? '';
            const cantidadClientes = parseInt(clienteSeleccionado, 10) || 0;
            const pesoRuta = parseFloat(pesoSeleccionado) || 0;
            const numFilasMerge = Math.max(tripulacion.length, 1);

            // PLACA (merge sobre todas las filas de tripulantes)
            for (let fila = 0; fila < numFilasMerge; fila++) {
                const estiloPlaca: XLSX.CellStyle = {
                    font: FONT_PLACA,
                    fill: { patternType: 'solid', fgColor: { rgb: NEGRO_PLACA } },
                    alignment: ALIGN_CENTER,
                    border: BORDER_THIN,
                };
                if (fila === 0) {
                    setCell(r0 + fila, COL.PLACA, cell((r.placa || '').toUpperCase(), { s: estiloPlaca }));
                } else {
                    setCell(r0 + fila, COL.PLACA, cell('', { s: estiloPlaca }));
                }
            }
            merges.push({
                s: { r: r0, c: COL.PLACA },
                e: { r: r0 + numFilasMerge - 1, c: COL.PLACA },
            });

            // DOC.T RAS (merge sobre todas las filas de tripulantes, rotado)
            for (let fila = 0; fila < numFilasMerge; fila++) {
                const estiloDocTras: XLSX.CellStyle = {
                    font: FONT_BODY_BOLD_BLACK,
                    alignment: { ...ALIGN_CENTER, textRotation: 60 },
                    border: BORDER_THIN,
                };
                if (fila === 0) {
                    setCell(r0 + fila, COL.DOC_TRAS, cell(r.doc_tras || '', { s: estiloDocTras }));
                } else {
                    setCell(r0 + fila, COL.DOC_TRAS, cell('', { s: estiloDocTras }));
                }
            }
            merges.push({
                s: { r: r0, c: COL.DOC_TRAS },
                e: { r: r0 + numFilasMerge - 1, c: COL.DOC_TRAS },
            });

            // TRIPULANTES (columna de color chica y columna de nombre al lado)
            for (let t = 0; t < maxTripulantes; t++) {
                const trip = tripulacion[t];
                const nombre = (trip?.nombres || '').toUpperCase();
                const cargo = (trip?.cargo || '').toUpperCase();
                let colorFondo: string;

                // Color según cargo (no por posición):
                // Azul   → Conductor
                // Amarillo → Responsable de Reparto
                // Gris   → Auxiliar de Reparto
                // Blanco → cualquier otro cargo
                if (cargo.includes('CONDUCTOR')) {
                    colorFondo = AZUL_CARGO_1;
                } else if (cargo.includes('RESPONSABLE')) {
                    colorFondo = AZUL_CLARO_CARGO_2;
                } else if (cargo.includes('AUXILIAR')) {
                    colorFondo = GRIS_CARGO_3;
                } else {
                    colorFondo = BLANCO_CARGO_4;
                }

                // Color del texto del nombre: azul oscuro para Responsable de Reparto, negro para los demás
                const colorTextoNombre = cargo.includes('RESPONSABLE')
                    ? { color: { rgb: AZUL_TEXTO_CARGO_2 } }
                    : {};

                // Columna de color (chica)
                setCell(r0 + t, COL.TRIP_COLOR, cell('', {
                    s: {
                        fill: { patternType: 'solid', fgColor: { rgb: colorFondo } },
                        border: BORDER_THIN,
                    },
                }));

                // Columna de nombre (al lado)
                setCell(r0 + t, COL.TRIP_NOMBRE, cell(nombre, {
                    s: {
                        font: { ...FONT_BODY, bold: true, ...colorTextoNombre },
                        alignment: ALIGN_LEFT,
                        border: BORDER_THIN,
                    },
                }));
            }

            // REUNION (merge sobre todas las filas de tripulantes)
            for (let fila = 0; fila < numFilasMerge; fila++) {
                setCell(r0 + fila, COL.REUNION, cell('', {
                    s: {
                        font: FONT_BODY,
                        alignment: ALIGN_CENTER,
                        border: BORDER_THIN,
                    },
                }));
            }
            merges.push({
                s: { r: r0, c: COL.REUNION },
                e: { r: r0 + numFilasMerge - 1, c: COL.REUNION },
            });

            // Llenar columnas entre REUNION y PRIMER_VIAJE con bordes
            for (let c = COL.REUNION + 1; c < COL.PRIMER_VIAJE; c++) {
                for (let fila = 0; fila < numFilasMerge; fila++) {
                    setCell(r0 + fila, c, cell('', {
                        s: {
                            font: FONT_BODY,
                            alignment: ALIGN_CENTER,
                            border: BORDER_THIN,
                        },
                    }));
                }
                merges.push({
                    s: { r: r0, c: c },
                    e: { r: r0 + numFilasMerge - 1, c: c },
                });
            }

            // Viajes (municipio y barrio, una celda por viaje, merge sobre filas de tripulantes)
            for (let v = 0; v < maxViajes; v++) {
                let contenido = '';
                if (viajes[v]) {
                    contenido = obtenerDestinosViaje(viajes[v])
                        .map((destino) => {
                            const municipio = destino.lugares.trim().toLocaleUpperCase('es');
                            const barrio = destino.barrio.trim().toLocaleUpperCase('es');
                            const esPasto = municipio.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'PASTO';

                            if (esPasto) return barrio ? `• ${barrio}` : '';
                            if (!municipio && !barrio) return '';
                            return `• ${municipio}${barrio ? `\n  BARRIOS: ${barrio}` : ''}`;
                        })
                        .filter(Boolean)
                        .join('\n');
                }
                const colViaje = COL.PRIMER_VIAJE + v;
                const numFilasMerge = Math.max(tripulacion.length, 1);

                // Aplicar bordes a todas las celdas dentro del merge
                for (let fila = 0; fila < numFilasMerge; fila++) {
                    const estiloViaje: XLSX.CellStyle = {
                        font: { ...FONT_BODY, bold: true, sz: 12 },
                        alignment: { ...ALIGN_LEFT, wrapText: true },
                        border: BORDER_THIN,
                    };
                    if (fila === 0) {
                        setCell(r0 + fila, colViaje, cell(contenido, { s: estiloViaje }));
                    } else {
                        setCell(r0 + fila, colViaje, cell('', { s: estiloViaje }));
                    }
                }

                merges.push({
                    s: { r: r0, c: colViaje },
                    e: { r: r0 + numFilasMerge - 1, c: colViaje },
                });
            }

            // CLIENTE y PESO (merge sobre filas de tripulantes)
            // CLIENTE - aplicar bordes a todas las celdas del merge
            for (let fila = 0; fila < numFilasMerge; fila++) {
                const estiloCliente: XLSX.CellStyle = {
                    font: { ...FONT_BODY, bold: true },
                    alignment: ALIGN_CENTER,
                    border: BORDER_THIN,
                };
                if (fila === 0) {
                    setCell(r0 + fila, COL_CLIENTE, cell(cantidadClientes > 0 ? cantidadClientes : '', {
                        t: cantidadClientes > 0 ? 'n' : 's',
                        s: estiloCliente,
                    }));
                } else {
                    setCell(r0 + fila, COL_CLIENTE, cell('', { s: estiloCliente }));
                }
            }
            merges.push({
                s: { r: r0, c: COL_CLIENTE },
                e: { r: r0 + numFilasMerge - 1, c: COL_CLIENTE },
            });

            // PESO - aplicar bordes a todas las celdas del merge
            for (let fila = 0; fila < numFilasMerge; fila++) {
                const estiloPeso: XLSX.CellStyle = {
                    font: { ...FONT_BODY, bold: true },
                    alignment: ALIGN_CENTER,
                    border: BORDER_THIN,
                };
                if (fila === 0) {
                    setCell(r0 + fila, COL_PESO, cell(pesoRuta > 0 ? parseFloat(pesoRuta.toFixed(1)) : '', {
                        t: pesoRuta > 0 ? 'n' : 's',
                        s: estiloPeso,
                    }));
                } else {
                    setCell(r0 + fila, COL_PESO, cell('', { s: estiloPeso }));
                }
            }
            merges.push({
                s: { r: r0, c: COL_PESO },
                e: { r: r0 + numFilasMerge - 1, c: COL_PESO },
            });

            currentRow += Math.max(tripulacion.length, 1);
        });

        // ─── Merges de encabezados de la tabla de rutas
        merges.unshift(mergeRutas, mergeRow0Header, mergeRow1Header);

        // ─── Construir worksheet final ───────────────────────────────
        const ws: XLSX.WorkSheet = { ...wsData };
        ws['!ref'] = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: currentRow + 1, c: TOTAL_COLS - 1 },
        });
        ws['!merges'] = merges;

        // ─── Anchos de columna ───────────────────────────────────────
        const colWidths: { wch: number }[] = [
            { wch: 14 }, // A placa / IDENT+NOMBRE (novedades)
            { wch: 14 }, // B DOC.T RAS / OBSERVACIONES (novedades)
            { wch: 3 },  // C TRIP_COLOR (columna chica de color)
            { wch: 40 }, // D TRIP_NOMBRE (nombre del colaborador)
            { wch: 9 },  // E REUNION
        ];
        for (let v = 0; v < maxViajes; v++) colWidths.push({ wch: 30 }); // 1ER/2DO VIAJE...
        colWidths.push({ wch: 14 }, { wch: 10 }); // CLIENTE, PESO (september)
        ws['!cols'] = colWidths;

        // ─── Alturas de fila ─────────────────────────────────────────
        const rowHeights: { hpt: number }[] = [];
        rowHeights.push({ hpt: 26 }); // fila 0 PROGRAMADO POR
        rowHeights.push({ hpt: 26 }); // fila 1 DESPACHADO POR
        rowHeights.push({ hpt: 60 }); // fila 2 encabezados
        // Alturas para filas de rutas (múltiples filas por ruta, una por tripulante)
        filteredRutasTable.forEach((r) => {
            const numTrip = Math.max((r.tripulacion || []).length, 1);
            const maxLineasDestino = Math.max(
                1,
                ...(r.viajes || []).map((viaje) =>
                    obtenerDestinosViaje(viaje).reduce(
                        (total, destino) => total + Number(Boolean(destino.lugares.trim())) + Number(Boolean(destino.barrio.trim())),
                        0,
                    ),
                ),
            );
            const alturaFila = Math.min(409, Math.max(22, Math.ceil((maxLineasDestino * 18 + 8) / numTrip)));
            for (let t = 0; t < numTrip; t++) {
                rowHeights.push({ hpt: alturaFila });
            }
        });
        ws['!rows'] = rowHeights;

        XLSX.utils.book_append_sheet(wb, ws, 'Planeación de Ruta');

        // ─── Tabla de NOVEDADES en la misma hoja, separada por 2 filas ───────
        const encabezadosNovedades = [
            'NOMBRE',
            'OBSERVACIONES',
            'FIJO RESCATE',
            'FIJO TALLER',
            'PERMISO',
            'NO ASISTIO',
            'INCAPACIDAD',
            'VACACIONES',
        ];
        const filasNovedades = novedadesLocal.map((novedad) => [
            (novedad.nombres || '').trim().toLocaleUpperCase('es'),
            novedad.observaciones || '',
            novedad.fijo_rescate ? 'X' : '',
            novedad.fijo_taller ? 'X' : '',
            novedad.permiso ? 'X' : '',
            novedad.no_asitio ? 'X' : '',
            novedad.incapacidad ? 'X' : '',
            novedad.vacaciones ? 'X' : '',
        ]);
        const estiloEncabezadoNovedades: XLSX.CellStyle = {
            fill: { patternType: 'solid', fgColor: { rgb: AZUL_OSCURO } },
            font: FONT_HEADER,
            alignment: ALIGN_CENTER,
            border: BORDER_THIN,
        };
        const estiloDatoNovedades: XLSX.CellStyle = {
            fill: { patternType: 'solid', fgColor: { rgb: AZUL_CLARO_NOMBRES } },
            font: FONT_BODY,
            alignment: ALIGN_LEFT,
            border: BORDER_THIN,
        };
        const estiloCheckNovedades: XLSX.CellStyle = {
            font: { ...FONT_BODY_BOLD_BLACK, sz: 14 },
            alignment: ALIGN_CENTER,
            border: BORDER_THIN,
        };

        // Posicionar la tabla de novedades 2 filas debajo de la última fila de rutas
        const rowInicioNovedades = currentRow + 2;
        const rowDatosNovedades = rowInicioNovedades + 1;

        // Encabezados de la tabla de novedades
        encabezadosNovedades.forEach((label, col) => {
            setCell(rowInicioNovedades, col, cell(label, { s: estiloEncabezadoNovedades }));
        });

        // Filas de datos de novedades
        filasNovedades.forEach((fila, rowIndex) => {
            fila.forEach((valor, col) => {
                setCell(rowDatosNovedades + rowIndex, col, cell(valor, {
                    s: col < 2 ? estiloDatoNovedades : estiloCheckNovedades,
                }));
            });
        });

        // Actualizar ref del worksheet para incluir las novedades
        const lastRowNovedades = rowDatosNovedades + Math.max(filasNovedades.length - 1, 0);
        const lastColNovedades = encabezadosNovedades.length - 1;
        ws['!ref'] = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: Math.max(currentRow + 1, lastRowNovedades), c: Math.max(TOTAL_COLS - 1, lastColNovedades) },
        });

        // Añadir alturas para las filas de separación y novedades
        const rowHeightsActual = ws['!rows'] as { hpt: number }[];
        while (rowHeightsActual.length < rowInicioNovedades) {
            rowHeightsActual.push({ hpt: 16 });
        }
        rowHeightsActual.push({ hpt: 24 }); // encabezado novedades
        filasNovedades.forEach((fila) => {
            rowHeightsActual.push({ hpt: Math.min(90, Math.max(22, Math.ceil(String(fila[1] ?? '').length / 55) * 18)) });
        });
        ws['!rows'] = rowHeightsActual;

        // Generar nombre de archivo con FECHA LOCAL (no UTC)
        let fechaNombre: string = fechaTexto || '';
        if (!fechaNombre) {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            fechaNombre = `${y}-${m}-${day}`;
        }
        const fileName = `Planeacion_Ruta_${fechaNombre}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

        const exportacionAutomaticaRealizada = useRef(false);
        useEffect(() => {
            if (exportExcel && !exportacionAutomaticaRealizada.current) {
                exportacionAutomaticaRealizada.current = true;
                handleExportExcel();
            }
            // La exportación se solicita una sola vez al abrir esta planeación desde Historial.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [exportExcel]);

        return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Planeación de ruta" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: '#D4102A20' }}>
                                <MapPin className="size-5" style={{ color: ACCENT }} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">Planificación de ruta</h1>
                                <p className="text-sm text-muted-foreground">Organiza y gestiona la salida de la ruta de reparto</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {readOnly && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('reparto.modulacion.historial')}>
                                    <ArrowLeft className="size-4" />
                                    Volver al historial
                                </Link>
                            </Button>
                        )}
                        <div className="flex items-center gap-2">
                            <Label htmlFor="ud_programado_por" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                UD Programado Por:
                            </Label>
                            <Input
                                id="ud_programado_por"
                                type="text"
                                placeholder="Nombre del usuario programador"
                                value={udProgramadoPor}
                                onChange={(e) => setUdProgramadoPor(e.target.value)}
                                className="h-10 w-64 text-sm bg-background"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Filtros de fecha y placa ───────────────────────────── */}
                {isEditing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
                    <div>
                        <Label htmlFor="filtro-fecha" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                            <Calendar className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                            Fecha de la planeación
                        </Label>
                        <Input
                            id="filtro-fecha"
                            type="date"
                            value={fechaTexto}
                            onChange={(e) => handleFechaChange(e.target.value)}
                            className="h-10 text-sm"
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
                                    setCurrentViajeForm({ lugares: '', barrio: '', cliente: '', peso: '' });
                                }}
                            >
                                Cargar planeación guardada
                            </Button>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="filtro-placa" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1.5">
                            <Filter className="size-3.5" style={{ color: ACCENT }} />
                            Filtro por placa
                        </Label>
                        <Select value={filterTablePlaca} onValueChange={setFilterTablePlaca}>
                            <SelectTrigger id="filtro-placa" className="h-10 text-sm w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">-- Todas las Placas --</SelectItem>
                                {uniquePlacasInRutas.map((placa) => (
                                    <SelectItem key={placa} value={placa}>{placa}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                )}

                {/* ── Formulario nueva / editar salida ─────────────────────── */}
                <form onSubmit={handleAddViaje} className="space-y-4" style={{ display: (!readOnly || isEditing) ? 'block' : 'none' }}>
                    {/* Card 1: Datos generales y Tripulación */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 dark:border-sidebar-border shadow-sm space-y-6">

                        {/* Título inline (modo edición) */}
                        {editingIndex !== null && (
                            <div className="flex items-center justify-between border-b border-border pb-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="size-4" style={{ color: ACCENT }} />
                                    <span className="font-semibold text-foreground">
                                        Editando ruta #{editingIndex + 1}
                                    </span>
                                    {currentRoute.placa && (
                                        <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: ACCENT, color: ACCENT }}>
                                            {currentRoute.placa}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Sección 1: Datos Generales de la Salida ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Placa */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="placa-ruta" className="text-xs font-medium">
                                    Placa <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="placa-ruta"
                                        name="placa"
                                        type="text"
                                        value={showPlacaDropdown ? placaSearch : currentRoute.placa}
                                        onFocus={() => {
                                            setPlacaSearch('');
                                            setShowPlacaDropdown(true);
                                        }}
                                        onChange={(e) => {
                                            setPlacaSearch(e.target.value);
                                            setShowPlacaDropdown(true);
                                        }}
                                        onBlur={() => setTimeout(() => {
                                            setShowPlacaDropdown(false);
                                            setPlacaSearch('');
                                        }, 150)}
                                        placeholder="Escriba para buscar una placa..."
                                        autoComplete="off"
                                        className="h-10 font-mono text-sm uppercase"
                                    />
                                    {showPlacaDropdown && (
                                        <div className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-input bg-popover shadow-lg">
                                            {placasCoincidentes.map((vehiculo) => (
                                                <div
                                                    key={vehiculo}
                                                    onMouseDown={() => {
                                                        handlePlacaChange(String(vehiculo));
                                                        setPlacaSearch('');
                                                        setShowPlacaDropdown(false);
                                                    }}
                                                    className="cursor-pointer border-b border-border px-3 py-2 font-mono text-sm last:border-b-0 hover:bg-muted"
                                                >
                                                    {String(vehiculo)}
                                                </div>
                                            ))}
                                            {placasCoincidentes.length === 0 && (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    No hay placas existentes que coincidan.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                    className="h-10 text-sm font-mono"
                                    required
                                />
                            </div>

                            {/* Despachado Por */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="despachado_por" className="text-xs font-medium">
                                    Despachado Por (Colaborador)
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="despachado_por"
                                        type="text"
                                        value={despachadoPorNombre}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setDespachadoPorNombre(val);
                                            setShowDespachadorDropdown(true);
                                            const found = colaboradores.find(
                                                (c) => c.nombre_completo.toLowerCase() === val.toLowerCase() ||
                                                       `${c.nombre_completo} ${c.cedula}`.toLowerCase() === val.toLowerCase()
                                            );
                                            setDespachadoPorId(found ? String(found.id) : '');
                                        }}
                                        onBlur={() => setTimeout(() => setShowDespachadorDropdown(false), 150)}
                                        placeholder="Busque o escriba el nombre..."
                                        autoComplete="off"
                                        className="h-10 text-sm"
                                    />
                                    {showDespachadorDropdown && (
                                        <div className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-input bg-popover shadow-lg">
                                            {colaboradores
                                                .filter((c) => {
                                                    const q = despachadoPorNombre.toLowerCase().trim();
                                                    if (!q) return true;
                                                    const full = (c.nombre_completo + " " + (c.cedula || "")).toLowerCase();
                                                    return c.nombre_completo.toLowerCase().includes(q) || (c.cedula && c.cedula.includes(q)) || full.includes(q);
                                                })
                                                .map((c) => (
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
                                                        <div className="text-xs text-muted-foreground">{c.cedula} · {c.cargo}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Sección 2: Tripulación de la Ruta ── */}
                        <div className="space-y-3 pt-2 border-t border-border/60">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Users className="size-3.5" style={{ color: ACCENT }} />
                                Tripulación de la Ruta
                            </p>
                            <div className="space-y-3">
                                {/* Filtros */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="buscar-tripulacion" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                            <Search className="size-3" style={{ color: ACCENT }} />
                                            Buscar por Nombre o Cédula
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
                                        <Label htmlFor="filtrar-cargo" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                            <Filter className="size-3" style={{ color: ACCENT }} />
                                            Filtrar por Cargo
                                        </Label>
                                        <Select value={cargoFilter} onValueChange={setCargoFilter}>
                                            <SelectTrigger id="filtrar-cargo" className="h-10 text-sm w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">-- Todos los Cargos --</SelectItem>
                                                {cargosOperativos.map((cg) => (
                                                    <SelectItem key={cg} value={String(cg)}>{String(cg)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Checklist */}
                                <div className="rounded-lg border border-border bg-background p-3 max-h-52 overflow-y-auto">
                                    <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                        <CheckSquare className="size-3.5" style={{ color: ACCENT }} />
                                        {isFiltering
                                            ? `Resultados del filtro (${allChecklistColaboradores.length})`
                                            : `Colaboradores asignados a la tripulación (${selectedColaboradores.length})`}
                                    </p>
                                    {allChecklistColaboradores.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            {allChecklistColaboradores.map((col) => {
                                                const colIdStr = String(col.id).trim();
                                                const colCedStr = col.cedula ? String(col.cedula).trim() : '';
                                                const isChecked = currentRoute.tripulacion.some(
                                                    (m) =>
                                                        (m.colaborador_id && String(m.colaborador_id).trim() === colIdStr) ||
                                                        (m.cedula && colCedStr !== '' && String(m.cedula).trim() === colCedStr)
                                                );
                                                const isFijo = fijosColaboradorIds.has(colIdStr) || (colCedStr !== '' && fijosColaboradorIds.has(`cedula:${colCedStr}`));

                                                return (
                                                    <label
                                                        key={`col-item-${col.id ?? col.cedula}`}
                                                        htmlFor={`check-${col.id ?? col.cedula}`}
                                                        className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer select-none ${
                                                            isChecked
                                                                ? isFijo
                                                                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                                                                    : 'border-primary/40 bg-primary/5'
                                                                : 'border-border hover:bg-muted/50'
                                                        } ${isFijo && isChecked ? 'cursor-not-allowed opacity-80' : ''}`}
                                                    >
                                                        <Checkbox
                                                            id={`check-${col.id ?? col.cedula}`}
                                                            checked={isChecked}
                                                            disabled={isFijo && isChecked}
                                                            onCheckedChange={() => !isFijo && handleToggleChecklistMember(col)}
                                                            className="mt-0.5 shrink-0"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-foreground truncate">{String(col.nombre_completo ?? '')}</p>
                                                            {col.cedula && <p className="text-[10px] font-mono text-muted-foreground">Cédula: {col.cedula}</p>}
                                                            {col.cargo && <p className="text-[10px] text-muted-foreground truncate">{col.cargo}</p>}
                                                        </div>
                                                        {isFijo && isChecked && (
                                                            <Badge className="shrink-0 bg-emerald-600 text-[9px] px-1.5 py-0 text-white">FIJO</Badge>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ) : isFiltering ? (
                                        <p className="py-4 text-center text-xs text-muted-foreground">
                                            No se encontraron colaboradores libres que coincidan con el filtro.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Viajes de la Ruta */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 dark:border-sidebar-border shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <MapPin className="size-3.5" style={{ color: ACCENT }} />
                                Viajes de la Ruta
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                                    {editingViajeIndex !== null
                                        ? `Editando viaje #${editingViajeIndex + 1}`
                                        : `Nuevo viaje #${(currentRoute.viajes?.length || 0) + 1}`}
                                </span>
                            </div>

                            {/* Campos en 2 columnas: Departamento hasta Peso */}
                            <div key={`viaje-form-group-${currentRoute.placa || 'empty'}`} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Departamento y Municipio / Destino (2 columnas) */}
                                <div className="sm:col-span-2">
                                    <NarinoMunicipioInput
                                        value={String(currentViajeForm.lugares ?? '')}
                                        onChange={(val) => handleViajeFormChange('lugares', val)}
                                        barrio={String(currentViajeForm.barrio ?? '')}
                                        onBarrioChange={(val) => handleViajeFormChange('barrio', val)}
                                        cliente={String(currentViajeForm.cliente ?? '')}
                                        onClienteChange={(val) => handleViajeFormChange('cliente', val)}
                                        puedeAgregarViaje={Boolean(currentRoute.placa.trim())}
                                        viajesRegistrados={
                                            editingViajeIndex === null
                                                ? currentRoute.viajes.map((viaje, indice) => ({ viaje, numero: indice + 1 }))
                                                : currentRoute.viajes.flatMap((viaje, indice) =>
                                                    indice === editingViajeIndex ? [] : [{ viaje, numero: indice + 1 }],
                                                )
                                        }
                                        destinosPendientes={destinosViajePendientes}
                                        numeroViajePendiente={
                                            editingViajeIndex !== null
                                                ? editingViajeIndex + 1
                                                : (currentRoute.viajes?.length || 0) + 1
                                        }
                                        onDestinoAgregado={(destino) =>
                                            setDestinosViajePendientes((actuales) => {
                                                const municipioSinBarrio = destino.barrio
                                                    ? actuales.findIndex(
                                                        (actual) =>
                                                            actual.lugares.localeCompare(destino.lugares, 'es', { sensitivity: 'base' }) === 0 &&
                                                            actual.barrio.trim() === '',
                                                    )
                                                    : -1;
                                                if (municipioSinBarrio >= 0) {
                                                    return actuales.map((actual, index) =>
                                                        index === municipioSinBarrio ? destino : actual,
                                                    );
                                                }

                                                return actuales.some(
                                                    (actual) =>
                                                        actual.lugares.localeCompare(destino.lugares, 'es', { sensitivity: 'base' }) === 0 &&
                                                        actual.barrio.localeCompare(destino.barrio, 'es', { sensitivity: 'base' }) === 0,
                                                )
                                                    ? actuales
                                                    : [...actuales, destino];
                                            })
                                        }
                                        onEliminarDestinoPendiente={(destinoIndex) => {
                                            const destinosActualizados = destinosViajePendientes.filter(
                                                (_, index) => index !== destinoIndex,
                                            );
                                            setDestinosViajePendientes(destinosActualizados);
                                            if (destinosActualizados.length === 0 && editingViajeIndex !== null) {
                                                setCurrentViajeForm((formulario) => ({
                                                    ...formulario,
                                                    lugares: '',
                                                    barrio: '',
                                                }));
                                            }
                                        }}
                                    />
                                </div>

                                {/* Peso (Toneladas) */}
                                <div className="grid gap-1.5 sm:col-span-2">
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
                        <div className="flex justify-end gap-2 pt-4 border-t border-border">
                            <Button
                                type="button"
                                onClick={(e) => handleAddViaje(e)}
                                className="gap-1.5 h-10 px-6"
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
                <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-border/70 dark:border-sidebar-border bg-muted/30 px-5 py-3">
                        <div className="flex items-center gap-2">
                            <FileText className="size-4" style={{ color: ACCENT }} />
                            <span className="font-semibold text-foreground">Planeación de Ruta</span>
                            {filteredRutasTable.length > 0 && (
                                <span className="text-xs text-muted-foreground">({filteredRutasTable.length} ruta{filteredRutasTable.length !== 1 ? 's' : ''})</span>
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
                                                <FileText className="size-8 opacity-30" style={{ color: ACCENT }} />
                                                <p className="text-sm">
                                                    {rutas.length === 0
                                                        ? 'No hay rutas registradas. Complete el formulario y presione Guardar ruta.'
                                                        : 'No hay rutas que coincidan con los filtros aplicados.'}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRutasTable.map((item, idx) => {
                                        const rutaIndex = rutas.indexOf(item);
                                        const tripMembers = Array.isArray(item.tripulacion) ? item.tripulacion : [];
                                        const viajesList = Array.isArray(item.viajes) ? item.viajes : [];

                                        return (
                                            <TableRow key={item.id ?? `ruta-${item.placa}-${idx}`} className="hover:bg-muted/30 align-top">
                                                <TableCell className="text-center text-sm font-medium">{idx + 1}</TableCell>

                                                <TableCell className="text-sm font-semibold text-foreground">
                                                    {item.placa}
                                                </TableCell>

                                                <TableCell className="text-sm text-foreground">
                                                    {item.doc_tras || '—'}
                                                </TableCell>

                                                <TableCell className="text-sm text-foreground">
                                                    {tripMembers.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {tripMembers.map((m, mIdx) => (
                                                                <div key={`trip-${m.colaborador_id ?? m.cedula}-${mIdx}`} className="flex items-start gap-2">
                                                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
                                                                    <div className="space-y-0.5">
                                                                        <p><span className="font-medium">Identificación:</span> {m.cedula || '—'}</p>
                                                                        <p><span className="font-medium">Nombre:</span> {m.nombres || 'Sin nombre'}</p>
                                                                        <p><span className="font-medium">Cargo:</span> {m.cargo || '—'}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </TableCell>

                                                <TableCell className="text-sm text-foreground">
                                                    {viajesList.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {viajesList.map((v, vIdx) => (
                                                                <div key={v.id ?? `viaje-${vIdx}`} className="border-b border-border/50 pb-2 last:border-0">
                                                                    <p className="mb-1.5 font-semibold text-xs" style={{ color: ACCENT }}>Viaje {vIdx + 1}</p>
                                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_auto] sm:items-start">
                                                                        <div className="space-y-1">
                                                                            {obtenerDestinosViaje(v).length > 0 ? (
                                                                                obtenerDestinosViaje(v).map((destino, destinoIdx) => (
                                                                                    <div key={`${destino.lugares}-${destino.barrio}-${destinoIdx}`}>
                                                                                        <p><span className="font-medium">Municipio:</span> {destino.lugares || '—'}</p>
                                                                                        <p><span className="font-medium">Barrio:</span> {destino.barrio || '—'}</p>
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <>
                                                                                    <p><span className="font-medium">Municipio:</span> —</p>
                                                                                    <p><span className="font-medium">Barrio:</span> —</p>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        <p><span className="font-medium">Cliente:</span> {v.cliente || '—'}</p>
                                                                        <p><span className="font-medium">Peso:</span> {v.peso ? `${v.peso} ton` : '—'}</p>
                                                                        <div className="flex items-center gap-1 sm:justify-end">
                                                                            <Button variant="ghost" size="icon" aria-label={`Editar viaje ${vIdx + 1} de la ruta ${item.placa}`} onClick={() => handleEditViajeIndividual(rutaIndex, vIdx)} className="size-6 hover:bg-accent/10" style={{ color: ACCENT }}>
                                                                                <Pencil className="size-3" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                aria-label={`Eliminar viaje ${vIdx + 1} de la ruta ${item.placa}`}
                                                                                onClick={() => handleRemoveViajeIndividual(item.placa, v.id, vIdx)}
                                                                                className="size-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                            >
                                                                                <Trash2 className="size-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-muted-foreground">—</span>}
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
                {(isEditing || (!isEditing && novedadesLocal.length > 0)) && (
                <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-sidebar-border/70 dark:border-sidebar-border bg-muted/30 px-5 py-3">
                        <Users className="size-4 text-blue-600" />
                        <span className="font-semibold text-foreground">Novedades de Colaboradores</span>
                        {novedadesLocal.length > 0 && (
                            <Badge variant="secondary">{novedadesLocal.length}</Badge>
                        )}
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Formulario agregar colaborador — solo en modo edición */}
                        {isEditing && (
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-4 grid gap-1.5">
                                <Label htmlFor="nueva-novedad-colaborador" className="text-xs text-muted-foreground">Seleccionar Colaborador</Label>
                                <div className="relative">
                                    <Input
                                        id="nueva-novedad-colaborador"
                                        type="text"
                                        role="combobox"
                                        aria-expanded={showNovedadColaboradorDropdown}
                                        aria-controls="novedad-colaboradores-operativos"
                                        autoComplete="off"
                                        placeholder="Escriba nombre o cédula"
                                        value={novedadColaboradorSearch}
                                        onFocus={() => setShowNovedadColaboradorDropdown(true)}
                                        onChange={(event) => {
                                            setNovedadColaboradorSearch(event.target.value);
                                            setNuevaNovedad((prev) => ({
                                                ...prev,
                                                colaborador_id: '',
                                                cedula: '',
                                                nombres: '',
                                                cargo: '',
                                            }));
                                            setShowNovedadColaboradorDropdown(true);
                                        }}
                                        onBlur={() => window.setTimeout(() => setShowNovedadColaboradorDropdown(false), 150)}
                                        className="h-10 text-sm w-full"
                                    />
                                    {showNovedadColaboradorDropdown && (
                                        <div
                                            id="novedad-colaboradores-operativos"
                                            role="listbox"
                                            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                        >
                                            {colaboradoresOperativosNovedad.length > 0 ? colaboradoresOperativosNovedad.map((col) => (
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
                                            )) : (
                                                <p className="px-2 py-2 text-sm text-muted-foreground">
                                                    No se encontraron colaboradores del área Operativa.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="sm:col-span-5 grid gap-1.5">
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

                            <div className="sm:col-span-3 flex items-center gap-2">
                                <label className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-3 py-2 cursor-pointer h-10 flex-1">
                                    <Checkbox
                                        id="nuevo-fijo-rescate"
                                        checked={nuevaNovedad.fijo_rescate}
                                        onCheckedChange={(checked) => setNuevaNovedad((prev) => ({ ...prev, fijo_rescate: Boolean(checked) }))}
                                    />
                                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 whitespace-nowrap">Fijo Rescate</span>
                                </label>
                                <label className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-3 py-2 cursor-pointer h-10 flex-1">
                                    <Checkbox
                                        id="nuevo-fijo-taller"
                                        checked={nuevaNovedad.fijo_taller}
                                        onCheckedChange={(checked) => setNuevaNovedad((prev) => ({ ...prev, fijo_taller: Boolean(checked) }))}
                                    />
                                    <span className="text-xs font-semibold text-green-800 dark:text-green-300 whitespace-nowrap">Fijo Taller</span>
                                </label>
                            </div>

                            <div className="sm:col-span-2">
                                <Button
                                    type="button"
                                    onClick={handleAgregarNovedadTabla2}
                                    className="h-10 w-full gap-1.5 text-sm"
                                >
                                    <Plus className="size-4" />
                                    Agregar
                                </Button>
                            </div>
                        </div>
                        )}

                        {/* Tabla novedades */}
                        <div className="rounded-lg border border-border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="font-semibold">Identificación</TableHead>
                                        <TableHead className="font-semibold">Nombres</TableHead>
                                        <TableHead className="font-semibold">Observaciones</TableHead>
                                        <TableHead className="text-center font-semibold">Fijo Rescate</TableHead>
                                        <TableHead className="text-center font-semibold">Fijo Taller</TableHead>
                                        <TableHead className="text-center font-semibold">Permiso</TableHead>
                                        <TableHead className="text-center font-semibold">No Asistio</TableHead>
                                        <TableHead className="text-center font-semibold">Incapacidad</TableHead>
                                        <TableHead className="text-center font-semibold">Vacaciones</TableHead>
                                        {isEditing && <TableHead className="text-right font-semibold w-16">Eliminar</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {novedadesLocal.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isEditing ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">
                                                No hay colaboradores en novedades. Use el formulario de arriba para agregar uno.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        novedadesLocal.map((nov) => (
                                            <TableRow key={nov.id} className={(nov.fijo || nov.fijo_rescate || nov.fijo_taller) ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}>
                                                <TableCell className="font-mono text-sm">{nov.cedula ?? '—'}</TableCell>
                                                <TableCell className="font-medium text-sm">{nov.nombres ?? '—'}</TableCell>
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
                                                <TableCell className="text-center">
                                                    {isEditing ? (
                                                        <Checkbox id={`novedad-${nov.id}-fijo-rescate`} aria-label={`Fijo Rescate: ${nov.nombres ?? nov.cedula ?? nov.id}`} checked={Boolean(nov.fijo_rescate)} onCheckedChange={(c) => handleNovedadChange(nov.id, 'fijo_rescate', Boolean(c))} />
                                                    ) : (
                                                        <span>{nov.fijo_rescate ? '✓' : '—'}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isEditing ? (
                                                        <Checkbox id={`novedad-${nov.id}-fijo-taller`} aria-label={`Fijo Taller: ${nov.nombres ?? nov.cedula ?? nov.id}`} checked={Boolean(nov.fijo_taller)} onCheckedChange={(c) => handleNovedadChange(nov.id, 'fijo_taller', Boolean(c))} />
                                                    ) : (
                                                        <span>{nov.fijo_taller ? '✓' : '—'}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isEditing ? (
                                                        <Checkbox id={`novedad-${nov.id}-permiso`} aria-label={`Permiso: ${nov.nombres ?? nov.cedula ?? nov.id}`} checked={Boolean(nov.permiso)} onCheckedChange={(c) => handleNovedadChange(nov.id, 'permiso', Boolean(c))} />
                                                    ) : (
                                                        <span>{nov.permiso ? '✓' : '—'}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isEditing ? (
                                                        <Checkbox id={`novedad-${nov.id}-no-asistio`} aria-label={`No asistió: ${nov.nombres ?? nov.cedula ?? nov.id}`} checked={Boolean(nov.no_asitio)} onCheckedChange={(c) => handleNovedadChange(nov.id, 'no_asitio', Boolean(c))} />
                                                    ) : (
                                                        <span>{nov.no_asitio ? '✓' : '—'}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isEditing ? (
                                                        <Checkbox id={`novedad-${nov.id}-incapacidad`} aria-label={`Incapacidad: ${nov.nombres ?? nov.cedula ?? nov.id}`} checked={Boolean(nov.incapacidad)} onCheckedChange={(c) => handleNovedadChange(nov.id, 'incapacidad', Boolean(c))} />
                                                    ) : (
                                                        <span>{nov.incapacidad ? '✓' : '—'}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isEditing ? (
                                                        <Checkbox id={`novedad-${nov.id}-vacaciones`} aria-label={`Vacaciones: ${nov.nombres ?? nov.cedula ?? nov.id}`} checked={Boolean(nov.vacaciones)} onCheckedChange={(c) => handleNovedadChange(nov.id, 'vacaciones', Boolean(c))} />
                                                    ) : (
                                                        <span>{nov.vacaciones ? '✓' : '—'}</span>
                                                    )}
                                                </TableCell>
                                                {isEditing && (
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteNovedad(nov.id)}
                                                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </TableCell>
                                                )}
                                            </TableRow>
                                        ))
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
                    <Button
                        type="button"
                        onClick={handleExportExcel}
                        variant="outline"
                        size="lg"
                        className="gap-2"
                    >
                        <FileSpreadsheet className="size-5 text-emerald-600" />
                        Exportar Excel
                    </Button>
                    <Button type="button" size="lg" disabled={isSubmitting} onClick={handleGuardarTodo} className="gap-2 px-8">
                        <Save className="size-4" />
                        Guardar planeación de ruta
                    </Button>
                </div>
                )}

            </div>
        </AppLayout>
    );
}
