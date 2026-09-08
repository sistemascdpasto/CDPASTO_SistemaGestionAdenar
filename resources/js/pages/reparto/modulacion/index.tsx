import axios from 'axios';
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Eye,
    FileSpreadsheet,
    FileText,
    Filter,
    MapPin,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    UserPlus,
    Users,
} from 'lucide-react';
import React, { useEffect, useId, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

interface ColaboradorOption {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    nombre_completo: string;
    cargo: string;
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
    cliente: string;
    peso: string;
}

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
    fijo: boolean;
    fijo_rescate: boolean;
    fijo_taller: boolean;
    permiso: boolean;
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
    fijo_rescate?: boolean;
    fijo_taller?: boolean;
}

interface Props {
    fecha: string;
    modulacion: ModulacionData | null;
    colaboradores: ColaboradorOption[];
    cargos: string[];
    vehiculos: string[];
    currentUser: string;
    readOnly?: boolean;
    fijosIniciales?: FijoInicial[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Planeación de ruta', href: '/modules/reparto/modulacion' },
];

// Opciones de cliente (0 a 60)
const clienteOptions: number[] = Array.from({ length: 61 }, (_, i) => i);

// Despachador por defecto
const DESPACHADO_POR_DEFECTO = 'Jhon alexander rojas muñoz 10041925516';

// Lista de municipios de Nariño para respaldo inmediato
const NARINO_MUNICIPIOS_FALLBACK = [
    'Pasto',
    'Ipiales',
    'Tumaco',
    'Túquerres',
    'La Unión',
    'Sandoná',
    'Samaniego',
    'El Tambo',
    'Barbacoas',
    'Buesaco',
    'Chachagüí',
    'Consacá',
    'Cumbal',
    'Guaitarilla',
    'Pupiales',
    'San Pablo',
    'Taminango',
    'Albán',
    'Aldana',
    'Ancuyá',
    'Arboleda',
    'Belén',
    'Cuaspud',
    'Córdoba',
    'El Charco',
    'El Peñol',
    'El Rosario',
    'El Tablón de Gómez',
    'Francisco Pizarro',
    'Funes',
    'Guachucal',
    'Gualmatán',
    'Iles',
    'Imués',
    'La Cruz',
    'La Florida',
    'Leiva',
    'Linares',
    'Los Andes',
    'Magüí Payán',
    'Mallama',
    'Mosquera',
    'Nariño',
    'Olaya Herrera',
    'Ospina',
    'Policarpa',
    'Potosí',
    'Providencia',
    'Puerres',
    'Ricaurte',
    'Roberto Payán',
    'San Bernardo',
    'San Lorenzo',
    'San Pedro de Cartago',
    'Santa Bárbara',
    'Santacruz',
    'Sapuyes',
    'Tangua',
    'Yacuanquer',
];

// Acento del módulo Reparto (usado con moderación, igual que en Seguridad)
const ACCENT = '#D4102A';
const CLIENTE_CLEAR = '__clear__';

// Generador de IDs con respaldo
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Componente para seleccionar municipio de Nariño en Lugares Varios
function NarinoMunicipioInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const baseId = useId();
    const [municipios, setMunicipios] = useState<string[]>(NARINO_MUNICIPIOS_FALLBACK);

    useEffect(() => {
        let cancelado = false;

        const loadMunicipios = async () => {
            try {
                // Intentar obtener la ruta de forma segura
                let deptRoute: string;
                try {
                    deptRoute = route('seguridad.colaboradores.referencias.departamentos');
                } catch (e) {
                    // Si la ruta no existe, usar el fallback
                    console.warn('Ruta de departamentos no disponible, usando municipios por defecto');
                    return;
                }

                const response = await fetch(deptRoute, { headers: { Accept: 'application/json' } });
                const json: { data?: { id: number; nombre: string }[] } = await response.json();
                
                if (cancelado) return;
                
                const narino = (json.data ?? []).find((d) => d.nombre.toLowerCase().includes('nariño'));
                if (narino) {
                    let citiesRoute: string;
                    try {
                        citiesRoute = route('seguridad.colaboradores.referencias.ciudades', { departamento_id: narino.id });
                    } catch (e) {
                        console.warn('Ruta de ciudades no disponible, usando municipios por defecto');
                        return;
                    }

                    const cityResponse = await fetch(citiesRoute, { headers: { Accept: 'application/json' } });
                    const cityJson: { data?: { id: number; nombre: string }[] } = await cityResponse.json();
                    
                    if (!cancelado && cityJson.data && cityJson.data.length > 0) {
                        setMunicipios(cityJson.data.map((c) => c.nombre));
                    }
                }
            } catch (error) {
                // En caso de cualquier error, simplemente usar el fallback
                console.warn('Error al cargar municipios, usando lista por defecto:', error);
            }
        };

        loadMunicipios();

        return () => {
            cancelado = true;
        };
    }, []);

    return (
        <div className="grid grid-cols-2 gap-2">
            <div>
                <Label className="text-xs text-muted-foreground">Departamento</Label>
                <Input
                    type="text"
                    value="Nariño"
                    readOnly
                    className="h-8 text-xs mt-0.5 bg-muted font-medium text-muted-foreground"
                />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">Municipio / Destino</Label>
                <Input
                    id={`${baseId}-municipio`}
                    list={`${baseId}-municipios-list`}
                    type="text"
                    placeholder="Seleccione o escriba municipio"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                    autoComplete="off"
                />
                <datalist id={`${baseId}-municipios-list`}>
                    {municipios.map((m) => (
                        <option key={m} value={m} />
                    ))}
                </datalist>
            </div>
        </div>
    );
}

const cleanString = (val: any, fallback: string = '') => {
    if (val === null || val === undefined || val === 'undefined' || val === 'null') return fallback;
    return String(val);
};

