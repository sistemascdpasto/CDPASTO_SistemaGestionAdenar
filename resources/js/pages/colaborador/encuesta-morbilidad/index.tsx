import HeadingSmall from '@/components/heading-small';
import { PreguntaCampo } from '@/components/morbilidad/pregunta-campo';
import {
    respuestasConValoresPorDefecto,
    seccionesOrdenadas,
    type RespuestasState,
    type SeccionesCatalogo,
} from '@/components/morbilidad/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Stepper, type StepDefinition } from '@/pages/gente/colaboradores/wizard/stepper';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ClipboardList, LoaderCircle, Plus, Trash2, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Encuesta de Morbilidad', href: '/portal/encuesta-morbilidad' },
];

// ─── Catálogos del Paso 1 ────────────────────────────────────────────────────

const EMPRESAS   = ['ADENAR', 'UD', 'UC'] as const;
const ESTADOS_CIVILES = ['SOLTERO(A)', 'CASADO(A)/UNIÓN LIBRE', 'DIVORCIADO(A)', 'VIUDO(A)'] as const;
const TIPOS_PERSONA_CARGO = ['PAREJA', 'HIJO', 'PADRES', 'HERMANOS', 'ABUELOS', 'SUEGROS', 'TIOS', 'OTRO'] as const;
const NIVELES_ESCOLARIDAD = [
    'Primaria', 'Secundaria', 'Técnico(a) / Tecnólogo(a)',
    'Universitario', 'Especialista / Magíster', 'Ninguno',
] as const;
const ESTRATOS = [
    'Estrato 1', 'Estrato 2', 'Estrato 3',
    'Estrato 4', 'Estrato 5', 'Estrato 6', 'No sabe / No conoce',
] as const;
const TENENCIAS_VIVIENDA = [
    'Propia totalmente pagada', 'Propia en proceso de pago',
    'Arrendada', 'Familiar', 'En usufructo', 'Otra',
] as const;
const TIPOS_CONTRATACION = [
    'Contrato a término indefinido', 'Contrato a término fijo',
    'Contrato por obra o labor', 'Contrato de prestación de servicios',
    'Contrato de aprendizaje', 'Trabajador independiente', 'No sabe / No conoce',
] as const;
const AREAS = [
    'Reparto', 'Flota', 'Administración', 'Bodega', 'Operaciones',
    'Recursos Humanos', 'Seguridad y Salud', 'Tecnología', 'Otro',
] as const;
const ANTIGUEDADES = [
    'Menos de 1 año', 'De 1 a 5 años', 'De 5 a 10 años',
    'De 10 a 15 años', 'Más de 15 años',
] as const;
const DURACIONES_CONTRATO = ['Un año', 'Menos de un año', 'Más de un año'] as const;
const TURNOS = ['DIURNO', 'NOCTURNO', 'ROTATIVO'] as const;
const INGRESOS = [
    'Mínimo Legal',
    'Entre 1 y 3 (s.m.m.l.v.)',
    'Entre 3 y 5 (s.m.m.l.v.)',
    'Entre 5 y 7 (s.m.m.l.v.)',
    'Más de 7 (s.m.m.l.v.)',
] as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Hijo { nombre: string; edad: string; [key: string]: string }
interface PersonaCargo { tipo: string; edad: string; [key: string]: string }

interface Paso1Data {
    empresa: string;
    correo_electronico: string;
    edad: string;
    estado_civil: string;
    tiene_hijos: string;
    hijos: Hijo[];
    personas_a_cargo: string;
    personas_cargo_detalle: PersonaCargo[];
    nivel_escolaridad: string;
    estrato_socioeconomico: string;
    tenencia_vivienda: string;
    ciudad_residencia: string;
    direccion_residencia: string;
    tipo_contratacion: string;
    cargo_paso1: string;
    area_paso1: string;
    antiguedad_empresa: string;
    antiguedad_cargo: string;
    duracion_contrato: string;
    turno: string;
    promedio_ingresos: string;
}

