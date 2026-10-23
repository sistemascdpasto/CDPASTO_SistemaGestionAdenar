/**
 * Layout igual a AppLayout pero sin el AppSidebarHeader (barra superior
 * con migas de pan). Útil para páginas de colaborador que tienen su propio
 * encabezado visual (ej: Mis Estrellas del Camión).
 */
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { FlashToast } from '@/components/flash-toast';
import { PasskeyPrompt } from '@/components/passkey-prompt';

interface Props {
    children: React.ReactNode;
}

export default function AppLayoutNoHeader({ children }: Props) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar">
                {/* Sin AppSidebarHeader — no hay barra de migas de pan */}
                <FlashToast />
                {children}
            </AppContent>
            <PasskeyPrompt />
        </AppShell>
    );
}
