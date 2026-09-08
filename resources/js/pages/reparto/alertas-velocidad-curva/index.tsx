import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    Calendar,
    Download,
    FileSpreadsheet,
    Upload,
    AlertTriangle,
    Gauge,
    MapPin,
    Edit2,
    Trash2,
    Plus,
    X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Alertas de Velocidad en Curva', href: '/modules/reparto/alertas-velocidad-curva' },
];

interface Alerta {
    id: number;
    fecha: string | null;
    hora: string | null;
    regional: string | null;
    cd: string | null;
    nombre: string | null;
    alerta: string | null;
    velocidad: number | null;
    coordenada: string | null;
    cantidad_eventos: number | null;
    mes: number | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Paginator {
    data: Alerta[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface Props {
    alertas: Paginator;
    placas: string[];
    filters: { fecha_desde: string; fecha_hasta: string; placa: string };
}

export default function AlertasVelocidadCurvaIndex({ alertas, placas, filters }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Filtros
    const [fechaDesde, setFechaDesde]   = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta]   = useState(filters.fecha_hasta ?? '');
    const [placa, setPlaca]             = useState(filters.placa ?? '');
    const [placaInput, setPlacaInput]   = useState(filters.placa ?? '');
    const [showPlacaList, setShowPlacaList] = useState(false);

    // Modal
    const [showModal, setShowModal]   = useState(false);
    const [isEditing, setIsEditing]   = useState(false);
    const [editingId, setEditingId]   = useState<number | null>(null);
    const [formData, setFormData]     = useState<Partial<Alerta>>({
        fecha: '', nombre: '', alerta: '', velocidad: null,
        coordenada: '', cantidad_eventos: null,
    });

    // Placas filtradas para el combobox
    const placasFiltradas = placaInput
        ? placas.filter((p) => p.toLowerCase().includes(placaInput.toLowerCase()))
        : placas;

    // Buscar al cambiar filtros (debounced para placa)
    const applyFilters = (overrides: Record<string, string> = {}) => {
        router.get(
            route('reparto.alertas-velocidad-curva.index'),
            { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, placa, ...overrides },
            { preserveState: true, preserveScroll: true },
        );
    };

    const selectPlaca = (p: string) => {
        setPlaca(p);
        setPlacaInput(p);
        setShowPlacaList(false);
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
        router.post(route('reparto.alertas-velocidad-curva.store'), fd as any, {
            onSuccess: () => { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; },
            onError:   () => setIsUploading(false),
        });
    };

    const openNewModal = () => {
        setFormData({ fecha: '', nombre: '', alerta: '', velocidad: null, coordenada: '', cantidad_eventos: null });
        setIsEditing(false); setEditingId(null); setShowModal(true);
    };

    const openEditModal = (a: Alerta) => {
        setFormData(a); setIsEditing(true); setEditingId(a.id); setShowModal(true);
    };

    const handleFormChange = (key: keyof Alerta, value: any) =>
        setFormData((prev) => ({ ...prev, [key]: value }));

    const handleSaveAlerta = () => {
        if (!formData.fecha) { alert('Por favor, ingresa una fecha'); return; }
        const payload = {
            fecha: formData.fecha, nombre: formData.nombre || null,
            alerta: formData.alerta || null, velocidad: formData.velocidad || null,
            coordenada: formData.coordenada || null, cantidad_eventos: formData.cantidad_eventos || null,
        };
        if (isEditing && editingId) {
            router.put(route('reparto.alertas-velocidad-curva.update', editingId), payload, {
                preserveScroll: true, onSuccess: () => setShowModal(false),
            });
        } else {
            router.post(route('reparto.alertas-velocidad-curva.storeManual'), payload, {
                preserveScroll: true, onSuccess: () => setShowModal(false),
            });
        }
    };

    const handleDeleteAlerta = (id: number) => {
        if (confirm('¿Estás seguro de que deseas eliminar esta alerta?')) {
            router.delete(route('reparto.alertas-velocidad-curva.delete', id), { preserveScroll: true });
        }
    };

    const formatFecha = (fecha: string | null) => {
        if (!fecha) return '—';
        const [y, m, d] = fecha.split('-');
        return `${d}/${m}/${y}`;
    };

    const hayFiltros = fechaDesde || fechaHasta || placa;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas de Velocidad en Curva" />

            <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
                {/* Encabezado */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <AlertTriangle className="h-7 w-7 text-orange-600" />
                            Alertas de Velocidad en Curva
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {alertas.total} alerta{alertas.total !== 1 ? 's' : ''} registrada{alertas.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <a href={route('reparto.alertas-velocidad-curva.template')}>
                            <Button variant="outline" className="text-green-600 border-green-300 hover:bg-green-50">
                                <Download className="h-4 w-4 mr-2" />
                                Descargar Plantilla
                            </Button>
                        </a>
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploading ? 'Cargando...' : 'Subir Excel'}
                        </Button>
                        <Button onClick={openNewModal} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Manual
                        </Button>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                    </div>
                </div>

                {/* Filtros */}
                <Card className="shadow-sm border bg-card">
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">

                                {/* Placa — combobox con búsqueda inmediata */}
                                <div className="relative">
                                    <Label className="text-xs font-semibold text-muted-foreground">Placa</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            type="text"
                                            placeholder="Buscar placa..."
                                            value={placaInput}
                                            onChange={(e) => {
                                                setPlacaInput(e.target.value);
                                                setPlaca('');
                                                setShowPlacaList(true);
                                            }}
                                            onFocus={() => setShowPlacaList(true)}
                                            className="pr-7 font-mono uppercase"
                                            autoComplete="off"
                                        />
                                        {placaInput && (
                                            <button
                                                type="button"
                                                onClick={clearPlaca}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {showPlacaList && placasFiltradas.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                                            {placasFiltradas.map((p) => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onMouseDown={() => selectPlaca(p)}
                                                    className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-orange-50 dark:hover:bg-muted"
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showPlacaList && (
                                        <div className="fixed inset-0 z-40" onClick={() => setShowPlacaList(false)} />
                                    )}
                                </div>

                                {/* Fecha desde */}
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        <Calendar className="h-3 w-3 inline mr-1" />
                                        Desde
                                    </Label>
                                    <Input
                                        type="date"
                                        value={fechaDesde}
                                        onChange={(e) => {
                                            setFechaDesde(e.target.value);
                                            applyFilters({ fecha_desde: e.target.value });
                                        }}
                                        className="mt-1"
                                    />
                                </div>

                                {/* Fecha hasta */}
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        <Calendar className="h-3 w-3 inline mr-1" />
                                        Hasta
                                    </Label>
                                    <Input
                                        type="date"
                                        value={fechaHasta}
                                        onChange={(e) => {
                                            setFechaHasta(e.target.value);
                                            applyFilters({ fecha_hasta: e.target.value });
                                        }}
                                        className="mt-1"
                                    />
                                </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabla */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            Registros de alertas
                            {alertas.from !== null && (
                                <Badge variant="secondary" className="ml-2">
                                    {alertas.from}–{alertas.to} de {alertas.total}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="font-semibold">Fecha</TableHead>
                                        <TableHead className="font-semibold">Hora</TableHead>
                                        <TableHead className="font-semibold">Regional</TableHead>
                                        <TableHead className="font-semibold">CD</TableHead>
                                        <TableHead className="font-semibold">Placa</TableHead>
                                        <TableHead className="font-semibold">Alerta</TableHead>
                                        <TableHead className="text-right font-semibold w-24">Velocidad</TableHead>
                                        <TableHead className="font-semibold">Coordenada</TableHead>
                                        <TableHead className="text-center font-semibold w-24">Eventos</TableHead>
                                        <TableHead className="text-center font-semibold w-32">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {alertas.data.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                                                    <span>
                                                        {hayFiltros
                                                            ? 'No se encontraron alertas con ese criterio.'
                                                            : 'No hay alertas registradas aún. Sube un archivo Excel para comenzar.'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        alertas.data.map((alerta) => (
                                            <TableRow key={alerta.id} className="hover:bg-muted/60/80 dark:hover:bg-muted/40">
                                                <TableCell className="text-sm font-medium text-foreground">
                                                    {formatFecha(alerta.fecha)}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground font-mono">
                                                    {alerta.hora || '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">
                                                    {alerta.regional || '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">
                                                    {alerta.cd || '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground font-mono font-semibold">
                                                    {alerta.nombre || '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">
                                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                        {alerta.alerta || '—'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-semibold text-foreground">
                                                    {alerta.velocidad ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Gauge className="h-3.5 w-3.5 text-red-500" />
                                                            {alerta.velocidad} km/h
                                                        </div>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">
                                                    {alerta.coordenada ? (
                                                        <div className="flex items-center gap-1">
                                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="font-mono text-xs">{alerta.coordenada}</span>
                                                        </div>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {alerta.cantidad_eventos != null ? (
                                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                            {alerta.cantidad_eventos}
                                                        </Badge>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-center space-x-1">
                                                    <Button
                                                        size="sm" variant="outline"
                                                        onClick={() => openEditModal(alerta)}
                                                        className="h-7 px-2 text-xs text-muted-foreground hover:text-muted-foreground border-sidebar-border/70 hover:bg-muted/50"
                                                    >
                                                        <Edit2 className="h-3 w-3 mr-1" />Editar
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="ghost"
                                                        onClick={() => handleDeleteAlerta(alerta.id)}
                                                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-3 w-3 mr-1" />Eliminar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {alertas.last_page > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t mt-4">
                                <p className="text-sm text-muted-foreground">
                                    Página {alertas.current_page} de {alertas.last_page}
                                </p>
                                <div className="flex gap-1 flex-wrap">
                                    {alertas.links.map((link, i) => (
                                        <Button
                                            key={i}
                                            size="sm"
                                            variant={link.active ? 'default' : 'outline'}
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                            className={`h-8 min-w-[2rem] px-2 text-xs ${link.active ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modal crear/editar */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {isEditing
                                ? <><Edit2 className="h-5 w-5 text-muted-foreground" />Editar Alerta</>
                                : <><Plus className="h-5 w-5 text-green-600" />Crear Nueva Alerta</>}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="m-fecha" className="text-sm font-semibold">Fecha *</Label>
                            <Input id="m-fecha" type="date" value={formData.fecha || ''}
                                onChange={(e) => handleFormChange('fecha', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label htmlFor="m-nombre" className="text-sm font-semibold">Placa</Label>
                            <Input id="m-nombre" type="text" placeholder="Ej: COLJV386"
                                value={formData.nombre || ''}
                                onChange={(e) => handleFormChange('nombre', e.target.value)}
                                className="mt-1 uppercase font-mono" />
                        </div>
                        <div>
                            <Label htmlFor="m-alerta" className="text-sm font-semibold">Alerta</Label>
                            <Input id="m-alerta" type="text" placeholder="Tipo de alerta"
                                value={formData.alerta || ''}
                                onChange={(e) => handleFormChange('alerta', e.target.value)} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="m-velocidad" className="text-sm font-semibold">Velocidad (km/h)</Label>
                                <Input id="m-velocidad" type="number" placeholder="0"
                                    value={formData.velocidad ?? ''}
                                    onChange={(e) => handleFormChange('velocidad', e.target.value ? parseFloat(e.target.value) : null)}
                                    className="mt-1" />
                            </div>
                            <div>
                                <Label htmlFor="m-cantidad" className="text-sm font-semibold">Cantidad de Eventos</Label>
                                <Input id="m-cantidad" type="number" placeholder="0"
                                    value={formData.cantidad_eventos ?? ''}
                                    onChange={(e) => handleFormChange('cantidad_eventos', e.target.value ? parseInt(e.target.value, 10) : null)}
                                    className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="m-coordenada" className="text-sm font-semibold">Coordenada</Label>
                            <Input id="m-coordenada" type="text" placeholder="Ej: 1.0632, -77.4201"
                                value={formData.coordenada || ''}
                                onChange={(e) => handleFormChange('coordenada', e.target.value)} className="mt-1" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="button" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSaveAlerta}>
                            {isEditing ? 'Actualizar' : 'Crear'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
