import { Head } from '@inertiajs/react';
import { AlertTriangle, Car, FlameKindling, History, Maximize2, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtintorPublico {
    id: number;
    numero_serie: string;
    tipo_agente: string | null;
    capacidad_kg: string | null;
    marca: string | null;
    fecha_fabricacion: string | null;
    fecha_vencimiento: string | null;
    vencido: boolean;
    observaciones: string | null;
    condicion: string | null;
    agente_impulsor: string | null;
    parte_mantenimiento: string | null;
    senalizacion: string | null;
    demarcacion: string | null;
    funcionamiento: string | null;
    acceso: string | null;
    ultima_recarga: string | null;
    placa_actual: string | null;
    fecha_asignacion: string | null;
    foto_url?: string | null;
}

interface AsignacionPub {
    placa: string;
    fecha_colocacion: string | null;
    fecha_retiro: string | null;
    responsable_colocacion: string | null;
    responsable_retiro: string | null;
    activo: boolean;
}

interface InspeccionPub {
    id: number;
    tipo: string;
    tipo_label: string;
    fecha_inspeccion: string | null;
    responsable_inicio: string | null;
    responsable_periodico: string | null;
    condicion?: string | null;
    tipo_agente?: string | null;
    agente_impulsor?: string | null;
    parte_mantenimiento?: string | null;
    senalizacion?: string | null;
    demarcacion?: string | null;
    funcionamiento?: string | null;
    acceso?: string | null;
    observaciones_inspeccion: string | null;
    incluye_recarga: boolean;
    fecha_recarga: string | null;
    fecha_proxima_recarga: string | null;
    observaciones_recarga: string | null;
    evidencias_count: number;
}

interface Props {
    extintor: ExtintorPublico;
    tiene_inspeccion_inicio?: boolean;
    asignaciones: AsignacionPub[];
    inspecciones: InspeccionPub[];
    qr_svg: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ExtintorPublico({ extintor, tiene_inspeccion_inicio = false, asignaciones, inspecciones, qr_svg }: Props) {
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const historialExtintor = useMemo(() => {
        const rows = inspecciones.map(ins => ({
            id: `ins-${ins.id}`,
            fecha: ins.fecha_inspeccion ?? '—',
            tipo: ins.tipo_label ?? (ins.tipo === 'inicio' ? 'Inspección de inicio' : 'Inspección periódica'),
            foto_url: extintor.foto_url,
            numero_serie: extintor.numero_serie,
            condicion: ins.condicion || extintor.condicion || '—',
            tipo_agente: ins.tipo_agente || extintor.tipo_agente || '—',
            agente_impulsor: ins.agente_impulsor || extintor.agente_impulsor || '—',
            ultima_recarga: ins.fecha_recarga || (ins.incluye_recarga ? (ins.fecha_inspeccion ?? '—') : (extintor.ultima_recarga ?? '—')),
            parte_mantenimiento: ins.parte_mantenimiento || '—',
            senalizacion: ins.senalizacion || '—',
            demarcacion: ins.demarcacion || '—',
            funcionamiento: ins.funcionamiento || '—',
            acceso: ins.acceso || '—',
            placa_actual: extintor.placa_actual || '—',
            observaciones: ins.observaciones_inspeccion || ins.observaciones_recarga || '—',
        }));

        if (!tiene_inspeccion_inicio || rows.length === 0) {
            rows.push({
                id: 'ext-inicial',
                fecha: extintor.fecha_fabricacion ? `${extintor.fecha_fabricacion}` : 'Registro inicial',
                tipo: 'Registro inicial',
                foto_url: extintor.foto_url,
                numero_serie: extintor.numero_serie,
                condicion: extintor.condicion || '—',
                tipo_agente: extintor.tipo_agente || '—',
                agente_impulsor: extintor.agente_impulsor || '—',
                ultima_recarga: extintor.ultima_recarga || '—',
                parte_mantenimiento: extintor.parte_mantenimiento || '—',
                senalizacion: extintor.senalizacion || '—',
                demarcacion: extintor.demarcacion || '—',
                funcionamiento: extintor.funcionamiento || '—',
                acceso: extintor.acceso || '—',
                placa_actual: extintor.placa_actual || '—',
                observaciones: extintor.observaciones || '—',
            });
        }

        return rows;
    }, [inspecciones, extintor, tiene_inspeccion_inicio]);

    return (
        <>
            <Head title={`Extintor ${extintor.numero_serie}`} />
            <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-6xl space-y-6">

                    {/* ── Ficha del extintor (card unificada) ── */}
                    <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
                        <div className="flex flex-col sm:flex-row gap-5">
                            {/* Foto del extintor */}
                            {extintor.foto_url && (
                                <div
                                    className="w-full sm:w-40 md:w-48 shrink-0 aspect-[3/4] rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer group relative"
                                    onClick={() => setLightboxOpen(true)}
                                    title="Clic para ver la imagen más grande"
                                >
                                    <img src={extintor.foto_url} alt={extintor.numero_serie} className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                                        <span className="text-white text-[11px] font-medium bg-black/50 px-3 py-1 rounded-full flex items-center gap-1">
                                            <Maximize2 className="size-3" /> Ampliar
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Datos */}
                            <div className="flex-1 flex flex-col gap-4">
                                {/* Título */}
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
                                        <FlameKindling className="size-5 text-red-500" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-gray-900 font-mono">
                                            {extintor.numero_serie}
                                        </h1>
                                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">N° de Serie</p>
                                    </div>
                                    {/* QR */}
                                    <div
                                        className="ml-auto shrink-0 rounded-xl border border-gray-200 bg-white p-1.5"
                                        dangerouslySetInnerHTML={{ __html: qr_svg }}
                                    />
                                </div>

                                {/* Campos */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Marca</p>
                                        <p className="mt-0.5 text-sm font-medium text-gray-900">{extintor.marca ?? '—'}</p>
                                        <p className="text-[10px] text-gray-400">Fabricante</p>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fecha fabricación</p>
                                        <p className="mt-0.5 text-sm font-medium text-gray-900">{extintor.fecha_fabricacion ?? '—'}</p>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fecha vencimiento / recarga</p>
                                        <p className={`mt-0.5 text-sm font-medium ${extintor.vencido ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                                            {extintor.vencido ? (
                                                <span className="flex items-center gap-1">
                                                    <AlertTriangle className="size-3.5 shrink-0" />
                                                    {extintor.fecha_vencimiento ?? '—'}
                                                </span>
                                            ) : (extintor.fecha_vencimiento ?? '—')}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vehículo actual</p>
                                        <p className="mt-0.5 text-sm font-semibold text-gray-900">
                                            {extintor.placa_actual
                                                ? <span className="font-mono">{extintor.placa_actual}</span>
                                                : <span className="text-gray-400 font-normal">En depósito</span>}
                                        </p>
                                        {extintor.fecha_asignacion && (
                                            <p className="text-[10px] text-gray-400">Desde {extintor.fecha_asignacion}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Tabla de extintores · Historial de condiciones ── */}
                    <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden p-6">
                        <div className="mb-4">
                            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <History className="size-4 text-red-600" />
                                Tabla del extintor · Historial de condiciones
                                <span className="text-sm font-normal text-gray-500">({historialExtintor.length} {historialExtintor.length === 1 ? 'registro' : 'registros'})</span>
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Registro cronológico de todas las renovaciones y checklist de condiciones del extintor
                            </p>
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50">
                                            {['Fecha', 'Foto', 'N° Serie', 'Condición', 'Agente extintor', 'Agente impulsor', 'Última recarga', 'Parte Mantenimiento', 'Señalización', 'Demarcación', 'Funcionamiento', 'Acceso al Extintor', 'Placa actual', 'Observaciones'].map(h => (
                                                <TableHead key={h} className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historialExtintor.map(row => (
                                            <TableRow key={row.id} className="hover:bg-gray-50/80 transition-colors">
                                                <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-gray-900">{row.fecha}</span>
                                                        <span className="text-[10px] text-gray-400">{row.tipo}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="w-12 py-1.5 px-3">
                                                    <div
                                                        className="size-9 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                                                        onClick={() => row.foto_url && setLightboxOpen(true)}
                                                        title={row.foto_url ? 'Ver imagen más grande' : undefined}
                                                    >
                                                        {row.foto_url ? (
                                                            <img src={row.foto_url} alt={row.numero_serie} className="w-full h-full object-contain p-0.5" />
                                                        ) : (
                                                            <FlameKindling className="size-4 text-gray-300" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono font-semibold text-gray-900 whitespace-nowrap">
                                                    {row.numero_serie}
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-600 capitalize">{row.condicion}</TableCell>
                                                <TableCell className="text-xs text-gray-600">{row.tipo_agente}</TableCell>
                                                <TableCell className="text-xs text-gray-600 capitalize">{row.agente_impulsor}</TableCell>
                                                <TableCell className="text-xs text-gray-600 whitespace-nowrap">{row.ultima_recarga}</TableCell>
                                                <TableCell className="text-xs text-gray-600 max-w-[130px] truncate" title={row.parte_mantenimiento}>{row.parte_mantenimiento}</TableCell>
                                                <TableCell className="text-xs text-gray-600 max-w-[120px] truncate" title={row.senalizacion}>{row.senalizacion}</TableCell>
                                                <TableCell className="text-xs text-gray-600">{row.demarcacion}</TableCell>
                                                <TableCell className="text-xs text-gray-600 max-w-[120px] truncate" title={row.funcionamiento}>{row.funcionamiento}</TableCell>
                                                <TableCell className="text-xs text-gray-600 max-w-[120px] truncate" title={row.acceso}>{row.acceso}</TableCell>
                                                <TableCell className="text-xs text-gray-600 whitespace-nowrap">{row.placa_actual}</TableCell>
                                                <TableCell className="text-xs text-gray-600 max-w-[150px] truncate" title={row.observaciones}>{row.observaciones}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    {/* Historial de asignaciones a vehículos */}
                    {asignaciones.length > 0 && (
                        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
                            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                <Car className="size-4" /> Historial de vehículos ({asignaciones.length})
                            </h2>
                            <div className="divide-y divide-gray-100">
                                {asignaciones.map((a, idx) => (
                                    <div key={idx} className="py-3 grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <p className="text-[10px] text-gray-400">Placa</p>
                                            <p className="font-mono font-semibold text-gray-900">{a.placa}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400">Asignado</p>
                                            <p className="text-gray-900">{a.fecha_colocacion ?? '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400">Retirado</p>
                                            <p className="text-gray-900">{a.fecha_retiro ?? (a.activo ? 'Activo' : '—')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-center text-xs text-gray-400 pb-4">
                        Sistema de Gestión ADENAR · Flota
                    </p>
                </div>
            </div>

            {/* Modal Lightbox Foto Extintor */}
            {lightboxOpen && extintor.foto_url && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setLightboxOpen(false)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <FlameKindling className="size-4 text-red-500" />
                                Extintor {extintor.numero_serie}
                            </p>
                            <button
                                type="button"
                                onClick={() => setLightboxOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="p-4 flex items-center justify-center bg-black/5 overflow-auto max-h-[calc(90vh-60px)]">
                            <img
                                src={extintor.foto_url}
                                alt={`Extintor ${extintor.numero_serie}`}
                                className="max-w-full max-h-[75vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
