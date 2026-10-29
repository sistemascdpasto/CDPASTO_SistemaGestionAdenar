import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Briefcase, FolderOpen, IdCard, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type WizardCatalogos } from './catalogos';
import { Paso1DatosPersonales } from './paso-1-datos-personales';
import { Paso2RequisitosCargo } from './paso-2-requisitos-cargo';
import { Paso3InformacionPuesto } from './paso-3-informacion-puesto';
import { Paso4Archivos } from './paso-4-archivos';
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

interface WizardPageProps {
    colaborador: ColaboradorRecord | null;
    currentStep: number;
    catalogos: WizardCatalogos;
    historialCargos?: HistorialCargo[];
    usuarios?: UsuarioVinculable[];
}

export default function ColaboradorWizard({ colaborador, currentStep, catalogos, historialCargos = [], usuarios }: WizardPageProps) {
    const [visibleStep, setVisibleStep] = useState(currentStep);

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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={colaborador ? `Editar ${nombre}` : 'Nuevo colaborador'} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title={colaborador ? nombre : 'Nuevo colaborador'}
                    description="Completa cada paso y guarda tu avance — puedes salir y retomarlo más tarde desde la lista de colaboradores."
                />

                <Stepper
                    steps={STEPS}
                    currentStep={visibleStep}
                    maxUnlockedStep={maxUnlockedStep}
                    onStepClick={(step) => step <= maxUnlockedStep && setVisibleStep(step)}
                />

                {visibleStep === 1 && <Paso1DatosPersonales colaborador={colaborador} catalogos={catalogos} usuarios={usuarios} />}
                {visibleStep === 2 && colaborador && <Paso2RequisitosCargo colaborador={colaborador} catalogos={catalogos} onBack={() => setVisibleStep(1)} />}
                {visibleStep === 3 && colaborador && (
                    <Paso3InformacionPuesto colaborador={colaborador} catalogos={catalogos} historialCargos={historialCargos} onBack={() => setVisibleStep(2)} />
                )}
                {visibleStep === 4 && colaborador && <Paso4Archivos colaborador={colaborador} onBack={() => setVisibleStep(3)} />}
            </div>
        </AppLayout>
    );
}
