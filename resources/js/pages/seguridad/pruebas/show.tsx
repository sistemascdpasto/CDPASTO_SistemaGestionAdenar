import HeadingSmall from '@/components/heading-small';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { FileText, MapPin, X, ZoomIn } from 'lucide-react';
import { useState } from 'react';

interface PruebaDetalle {
    id: number;
    tipo: string;
    resultado: string | null;
    es_positivo: boolean;
    estado: string;
    evaluacion: string;
    consentimiento_aceptado: boolean;
    consentimiento_en: string | null;
    evidencia_path: string | null;
    firma_path: string | null;
    observaciones: string | null;
    fecha_hora: string;
    colaborador: { nombres: string; apellidos: string; cedula: string } | null;
    alcoholimetro: { codigo: string } | null;
    responsable: { name: string } | null;
    evidencias: { id: number; path: string }[];
}

const EVALUACION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Apto: 'default',
    'Apto con Observaciones': 'secondary',
    'No Apto': 'destructive',
};

const TIPO_LABELS: Record<string, string> = {
    pre_ruta: 'Pre Ruta',
    ruta: 'Ruta',
    post_ruta: 'Post Ruta',
    jl: 'JL',
    segundo_viaje: 'Segundo viaje',
    movilizador: 'Movilizador',
    administrativo: 'Administrativo',
};

