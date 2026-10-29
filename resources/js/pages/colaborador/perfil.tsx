import HeadingSmall from '@/components/heading-small';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { calcularEdad } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { IdCard, User } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mi Perfil', href: '/portal/perfil' },
];

const TURNO_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };
const SEXO_LABELS: Record<string, string> = { femenino: 'Femenino', masculino: 'Masculino' };
const SI_NO_LABELS: Record<string, string> = { si: 'Sí', no: 'No' };

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-foreground">{value ?? '—'}</dd>
        </div>
    );
}

interface ColaboradorPerfil {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    cargo: string | null;
    turno: string | null;
    area: string | null;
    imagen: string | null;
    is_active: boolean;

    expedido_en: string | null;
    sexo: string | null;
    fecha_nacimiento: string | null;
    ciudad_residencia: string | null;
    direccion: string | null;
    estrato: string | null;
    celular_1: string | null;
    celular_2: string | null;
    correo: string | null;
    estado_civil: string | null;

    ha_trabajado_antes: string | null;
    cargo_anterior: string | null;
    fecha_ultima_laboral: string | null;

    tiene_experiencia: string | null;
    area_experiencia: string | null;
    cargo_experiencia: string | null;
    anios_experiencia: number | null;
}

export default function ColaboradorPerfil({ colaborador }: { colaborador: ColaboradorPerfil }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Perfil" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex items-center gap-4">
                    {colaborador.imagen ? (
                        <SafeImage
                            src={`/storage/${colaborador.imagen}`}
                            alt={`${colaborador.nombres} ${colaborador.apellidos}`}
                            className="h-24 w-24 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <User className="size-8" />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <HeadingSmall
                            title={`${colaborador.nombres} ${colaborador.apellidos}`}
                            description={`Cédula ${colaborador.cedula}${colaborador.cargo ? ` · ${colaborador.cargo}` : ''}`}
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {colaborador.turno && <Badge variant="secondary">{TURNO_LABELS[colaborador.turno] ?? colaborador.turno}</Badge>}
                            {colaborador.area && <Badge variant="secondary">{colaborador.area}</Badge>}
                            <Badge variant={colaborador.is_active ? 'default' : 'destructive'}>{colaborador.is_active ? 'Activo' : 'Inactivo'}</Badge>
                        </div>
                    </div>
                </div>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <IdCard className="size-4" />
                            Información personal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <InfoRow label="Expedido en" value={colaborador.expedido_en} />
                            <InfoRow label="Sexo" value={colaborador.sexo ? (SEXO_LABELS[colaborador.sexo] ?? colaborador.sexo) : null} />
                            <InfoRow
                                label="Fecha de nacimiento"
                                value={colaborador.fecha_nacimiento ? `${colaborador.fecha_nacimiento} (${calcularEdad(colaborador.fecha_nacimiento)})` : null}
                            />
                            <InfoRow label="Ciudad de residencia" value={colaborador.ciudad_residencia} />
                            <InfoRow label="Dirección" value={colaborador.direccion} />
                            <InfoRow label="Estrato" value={colaborador.estrato} />
                            <InfoRow label="Celular principal" value={colaborador.celular_1} />
                            <InfoRow label="Celular alterno" value={colaborador.celular_2} />
                            <InfoRow label="Correo" value={colaborador.correo} />
                            <InfoRow
                                label="Estado civil"
                                value={colaborador.estado_civil}
                            />
                        </dl>
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Antecedentes y experiencia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <InfoRow
                                label="¿Trabajó antes en la empresa?"
                                value={colaborador.ha_trabajado_antes ? (SI_NO_LABELS[colaborador.ha_trabajado_antes] ?? colaborador.ha_trabajado_antes) : null}
                            />
                            <InfoRow label="Cargo anterior" value={colaborador.cargo_anterior} />
                            <InfoRow label="Fecha última laboral" value={colaborador.fecha_ultima_laboral} />
                            <InfoRow
                                label="¿Tiene experiencia?"
                                value={colaborador.tiene_experiencia ? (SI_NO_LABELS[colaborador.tiene_experiencia] ?? colaborador.tiene_experiencia) : null}
                            />
                            <InfoRow label="Área de experiencia" value={colaborador.area_experiencia} />
                            <InfoRow label="Cargo de experiencia" value={colaborador.cargo_experiencia} />
                            <InfoRow label="Años de experiencia" value={colaborador.anios_experiencia} />
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
