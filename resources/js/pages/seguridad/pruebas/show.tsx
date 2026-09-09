import HeadingSmall from '@/components/heading-small';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { FileText } from 'lucide-react';

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

const TIPO_LABELS: Record<string, string> = { pre_ruta: 'Pre Ruta', ruta: 'Ruta', post_ruta: 'Post Ruta', jl: 'JL', segundo_viaje: 'Segundo viaje' };

export default function PruebaShow({ prueba, qrSvg }: { prueba: PruebaDetalle; qrSvg: string | null }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Pruebas de Alcoholemia', href: '/modules/seguridad/pruebas' },
        { title: `Prueba #${prueba.id}`, href: `/modules/seguridad/pruebas/${prueba.id}` },
    ];

    // La evidencia principal siempre es imagen y las adicionales siempre PDF
    // (así lo exige la validación), así que el tipo de archivo es más
    // confiable que la posición para separarlas al mostrarlas.
    const evidenciaPaths = [prueba.evidencia_path, ...prueba.evidencias.map((e) => e.path)].filter((p): p is string => Boolean(p));
    const fotos = evidenciaPaths.filter((p) => !/\.pdf$/i.test(p));
    const pdfs = evidenciaPaths.filter((p) => /\.pdf$/i.test(p));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Prueba #${prueba.id}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <HeadingSmall
                        title={prueba.colaborador ? `${prueba.colaborador.nombres} ${prueba.colaborador.apellidos}` : `Prueba #${prueba.id}`}
                        description={`${new Date(prueba.fecha_hora).toLocaleString()} · ${TIPO_LABELS[prueba.tipo] ?? prueba.tipo}`}
                    />
                    {prueba.estado === 'programada' ? (
                        <Badge variant="secondary">Programada</Badge>
                    ) : (
                        <Badge variant={EVALUACION_VARIANT[prueba.evaluacion] ?? 'default'}>{prueba.evaluacion}</Badge>
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="border-sidebar-border/70 lg:col-span-2 dark:border-sidebar-border">
                        <CardContent className="grid gap-3 p-6 text-sm sm:grid-cols-2">
                            <p>Cédula: {prueba.colaborador?.cedula ?? '—'}</p>
                            <p>Dispositivo: {prueba.alcoholimetro?.codigo ?? '—'}</p>
                            <p>Resultado: {prueba.resultado ?? '—'}</p>
                            <p>Responsable: {prueba.responsable?.name ?? '—'}</p>
                            <p>
                                Consentimiento informado: {prueba.consentimiento_aceptado ? 'Aceptado' : 'No registrado'}
                                {prueba.consentimiento_en ? ` (${new Date(prueba.consentimiento_en).toLocaleString()})` : ''}
                            </p>
                            {prueba.observaciones && <p className="sm:col-span-2">Observaciones: {prueba.observaciones}</p>}
                        </CardContent>
                    </Card>

                    {qrSvg && (
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                                <div className="rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                                <p className="text-muted-foreground text-xs">
                                    Escanea para verificar la autenticidad de este registro sin necesidad de iniciar sesión.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

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

                {fotos.length > 0 && (
                    <div>
                        <h2 className="mb-2 text-lg font-medium tracking-tight">Evidencias</h2>
                        <div className="flex flex-wrap gap-3">
                            {fotos.map((path) => (
                                <SafeImage
                                    key={path}
                                    src={`/storage/${path}`}
                                    alt="Evidencia de la prueba"
                                    className="h-32 w-32 rounded-lg border border-sidebar-border/70 object-cover dark:border-sidebar-border"
                                />
                            ))}
                        </div>
                    </div>
                )}

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
        </AppLayout>
    );
}