/** Overlay negro semitransparente con fecha, hora, ubicación y número de verificación */
function FotoConOverlay({
    src,
    numero,
    fechaHora,
    ubicacion,
    onClick,
}: {
    src: string;
    numero: number;
    fechaHora: Date;
    ubicacion: string;
    onClick: () => void;
}) {
    const fecha = fechaHora.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const hora = fechaHora.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative h-44 w-44 shrink-0 overflow-hidden rounded-xl border border-sidebar-border/70 shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-sidebar-border"
            title="Haz clic para ampliar"
        >
            {/* Imagen base */}
            <SafeImage
                src={src}
                alt={`Evidencia ${numero}`}
                className="h-full w-full object-cover"
            />

            {/* Overlay de datos — parte inferior derecha */}
            <div className="absolute bottom-2 right-2 flex flex-col items-end gap-0.5 text-right pointer-events-none">
                {/* Número de verificación */}
                <span className="font-mono text-[11px] font-bold leading-none text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]">
                    VERIFICACIÓN #{String(numero).padStart(4, '0')}
                </span>

                {/* Fecha y hora */}
                <p className="font-mono text-[10px] font-semibold leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]">
                    {fecha} &nbsp;{hora}
                </p>

                {/* Ubicación */}
                <p className="flex items-center gap-1 text-[9px] leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]">
                    <MapPin className="size-2.5 shrink-0" />
                    {ubicacion}
                </p>
            </div>

            {/* Ícono de zoom al hacer hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                <ZoomIn className="size-7 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
            </div>
        </button>
    );
}

export default function PruebaShow({
    prueba,
    qrSvg,
    ubicacion = 'Pasto, Nariño · Colombia',
}: {
    prueba: PruebaDetalle;
    qrSvg: string | null;
    ubicacion?: string;
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Pruebas de Alcoholemia', href: '/modules/seguridad/pruebas' },
        { title: `Prueba #${prueba.id}`, href: `/modules/seguridad/pruebas/${prueba.id}` },
    ];

    const fotos: { src: string; numero: number }[] = [];

    prueba.evidencias
        .filter((e) => !/\.pdf$/i.test(e.path))
        .forEach((e) => {
            const path = e.path.startsWith('/storage/') ? e.path : `/storage/${e.path}`;
            fotos.push({ src: path, numero: e.id });
        });

    if (
        prueba.evidencia_path &&
        !/\.pdf$/i.test(prueba.evidencia_path) &&
        !fotos.some((f) => f.src.endsWith(prueba.evidencia_path!))
    ) {
        const path = prueba.evidencia_path.startsWith('/storage/')
            ? prueba.evidencia_path
            : `/storage/${prueba.evidencia_path}`;
        fotos.unshift({ src: path, numero: prueba.id });
    }

    const pdfs = [
        prueba.evidencia_path,
        ...prueba.evidencias.map((e) => e.path),
    ].filter((p): p is string => Boolean(p) && /\.pdf$/i.test(p));

    const fechaHora = new Date(prueba.fecha_hora);

    const [fotoAmpliada, setFotoAmpliada] = useState<{ src: string; numero: number } | null>(null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Prueba #${prueba.id}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3">
                    <HeadingSmall
                        title={
                            prueba.colaborador
                                ? `${prueba.colaborador.nombres} ${prueba.colaborador.apellidos}`
                                : `Prueba #${prueba.id}`
                        }
                        description={`${fechaHora.toLocaleString('es-CO')} · ${TIPO_LABELS[prueba.tipo] ?? prueba.tipo}`}
                    />
                    {prueba.estado === 'programada' ? (
                        <Badge variant="secondary">Programada</Badge>
                    ) : (
                        <Badge variant={EVALUACION_VARIANT[prueba.evaluacion] ?? 'default'}>
                            {prueba.evaluacion}
                        </Badge>
                    )}
                </div>

                {/* Datos de la prueba + QR */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="border-sidebar-border/70 lg:col-span-2 dark:border-sidebar-border">
                        <CardContent className="grid gap-3 p-6 text-sm sm:grid-cols-2">
                            <p>Cédula: {prueba.colaborador?.cedula ?? '—'}</p>
                            <p>Dispositivo: {prueba.alcoholimetro?.codigo ?? '—'}</p>
                            <p>Resultado: {prueba.resultado ?? '—'}</p>
                            <p>Responsable: {prueba.responsable?.name ?? '—'}</p>
                            <p>
                                Consentimiento informado:{' '}
                                {prueba.consentimiento_aceptado ? 'Aceptado' : 'No registrado'}
                                {prueba.consentimiento_en
                                    ? ` (${new Date(prueba.consentimiento_en).toLocaleString('es-CO')})`
                                    : ''}
                            </p>
                            {prueba.observaciones && (
                                <p className="sm:col-span-2">Observaciones: {prueba.observaciones}</p>
                            )}
                        </CardContent>
                    </Card>

                    {qrSvg && (
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                                <div
                                    className="rounded-lg bg-white p-2"
                                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Escanea para verificar la autenticidad de este registro sin necesidad de iniciar
                                    sesión.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Firma */}
                {prueba.firma_path && (
                    <div className="max-w-xs">
                        <h2 className="mb-2 text-lg font-medium tracking-tight">Firma del colaborador</h2>
                        <SafeImage
                            src={`/storage/${prueba.firma_path}`}
                            alt="Firma del colaborador"
                            className="rounded-lg border border-sidebar-border/70 bg-white dark:border-sidebar-border"
                        />
                    </div>
                )}

                {/* Fotografías con overlay */}
                {fotos.length > 0 && (
                    <div>
                        <h2 className="mb-3 text-lg font-medium tracking-tight">
                            Evidencias fotográficas
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({fotos.length} foto{fotos.length !== 1 ? 's' : ''})
                            </span>
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {fotos.map((foto) => (
                                <FotoConOverlay
                                    key={foto.src}
                                    src={foto.src}
                                    numero={foto.numero}
                                    fechaHora={fechaHora}
                                    ubicacion={ubicacion}
                                    onClick={() => setFotoAmpliada({ src: foto.src, numero: foto.numero })}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* PDFs adicionales */}
                {pdfs.length > 0 && (
                    <div>
                        <h2 className="mb-2 text-lg font-medium tracking-tight">Evidencia adicional (PDF)</h2>
                        <div className="flex flex-wrap gap-2">
                            {pdfs.map((path) => (
                                <a
                                    key={path}
                                    href={`/storage/${path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-card px-3 py-2 text-sm text-foreground hover:underline dark:border-sidebar-border"
                                >
                                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="max-w-[220px] truncate">{path.split('/').pop()}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Lightbox ampliado — también con overlay */}
            {fotoAmpliada && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
                    onClick={() => setFotoAmpliada(null)}
                >
                    <div
                        className="relative inline-block max-h-full max-w-3xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Botón cerrar */}
                        <button
                            type="button"
                            onClick={() => setFotoAmpliada(null)}
                            aria-label="Cerrar vista ampliada"
                            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-colors hover:bg-black/80"
                        >
                            <X className="size-5" />
                        </button>

                        {/* Imagen */}
                        <img
                            src={fotoAmpliada.src}
                            alt="Vista ampliada"
                            className="block max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl"
                        />

            {/* Marca de agua — esquina inferior derecha, dentro de la foto */}
                        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-0.5 text-right">
                            <span className="font-mono text-sm font-bold leading-none text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]">
                                VERIFICACIÓN #{String(fotoAmpliada.numero).padStart(4, '0')}
                            </span>
                            <span className="font-mono text-[13px] leading-snug text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]">
                                {fechaHora.toLocaleDateString('es-CO', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                })}{' '}
                                {fechaHora.toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false,
                                })}
                            </span>
                            <span className="flex items-center gap-1 text-[12px] leading-snug text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]">
                                <MapPin className="size-3 shrink-0" />
                                {ubicacion}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
