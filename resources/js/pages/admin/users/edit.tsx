import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { ModuleRegistry, UserFormData, UserFormFields } from '@/pages/admin/users/user-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface EditableUser {
    id: number;
    first_name: string | null;
    last_name: string | null;
    identification_number: string;
    email: string | null;
    is_active: boolean;
    roles: string[];
    modulos_personalizados: boolean;
    submodulos_actuales: Record<string, string[]>;
}

export default function EditUser({ user, roles, moduleRegistry }: { user: EditableUser; roles: string[]; moduleRegistry: ModuleRegistry }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gestión de Usuarios', href: '/admin/users' },
        { title: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(), href: `/admin/users/${user.id}/edit` },
    ];

    const { data, setData, put, processing, errors } = useForm<UserFormData>({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        identification_number: user.identification_number,
        email: user.email ?? '',
        password: '',
        password_confirmation: '',
        roles: user.roles,
        is_active: user.is_active,
        modulos_personalizados: user.modulos_personalizados,
        submodulos: user.submodulos_actuales,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('admin.users.update', user.id));
    };

    const resetPasswordForm = useForm({ password: '', password_confirmation: '' });
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);

    const submitResetPassword: FormEventHandler = (e) => {
        e.preventDefault();
        resetPasswordForm.patch(route('admin.users.reset-password', user.id), {
            preserveScroll: true,
            onSuccess: () => {
                resetPasswordForm.reset();
                setResetPasswordOpen(false);
                setResetPasswordSuccess(true);
            },
        });
    };

    useEffect(() => {
        if (!resetPasswordSuccess) return;
        const timeout = setTimeout(() => setResetPasswordSuccess(false), 4000);
        return () => clearTimeout(timeout);
    }, [resetPasswordSuccess]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Editar usuario" />
            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4">
                <div className="max-w-2xl space-y-6">
                    <HeadingSmall title="Editar usuario" description="Actualiza los datos, el estado o los roles asignados." />

                    <form onSubmit={submit} className="space-y-6">
                        <UserFormFields
                            data={data}
                            setData={setData}
                            errors={errors}
                            availableRoles={roles}
                            moduleRegistry={moduleRegistry}
                            showPassword={false}
                            processing={processing}
                        />

                        <Button type="submit" disabled={processing}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </form>
                </div>

                <div className="max-w-2xl space-y-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                    <HeadingSmall title="Restablecer contraseña" description="Define una nueva contraseña para este usuario." />

                    {resetPasswordSuccess && (
                        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 className="size-4" />
                            <AlertDescription>Contraseña cambiada correctamente.</AlertDescription>
                        </Alert>
                    )}

                    <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">Restablecer contraseña</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogTitle>Restablecer contraseña</DialogTitle>
                            <DialogDescription>Se reemplazará la contraseña actual del usuario de forma inmediata.</DialogDescription>
                            <form className="space-y-4" onSubmit={submitResetPassword}>
                                <div className="grid gap-2">
                                    <Label htmlFor="new_password">Nueva contraseña</Label>
                                    <Input
                                        id="new_password"
                                        type="password"
                                        value={resetPasswordForm.data.password}
                                        onChange={(e) => resetPasswordForm.setData('password', e.target.value)}
                                    />
                                    <InputError message={resetPasswordForm.errors.password} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="new_password_confirmation">Confirmar contraseña</Label>
                                    <Input
                                        id="new_password_confirmation"
                                        type="password"
                                        value={resetPasswordForm.data.password_confirmation}
                                        onChange={(e) => resetPasswordForm.setData('password_confirmation', e.target.value)}
                                    />
                                    <InputError message={resetPasswordForm.errors.password_confirmation} />
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">
                                            Cancelar
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={resetPasswordForm.processing}>
                                        Restablecer
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </AppLayout>
    );
}
