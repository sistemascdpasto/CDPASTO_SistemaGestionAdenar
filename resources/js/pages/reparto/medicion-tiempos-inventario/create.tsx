import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, PlayCircle, X } from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Nueva Medición de Tiempo en Inventario', href: '' },
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

interface Props {
    vehiculos: Vehiculo[];
    colaboradores: Colaborador[];
    esColaborador?: boolean;
}

export default function MedicionTiemposInventarioCreate({ vehiculos, colaboradores, esColaborador = false }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        fecha_medicion: new Date().toISOString().split('T')[0],
        vehiculo_id: '',
        colaborador_id: '',
    });

    // ── Combobox Vehículo ──────────────────────────────────────────────────────
    const [vehiculoInput, setVehiculoInput] = useState('');
    const [showVehiculoList, setShowVehiculoList] = useState(false);
    const vehiculosFiltrados = vehiculoInput
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
    const [colaboradorInput, setColaboradorInput] = useState('');
    const [showColaboradorList, setShowColaboradorList] = useState(false);
    const colaboradoresFiltrados = colaboradorInput
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('reparto.medicion-tiempos-inventario.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nueva Medición de Tiempo en Inventario" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <HeadingSmall>Nueva Medición de Tiempo en Inventario</HeadingSmall>
                    {!esColaborador && (
                        <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                            <Button variant="outline">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                        </Link>
                    )}
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* fecha_medicion oculta — se actualiza al momento de finalizar */}
                        <input type="hidden" name="fecha_medicion" value={data.fecha_medicion} />

                        {/* Vehículo — combobox con búsqueda */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Vehículo</h3>
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
                            </div>
                        </div>

                        {/* Colaborador — combobox con búsqueda */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Colaborador</h3>
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
                            </div>
                        </div>

                        {/* Aviso hora automática */}
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Al pulsar <strong>Iniciar Inventario</strong> se registrará la hora exacta de inicio automáticamente.
                        </div>

                        {/* Botones */}
                        <div className="flex justify-end gap-4 pt-4 border-t">
                            {!esColaborador && (
                                <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                                    <Button variant="outline" type="button">Cancelar</Button>
                                </Link>
                            )}
                            <Button
                                type="submit"
                                disabled={processing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <PlayCircle className="mr-2 h-4 w-4" />
                                {processing ? 'Iniciando...' : 'Iniciar Inventario'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
