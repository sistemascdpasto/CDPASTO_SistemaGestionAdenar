import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, StopCircle, X } from 'lucide-react';
import { useState } from 'react';

function formatHora(h: string | null) {
    if (!h) return '—';
    const [hh, mm] = h.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
    { title: 'Finalizar Medición', href: '' },
];

interface Vehiculo {
    id: number;
    placa: string;
    modelo: string | null;
}

interface Colaborador {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
}

interface Registro {
    id: number;
    fecha_medicion: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    tipo_inventario: string | null;
    vehiculo_id: number | null;
    colaborador_id: number | null;
}

interface Props {
    registro: Registro;
    vehiculos: Vehiculo[];
    colaboradores: Colaborador[];
    esColaborador?: boolean;
}

export default function MedicionTiemposInventarioEdit({ registro, vehiculos, colaboradores, esColaborador = false }: Props) {

    // ── Formulario finalizar ───────────────────────────────────────────────────
    const { put: finalizar, processing: finalizando } = useForm({ accion: 'finalizar' });

    // ── Formulario edición básica ──────────────────────────────────────────────
    const vehiculoInicial = vehiculos.find((v) => v.id === registro.vehiculo_id);
    const colaboradorInicial = colaboradores.find((c) => c.id === registro.colaborador_id);

    const { data, setData, put, processing, errors } = useForm({
        fecha_medicion: registro.fecha_medicion || '',
        vehiculo_id: registro.vehiculo_id?.toString() || '',
        colaborador_id: registro.colaborador_id?.toString() || '',
        hora_inicio: registro.hora_inicio || '',
        hora_fin: registro.hora_fin || '',
    });

    // ── Combobox Vehículo ──────────────────────────────────────────────────────
    const [vehiculoInput, setVehiculoInput] = useState(
        vehiculoInicial
            ? (vehiculoInicial.modelo ? `${vehiculoInicial.placa} — ${vehiculoInicial.modelo}` : vehiculoInicial.placa)
            : '',
    );
    const [showVehiculoList, setShowVehiculoList] = useState(false);
    const vehiculosFiltrados = vehiculoInput && !data.vehiculo_id
        ? vehiculos.filter(
              (v) =>
                  v.placa.toLowerCase().includes(vehiculoInput.toLowerCase()) ||
                  (v.modelo ?? '').toLowerCase().includes(vehiculoInput.toLowerCase()),
          )
        : vehiculos;

    const selectVehiculo = (v: Vehiculo) => {
        setData('vehiculo_id', v.id.toString());
        setVehiculoInput(v.modelo ? `${v.placa} — ${v.modelo}` : v.placa);
        setShowVehiculoList(false);
    };
    const clearVehiculo = () => {
        setData('vehiculo_id', '');
        setVehiculoInput('');
    };

    // ── Combobox Colaborador ───────────────────────────────────────────────────
    const [colaboradorInput, setColaboradorInput] = useState(
        colaboradorInicial
            ? `${colaboradorInicial.nombres} ${colaboradorInicial.apellidos} — ${colaboradorInicial.cedula}`
            : '',
    );
    const [showColaboradorList, setShowColaboradorList] = useState(false);
    const colaboradoresFiltrados = colaboradorInput && !data.colaborador_id
        ? colaboradores.filter(
              (c) =>
                  c.nombres.toLowerCase().includes(colaboradorInput.toLowerCase()) ||
                  c.apellidos.toLowerCase().includes(colaboradorInput.toLowerCase()) ||
                  c.cedula.includes(colaboradorInput),
          )
        : colaboradores;

    const selectColaborador = (c: Colaborador) => {
        setData('colaborador_id', c.id.toString());
        setColaboradorInput(`${c.nombres} ${c.apellidos} — ${c.cedula}`);
        setShowColaboradorList(false);
    };
    const clearColaborador = () => {
        setData('colaborador_id', '');
        setColaboradorInput('');
    };

    const yaFinalizado = !!registro.hora_fin;

    const handleFinalizar = (e: React.FormEvent) => {
        e.preventDefault();
        finalizar(route('reparto.medicion-tiempos-inventario.update', registro.id));
    };

    const handleGuardar = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('reparto.medicion-tiempos-inventario.update', registro.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Medición #${registro.id} — Finalizar`} />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <HeadingSmall>Medición #{registro.id}</HeadingSmall>
                    {!esColaborador && (
                        <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                            <Button variant="outline">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                        </Link>
                    )}
                </div>

                {/* ── Tarjeta de tiempos ── */}
                <div className="rounded-lg border bg-card p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Tiempos registrados</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-md border bg-muted/40 px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1">Hora de inicio</p>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                {formatHora(registro.hora_inicio)}
                            </p>
                        </div>
                        <div className="rounded-md border bg-muted/40 px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1">Hora de finalización</p>
                            <p className={`text-xl font-bold ${yaFinalizado ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                                {yaFinalizado ? formatHora(registro.hora_fin) : 'Pendiente'}
                            </p>
                        </div>
                        <div className="rounded-md border bg-muted/40 px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1">Estado</p>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                yaFinalizado
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            }`}>
                                {yaFinalizado ? 'Finalizado' : 'En curso'}
                            </span>
                        </div>
                    </div>

                    {!yaFinalizado && (
                        <form onSubmit={handleFinalizar} className="pt-2">
                            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-300 mb-4">
                                Al pulsar <strong>Finalizar Inventario</strong> se registrará la hora exacta de finalización y se calculará la duración automáticamente.
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={finalizando}
                                    className="bg-rose-600 hover:bg-rose-700 text-white"
                                >
                                    <StopCircle className="mr-2 h-4 w-4" />
                                    {finalizando ? 'Finalizando...' : 'Finalizar Inventario'}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>

                {/* ── Editar datos básicos — solo Admin y Reparto ── */}
                {!esColaborador && (
                    <div className="rounded-lg border bg-card p-6">
                        <h3 className="text-lg font-semibold mb-4">Datos de la medición</h3>
                        <form onSubmit={handleGuardar} className="space-y-6">

                            {/* Fecha */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="fecha_medicion">Fecha de Medición *</Label>
                                    <Input
                                        id="fecha_medicion"
                                        type="date"
                                        value={data.fecha_medicion}
                                        onChange={(e) => setData('fecha_medicion', e.target.value)}
                                        error={errors.fecha_medicion}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Horas */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="hora_inicio">Hora de inicio</Label>
                                    <Input
                                        id="hora_inicio"
                                        type="time"
                                        value={data.hora_inicio}
                                        onChange={(e) => setData('hora_inicio', e.target.value)}
                                        error={errors.hora_inicio}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="hora_fin">Hora de finalización</Label>
                                    <Input
                                        id="hora_fin"
                                        type="time"
                                        value={data.hora_fin}
                                        onChange={(e) => setData('hora_fin', e.target.value)}
                                        error={errors.hora_fin}
                                    />
                                </div>
                            </div>

                            {/* Vehículo — combobox */}
                            <div className="space-y-2">
                                <Label>Placa / Modelo <span className="text-destructive">*</span></Label>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Buscar por placa o modelo..."
                                        value={vehiculoInput}
                                        onChange={(e) => {
                                            setVehiculoInput(e.target.value);
                                            setData('vehiculo_id', '');
                                            setShowVehiculoList(true);
                                        }}
                                        onFocus={() => setShowVehiculoList(true)}
                                        autoComplete="off"
                                        required
                                        className="pr-7 font-mono uppercase"
                                    />
                                    {vehiculoInput && (
                                        <button
                                            type="button"
                                            onClick={clearVehiculo}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    {showVehiculoList && vehiculosFiltrados.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                                            {vehiculosFiltrados.map((v) => (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    onMouseDown={() => selectVehiculo(v)}
                                                    className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted"
                                                >
                                                    <span className="font-semibold">{v.placa}</span>
                                                    {v.modelo && <span className="ml-2 text-muted-foreground">{v.modelo}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showVehiculoList && (
                                        <div className="fixed inset-0 z-40" onClick={() => setShowVehiculoList(false)} />
                                    )}
                                </div>
                                {errors.vehiculo_id && <p className="text-xs text-destructive">{errors.vehiculo_id}</p>}
                            </div>

                            {/* Colaborador — combobox */}
                            <div className="space-y-2">
                                <Label>Nombre / Cédula <span className="text-destructive">*</span></Label>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Buscar por nombre o cédula..."
                                        value={colaboradorInput}
                                        onChange={(e) => {
                                            setColaboradorInput(e.target.value);
                                            setData('colaborador_id', '');
                                            setShowColaboradorList(true);
                                        }}
                                        onFocus={() => setShowColaboradorList(true)}
                                        autoComplete="off"
                                        required
                                    />
                                    {colaboradorInput && (
                                        <button
                                            type="button"
                                            onClick={clearColaborador}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    {showColaboradorList && colaboradoresFiltrados.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                                            {colaboradoresFiltrados.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onMouseDown={() => selectColaborador(c)}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                                >
                                                    <span className="font-semibold">{c.nombres} {c.apellidos}</span>
                                                    <span className="ml-2 text-xs text-muted-foreground font-mono">{c.cedula}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showColaboradorList && (
                                        <div className="fixed inset-0 z-40" onClick={() => setShowColaboradorList(false)} />
                                    )}
                                </div>
                                {errors.colaborador_id && <p className="text-xs text-destructive">{errors.colaborador_id}</p>}
                            </div>

                            <div className="flex justify-end gap-4 pt-4 border-t">
                                <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                                    <Button variant="outline" type="button">Cancelar</Button>
                                </Link>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Guardando...' : 'Guardar cambios'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
