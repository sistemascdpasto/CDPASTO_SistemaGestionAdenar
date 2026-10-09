import { EvidenciaUploader, type PickedFile } from '@/components/evidencia-uploader';
import { FirmaPad, type FirmaPadHandle } from '@/components/firma-pad';
import { ImageLightbox } from '@/components/image-lightbox';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Download, LoaderCircle, Plus } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

interface ColaboradorInfo {
    id: number;
    nombre_completo: string;
    cedula: string;
    centro: string | null;
    area: string | null;
    cargo: string | null;
    fecha_ingreso_empresa: string | null;
}

interface Perfil {
    talla_calzado: string | null;
    talla_camisa: string | null;
    talla_pantalon: string | null;
    talla_otros: string | null;
    compromiso_firmado_en: string | null;
    compromiso_firma_url: string | null;
}

interface Entrega {
    id: number;
    fecha_entrega: string;
    [key: string]: unknown;
    otros_cual: string | null;
    firma_url: string | null;
    foto_url: string | null;
    observaciones: string | null;
    registrado_por: string | null;
}

interface ItemEstado {
    fecha: string | null;
    estado: 'al_dia' | 'proximo' | 'vencido';
}

const ESTADO_LABEL: Record<string, string> = { al_dia: 'Al día', proximo: 'Próximo a vencer', vencido: 'Vencido' };
const ESTADO_BADGE: Record<string, string> = {
    al_dia: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    proximo: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    vencido: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

function SeccionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
            <div className="border-b border-sidebar-border/70 px-5 py-3.5 dark:border-sidebar-border">
                <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

export default function DotacionEppShow({
    colaborador,
    perfil,
    entregas,
    items_labels,
    estado_por_item,
}: {
    colaborador: ColaboradorInfo;
    perfil: Perfil | null;
    entregas: Entrega[];
    items_labels: Record<string, string>;
    estado_por_item: Record<string, ItemEstado>;
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Dotación y EPP', href: '/modules/seguridad/dotacion-epp' },
        { title: colaborador.nombre_completo, href: '#' },
    ];

    const itemKeys = Object.keys(items_labels);
    const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

    // ── Tallas ──────────────────────────────────────────────────────────────
    const tallasForm = useForm({
        talla_calzado: perfil?.talla_calzado ?? '',
        talla_camisa: perfil?.talla_camisa ?? '',
        talla_pantalon: perfil?.talla_pantalon ?? '',
        talla_otros: perfil?.talla_otros ?? '',
    });
    const guardarTallas: FormEventHandler = (e) => {
        e.preventDefault();
        tallasForm.put(route('seguridad.dotacion-epp.perfil.update', colaborador.id), { preserveScroll: true });
    };

    // ── Compromiso ──────────────────────────────────────────────────────────
    const [firmandoCompromiso, setFirmandoCompromiso] = useState(!perfil?.compromiso_firmado_en);
    const [procesandoCompromiso, setProcesandoCompromiso] = useState(false);
    const compromisoFirmaRef = useRef<FirmaPadHandle>(null);

    // Precarga la última firma que el colaborador dejó en Pruebas de
    // Alcoholemia (si tiene una), para no obligarlo a volver a firmar algo
    // que ya firmó recientemente para otro trámite. La firma de recibido de
    // cada entrega de dotación, en cambio, siempre se traza de nuevo.
    useEffect(() => {
        if (!firmandoCompromiso) return;

        fetch(route('seguridad.pruebas.ultima-firma', { colaborador: colaborador.id }))
            .then((res) => res.json())
            .then((json: { firma_url: string | null }) => {
                if (json.firma_url) {
                    compromisoFirmaRef.current?.loadFromUrl(json.firma_url);
                }
            })
            .catch(() => {
                /* ignorar errores de red: el colaborador puede firmar de cero */
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmandoCompromiso]);

    const archivoABase64 = (file: File): Promise<string> =>
        new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });

    const firmarCompromiso = async () => {
        const file = await compromisoFirmaRef.current?.getFile();
        if (!file) return;
        setProcesandoCompromiso(true);
        const firma = await archivoABase64(file);
        router.post(
            route('seguridad.dotacion-epp.compromiso.store', colaborador.id),
            { firma },
            {
                onFinish: () => {
                    setProcesandoCompromiso(false);
                    setFirmandoCompromiso(false);
                },
            },
        );
    };

    // ── Nueva entrega ───────────────────────────────────────────────────────
    const [mostrarFormEntrega, setMostrarFormEntrega] = useState(false);
    const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split('T')[0]);
    const [itemsMarcados, setItemsMarcados] = useState<Record<string, boolean>>({});
    const [otrosCual, setOtrosCual] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [fotoEntrega, setFotoEntrega] = useState<PickedFile[]>([]);
    const [procesandoEntrega, setProcesandoEntrega] = useState(false);
    const [erroresEntrega, setErroresEntrega] = useState<Record<string, string>>({});
    const entregaFirmaRef = useRef<FirmaPadHandle>(null);

    const toggleItem = (key: string) => setItemsMarcados((prev) => ({ ...prev, [key]: !prev[key] }));

    const registrarEntrega: FormEventHandler = async (e) => {
        e.preventDefault();
        setProcesandoEntrega(true);
        setErroresEntrega({});

        const fd = new FormData();
        fd.append('fecha_entrega', fechaEntrega);
        itemKeys.forEach((key) => fd.append(key, itemsMarcados[key] ? '1' : '0'));
        fd.append('otros_cual', otrosCual);
        fd.append('observaciones', observaciones);

        const firmaFile = await entregaFirmaRef.current?.getFile();
        if (firmaFile) fd.append('firma', await archivoABase64(firmaFile));
        if (fotoEntrega[0]) fd.append('foto', fotoEntrega[0].file);

        router.post(route('seguridad.dotacion-epp.entregas.store', colaborador.id), fd as unknown as Record<string, unknown>, {
            forceFormData: true,
            onError: (errs) => setErroresEntrega(errs),
            onFinish: () => setProcesandoEntrega(false),
            onSuccess: () => {
                setMostrarFormEntrega(false);
                setItemsMarcados({});
                setOtrosCual('');
                setObservaciones('');
                setFotoEntrega([]);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Dotación y EPP — ${colaborador.nombre_completo}`} />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{colaborador.nombre_completo}</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            C.C. {colaborador.cedula} · {[colaborador.centro, colaborador.area, colaborador.cargo].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('seguridad.dotacion-epp.index')}>← Volver</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a href={route('seguridad.dotacion-epp.pdf', colaborador.id)}>
                                <Download className="size-3.5" /> Descargar PDF
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Estado por ítem */}
                <SeccionCard title="Estado de dotación por ítem">
                    <div className="flex flex-wrap gap-2">
                        {itemKeys.map((key) => (
                            <span
                                key={key}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[estado_por_item[key].estado]}`}
                                title={estado_por_item[key].fecha ? `Última entrega: ${estado_por_item[key].fecha}` : 'Sin entregas registradas'}
                            >
                                {items_labels[key]} — {ESTADO_LABEL[estado_por_item[key].estado]}
                            </span>
                        ))}
                    </div>
                </SeccionCard>

                {/* Tallas */}
                <SeccionCard title="Tallas">
                    <form onSubmit={guardarTallas} className="grid gap-4 sm:grid-cols-4">
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Calzado</Label>
                            <Input
                                value={tallasForm.data.talla_calzado}
                                onChange={(e) => tallasForm.setData('talla_calzado', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Camisa</Label>
                            <Input
                                value={tallasForm.data.talla_camisa}
                                onChange={(e) => tallasForm.setData('talla_camisa', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Pantalón</Label>
                            <Input
                                value={tallasForm.data.talla_pantalon}
                                onChange={(e) => tallasForm.setData('talla_pantalon', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Otros</Label>
                            <Input
                                value={tallasForm.data.talla_otros}
                                onChange={(e) => tallasForm.setData('talla_otros', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="sm:col-span-4">
                            <Button type="submit" size="sm" disabled={tallasForm.processing} className="gap-1.5">
                                {tallasForm.processing && <LoaderCircle className="size-4 animate-spin" />}
                                Guardar tallas
                            </Button>
                        </div>
                    </form>
                </SeccionCard>

                {/* Compromiso */}
                <SeccionCard title="Compromiso del trabajador">
                    {!firmandoCompromiso && perfil?.compromiso_firmado_en ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm text-foreground">Firmado el {new Date(perfil.compromiso_firmado_en).toLocaleString('es-CO')}</p>
                                {perfil.compromiso_firma_url && (
                                    <button type="button" onClick={() => setImagenAmpliada(perfil.compromiso_firma_url)} className="mt-2">
                                        <img src={perfil.compromiso_firma_url} alt="Firma del compromiso" className="h-16 rounded-md border border-border" />
                                    </button>
                                )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setFirmandoCompromiso(true)}>
                                Firmar de nuevo
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <p className="text-xs text-muted-foreground">
                                El colaborador se compromete a usar correctamente la dotación y los elementos de protección personal asignados.
                            </p>
                            <FirmaPad
                                ref={compromisoFirmaRef}
                                label="Firma del compromiso (se precarga la última registrada en Pruebas de Alcoholemia)"
                                fileName="compromiso.png"
                            />
                            <div>
                                <Button type="button" size="sm" onClick={firmarCompromiso} disabled={procesandoCompromiso} className="gap-1.5">
                                    {procesandoCompromiso && <LoaderCircle className="size-4 animate-spin" />}
                                    Guardar firma
                                </Button>
                            </div>
                        </div>
                    )}
                </SeccionCard>

                {/* Entregas */}
                <SeccionCard title={`Entregas registradas (${entregas.length})`}>
                    <div className="grid gap-4">
                        {!mostrarFormEntrega && (
                            <Button type="button" size="sm" variant="outline" onClick={() => setMostrarFormEntrega(true)} className="w-fit gap-1.5 border-dashed">
                                <Plus className="size-4" /> Registrar entrega
                            </Button>
                        )}

                        {mostrarFormEntrega && (
                            <form onSubmit={registrarEntrega} className="grid gap-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <div className="grid gap-1.5 sm:w-52">
                                    <Label className="text-xs">Fecha de entrega</Label>
                                    <Input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="h-9 text-sm" />
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs font-semibold text-muted-foreground">Elementos entregados</Label>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {itemKeys.map((key) => (
                                            <label key={key} className="flex items-center gap-2 text-sm">
                                                <Checkbox checked={!!itemsMarcados[key]} onCheckedChange={() => toggleItem(key)} />
                                                {items_labels[key]}
                                            </label>
                                        ))}
                                    </div>
                                    {itemsMarcados['otros'] && (
                                        <Input
                                            value={otrosCual}
                                            onChange={(e) => setOtrosCual(e.target.value)}
                                            placeholder="¿Cuál otro elemento?"
                                            className="h-9 max-w-sm text-sm"
                                        />
                                    )}
                                </div>

                                <FirmaPad ref={entregaFirmaRef} label="Firma de recibido" fileName="entrega.png" />
                                {erroresEntrega.firma && <p className="text-xs text-red-500">{erroresEntrega.firma}</p>}

                                <EvidenciaUploader files={fotoEntrega} onChange={setFotoEntrega} label="Foto de recibido" error={erroresEntrega.foto} />

                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Observaciones</Label>
                                    <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="text-sm" />
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" size="sm" disabled={procesandoEntrega} className="gap-1.5 bg-green-700 hover:bg-green-800 text-white">
                                        {procesandoEntrega && <LoaderCircle className="size-4 animate-spin" />}
                                        Guardar entrega
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setMostrarFormEntrega(false)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </form>
                        )}

                        {entregas.length > 0 && (
                            <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            {itemKeys.map((key) => (
                                                <TableHead key={key} className="text-center text-[10px]">
                                                    {items_labels[key]}
                                                </TableHead>
                                            ))}
                                            <TableHead>Firma</TableHead>
                                            <TableHead>Foto</TableHead>
                                            <TableHead>Registrado por</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {entregas.map((entrega) => (
                                            <TableRow key={entrega.id}>
                                                <TableCell>{entrega.fecha_entrega}</TableCell>
                                                {itemKeys.map((key) => (
                                                    <TableCell key={key} className="text-center">
                                                        {entrega[key] ? (
                                                            <span className="text-green-600">✓</span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40">—</span>
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell>
                                                    {entrega.firma_url ? (
                                                        <button type="button" onClick={() => setImagenAmpliada(entrega.firma_url)}>
                                                            <img src={entrega.firma_url} alt="Firma" className="h-8 w-14 rounded object-contain" />
                                                        </button>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {entrega.foto_url ? (
                                                        <button type="button" onClick={() => setImagenAmpliada(entrega.foto_url)}>
                                                            <img src={entrega.foto_url} alt="Foto de recibido" className="h-8 w-8 rounded object-cover" />
                                                        </button>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{entrega.registrado_por ?? '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </SeccionCard>
            </div>
            <ImageLightbox src={imagenAmpliada} onClose={() => setImagenAmpliada(null)} />
        </AppLayout>
    );
}