export default function ModulacionIndex({
    fecha: initialFecha,
    modulacion,
    colaboradores = [],
    cargos = [],
    vehiculos = [],
    currentUser,
    readOnly = false,
    fijosIniciales = [],
}: Props) {
    // Modo edición: false por defecto si se llega en modo lectura
    const [isEditing, setIsEditing] = useState(() => !readOnly);
    
    // Sincronizar isEditing cuando cambia readOnly desde las props de Inertia
    useEffect(() => {
        if (readOnly && isEditing) {
            setIsEditing(false);
        }
    }, [readOnly]); // Removí isEditing de las dependencias para evitar loops
    
    // Fecha seleccionada con Calendario
    const [fechaTexto, setFechaTexto] = useState<string>(
        String(modulacion?.fecha ?? initialFecha ?? new Date().toISOString().split('T')[0])
    );

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

    // Flag para saber si la consulta de fecha fue iniciada manualmente por el usuario al crear/cambiar fecha
    const userInitiatedDateChange = React.useRef(false);

    useEffect(() => {
        if (modulacion) {
            if (modulacion.fecha) setFechaTexto(String(modulacion.fecha));
            setUdProgramadoPor(cleanString(modulacion.ud_programado_por, cleanString(currentUser, '')));
            if (modulacion.despachado_por_colaborador_id)
                setDespachadoPorId(String(modulacion.despachado_por_colaborador_id));
            setDespachadoPorNombre(cleanString(modulacion.despachado_por_nombre, DESPACHADO_POR_DEFECTO));

            // Notificar ALERTA SOLO cuando el usuario estaba creando o cambiando de fecha explícitamente
            if (modulacion.fecha && userInitiatedDateChange.current) {
                userInitiatedDateChange.current = false;
                alert(`La fecha ${modulacion.fecha} ya tiene una planeación registrada. Se han precargado los datos.`);
            }
        }
    }, [modulacion]);

    // Función para cambiar la fecha consultando la base de datos vía API en tiempo real sin redirigir la página
    const handleFechaChange = async (newFecha: string) => {
        setFechaTexto(newFecha);
        if (!newFecha) return;

        try {
            const res = await fetch(`/modules/reparto/modulacion/check-fecha?fecha=${encodeURIComponent(newFecha)}`, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!res.ok) {
                console.error('Error checkFecha HTTP:', res.status);
                return;
            }
            const data = await res.json();
            if (data.exists && data.modulacion) {
                setUdProgramadoPor(cleanString(data.modulacion.ud_programado_por, cleanString(currentUser, '')));
                if (data.modulacion.despachado_por_colaborador_id) {
                    setDespachadoPorId(String(data.modulacion.despachado_por_colaborador_id));
                }
                setDespachadoPorNombre(cleanString(data.modulacion.despachado_por_nombre, DESPACHADO_POR_DEFECTO));

                if (Array.isArray(data.modulacion.items) && data.modulacion.items.length > 0) {
                    setRutas(
                        data.modulacion.items.map((item: any) => ({
                            id: item.id,
                            placa: item.placa,
                            doc_tras: item.doc_tras ?? '',
                            cargo: item.cargo ?? '',
                            tripulacion: item.tripulacion ?? [],
                            viajes: (item.viajes ?? []).map((v: any, i: number) => ({ ...v, id: v.id ?? `srv-${item.id}-v${i}` })),
                        }))
                    );
                } else {
                    setRutas([]);
                }

                if (Array.isArray(data.modulacion.novedades)) {
                    setNovedadesLocal([...data.modulacion.novedades]);
                }

                if (!readOnly) setIsEditing(true);

                alert(`La fecha ${newFecha} ya tiene una planeación registrada. Se han precargado los datos.`);
            } else {
                setRutas([]);
                if (Array.isArray(data.fijosIniciales) && data.fijosIniciales.length > 0) {
                    setNovedadesLocal(
                        data.fijosIniciales.map((f: any, i: number) => ({
                            id: -(i + 1),
                            modulacion_id: 0,
                            colaborador_id: f.colaborador_id,
                            cedula: f.cedula,
                            nombres: f.nombres,
                            cargo: f.cargo,
                            fijo: true,
                            fijo_rescate: Boolean(f.fijo_rescate),
                            fijo_taller: Boolean(f.fijo_taller),
                            permiso: false,
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
            console.error('Error al verificar planeación por fecha:', err);
        }
    };

    // Crear ruta en blanco
    const createEmptyRoute = (): RutaFormState => ({
        placa: '',
        doc_tras: '',
        cargo: '',
        tripulacion: [],
        viajes: [
            { id: generateId(), lugares: '', barrio: '', cliente: '', peso: '' },
            { id: generateId(), lugares: '', barrio: '', cliente: '', peso: '' },
        ],
    });

    const [currentRoute, setCurrentRoute] = useState<RutaFormState>(createEmptyRoute());
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // Rutas guardadas en la lista
    const [rutasLoaded, setRutasLoaded] = useState(false);
    const [rutas, setRutas] = useState<RutaFormState[]>(() => {
        if (modulacion?.items && modulacion.items.length > 0) {
            return modulacion.items.map((item) => ({
                id: item.id,
                placa: item.placa,
                doc_tras: (item as any).doc_tras ?? '',
                cargo: item.cargo ?? '',
                tripulacion: item.tripulacion ?? [],
                viajes: (item.viajes ?? []).map((v, i) => ({ ...v, id: v.id ?? `srv-${item.id}-v${i}` })),
            }));
        }
        return [];
    });

    useEffect(() => {
        if (modulacion?.items && modulacion.items.length > 0) {
            setRutas(
                modulacion.items.map((item) => ({
                    id: item.id,
                    placa: item.placa,
                    doc_tras: (item as any).doc_tras ?? '',
                    cargo: item.cargo ?? '',
                    tripulacion: item.tripulacion ?? [],
                    viajes: (item.viajes ?? []).map((v, i) => ({ ...v, id: v.id ?? `srv-${item.id}-v${i}` })),
                }))
            );
            if (!readOnly) {
                setIsEditing(true);
            }
        } else if (modulacion) {
            setRutas([]);
            if (!readOnly) {
                setIsEditing(true);
            }
        } else {
            setRutas([]);
            if (!readOnly) {
                setIsEditing(true);
            }
        }
        setRutasLoaded(true);
    }, [modulacion, readOnly]);

    // Filtros de la Tabla Planeación de Ruta (Solo Filtro por Placa)
    const [filterTablePlaca, setFilterTablePlaca] = useState<string>('todas');

    // Filtros de búsqueda para el Checklist de tripulación
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cargoFilter, setCargoFilter] = useState<string>('todos');

    // COLABORADORES FIJOS
    const fijosColaboradorIds = useMemo(() => {
        const ids = new Set<string>();
        if (modulacion?.novedades) {
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
    }, [modulacion?.novedades]);

    // BOTÓN EDITAR EN LA TABLA PLANEACIÓN DE RUTA
    const handleEditRoute = (index: number) => {
        const routeToEdit = rutas[index];
        if (!routeToEdit) return;
        setCurrentRoute({
            id: routeToEdit.id,
            placa: routeToEdit.placa,
            doc_tras: routeToEdit.doc_tras ?? '',
            cargo: routeToEdit.cargo ?? '',
            tripulacion: Array.isArray(routeToEdit.tripulacion) ? [...routeToEdit.tripulacion] : [],
            viajes: Array.isArray(routeToEdit.viajes) ? [...routeToEdit.viajes] : [],
        });
        setEditingIndex(index);
        setIsEditing(true); // Activar modo edición automáticamente
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRemoveRutaFromList = (index: number) => {
        const itemToRemove = rutas[index];
        // Quitar del estado local inmediatamente
        setRutas((prev) => prev.filter((_, i) => i !== index));
        if (editingIndex === index) {
            setCurrentRoute(createEmptyRoute());
            setEditingIndex(null);
        }
        // Si tenía id en BD, eliminar en el servidor también
        if (itemToRemove?.id) {
            router.delete(route('reparto.modulacion.destroyItem', itemToRemove.id), {
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    const handleCurrentRouteFieldChange = (field: keyof RutaFormState, value: any) => {
        setCurrentRoute((prev) => ({ ...prev, [field]: value }));
    };

    // AGREGAR / EDITAR RUTA INDIVIDUALMENTE EN LA LISTA LOCAL
    const handleGuardarRutaLocal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRoute.placa || currentRoute.placa.trim() === '') {
            alert('Por favor ingrese una Placa para la ruta.');
            return;
        }

        // Tripulación contiene ÚNICAMENTE los colaboradores asignados en el checklist
        const rutaFinal = { ...currentRoute, tripulacion: [...(currentRoute.tripulacion || [])] };

        setRutas((prev) => {
            const updated = [...prev];
            if (editingIndex !== null && editingIndex >= 0 && editingIndex < updated.length) {
                updated[editingIndex] = rutaFinal;
            } else {
                updated.push(rutaFinal);
            }
            return updated;
        });

        setCurrentRoute(createEmptyRoute());
        setEditingIndex(null);
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

    const isCollaboratorAlreadyAssigned = (col: ColaboradorOption) => {
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
    };

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

        setCurrentRoute((prev) => ({ ...prev, tripulacion: trip }));
    };

    // MANEJO DE VIAJES DINÁMICOS
    const handleAddViaje = () => {
        setCurrentRoute((prev) => ({
            ...prev,
            viajes: [...prev.viajes, { id: generateId(), lugares: '', barrio: '', cliente: '', peso: '' }],
        }));
    };

    const handleRemoveViaje = (viajeIndex: number) => {
        if (currentRoute.viajes.length <= 1) return;
        setCurrentRoute((prev) => ({
            ...prev,
            viajes: prev.viajes.filter((_, i) => i !== viajeIndex),
        }));
    };

    const handleViajeChange = (viajeIndex: number, field: keyof Viaje, value: string) => {
        let finalVal = value;
        if (field === 'peso' && value !== '') {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && parsed > 10) {
                alert('El peso máximo permitido por viaje es de 10 toneladas.');
                finalVal = '10';
            }
        }
        const newViajes = [...currentRoute.viajes];
        newViajes[viajeIndex][field] = finalVal;
        setCurrentRoute((prev) => ({ ...prev, viajes: newViajes }));
    };

    // Calcular el total de toneladas acumuladas en los viajes de la ruta actual
    const totalPesoActual = useMemo(() => {
        return currentRoute.viajes
            .reduce((sum, v) => sum + (parseFloat(v.peso) || 0), 0)
            .toFixed(2);
    }, [currentRoute.viajes]);

    // GUARDAR PLANEACIÓN DE RUTA COMPLETA (TODAS LAS RUTAS + NOVEDADES)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleGuardarTodo = () => {
        let finalRutas = [...rutas];

        // Si hay datos escritos actualmente en el formulario de ruta, incluirlos
        if (currentRoute.placa && currentRoute.placa.trim() !== '') {
            if (editingIndex !== null && editingIndex >= 0 && editingIndex < finalRutas.length) {
                finalRutas[editingIndex] = { ...currentRoute };
            } else {
                finalRutas.push({ ...currentRoute });
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
                fijo_rescate: Boolean(nov.fijo_rescate),
                fijo_taller: Boolean(nov.fijo_taller),
                fijo: Boolean(nov.fijo_rescate) || Boolean(nov.fijo_taller),
                permiso: Boolean(nov.permiso),
                incapacidad: Boolean(nov.incapacidad),
                vacaciones: Boolean(nov.vacaciones),
            };
        });

        router.post(
            route('reparto.modulacion.storeBatch'),
            {
                modulacion_id: modulacion?.id ?? null,
                fecha: fechaTexto,
                ud_programado_por: udProgramadoPor,
                despachado_por_colaborador_id: despachadoPorId ? Number(despachadoPorId) : null,
                despachado_por_nombre: despachadoPorNombre,
                rutas: finalRutas as any,
                novedades: novedadesPayload,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => {
                    setIsSubmitting(false);
                    setRutasLoaded(false);
                    setNovedadesLocal([]);
                    setCurrentRoute(createEmptyRoute());
                    setEditingIndex(null);
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
                fijo: true,
                fijo_rescate: Boolean(f.fijo_rescate),
                fijo_taller: Boolean(f.fijo_taller),
                permiso: false,
                incapacidad: false,
                vacaciones: false,
            }));
        }
        return [];
    });

    // Sincronizar novedades cuando cambia modulacion o fijosIniciales
    useEffect(() => {
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
                    fijo: true,
                    fijo_rescate: Boolean(f.fijo_rescate),
                    fijo_taller: Boolean(f.fijo_taller),
                    permiso: false,
                    incapacidad: false,
                    vacaciones: false,
                }))
            );
        } else if (!modulacion) {
            setNovedadesLocal([]);
        }
    }, [modulacion, fijosIniciales]);

    // Para compatibilidad con el payload de storeBatch — mantiene los cambios de checkboxes
    const [novedadesState, setNovedadesState] = useState<Record<number, ModulacionNovedadData>>({});

    useEffect(() => {
        if (modulacion?.novedades) {
            const initialMap: Record<number, ModulacionNovedadData> = {};
            modulacion.novedades.forEach((nov) => {
                initialMap[nov.id] = { ...nov };
            });
            setNovedadesState(initialMap);
        }
    }, [modulacion]);

    // FORMULARIO DE INGRESO A TABLA 2
    const [nuevaNovedad, setNuevaNovedad] = useState({
        colaborador_id: '',
        cedula: '',
        nombres: '',
        cargo: '',
        fijo_rescate: false,
        fijo_taller: false,
        permiso: false,
        incapacidad: false,
        vacaciones: false,
    });

    const handleNuevaNovedadSelectColaborador = (val: string) => {
        if (!val) {
            setNuevaNovedad((prev) => ({
                ...prev,
                colaborador_id: '',
                cedula: '',
                nombres: '',
                cargo: '',
            }));
            return;
        }
        const col = colaboradores.find((c) => String(c.id) === val);
        if (col) {
            setNuevaNovedad((prev) => ({
                ...prev,
                colaborador_id: String(col.id),
                cedula: col.cedula || '',
                nombres: col.nombre_completo || '',
                cargo: col.cargo || '',
            }));
        }
    };

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
            modulacion_id: modulacion?.id ?? 0,
            colaborador_id: nuevaNovedad.colaborador_id ? Number(nuevaNovedad.colaborador_id) : undefined,
            cedula: nuevaNovedad.cedula,
            nombres: nuevaNovedad.nombres,
            cargo: nuevaNovedad.cargo,
            fijo: nuevaNovedad.fijo_rescate || nuevaNovedad.fijo_taller,
            fijo_rescate: nuevaNovedad.fijo_rescate,
            fijo_taller: nuevaNovedad.fijo_taller,
            permiso: nuevaNovedad.permiso,
            incapacidad: nuevaNovedad.incapacidad,
            vacaciones: nuevaNovedad.vacaciones,
        } as any;

        setNovedadesLocal((prev) => [...prev, nuevaFila]);

        // Limpiar formulario
        setNuevaNovedad({
            colaborador_id: '',
            cedula: '',
            nombres: '',
            cargo: '',
            fijo_rescate: false,
            fijo_taller: false,
            permiso: false,
            incapacidad: false,
            vacaciones: false,
        });
    };

    const handleNovedadChange = (id: number, field: keyof ModulacionNovedadData, value: any) => {
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
    const { selectedColaboradores, unselectedColaboradores } = useMemo(() => {
        const selected: ColaboradorOption[] = [];
        const unselected: ColaboradorOption[] = [];

        colaboradores.forEach((col) => {
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

            const matchesCargo = cargoFilter === 'todos' || col.cargo === cargoFilter;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                (col.nombre_completo && col.nombre_completo.toLowerCase().includes(q)) ||
                (col.cedula && col.cedula.includes(q));

            if (!matchesCargo || !matchesSearch) return;

            const isAssignedElsewhere = isCollaboratorAlreadyAssigned(col);

            if (!isAssignedElsewhere) {
                unselected.push(col);
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
                });
            }
        });

        return { selectedColaboradores: selected, unselectedColaboradores: unselected };
    }, [colaboradores, cargoFilter, searchQuery, currentRoute.tripulacion, assignedCollaboratorsSet, fijosColaboradorIds]);

    const allChecklistColaboradores = [...selectedColaboradores, ...unselectedColaboradores];

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

    // FUNCIÓN PARA EXPORTAR A EXCEL
    const handleExportExcel = () => {
        if (filteredRutasTable.length === 0) {
            alert('No hay rutas para exportar con los filtros seleccionados.');
            return;
        }

        const exportData = filteredRutasTable.map((r, index) => {
            const tripulacionStr = (r.tripulacion || [])
                .map((m) => `${m.nombres} (Cédula: ${m.cedula}${m.cargo ? ' - Cargo: ' + m.cargo : ''})`)
                .join(' | ');

            const colaboradoresStr = novedadesLocal
                .map((nov) => {
                    const types = [];
                    if (nov.fijo_rescate) types.push('FIJO RESCATE');
                    if (nov.fijo_taller) types.push('FIJO TALLER');
                    if (nov.permiso) types.push('PERMISO');
                    if (nov.incapacidad) types.push('INCAPACIDAD');
                    if (nov.vacaciones) types.push('VACACIONES');
                    const typeStr = types.length > 0 ? ` [${types.join(', ')}]` : '';
                    return `${nov.nombres || ''} (Cédula: ${nov.cedula || '-'}${nov.cargo ? ' - ' + nov.cargo : ''})${typeStr}`;
                })
                .join(' | ');

            const viajesStr = (r.viajes || [])
                .map(
                    (v, vIdx) =>
                        `Viaje ${vIdx + 1}: Lugares: Nariño - ${v.lugares || '-'}${v.barrio ? ' - Barrio: ' + v.barrio : ''}, Cliente: ${v.cliente || '-'}, Peso: ${v.peso || '-'} ton`
                )
                .join(' | ');

            return {
                '#': index + 1,
                Fecha: fechaTexto,
                'Programado Por': udProgramadoPor || '-',
                'Despachado Por': despachadoPorNombre || '-',
                Placa: r.placa,
                Tripulación: tripulacionStr || '-',
                Colaboradores: colaboradoresStr || '-',
                Viajes: viajesStr || '-',
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Planeación de Ruta');

        const fileName = `Planeacion_Ruta_${fechaTexto || new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Planeación de ruta" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                {/* Header título */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
                    <HeadingSmall title="Planeación de ruta" />
                    <div className="flex items-center gap-2">
                        {readOnly && (
                            <Button variant="outline" asChild>
                                <Link href={route('reparto.modulacion.historial')}>
                                    <ArrowLeft className="size-4" />
                                    Volver al historial
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                {/* CARD DE FILTROS */}
                {/* Creando: sin filtros. Editando con planeación existente: solo filtro por placa */}
                {isEditing && modulacion?.id && (
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between">
                            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                <Filter className="size-4" />
                                Filtros
                            </span>
                            <Button
                                type="button"
                                onClick={handleExportExcel}
                                className="text-xs h-8 px-3"
                            >
                                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                                {'Exportar Excel'}
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Selector de Fecha con Calendario */}
                            <div>
                                <Label htmlFor="filtro-fecha" className="flex items-center gap-1.5 text-xs font-semibold">
                                    <Calendar className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                                    {'Fecha de la Planeación (Calendario)'}
                                </Label>
                                <Input
                                    id="filtro-fecha"
                                    type="date"
                                    value={fechaTexto}
                                    onChange={(e) => handleFechaChange(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            {/* Filtro por Placa */}
                            <div>
                                <Label className="flex items-center gap-1 text-xs font-medium">
                                    <Filter className="size-3.5 text-muted-foreground" />
                                    Filtro por placa
                                </Label>
                                <Select value={filterTablePlaca} onValueChange={setFilterTablePlaca}>
                                    <SelectTrigger className="h-10 text-xs mt-1 w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">-- Todas las Placas --</SelectItem>
                                        {uniquePlacasInRutas.map((placa) => (
                                            <SelectItem key={placa} value={placa}>
                                                {placa}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                )}
                {/* fin card filtros */}

                {/* FORMULARIO NUEVA SALIDA — visible en creación o edición */}
                <form onSubmit={handleGuardarRutaLocal} className="space-y-6" style={{ display: (!readOnly || isEditing) ? 'block' : 'none' }}>
                    {/* FORMULARIO DE RUTA UNIFICADO (CARD NUEVA SALIDA) */}
                    <Card className="relative border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Badge>{editingIndex !== null ? `Editando ruta #${editingIndex + 1}` : 'Nueva salida'}</Badge>
                                {currentRoute.placa ? <span>{`Placa: ${currentRoute.placa}`}</span> : null}
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-6 pt-4">
                            {/* DATOS GENERALES DE LA SALIDA */}
                            <div className="p-4 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border space-y-4">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                    <FileText className="size-4" style={{ color: ACCENT }} />
                                    Datos generales de la salida
                                </div>

                                {/* Fila 1: Programado Por, Despachado Por */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="ud_programado_por" className="text-xs font-medium text-foreground">
                                            UD Programado Por
                                        </Label>
                                        <Input
                                            id="ud_programado_por"
                                            type="text"
                                            placeholder="Nombre del usuario programador"
                                            value={udProgramadoPor}
                                            onChange={(e) => setUdProgramadoPor(e.target.value)}
                                            className="mt-1"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="despachado_por" className="text-xs font-medium">
                                            Despachado Por (Colaborador)
                                        </Label>
                                        <div className="relative mt-1">
                                            <Input
                                                id="despachado_por"
                                                type="text"
                                                value={despachadoPorNombre}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setDespachadoPorNombre(val);
                                                    setShowDespachadorDropdown(true);
                                                    // Si coincide con un colaborador de la lista, guardar su ID
                                                    const found = colaboradores.find(
                                                        (c) => c.nombre_completo.toLowerCase() === val.toLowerCase() ||
                                                               `${c.nombre_completo} ${c.cedula}`.toLowerCase() === val.toLowerCase()
                                                    );
                                                    setDespachadoPorId(found ? String(found.id) : '');
                                                }}
                                                onFocus={() => setShowDespachadorDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowDespachadorDropdown(false), 150)}
                                                placeholder="Busque o escriba el nombre..."
                                                className="mt-1 bg-background font-medium"
                                                autoComplete="off"
                                            />
                                            {/* Dropdown de colaboradores */}
                                            {showDespachadorDropdown && (
                                                <div className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-48 overflow-y-auto rounded-md border border-input bg-popover shadow-md">
                                                    {colaboradores
                                                        .filter((c) => {
                                                            const q = despachadoPorNombre.toLowerCase().trim();
                                                            return !q || 
                                                                c.nombre_completo.toLowerCase().includes(q) || 
                                                                (c.cedula && c.cedula.includes(q));
                                                        })
                                                        .map((c) => (
                                                            <div
                                                                key={c.id}
                                                                onMouseDown={() => {
                                                                    setDespachadoPorNombre(`${c.nombre_completo} ${c.cedula}`);
                                                                    setDespachadoPorId(String(c.id));
                                                                    setShowDespachadorDropdown(false);
                                                                }}
                                                                className="cursor-pointer border-b border-border px-3 py-2 text-sm text-foreground last:border-b-0 hover:bg-muted"
                                                            >
                                                                <div className="font-medium">{c.nombre_completo}</div>
                                                                <div className="text-xs text-muted-foreground">{c.cedula} • {c.cargo}</div>
                                                            </div>
                                                        ))}
                                                    {colaboradores.filter((c) => {
                                                        const q = despachadoPorNombre.toLowerCase().trim();
                                                        return !q || 
                                                            c.nombre_completo.toLowerCase().includes(q) || 
                                                            (c.cedula && c.cedula.includes(q));
                                                    }).length === 0 && (
                                                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                                            No se encontraron colaboradores
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <Input
                                            id="despachado_por"
                                            type="text"
                                            value={despachadoPorNombre}
                                            onChange={(e) => setDespachadoPorNombre(e.target.value)}
                                            placeholder="Despachado Por"
                                            className="mt-1 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Fila 2: Placa + Documento Transporte */}
                                <div className="pt-2 border-t border-red-100 dark:border-red-900/30">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs font-medium text-foreground">
                                                Placa <span className="text-red-500">*</span>
                                            </Label>
                                            {vehiculos.length > 0 && (
                                                <select
                                                    value={currentRoute.placa}
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleCurrentRouteFieldChange('placa', e.target.value);
                                                        }
                                                    }}
                                                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                >
                                                    <option value="">-- Seleccionar Placa --</option>
                                                    {vehiculos
                                                        .filter((v) => {
                                                            const placaUpper = String(v).toUpperCase();
                                                            // Permitir la placa que ya tiene la ruta en edición
                                                            if (currentRoute.placa && String(currentRoute.placa).toUpperCase() === placaUpper) return true;
                                                            // Excluir placas ya usadas en otras rutas
                                                            return !rutas.some((r, idx) => {
                                                                if (editingIndex !== null && idx === editingIndex) return false;
                                                                return String(r.placa).toUpperCase() === placaUpper;
                                                            });
                                                        })
                                                        .map((v) => (
                                                        <option key={v} value={String(v)}>
                                                            {String(v)}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="text-xs font-medium text-foreground">
                                                Documento Transporte
                                            </Label>
                                            <Input
                                                type="text"
                                                placeholder="Ej: 8008417408"
                                                value={currentRoute.doc_tras ?? ''}
                                                onChange={(e) => handleCurrentRouteFieldChange('doc_tras', e.target.value)}
                                                className="h-10 mt-1 font-mono"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN TRIPULACIÓN: CHECKLIST CON FILTRO */}
                            <div className="border border-sidebar-border/70 dark:border-sidebar-border rounded-lg p-4 space-y-4">
                                <div className="border-b pb-2">
                                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        Tripulación de la Ruta (Solo colaboradores libres para la fecha)
                                    </h3>
                                </div>

                                {/* BARRA DE FILTROS Y BUSCADOR */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md border">
                                    <div>
                                        <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                            <Search className="h-3 w-3 text-muted-foreground" />
                                            Buscar por Nombre o Cédula
                                        </Label>
                                        <Input
                                            type="text"
                                            placeholder="Escriba para filtrar colaboradores..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="h-8 text-xs mt-1"
                                        />
                                    </div>

                                    <div>
                                        <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                            <Filter className="h-3 w-3 text-muted-foreground" />
                                            Filtrar por Cargo
                                        </Label>
                                        <Select value={cargoFilter} onValueChange={setCargoFilter}>
                                            <SelectTrigger className="h-8 text-xs mt-1 w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">-- Todos los Cargos --</SelectItem>
                                                {cargos.map((cg) => (
                                                    <SelectItem key={cg} value={String(cg)}>
                                                        {String(cg)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* CHECKLIST DE COLABORADORES DISPONIBLES */}
                                <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                                    <Label className="flex items-center gap-1 border-b pb-1 text-[11px] font-semibold text-muted-foreground">
                                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                        Marcar colaboradores libres al día para la Tripulación ({allChecklistColaboradores.length} disponibles)
                                    </Label>

                                    {allChecklistColaboradores.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-2 text-center">
                                            No se encontraron colaboradores libres para la fecha seleccionada.
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
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
                                                    <div
                                                        key={`col-item-${col.id ?? col.cedula}`}
                                                        className={`flex items-center space-x-2 p-1.5 rounded border transition-colors ${
                                                            isChecked
                                                                ? isFijo
                                                                    ? 'border-[#0ca30c]/50 bg-[#0ca30c]/10 ring-1 ring-[#0ca30c]/30'
                                                                    : 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                                                                : 'hover:bg-muted/50'
                                                        }`}
                                                    >
                                                        <Checkbox
                                                            id={`check-${col.id}`}
                                                            checked={isChecked}
                                                            disabled={isFijo && isChecked}
                                                            onCheckedChange={() => handleToggleChecklistMember(col)}
                                                        />
                                                        <label
                                                            htmlFor={`check-${col.id}`}
                                                            className="text-xs font-medium cursor-pointer leading-tight truncate flex-1"
                                                        >
                                                            <span className="font-semibold text-foreground">
                                                                {String(col.nombre_completo ?? '')}
                                                            </span>
                                                            {col.cedula ? (
                                                                <span className="text-[10px] text-muted-foreground font-mono block">
                                                                    {'Cédula: ' + String(col.cedula ?? '')}
                                                                </span>
                                                            ) : null}
                                                            {col.cargo ? (
                                                                <span className="text-[10px] text-muted-foreground block truncate">
                                                                    {String(col.cargo ?? '')}
                                                                </span>
                                                            ) : null}
                                                        </label>
                                                        {isFijo && isChecked ? (
                                                            <Badge className="border-transparent bg-[#15803d] px-1.5 py-0 text-[9px] text-white">FIJO</Badge>
                                                        ) : isChecked ? (
                                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                                                {'Seleccionado'}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECCIÓN VIAJES DINÁMICOS CON LUGARES DE NARIÑO Y API */}
                            <div className="space-y-3 rounded-lg border border-sidebar-border/70 bg-muted/40 p-4 dark:border-sidebar-border">
                                <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                            <MapPin className="h-4 w-4 text-red-500" />
                                            Viajes de la Ruta (Destinos Nariño, Cliente y Peso por Fila)
                                        </h3>
                                        <Badge variant="outline" className="font-mono text-xs border-red-300 text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300">
                                            Fórmula Total Peso: {totalPesoActual} ton
                                        </Badge>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddViaje}
                                        className="text-xs"
                                        style={{ color: ACCENT }}
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                        Aumentar Más Viajes
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {currentRoute.viajes.map((viaje, vIdx) => (
                                        <div
                                            key={viaje.id ?? `form-viaje-${vIdx}`}
                                            className="p-3 border rounded-md space-y-2 relative"
                                        >
                                            <div className="flex items-center justify-between border-b pb-1">
                                                <span className="text-xs font-bold" style={{ color: ACCENT }}>
                                                    {`Viaje ${vIdx + 1}`}
                                                </span>
                                                {currentRoute.viajes.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveViaje(vIdx)}
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        aria-label="Eliminar viaje"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>

                                            <NarinoMunicipioInput
                                                value={String(viaje.lugares ?? '')}
                                                onChange={(val) => handleViajeChange(vIdx, 'lugares', val)}
                                            />

                                            {/* Barrio */}
                                            <div>
                                                <Label className="text-xs text-muted-foreground">
                                                    Barrio
                                                </Label>
                                                <Input
                                                    type="text"
                                                    placeholder="Ej: Centro, El Tejar..."
                                                    value={String(viaje.barrio ?? '')}
                                                    onChange={(e) => handleViajeChange(vIdx, 'barrio', e.target.value)}
                                                    className="mt-0.5 h-8 text-xs"
                                                />
                                            </div>

                                            {/* Barrio */}
                                            <div>
                                                <Label className="text-xs text-muted-foreground">
                                                    Cliente (0 - 60)
                                                </Label>
                                                <Select
                                                    value={viaje.cliente ? String(viaje.cliente) : undefined}
                                                    onValueChange={(v) =>
                                                        handleViajeChange(vIdx, 'cliente', v === CLIENTE_CLEAR ? '' : v)
                                                    }
                                                >
                                                    <SelectTrigger className="h-8 text-xs mt-0.5 w-full">
                                                        <SelectValue placeholder="-- Seleccionar --" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value={CLIENTE_CLEAR}>-- Seleccionar --</SelectItem>
                                                        {clienteOptions.map((n) => (
                                                            <SelectItem key={n} value={String(n)}>
                                                                {String(n)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs text-muted-foreground">
                                                        Peso (Toneladas)
                                                    </Label>
                                                    <span className="text-[10px] text-red-600 font-bold">Máx 10 Ton</span>
                                                </div>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="10"
                                                    placeholder="Ej: 1.5"
                                                    value={String(viaje.peso ?? '')}
                                                    onChange={(e) => handleViajeChange(vIdx, 'peso', e.target.value)}
                                                    className="h-8 text-xs mt-0.5"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* BOTONES RUTA INDIVIDUAL */}
                    <div className="flex justify-end gap-2 pt-2">
                        {editingIndex !== null && (
                            <Button
                                type="button"
                                onClick={() => {
                                    setCurrentRoute(createEmptyRoute());
                                    setEditingIndex(null);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm px-6 py-2 font-semibold shadow-sm"
                            >
                                <Plus className="h-4 w-4 mr-1.5" />
                                Agregar Ruta
                            </Button>
                        )}
                        <Button type="submit" className="text-sm px-6 py-2 font-semibold">
                            <Plus className="h-4 w-4 mr-1.5" />
                            {editingIndex !== null ? 'Actualizar Ruta' : 'Guardar Ruta'}
                        </Button>
                    </div>
                </form>
                
                {/* fin formulario */}

                {/* 3. TABLA 1: PLANEACIÓN DE RUTA */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <FileText className="h-5 w-5" style={{ color: ACCENT }} />
                                {'Planeación de Ruta'}
                                {filteredRutasTable.length > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {String(filteredRutasTable.length)} {'rutas'}
                                    </Badge>
                                )}
                            </CardTitle>
                        </div>

                        {/* METADATOS */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-3 text-xs bg-muted px-3 py-1.5 rounded-md border">
                                <div>
                                    <span className="font-semibold text-muted-foreground">Fecha:</span>{' '}
                                    <span className="font-bold text-foreground">{fechaTexto}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-muted-foreground">Programado Por:</span>{' '}
                                    <span className="font-bold text-foreground">{udProgramadoPor || '-'}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-muted-foreground">Despachado Por:</span>{' '}
                                    <span className="font-bold text-foreground">{despachadoPorNombre || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-4">
                        {/* TABLA DE RUTAS */}
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-10 text-center">{'#'}</TableHead>
                                        <TableHead className="font-semibold">{'Placa'}</TableHead>
                                        <TableHead className="font-semibold min-w-[140px]">{'Doc. Transporte'}</TableHead>
                                        <TableHead className="font-semibold min-w-[220px]">{'Tripulación'}</TableHead>
                                        <TableHead className="font-semibold min-w-[240px]">{'Colaboradores'}</TableHead>
                                        <TableHead className="font-semibold min-w-[300px]">{'Viajes (Lugar, Cliente, Peso)'}</TableHead>
                                        <TableHead className="text-right font-semibold w-28">{'Acciones'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRutasTable.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                {rutas.length === 0
                                                    ? 'No hay rutas registradas para esta fecha. Complete los campos arriba y presione Guardar Ruta.'
                                                    : 'No hay rutas que coincidan con los filtros aplicados.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRutasTable.map((item, idx) => {
                                            const tripMembers = Array.isArray(item.tripulacion) ? item.tripulacion : [];
                                            const viajesList = Array.isArray(item.viajes) ? item.viajes : [];

                                            return (
                                                <TableRow key={item.id ?? `ruta-${item.placa}-${idx}`} className="hover:bg-muted/50">
                                                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                        {String(idx + 1)}
                                                    </TableCell>
                                                    <TableCell className="font-semibold font-mono text-sm" style={{ color: ACCENT }}>
                                                        {String(item.placa ?? '')}
                                                    </TableCell>

                                                    {/* DOC. TRANSPORTE */}
                                                    <TableCell className="font-mono text-xs text-foreground">
                                                        {item.doc_tras ? (
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                {String(item.doc_tras)}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground italic text-xs">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* TRIPULACIÓN */}
                                                    <TableCell className="text-xs">
                                                        {tripMembers.length > 0 ? (
                                                            <div className="space-y-1.5">
                                                                {tripMembers.map((m, mIdx) => (
                                                                    <div key={`trip-${m.colaborador_id ?? m.cedula}-${mIdx}`} className="p-1.5 rounded border flex items-center justify-between gap-2 bg-muted">
                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                            <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                                                                                {String(m.cedula ?? 'S/I')}
                                                                            </Badge>
                                                                            <span className="font-semibold text-foreground truncate">
                                                                                {String(m.nombres ?? 'Sin nombre')}
                                                                            </span>
                                                                        </div>
                                                                        {m.cargo ? (
                                                                            <span className="text-[10px] text-blue-600 font-medium shrink-0">
                                                                                {String(m.cargo)}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">{'-'}</span>
                                                        )}
                                                    </TableCell>

                                                    {/* COLABORADORES AGREGADOS */}
                                                    <TableCell className="text-xs">
                                                        {novedadesLocal.length > 0 ? (
                                                            <div className="space-y-1.5">
                                                                {novedadesLocal.map((nov) => {
                                                                    const badges: { text: string; color: string }[] = [];
                                                                    if (nov.fijo_rescate) badges.push({ text: 'FIJO RESCATE', color: 'bg-green-600' });
                                                                    if (nov.fijo_taller) badges.push({ text: 'FIJO TALLER', color: 'bg-emerald-600' });
                                                                    if (!nov.fijo_rescate && !nov.fijo_taller && nov.fijo) badges.push({ text: 'FIJO', color: 'bg-green-600' });
                                                                    if (nov.permiso) badges.push({ text: 'PERMISO', color: 'bg-amber-600' });
                                                                    if (nov.incapacidad) badges.push({ text: 'INCAPACIDAD', color: 'bg-red-600' });
                                                                    if (nov.vacaciones) badges.push({ text: 'VACACIONES', color: 'bg-purple-600' });

                                                                    return (
                                                                        <div key={`colab-${nov.id ?? nov.cedula}`} className="p-1.5 rounded border bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-1.5 truncate">
                                                                                {nov.cedula && (
                                                                                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                                                                                        {String(nov.cedula)}
                                                                                    </Badge>
                                                                                )}
                                                                                <span className="font-semibold text-foreground truncate">
                                                                                    {String(nov.nombres ?? 'Sin nombre')}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                                                                {nov.cargo ? (
                                                                                    <span className="text-[10px] text-blue-600 font-medium">
                                                                                        {String(nov.cargo)}
                                                                                    </span>
                                                                                ) : null}
                                                                                {badges.map((b, bIdx) => (
                                                                                    <Badge key={bIdx} className={`text-[9px] px-1 py-0 ${b.color} text-white`}>
                                                                                        {b.text}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">{'-'}</span>
                                                        )}
                                                    </TableCell>

                                                    {/* VIAJES */}
                                                    <TableCell className="text-xs">
                                                        {viajesList.length > 0 ? (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {viajesList.map((v, vIdx) => (
                                                                    <div key={v.id ?? `viaje-${v.lugares}-${v.cliente}-${vIdx}`} className="p-2 bg-muted/50 rounded border space-y-1">
                                                                        <div className="font-bold text-[10px] border-b pb-0.5" style={{ color: ACCENT }}>
                                                                            {'Viaje ' + String(vIdx + 1)}
                                                                        </div>
                                                                        <div className="text-[11px] text-muted-foreground">
                                                                            <span className="font-semibold">{'Lugar: '}</span>
                                                                            {v.lugares ? `Nariño - ${v.lugares}` : '-'}
                                                                            {v.barrio ? ` · Barrio: ${v.barrio}` : ''}
                                                                        </div>
                                                                        <div className="text-[11px] text-muted-foreground">
                                                                            <span className="font-semibold">{'Cliente: '}</span>
                                                                            {String(v.cliente ?? '-')}
                                                                        </div>
                                                                        <div className="text-[11px] text-muted-foreground">
                                                                            <span className="font-semibold">{'Peso: '}</span>
                                                                            {v.peso ? `${v.peso} ton` : '-'}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">{'-'}</span>
                                                        )}
                                                    </TableCell>

                                                    {/* ACCIONES */}
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEditRoute(idx)}
                                                                className="h-8 px-2 text-xs"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                                                {'Editar'}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveRutaFromList(idx)}
                                                                className="h-8 w-8"
                                                                aria-label="Eliminar ruta"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. TABLA 2: NOVEDADES DE COLABORADORES AGREGADOS — solo en modo edición */}
                {isEditing && (
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            {'Agregar Colaboradores'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* FORMULARIO SUPERIOR MANUAL */}
                        <div className="p-3 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border space-y-3">
                            <Label className="flex items-center gap-1.5 text-xs font-semibold">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                {'Ingresar Colaborador a Novedades'}
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                <div>
                                    <Label className="text-xs text-muted-foreground">
                                        {'Seleccionar Colaborador'}
                                    </Label>
                                    <Select
                                        value={nuevaNovedad.colaborador_id || undefined}
                                        onValueChange={(v) =>
                                            handleNuevaNovedadSelectColaborador(v === CLIENTE_CLEAR ? '' : v)
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs mt-1 w-full">
                                            <SelectValue placeholder="-- Seleccionar colaborador --" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={CLIENTE_CLEAR}>-- Seleccionar colaborador --</SelectItem>
                                            {colaboradores.map((col) => (
                                                <SelectItem key={col.id} value={String(col.id)}>
                                                    {`${col.nombre_completo ?? ''} (${col.cedula ?? ''})`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">
                                            {'Cédula'}
                                        </Label>
                                        <Input
                                            type="text"
                                            placeholder="Cédula"
                                            value={nuevaNovedad.cedula}
                                            onChange={(e) => setNuevaNovedad((prev) => ({ ...prev, cedula: e.target.value }))}
                                            className="h-8 text-xs mt-1 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">
                                            {'Cargo'}
                                        </Label>
                                        <Input
                                            type="text"
                                            placeholder="Cargo"
                                            value={nuevaNovedad.cargo}
                                            onChange={(e) => setNuevaNovedad((prev) => ({ ...prev, cargo: e.target.value }))}
                                            className="h-8 text-xs mt-1"
                                        />
                                    </div>
                                </div>

                                {/* CHECKBOXES FIJO RESCATE / FIJO TALLER */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200">
                                        <Checkbox
                                            id="nuevo-fijo-rescate"
                                            checked={nuevaNovedad.fijo_rescate}
                                            onCheckedChange={(checked) =>
                                                setNuevaNovedad((prev) => ({ ...prev, fijo_rescate: Boolean(checked) }))
                                            }
                                        />
                                        <label htmlFor="nuevo-fijo-rescate" className="text-xs font-semibold text-green-800 dark:text-green-300 cursor-pointer">
                                            Fijo Rescate (aparece en todas las rutas)
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md border border-emerald-200">
                                        <Checkbox
                                            id="nuevo-fijo-taller"
                                            checked={nuevaNovedad.fijo_taller}
                                            onCheckedChange={(checked) =>
                                                setNuevaNovedad((prev) => ({ ...prev, fijo_taller: Boolean(checked) }))
                                            }
                                        />
                                        <label htmlFor="nuevo-fijo-taller" className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                                            Fijo Taller (aparece en todas las rutas)
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <Button
                                        type="button"
                                        onClick={handleAgregarNovedadTabla2}
                                        className="font-semibold text-xs h-8 w-full"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        {'+ Agregar a Novedades'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* TABLA DE NOVEDADES */}
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="font-semibold">{'Identificación'}</TableHead>
                                        <TableHead className="font-semibold">{'Nombres'}</TableHead>
                                        <TableHead className="font-semibold">{'Cargo'}</TableHead>
                                        <TableHead className="text-center font-semibold">{'Fijo Rescate'}</TableHead>
                                        <TableHead className="text-center font-semibold">{'Fijo Taller'}</TableHead>
                                        <TableHead className="text-center font-semibold">{'Permiso'}</TableHead>
                                        <TableHead className="text-center font-semibold">{'Incapacidad'}</TableHead>
                                        <TableHead className="text-center font-semibold">{'Vacaciones'}</TableHead>
                                        <TableHead className="text-right font-semibold w-24">{'Acciones'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {novedadesLocal.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                {'No hay colaboradores agregados en novedades para esta fecha. Utilice el formulario arriba para agregar uno.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        novedadesLocal.map((nov) => (
                                            <TableRow key={nov.id} className={(nov.fijo || nov.fijo_rescate || nov.fijo_taller) ? 'bg-green-50/50 dark:bg-green-950/20' : ''}>
                                                <TableCell className="font-mono text-sm">{String(nov.cedula ?? '-')}</TableCell>
                                                <TableCell className="font-medium text-sm">{String(nov.nombres ?? '-')}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {String(nov.cargo ?? '-')}
                                                </TableCell>

                                                 {/* Fijo Rescate */}
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={Boolean(nov.fijo_rescate)}
                                                        onCheckedChange={(checked) =>
                                                            handleNovedadChange(nov.id, 'fijo_rescate', Boolean(checked))
                                                        }
                                                    />
                                                </TableCell>

                                                {/* Fijo Taller */}
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={Boolean(nov.fijo_taller)}
                                                        onCheckedChange={(checked) =>
                                                            handleNovedadChange(nov.id, 'fijo_taller', Boolean(checked))
                                                        }
                                                    />
                                                </TableCell>

                                                {/* Permiso */}
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={Boolean(nov.permiso)}
                                                        onCheckedChange={(checked) =>
                                                            handleNovedadChange(nov.id, 'permiso', Boolean(checked))
                                                        }
                                                    />
                                                </TableCell>

                                                {/* Incapacidad */}
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={Boolean(nov.incapacidad)}
                                                        onCheckedChange={(checked) =>
                                                            handleNovedadChange(nov.id, 'incapacidad', Boolean(checked))
                                                        }
                                                    />
                                                </TableCell>

                                                {/* Vacaciones */}
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={Boolean(nov.vacaciones)}
                                                        onCheckedChange={(checked) =>
                                                            handleNovedadChange(nov.id, 'vacaciones', Boolean(checked))
                                                        }
                                                    />
                                                </TableCell>

                                                {/* Acciones */}
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteNovedad(nov.id)}
                                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                )}
                {/* fin tabla 2 novedades */}

                {/* BOTÓN GENERAL PARA GUARDAR LA PLANEACIÓN DE RUTA COMPLETA (TODAS LAS RUTAS Y NOVEDADES) — solo en modo edición */}
                {isEditing && (
                <div className="flex items-center justify-end border-t border-sidebar-border/70 pt-4 dark:border-sidebar-border">
                    <Button type="button" size="lg" disabled={isSubmitting} onClick={handleGuardarTodo}>
                        <Save className="size-4" />
                        Guardar planeación de ruta
                    </Button>
                </div>
                )}
                {/* fin botón guardar todo */}
            </div>
        </AppLayout>
    );
}