interface Paso1Inicial {
    empresa: string | null;
    correo_electronico: string | null;
    edad: number | null;
    estado_civil: string | null;
    tiene_hijos: string | null;
    hijos: Hijo[] | null;
    personas_a_cargo: string | null;
    personas_cargo_detalle: PersonaCargo[] | null;
    nivel_escolaridad: string | null;
    estrato_socioeconomico: string | null;
    tenencia_vivienda: string | null;
    ciudad_residencia: string | null;
    direccion_residencia: string | null;
    tipo_contratacion: string | null;
    cargo_paso1: string | null;
    area_paso1: string | null;
    antiguedad_empresa: string | null;
    antiguedad_cargo: string | null;
    duracion_contrato: string | null;
    turno: string | null;
    promedio_ingresos: string | null;
}

interface ColaboradorPrecarga {
    nombre_completo: string;
    cedula: string;
    area: string | null;
    cargo: string | null;
    correo: string | null;
    edad: number | null;
    estado_civil: string | null;
    ciudad_residencia: string | null;
    estrato: string | null;
    turno: string | null;
    tipo_contrato: string | null;
}

interface EncuestaFormData {
    respuestas: RespuestasState;
    paso1: Paso1Data;
}

// ─── Sub-componentes de apoyo ────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
    return (
        <Label className="text-sm font-medium text-foreground">
            {children} <span className="text-red-500">*</span>
        </Label>
    );
}

