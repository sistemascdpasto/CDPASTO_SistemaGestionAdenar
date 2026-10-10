import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mis Pruebas', href: '/portal/pruebas' },
];

interface PruebaRow {
    id: number;
    tipo: string;
    resultado: string | null;
    es_positivo: boolean;
    estado: string;
    fecha_hora: string;
    alcoholimetro: { codigo: string } | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PruebasPaginator {
    data: PruebaRow[];
    links: PaginationLink[];
}

export default function ColaboradorPruebas({ pruebas }: { pruebas: PruebasPaginator }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mis Pruebas" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Mis pruebas de alcoholemia" description="Historial completo de tus pruebas registradas." />

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12 text-center">#</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Dispositivo</TableHead>
                                <TableHead>Resultado</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pruebas.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                                        Sin pruebas registradas.
                                    </TableCell>
                                </TableRow>
                            )}
                            {pruebas.data.map((prueba, index) => (
                                <TableRow key={prueba.id}>
                                    <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell>{new Date(prueba.fecha_hora).toLocaleString()}</TableCell>
                                    <TableCell className="capitalize">{prueba.tipo}</TableCell>
                                    <TableCell>{prueba.alcoholimetro?.codigo ?? '—'}</TableCell>
                                    <TableCell>{prueba.resultado ?? '—'}</TableCell>
                                    <TableCell>
                                        {prueba.estado === 'programada' ? (
                                            <Badge variant="secondary">Programada</Badge>
                                        ) : (
                                            <Badge variant={prueba.es_positivo ? 'destructive' : 'default'}>
                                                {prueba.es_positivo ? 'Positivo' : 'Negativo'}
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {pruebas.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {pruebas.links.map((link, index) => (
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
