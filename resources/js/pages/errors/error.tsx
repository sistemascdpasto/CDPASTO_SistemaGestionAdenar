import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Clock, FileQuestion, ServerCrash } from 'lucide-react';

const COPY: Record<number, { title: string; description: string; icon: typeof FileQuestion }> = {
    404: {
        title: 'Página no encontrada',
        description: 'El enlace que seguiste no existe o fue movido. Revisa la dirección o vuelve al inicio.',
        icon: FileQuestion,
    },
    500: {
        title: 'Algo salió mal',
        description: 'Ocurrió un error inesperado en el servidor. Ya quedó registrado; intenta de nuevo en unos minutos.',
        icon: ServerCrash,
    },
    503: {
        title: 'Servicio no disponible',
        description: 'El sistema está en mantenimiento o temporalmente fuera de servicio. Intenta de nuevo en unos minutos.',
        icon: Clock,
    },
};

const DEFAULT_COPY = {
    title: 'Ocurrió un error',
    description: 'No pudimos procesar tu solicitud. Intenta de nuevo o vuelve al inicio.',
    icon: AlertTriangle,
};

export default function ErrorPage({ status }: { status: number }) {
    const { title, description, icon: Icon } = COPY[status] ?? DEFAULT_COPY;

    return (
        <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center md:p-10">
            <Head title={title}>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-8" />
            </div>
            <div className="space-y-2">
                <p className="text-muted-foreground text-sm font-semibold tabular-nums">Error {status}</p>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="text-muted-foreground max-w-sm">{description}</p>
            </div>
            <Button asChild>
                <Link href="/">Volver al inicio</Link>
            </Button>
        </div>
    );
}
