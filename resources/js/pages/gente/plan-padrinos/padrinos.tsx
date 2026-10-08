import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { HeartHandshake, ListChecks, Save, Star, UserCheck } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Padrinos', href: '/modules/gente/plan-padrinos' },
    { title: 'Padrinos', href: '/modules/gente/plan-padrinos/padrinos' },
];

interface Padrino {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    mensaje_padrino: string | null;
}

interface Props {
    padrinos: Padrino[];
}

export default function PadrinosIndex({ padrinos }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.isAdmin || auth.roles.includes('Gente');

    const [selected, setSelected] = useState<Padrino | null>(null);
    const [mensaje, setMensaje] = useState('');
    const [saving, setSaving] = useState(false);

    const handleOpen = (padrino: Padrino) => {
        setSelected(padrino);
        setMensaje(padrino.mensaje_padrino ?? '');
    };

    const handleClose = () => {
        setSelected(null);
        setMensaje('');
    };

    const handleSave = () => {
        if (!selected) return;
        setSaving(true);
        router.post(
            route('gente.plan-padrinos.padrinos.mensaje'),
            { colaborador_id: selected.id, mensaje_padrino: mensaje },
            {
                preserveScroll: true,
                onSuccess: () => {
                    // Actualizar el mensaje en el objeto seleccionado localmente
                    setSelected((prev) => prev ? { ...prev, mensaje_padrino: mensaje } : null);
                    setSaving(false);
                },
                onError: () => setSaving(false),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Padrinos — Plan Padrino" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                <HeadingSmall
                    title="Nuestros Padrinos"
                    description="Colaboradores operativos con rol de Padrino dentro del Plan Padrino."
                />

                {/* Pestañas del submódulo */}
                <div className="flex items-center gap-2 border-b pb-2 flex-wrap">
                    <Link
                        href="/modules/gente/plan-padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <HeartHandshake className="h-4 w-4" />
                        Seguimiento de Pruebas
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/criterios"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <ListChecks className="h-4 w-4" />
                        Criterios y Nivel de Autonomía
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-xs"
                    >
                        <Star className="h-4 w-4" />
                        Padrinos
                    </Link>
                </div>

                {/* Grid de tarjetas */}
                {padrinos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
                        <Star className="h-16 w-16 opacity-20" />
                        <p className="text-sm">No hay colaboradores con rol de Padrino aún.</p>
                        <p className="text-xs">Asigna el rol desde la vista de Criterios.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {padrinos.map((padrino) => (
                            <button
                                key={padrino.id}
                                type="button"
                                onClick={() => handleOpen(padrino)}
                                className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-purple-400/60 hover:-translate-y-0.5 text-left"
                            >
                                {/* Foto */}
                                <div className="relative">
                                    {padrino.imagen ? (
                                        <img
                                            src={`/storage/${padrino.imagen}`}
                                            alt={padrino.nombre_completo}
                                            className="h-20 w-20 rounded-full object-cover border-2 border-purple-300/60 group-hover:border-purple-500/80 transition-colors"
                                        />
                                    ) : (
                                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300/60 group-hover:border-purple-500/80 transition-colors">
                                            <UserCheck className="h-8 w-8 text-purple-500" />
                                        </div>
                                    )}
                                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white shadow">
                                        <Star className="h-3 w-3 fill-current" />
                                    </span>
                                </div>

                                {/* Datos */}
                                <div className="flex flex-col items-center gap-0.5 text-center w-full">
                                    <span className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                                        {padrino.nombre_completo}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                                        {padrino.cargo}
                                    </span>
                                    {padrino.mensaje_padrino && (
                                        <span className="mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                            Tiene mensaje ✓
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal detalle — foto grande + mensaje editable */}
            <Dialog open={!!selected} onOpenChange={(open) => { if (!open) handleClose(); }}>
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
                    {selected && (
                        <div className="flex flex-col sm:flex-row min-h-[340px]">
                            {/* Lado izquierdo — foto grande */}
                            <div className="flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-purple-600 to-purple-900 p-8 sm:w-64 shrink-0">
                                {selected.imagen ? (
                                    <img
                                        src={`/storage/${selected.imagen}`}
                                        alt={selected.nombre_completo}
                                        className="h-36 w-36 rounded-full object-cover border-4 border-white/40 shadow-xl"
                                    />
                                ) : (
                                    <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white/10 border-4 border-white/30">
                                        <UserCheck className="h-14 w-14 text-white/70" />
                                    </div>
                                )}
                                <div className="text-center">
                                    <p className="text-base font-bold text-white leading-tight">
                                        {selected.nombre_completo}
                                    </p>
                                    <p className="text-sm text-purple-200 mt-1">
                                        {selected.cargo}
                                    </p>
                                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
                                        <Star className="h-3 w-3 fill-current" />
                                        Padrino
                                    </div>
                                </div>
                            </div>

                            {/* Lado derecho — mensaje editable */}
                            <div className="flex flex-col flex-1 p-6 gap-4">
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Mensaje del Padrino</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {canManage
                                            ? 'Escribe o edita el mensaje de este padrino.'
                                            : 'Mensaje de este padrino para el equipo.'}
                                    </p>
                                </div>

                                <Textarea
                                    value={mensaje}
                                    onChange={(e) => setMensaje(e.target.value)}
                                    placeholder="Escribe aquí el mensaje del padrino para el equipo..."
                                    className="flex-1 resize-none min-h-[160px] text-sm"
                                    disabled={!canManage}
                                    maxLength={2000}
                                />

                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-muted-foreground">
                                        {mensaje.length}/2000
                                    </span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleClose}>
                                            Cerrar
                                        </Button>
                                        {canManage && (
                                            <Button
                                                size="sm"
                                                disabled={saving}
                                                onClick={handleSave}
                                                className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                                            >
                                                <Save className="h-3.5 w-3.5" />
                                                {saving ? 'Guardando...' : 'Guardar mensaje'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
