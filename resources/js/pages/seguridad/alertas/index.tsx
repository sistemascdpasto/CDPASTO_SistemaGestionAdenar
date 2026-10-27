import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { ProrrogarContratoDialog } from '@/pages/gente/colaboradores/prorrogar-contrato-dialog';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarPlus, Check, FileDown } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Alertas', href: '/modules/seguridad/alertas' },
];

const TIPO_LABELS: Record<string, string> = {
    prueba_positiva: 'Prueba positiva',
    salud_mala: 'Salud: Malo',
    no_apto: 'No apto para laborar',
    calibracion_proxima: 'Calibración próxima',
    certificado_vencido: 'Certificado por vencer',
    retiro_proximo: 'Contrato próximo a vencer',
};

interface AlertaRow {
    id: number;
    tipo: string;
    mensaje: string;
    atendida: boolean;
    created_at: string;
    colaborador: { id: number; nombres: string; apellidos: string; fecha_retiro_empresa: string | null } | null;
    alcoholimetro: { codigo: string } | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface AlertasPaginator {
    data: AlertaRow[];
    links: PaginationLink[];
}

export default function AlertasIndex({ alertas, filters }: { alertas: AlertasPaginator; filters: { estado: string } }) {
    const filtrarPorEstado = (estado: string) => {
        router.get(route('seguridad.alertas.index'), { estado }, { preserveState: true, replace: true });
    };

    const atender = (alerta: AlertaRow) => {
        router.patch(route('seguridad.alertas.atender', alerta.id), {}, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Alertas" description="Pruebas positivas, salud crítica, y dispositivos que requieren atención." />

                <Select value={filters.estado} onValueChange={filtrarPorEstado}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pendientes">Pendientes</SelectItem>
                        <SelectItem value="atendidas">Atendidas</SelectItem>
                        <SelectItem value="todas">Todas</SelectItem>
                    </SelectContent>
                </Select>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Mensaje</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {alertas.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                                        No hay alertas.
                                    </TableCell>
                                </TableRow>
                            )}
                            {alertas.data.map((alerta) => (
                                <TableRow key={alerta.id}>
                                    <TableCell>{new Date(alerta.created_at).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={alerta.atendida ? 'secondary' : 'destructive'}>
                                            {TIPO_LABELS[alerta.tipo] ?? alerta.tipo}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-md">{alerta.mensaje}</TableCell>
                                    <TableCell>{alerta.atendida ? 'Atendida' : 'Pendiente'}</TableCell>
                                    <TableCell className="text-right">
                                        {!alerta.atendida && (
                                            <div className="flex justify-end gap-1">
                                                {alerta.tipo === 'retiro_proximo' && alerta.colaborador && (
                                                    <>
                                                        <ProrrogarContratoDialog
                                                            colaboradorId={alerta.colaborador.id}
                                                            nombreCompleto={`${alerta.colaborador.nombres} ${alerta.colaborador.apellidos}`}
                                                            fechaActual={alerta.colaborador.fecha_retiro_empresa}
                                                            trigger={
                                                                <Button variant="outline" size="sm">
                                                                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                                                                    Prorrogar
                                                                </Button>
                                                            }
                                                        />
                                                        <Button variant="outline" size="sm" asChild>
                                                            <a
                                                                href={`/modules/gente/contratos/${alerta.colaborador.id}/prorroga-pdf${alerta.colaborador.fecha_retiro_empresa ? `?fecha=${alerta.colaborador.fecha_retiro_empresa}` : ''}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                                                                PDF
                                                            </a>
                                                        </Button>
                                                    </>
                                                )}
                                                <IconActionButton icon={Check} label="Marcar como atendida" onClick={() => atender(alerta)} />
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {alertas.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {alertas.links.map((link, index) => (
                            <Button key={index} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={!!link.url}>
                                {link.url ? (
                                    <Link href={link.url} preserveScroll dangerouslySetInnerHTML={{ __html: link.label }} />
                                ) : (
                                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