function SelectField({
    label, name, value, onChange, options, error, placeholder = 'Selecciona una opción',
}: {
    label: string; name: string; value: string;
    onChange: (v: string) => void; options: readonly string[];
    error?: string; placeholder?: string;
}) {
    return (
        <div className="grid gap-1.5">
            <RequiredLabel>{label}</RequiredLabel>
            <select
                id={name}
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${error ? 'border-red-400' : 'border-input'}`}
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <FieldError msg={error} />
        </div>
    );
}

function InputField({
    label, name, value, onChange, error, type = 'text', readOnly = false, autoFilled = false,
}: {
    label: string; name: string; value: string;
    onChange?: (v: string) => void; error?: string;
    type?: string; readOnly?: boolean; autoFilled?: boolean;
}) {
    return (
        <div className="grid gap-1.5">
            <RequiredLabel>{label}</RequiredLabel>
            {autoFilled && (
                <p className="text-[10px] text-muted-foreground">Calculado automáticamente de tu perfil</p>
            )}
            <Input
                id={name} type={type} value={value} readOnly={readOnly}
                onChange={e => onChange?.(e.target.value)}
                className={`h-9 text-sm ${readOnly ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''} ${error ? 'border-red-400' : ''}`}
            />
            <FieldError msg={error} />
        </div>
    );
}

// ─── Sección: Hijos ──────────────────────────────────────────────────────────

function SeccionHijos({
    hijos, onChange, errors,
}: {
    hijos: Hijo[];
    onChange: (hijos: Hijo[]) => void;
    errors: Record<string, string | undefined>;
}) {
    const agregar = () => onChange([...hijos, { nombre: '', edad: '' }]);
    const quitar  = (i: number) => onChange(hijos.filter((_, idx) => idx !== i));
    const update  = (i: number, field: keyof Hijo, val: string) => {
        const copia = [...hijos];
        copia[i] = { ...copia[i], [field]: val };
        onChange(copia);
    };

    return (
        <div className="space-y-3">
            {hijos.map((hijo, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_32px] items-end gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="grid gap-1">
                        <Label className="text-xs font-medium">Nombre</Label>
                        <Input value={hijo.nombre} onChange={e => update(i, 'nombre', e.target.value)}
                            className={`h-8 text-sm ${errors[`paso1.hijos.${i}.nombre`] ? 'border-red-400' : ''}`} />
                        <FieldError msg={errors[`paso1.hijos.${i}.nombre`]} />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs font-medium">Edad</Label>
                        <Input type="number" min={0} value={hijo.edad} onChange={e => update(i, 'edad', e.target.value)}
                            className={`h-8 text-sm ${errors[`paso1.hijos.${i}.edad`] ? 'border-red-400' : ''}`} />
                        <FieldError msg={errors[`paso1.hijos.${i}.edad`]} />
                    </div>
                    <button type="button" onClick={() => quitar(i)}
                        className="flex size-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100">
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={agregar} className="gap-1.5">
                <Plus className="size-3.5" /> Agregar hijo/a
            </Button>
        </div>
    );
}

// ─── Sección: Personas a cargo ───────────────────────────────────────────────

function SeccionPersonasCargo({
    personas, onChange, errors,
}: {
    personas: PersonaCargo[];
    onChange: (p: PersonaCargo[]) => void;
    errors: Record<string, string | undefined>;
}) {
    const agregar = () => onChange([...personas, { tipo: '', edad: '' }]);
    const quitar  = (i: number) => onChange(personas.filter((_, idx) => idx !== i));
    const update  = (i: number, field: keyof PersonaCargo, val: string) => {
        const copia = [...personas];
        copia[i] = { ...copia[i], [field]: val };
        onChange(copia);
    };

    return (
        <div className="space-y-3">
            {personas.map((persona, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_32px] items-end gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="grid gap-1">
                        <Label className="text-xs font-medium">Parentesco</Label>
                        <select value={persona.tipo} onChange={e => update(i, 'tipo', e.target.value)}
                            className={`h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors[`paso1.personas_cargo_detalle.${i}.tipo`] ? 'border-red-400' : 'border-input'}`}>
                            <option value="">Selecciona</option>
                            {TIPOS_PERSONA_CARGO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <FieldError msg={errors[`paso1.personas_cargo_detalle.${i}.tipo`]} />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs font-medium">Edad</Label>
                        <Input type="number" min={0} value={persona.edad} onChange={e => update(i, 'edad', e.target.value)}
                            className={`h-8 text-sm ${errors[`paso1.personas_cargo_detalle.${i}.edad`] ? 'border-red-400' : ''}`} />
                        <FieldError msg={errors[`paso1.personas_cargo_detalle.${i}.edad`]} />
                    </div>
                    <button type="button" onClick={() => quitar(i)}
                        className="flex size-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100">
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={agregar} className="gap-1.5">
                <Plus className="size-3.5" /> Agregar persona a cargo
            </Button>
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EncuestaMorbilidadForm({
    encuestaId,
    colaborador,
    fechaHora,
    secciones,
    respuestas,
    paso1: paso1Inicial,
    portadas = {},
}: {
    encuestaId: number;
    colaborador: ColaboradorPrecarga;
    fechaHora: string;
    secciones: SeccionesCatalogo;
    respuestas: RespuestasState;
    paso1: Paso1Inicial;
    portadas?: Record<number, string | null>;
}) {
    const lista = useMemo(() => seccionesOrdenadas(secciones), [secciones]);

    const steps: StepDefinition[] = useMemo(
        () => [
            { id: 1, label: 'Tus datos', description: 'Datos sociodemográficos', icon: UserCheck },
            ...lista.map((seccion, index) => ({
                id: index + 2,
                label: `Sección ${seccion.numero}`,
                description: seccion.titulo,
                icon: ClipboardList,
            })),
        ],
        [lista],
    );

    const [currentStep, setCurrentStep] = useState(1);

    // Valores iniciales del paso 1 — se prefieren los del borrador guardado;
    // si no existen, se autocompletan desde el perfil del colaborador.
    const paso1Defecto: Paso1Data = {
        empresa:                paso1Inicial.empresa              ?? '',
        correo_electronico:     paso1Inicial.correo_electronico   ?? colaborador.correo ?? '',
        edad:                   String(paso1Inicial.edad          ?? colaborador.edad   ?? ''),
        estado_civil:           paso1Inicial.estado_civil         ?? colaborador.estado_civil ?? '',
        tiene_hijos:            paso1Inicial.tiene_hijos          ?? '',
        hijos:                  paso1Inicial.hijos                ?? [],
        personas_a_cargo:       paso1Inicial.personas_a_cargo     ?? '',
        personas_cargo_detalle: paso1Inicial.personas_cargo_detalle ?? [],
        nivel_escolaridad:      paso1Inicial.nivel_escolaridad    ?? '',
        estrato_socioeconomico: paso1Inicial.estrato_socioeconomico ?? (colaborador.estrato ? `Estrato ${colaborador.estrato}` : ''),
        tenencia_vivienda:      paso1Inicial.tenencia_vivienda    ?? '',
        ciudad_residencia:      paso1Inicial.ciudad_residencia    ?? colaborador.ciudad_residencia ?? '',
        direccion_residencia:   paso1Inicial.direccion_residencia ?? '',
        tipo_contratacion:      paso1Inicial.tipo_contratacion    ?? colaborador.tipo_contrato ?? '',
        cargo_paso1:            paso1Inicial.cargo_paso1          ?? colaborador.cargo ?? '',
        area_paso1:             paso1Inicial.area_paso1           ?? colaborador.area  ?? '',
        antiguedad_empresa:     paso1Inicial.antiguedad_empresa   ?? '',
        antiguedad_cargo:       paso1Inicial.antiguedad_cargo     ?? '',
        duracion_contrato:      paso1Inicial.duracion_contrato    ?? '',
        turno:                  paso1Inicial.turno                ?? colaborador.turno ?? '',
        promedio_ingresos:      paso1Inicial.promedio_ingresos    ?? '',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<any>({
        respuestas: respuestasConValoresPorDefecto(secciones, respuestas),
        paso1: paso1Defecto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const errores = form.errors as unknown as Record<string, string | undefined>;

    const setPaso1 = <K extends keyof Paso1Data>(key: K, value: Paso1Data[K]) => {
        form.setData('paso1', { ...form.data.paso1, [key]: value });
    };

    const numeroASeccionIndex = useMemo(() => {
        const mapa = new Map<number, number>();
        lista.forEach((seccion, index) => {
            Object.keys(seccion.preguntas).forEach(n => mapa.set(Number(n), index + 2));
        });
        return mapa;
    }, [lista]);

    const actualizarRespuesta = (numero: number, respuesta: { valor: string | null; detalle: string | null }) => {
        form.setData('respuestas', { ...form.data.respuestas, [numero]: respuesta });
    };

    const transformarParaEnvio = (data: EncuestaFormData) => ({
        paso1: {
            ...data.paso1,
            edad: data.paso1.edad !== '' ? Number(data.paso1.edad) : null,
            hijos: data.paso1.tiene_hijos === 'Si' ? data.paso1.hijos : [],
            personas_cargo_detalle: data.paso1.personas_a_cargo === 'Si'
                ? data.paso1.personas_cargo_detalle : [],
        },
        respuestas: Object.entries(data.respuestas).map(([numero, r]) => ({
            numero: Number(numero), valor: r.valor, detalle: r.detalle,
        })),
    });

    const guardarProgreso = (onSuccess?: () => void, validarPaso1: boolean = false) => {
        form.transform((data: EncuestaFormData) => ({
            ...transformarParaEnvio(data),
            validar_paso1: validarPaso1,
        }));
        form.post(route('portal.encuesta-morbilidad.guardar', encuestaId), {
            preserveScroll: true,
            preserveState: true,
            onSuccess,
            onError: (err: Record<string, string>) => {
                if (Object.keys(err).some(k => k.startsWith('paso1'))) {
                    setCurrentStep(1);
                }
            },
        });
    };

    const enviarEncuesta = () => {
        form.transform(transformarParaEnvio);
        form.post(route('portal.encuesta-morbilidad.enviar', encuestaId), {
            preserveScroll: true,
            preserveState: true,
            onError: (err: Record<string, string>) => {
                // Si hay errores del paso1, volver al paso 1
                if (Object.keys(err).some(k => k.startsWith('paso1'))) {
                    setCurrentStep(1);
                    return;
                }
                const primeraClave = Object.keys(err)[0];
                const numero = primeraClave ? Number(primeraClave.split('.')[1]) : null;
                const paso = numero !== null ? numeroASeccionIndex.get(numero) : null;
                if (paso) setCurrentStep(paso);
            },
        });
    };

    const esUltimoPaso  = currentStep === steps.length;
    const seccionActual = currentStep >= 2 ? lista[currentStep - 2] : null;
    const p1            = form.data.paso1;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Encuesta de Morbilidad Sentida" />
            <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall
                        title="Encuesta de Morbilidad Sentida"
                        description="Tu progreso se guarda automáticamente al avanzar de sección."
                    />
                    <Button variant="outline" size="sm" asChild>
                        <Link href={route('portal.encuesta-morbilidad.historial')}>Ver mi historial</Link>
                    </Button>
                </div>

                <Stepper steps={steps} currentStep={currentStep} maxUnlockedStep={steps.length} onStepClick={setCurrentStep} />

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardContent className="pt-6">
                        <div key={`step-${currentStep}`}>

                        {/* ════════════════════════ PASO 1 ════════════════════════ */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">1. Datos sociodemográficos y laborales</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Todos los campos marcados con <span className="text-red-500">*</span> son obligatorios.
                                        Los campos en gris se autollenan desde tu perfil.
                                    </p>
                                </div>

                                {/* ── Datos de identificación (solo lectura) ── */}
                                <div className="rounded-lg border border-border bg-muted/20 p-4">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Datos precargados de tu perfil
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">Nombres y apellidos</p>
                                            <p className="text-sm text-foreground">{colaborador.nombre_completo}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">Cédula</p>
                                            <p className="text-sm text-foreground">{colaborador.cedula}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">Fecha y hora de la encuesta</p>
                                            <p className="text-sm text-foreground">{new Date(fechaHora).toLocaleString('es-CO', { hour12: true })}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Sección A: identificación editable ── */}
                                <div className="space-y-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        A. Identificación
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <SelectField
                                            label="Empresa"
                                            name="empresa"
                                            value={p1.empresa}
                                            onChange={v => setPaso1('empresa', v)}
                                            options={EMPRESAS}
                                            error={errores['paso1.empresa']}
                                        />
                                        <InputField
                                            label="Correo electrónico"
                                            name="correo_electronico"
                                            type="email"
                                            value={p1.correo_electronico}
                                            onChange={v => setPaso1('correo_electronico', v)}
                                            error={errores['paso1.correo_electronico']}
                                        />
                                        <InputField
                                            label="Edad"
                                            name="edad"
                                            type="number"
                                            value={p1.edad}
                                            onChange={v => setPaso1('edad', v)}
                                            error={errores['paso1.edad']}
                                            autoFilled={!!colaborador.edad}
                                        />
                                        <SelectField
                                            label="Estado civil"
                                            name="estado_civil"
                                            value={p1.estado_civil}
                                            onChange={v => setPaso1('estado_civil', v)}
                                            options={ESTADOS_CIVILES}
                                            error={errores['paso1.estado_civil']}
                                        />
                                    </div>
                                </div>

                                {/* ── Sección B: Familia ── */}
                                <div className="space-y-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        B. Familia
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <SelectField
                                            label="¿Tiene hijos(as)?"
                                            name="tiene_hijos"
                                            value={p1.tiene_hijos}
                                            onChange={v => setPaso1('tiene_hijos', v)}
                                            options={['Si', 'No']}
                                            error={errores['paso1.tiene_hijos']}
                                        />
                                        <SelectField
                                            label="¿Tiene personas a cargo?"
                                            name="personas_a_cargo"
                                            value={p1.personas_a_cargo}
                                            onChange={v => setPaso1('personas_a_cargo', v)}
                                            options={['Si', 'No']}
                                            error={errores['paso1.personas_a_cargo']}
                                        />
                                    </div>

                                    {/* Lista de hijos — visible si responde Sí */}
                                    {p1.tiene_hijos === 'Si' && (
                                        <div className="rounded-lg border border-border p-4">
                                            <p className="mb-3 text-xs font-semibold text-muted-foreground">
                                                ¿Cuántos hijos/as tiene? — Agrega el nombre y la edad de cada uno(a)
                                            </p>
                                            <SeccionHijos
                                                hijos={p1.hijos}
                                                onChange={v => setPaso1('hijos', v)}
                                                errors={errores}
                                            />
                                        </div>
                                    )}

                                    {/* Lista de personas a cargo — visible si responde Sí */}
                                    {p1.personas_a_cargo === 'Si' && (
                                        <div className="rounded-lg border border-border p-4">
                                            <p className="mb-3 text-xs font-semibold text-muted-foreground">
                                                Número de personas a cargo — Agrega el parentesco y la edad de cada una
                                            </p>
                                            <SeccionPersonasCargo
                                                personas={p1.personas_cargo_detalle}
                                                onChange={v => setPaso1('personas_cargo_detalle', v)}
                                                errors={errores}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* ── Sección C: Educación y vivienda ── */}
                                <div className="space-y-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        C. Educación y vivienda
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <SelectField
                                                label="Nivel de escolaridad — Señale el último nivel aprobado"
                                                name="nivel_escolaridad"
                                                value={p1.nivel_escolaridad}
                                                onChange={v => setPaso1('nivel_escolaridad', v)}
                                                options={NIVELES_ESCOLARIDAD}
                                                error={errores['paso1.nivel_escolaridad']}
                                            />
                                        </div>
                                        <SelectField
                                            label="Estrato socioeconómico"
                                            name="estrato_socioeconomico"
                                            value={p1.estrato_socioeconomico}
                                            onChange={v => setPaso1('estrato_socioeconomico', v)}
                                            options={ESTRATOS}
                                            error={errores['paso1.estrato_socioeconomico']}
                                        />
                                        <SelectField
                                            label="Tenencia de vivienda"
                                            name="tenencia_vivienda"
                                            value={p1.tenencia_vivienda}
                                            onChange={v => setPaso1('tenencia_vivienda', v)}
                                            options={TENENCIAS_VIVIENDA}
                                            error={errores['paso1.tenencia_vivienda']}
                                        />
                                    </div>
                                </div>

                                {/* ── Sección D: Residencia ── */}
                                <div className="space-y-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        D. Residencia
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <InputField
                                            label="Ciudad / Municipio de residencia"
                                            name="ciudad_residencia"
                                            value={p1.ciudad_residencia}
                                            onChange={v => setPaso1('ciudad_residencia', v)}
                                            error={errores['paso1.ciudad_residencia']}
                                            autoFilled={!!colaborador.ciudad_residencia}
                                        />
                                        <InputField
                                            label="Dirección de residencia"
                                            name="direccion_residencia"
                                            value={p1.direccion_residencia}
                                            onChange={v => setPaso1('direccion_residencia', v)}
                                            error={errores['paso1.direccion_residencia']}
                                        />
                                    </div>
                                </div>

                                {/* ── Sección E: Información laboral ── */}
                                <div className="space-y-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        E. Información laboral
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <SelectField
                                                label="Tipo de contratación"
                                                name="tipo_contratacion"
                                                value={p1.tipo_contratacion}
                                                onChange={v => setPaso1('tipo_contratacion', v)}
                                                options={TIPOS_CONTRATACION}
                                                error={errores['paso1.tipo_contratacion']}
                                            />
                                        </div>
                                        <InputField
                                            label="Cargo"
                                            name="cargo_paso1"
                                            value={p1.cargo_paso1}
                                            onChange={v => setPaso1('cargo_paso1', v)}
                                            error={errores['paso1.cargo_paso1']}
                                            autoFilled={!!colaborador.cargo}
                                        />
                                        <SelectField
                                            label="Área"
                                            name="area_paso1"
                                            value={p1.area_paso1}
                                            onChange={v => setPaso1('area_paso1', v)}
                                            options={AREAS}
                                            error={errores['paso1.area_paso1']}
                                        />
                                        <SelectField
                                            label="Antigüedad en la empresa"
                                            name="antiguedad_empresa"
                                            value={p1.antiguedad_empresa}
                                            onChange={v => setPaso1('antiguedad_empresa', v)}
                                            options={ANTIGUEDADES}
                                            error={errores['paso1.antiguedad_empresa']}
                                        />
                                        <SelectField
                                            label="Antigüedad en el cargo actual"
                                            name="antiguedad_cargo"
                                            value={p1.antiguedad_cargo}
                                            onChange={v => setPaso1('antiguedad_cargo', v)}
                                            options={ANTIGUEDADES}
                                            error={errores['paso1.antiguedad_cargo']}
                                        />
                                        <SelectField
                                            label="Duración del contrato"
                                            name="duracion_contrato"
                                            value={p1.duracion_contrato}
                                            onChange={v => setPaso1('duracion_contrato', v)}
                                            options={DURACIONES_CONTRATO}
                                            error={errores['paso1.duracion_contrato']}
                                        />
                                        <SelectField
                                            label="Turno"
                                            name="turno"
                                            value={p1.turno}
                                            onChange={v => setPaso1('turno', v)}
                                            options={TURNOS}
                                            error={errores['paso1.turno']}
                                        />
                                        <div className="sm:col-span-2">
                                            <SelectField
                                                label="Promedio de Ingresos (s.m.m.l.v. — Salario Mínimo Mensual Legal Vigente)"
                                                name="promedio_ingresos"
                                                value={p1.promedio_ingresos}
                                                onChange={v => setPaso1('promedio_ingresos', v)}
                                                options={INGRESOS}
                                                error={errores['paso1.promedio_ingresos']}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep >= 2 && seccionActual && (
                            <div className="space-y-4">
                                {/* Imagen de portada de la sección */}
                                {portadas[seccionActual.numero] && (
                                    <div className="overflow-hidden rounded-xl">
                                        <img
                                            src={portadas[seccionActual.numero]!}
                                            alt={`Portada sección ${seccionActual.numero}`}
                                            className="h-40 w-full object-cover"
                                        />
                                    </div>
                                )}
                                <p className="text-sm font-medium text-foreground">
                                    {seccionActual.numero}. {seccionActual.titulo}
                                </p>
                                {/* Descripción opcional de la sección */}
                                {(seccionActual as { descripcion?: string }).descripcion && (
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {(seccionActual as { descripcion?: string }).descripcion}
                                    </p>
                                )}
                                {/* Nota de instrucciones para segmentos corporales */}
                                {seccionActual.numero === 1 && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10 space-y-1">
                                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                            INSTRUCCIONES — Molestia o dolor en los últimos 12 meses
                                        </p>
                                        <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                                            <li><strong>RARA VEZ:</strong> una vez por mes</li>
                                            <li><strong>FRECUENTE:</strong> por lo menos una vez cada dos semanas</li>
                                            <li><strong>CONTINUO:</strong> diario o más de tres veces por semana</li>
                                            <li><strong>NUNCA:</strong> cuando no se presenta</li>
                                        </ul>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                            Si marcó RARA VEZ, FRECUENTE o CONTINUO, califique la severidad: <strong>LEVE · MODERADO · SEVERO</strong>
                                        </p>
                                    </div>
                                )}
                                <div>
                                    {Object.entries(seccionActual.preguntas).map(([numeroStr, pregunta]) => {
                                        const numero = Number(numeroStr);
                                        return (
                                            <PreguntaCampo
                                                key={numero}
                                                numero={numero}
                                                pregunta={pregunta}
                                                respuesta={form.data.respuestas[numero]}
                                                onChange={actualizarRespuesta}
                                                errorValor={errores[`respuestas.${numero}.valor`]}
                                                errorDetalle={errores[`respuestas.${numero}.detalle`]}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        </div>
                    </CardContent>
                </Card>

                {/* Botonera */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="button" variant="ghost" onClick={() => guardarProgreso()} disabled={form.processing}>
                        {form.processing && <LoaderCircle className="size-4 animate-spin" />}
                        <span>Guardar borrador</span>
                    </Button>

                    <div className="flex gap-2">
                        {currentStep > 1 && (
                            <Button type="button" variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                                Anterior
                            </Button>
                        )}
                        {esUltimoPaso ? (
                            <Button type="button" onClick={enviarEncuesta} disabled={form.processing}>
                                {form.processing && <LoaderCircle className="size-4 animate-spin" />}
                                <span>Finalizar y enviar</span>
                            </Button>
                        ) : (
                            <Button type="button"
                                onClick={() => guardarProgreso(() => setCurrentStep(currentStep + 1), currentStep === 1)}
                                disabled={form.processing}>
                                {form.processing && <LoaderCircle className="size-4 animate-spin" />}
                                <span>{currentStep === 1 ? 'Comenzar' : 'Guardar y continuar'}</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
