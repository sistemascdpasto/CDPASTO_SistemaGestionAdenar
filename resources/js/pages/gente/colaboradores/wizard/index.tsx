import { SafeImage } from '@/components/safe-image';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Briefcase, FolderOpen, IdCard, ListChecks, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type WizardCatalogos } from './catalogos';
import { Paso1DatosPersonales } from './paso-1-datos-personales';
import { Paso2RequisitosCargo } from './paso-2-requisitos-cargo';
import { Paso3InformacionPuesto } from './paso-3-informacion-puesto';
import { Paso4Archivos } from './paso-4-archivos';
import PhotoOverlay from './components/PhotoOverlay';
import { type StepDefinition, Stepper } from './stepper';
import { type ColaboradorRecord, type UsuarioVinculable } from './types';

const STEPS: StepDefinition[] = [
    { id: 1, label: 'Datos personales', description: 'Identificación y contacto', icon: IdCard },
    { id: 2, label: 'Requisitos del cargo', description: 'Antecedentes y experiencia', icon: ListChecks },
    { id: 3, label: 'Puesto de trabajo', description: 'Cargo, centro y contrato', icon: Briefcase },
    { id: 4, label: 'Archivos digitales', description: 'Documentación completa', icon: FolderOpen },
];

type HistorialCargo = {
    id: number;
    cargo: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    estado: 'ACTIVO' | 'INACTIVO';
};

type HistorialContrato = {
    id: number;
    tipo_contrato: string;
    tipo_contrato_otro: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
};

interface WizardPageProps {
    colaborador: ColaboradorRecord | null;
    currentStep: number;
    esReingreso?: boolean;
    catalogos: WizardCatalogos;
    historialCargos?: HistorialCargo[];
    historialContratos?: HistorialContrato[];
    usuarios?: UsuarioVinculable[];
}

export default function ColaboradorWizard({
    colaborador,
    currentStep,
    esReingreso = false,
    catalogos,
    historialCargos = [],
    historialContratos = [],
    usuarios,
}: WizardPageProps) {
    const [visibleStep, setVisibleStep] = useState(currentStep);

    // Leer redirect_to desde la URL (ej: ?paso=3&redirect_to=contratos)
    const redirectTo = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('redirect_to') ?? undefined) : undefined;

    // Cuando el servidor confirma un paso (redirect tras Siguiente) o se
    // navega a un colaborador distinto, el paso visible sigue al prop.
    useEffect(() => {
        setVisibleStep(currentStep);
    }, [currentStep, colaborador?.id]);

    const maxUnlockedStep = colaborador ? Math.min((colaborador.wizard_step ?? 0) + 1, 4) : 1;

    const nombre = colaborador ? `${colaborador.nombres} ${colaborador.apellidos}` : 'Nuevo colaborador';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gente', href: '/modules/gente' },
        { title: 'Colaboradores', href: '/modules/gente/colaboradores' },
        { title: nombre, href: '#' },
    ];

    // State and ref for photo handling are now managed by PhotoOverlay component
    const [fotoLocal, setFotoLocal] = useState<string | null>(null);
    const [fotoEliminada, setFotoEliminada] = useState(false);


    // Cuando cambia el colaborador (tras guardar paso 1), resetear estados locales
    useEffect(() => {
        setFotoLocal(null);
        setFotoEliminada(false);
    }, [colaborador?.id, colaborador?.imagen]);

    const fotoSrc = fotoLocal
        ?? (!fotoEliminada && colaborador?.imagen
            ? (String(colaborador.imagen).startsWith('/') ? String(colaborador.imagen) : `/storage/${colaborador.imagen}`)
            : null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={colaborador ? `Editar ${nombre}` : 'Nuevo colaborador'} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex items-center gap-4">
                    {/* Photo overlay component */}
                    <PhotoOverlay
                        colaboradorId={colaborador?.id}
                        fotoSrc={fotoSrc}
                        fotoAlt={nombre}
                        onChange={(file) => {
                            setFotoLocal(URL.createObjectURL(file));
                            setFotoEliminada(false);
                            const inputPaso1 = document.getElementById('wizard-foto-input') as HTMLInputElement | null;
                            if (inputPaso1) {
                                const dt = new DataTransfer();
                                dt.items.add(file);
                                inputPaso1.files = dt.files;
                                inputPaso1.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }}
                        onDelete={() => {
                            setFotoEliminada(true);
                            setFotoLocal(null);
                        }}
                    />
                    <div>
                        <h2 className="text-lg font-semibold">{colaborador ? nombre : 'Nuevo colaborador'}</h2>
                        <p className="text-muted-foreground text-sm">Completa cada paso y guarda tu avance — puedes salir y retomarlo más tarde desde la lista de colaboradores.</p>
                    </div>
                </div>

                <Stepper
                    steps={STEPS}
                    currentStep={visibleStep}
                    maxUnlockedStep={maxUnlockedStep}
                    onStepClick={(step) => step <= maxUnlockedStep && setVisibleStep(step)}
                />

                {visibleStep === 1 && <Paso1DatosPersonales colaborador={colaborador} catalogos={catalogos} usuarios={usuarios} />}
                {visibleStep === 2 && colaborador && (
                    <Paso2RequisitosCargo colaborador={colaborador} catalogos={catalogos} onBack={() => setVisibleStep(1)} />
                )}
                {visibleStep === 3 && colaborador && (
                    <Paso3InformacionPuesto
                        colaborador={colaborador}
                        catalogos={catalogos}
                        historialCargos={historialCargos}
                        onBack={() => setVisibleStep(2)}
                        redirectTo={redirectTo}
                        historialContratos={historialContratos}
                        esReingreso={esReingreso}
                    />
                )}
                {visibleStep === 4 && colaborador && <Paso4Archivos colaborador={colaborador} onBack={() => setVisibleStep(3)} />}
            </div>
        </AppLayout>
    );
}
