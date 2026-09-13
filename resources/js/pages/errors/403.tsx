import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';

export default function Forbidden() {
    return (
        <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center md:p-10">
            <Head title="Acceso denegado">
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="size-8" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Acceso denegado</h1>
                <p className="text-muted-foreground max-w-sm">No tienes permisos para acceder a esta sección. Si crees que esto es un error, contacta a un administrador.</p>
            </div>
            <Button asChild>
                <Link href={route('dashboard')}>Volver al dashboard</Link>
            </Button>
        </div>
    );
}
