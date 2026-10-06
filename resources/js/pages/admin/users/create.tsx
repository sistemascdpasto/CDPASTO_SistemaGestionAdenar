import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { ModuleRegistry, UserFormData, UserFormFields } from '@/pages/admin/users/user-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gestión de Usuarios', href: '/admin/users' },
    { title: 'Nuevo usuario', href: '/admin/users/create' },
];

export default function CreateUser({ roles, moduleRegistry }: { roles: string[]; moduleRegistry: ModuleRegistry }) {
    const { data, setData, post, processing, errors } = useForm<UserFormData>({
        first_name: '',
        last_name: '',
        identification_number: '',
        email: '',
        password: '',
        password_confirmation: '',
        roles: [],
        is_active: true,
        modulos_personalizados: false,
        submodulos: {},
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.users.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nuevo usuario" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Nuevo usuario" description="Crea una cuenta y asígnale un rol para definir a qué módulos podrá acceder." />

                <form onSubmit={submit} className="max-w-2xl space-y-6">
                    <UserFormFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        availableRoles={roles}
                        moduleRegistry={moduleRegistry}
                        showPassword
                        processing={processing}
                    />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Crear usuario
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
