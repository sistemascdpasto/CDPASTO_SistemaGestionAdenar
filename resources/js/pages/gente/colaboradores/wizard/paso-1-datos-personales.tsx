import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { calcularEdad, PillToggle, SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { ArrowRight, IdCard, LoaderCircle, MapPin, Phone, Plus, ShieldCheck, Stethoscope, Trash2, User, UserCog } from 'lucide-react';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import { DepartamentoCiudadSelect } from './components/departamento-ciudad-select';
import { PhotoUploader } from './components/photo-uploader';
import { SelectConOtro } from './components/select-con-otro';
import { SimpleFileField } from './components/simple-file-field';
import { type ColaboradorRecord, type Paso1FormData, type UsuarioVinculable } from './types';
import { type WizardCatalogos } from './catalogos';
import { errorDeArchivo } from './utils';

interface Paso1Props {
    colaborador: ColaboradorRecord | null;
    catalogos: WizardCatalogos;
    usuarios?: UsuarioVinculable[];
}

export function Paso1DatosPersonales({ colaborador, catalogos, usuarios }: Paso1Props) {
    const esNuevo = !colaborador;

    const { data, setData, post, processing, errors, transform } = useForm<Paso1FormData>({
        user_id: colaborador?.user_id?.toString() ?? '',
        cedula: (colaborador?.cedula as string) ?? '',
        nombres: (colaborador?.nombres as string) ?? '',
        apellidos: (colaborador?.apellidos as string) ?? '',
        imagen: null,

        tipo_documento: (colaborador?.tipo_documento as string) ?? '',
        tipo_documento_otro_label: (colaborador?.tipo_documento_otro_label as string) ?? '',
        expedido_en: (colaborador?.expedido_en as string) ?? '',
        sexo: (colaborador?.sexo as Paso1FormData['sexo']) ?? '',
        fecha_nacimiento: (colaborador?.fecha_nacimiento as string) ?? '',
        ciudad_residencia: (colaborador?.ciudad_residencia as string) ?? '',
        direccion: (colaborador?.direccion as string) ?? '',
        estrato: (colaborador?.estrato as string) ?? '',
        celular_1: (colaborador?.celular_1 as string) ?? '',
        celular_2: (colaborador?.celular_2 as string) ?? '',
        correo: (colaborador?.correo as string) ?? '',
        estado_civil: (colaborador?.estado_civil as string) ?? '',
        estado_civil_otro: (colaborador?.estado_civil_otro as string) ?? '',

        // Información personal
        nombre_pareja: (colaborador?.nombre_pareja as string) ?? '',

        // Contactos de emergencia
        emergencia_parentezco_1: (colaborador?.emergencia_parentezco_1 as string) ?? '',
        emergencia_nombre_1: (colaborador?.emergencia_nombre_1 as string) ?? '',
        emergencia_telefono_1: (colaborador?.emergencia_telefono_1 as string) ?? '',
        emergencia_parentezco_2: (colaborador?.emergencia_parentezco_2 as string) ?? '',
        emergencia_nombre_2: (colaborador?.emergencia_nombre_2 as string) ?? '',
        emergencia_telefono_2: (colaborador?.emergencia_telefono_2 as string) ?? '',

        discapacidad: (colaborador?.discapacidad as Paso1FormData['discapacidad']) ?? '',
        discapacidad_tipo: (colaborador?.discapacidad_tipo as string) ?? '',
        discapacidad_observaciones: (colaborador?.discapacidad_observaciones as string) ?? '',
        victima_conflicto: (colaborador?.victima_conflicto as Paso1FormData['victima_conflicto']) ?? '',
        victima_conflicto_observaciones: (colaborador?.victima_conflicto_observaciones as string) ?? '',
        libreta_militar: (colaborador?.libreta_militar as Paso1FormData['libreta_militar']) ?? '',
        runt_aplica: (colaborador?.runt_aplica as Paso1FormData['runt_aplica']) ?? '',

        eps: (colaborador?.eps as string) ?? '',
        eps_otro: (colaborador?.eps_otro as string) ?? '',
        afp: (colaborador?.afp as string) ?? '',
        afp_otro: (colaborador?.afp_otro as string) ?? '',
        arl: (colaborador?.arl as string) ?? 'ARL SURA',
        arl_otro: (colaborador?.arl_otro as string) ?? '',

        documento_tipo_identificacion: [],
        documento_libreta_militar: [],
        documento_eps: [],
        documento_pension: [],
        documento_arl: [],
        documento_runt: [],
    });

    const edadCalculada = useMemo(() => calcularEdad(data.fecha_nacimiento), [data.fecha_nacimiento]);

    // ── Hijos (lista dinámica) ───────────────────────────────────────────────
    type Hijo = { nombre: string; fecha_nacimiento: string; edad: string };

    const calcularEdadHijo = (fechaNac: string): string => {
        if (!fechaNac) return '';
        const nac = new Date(fechaNac);
        if (isNaN(nac.getTime())) return '';
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        const aun = hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate());
        if (aun) edad -= 1;
        return edad >= 0 ? String(edad) : '';
    };
    const [hijosList, setHijosList] = useState<Hijo[]>(
        Array.isArray(colaborador?.hijos) ? (colaborador.hijos as Hijo[]) : [],
    );

    const agregarHijo = () => setHijosList((prev) => [...prev, { nombre: '', fecha_nacimiento: '', edad: '' }]);
    const removerHijo = (index: number) => setHijosList((prev) => prev.filter((_, i) => i !== index));
    const actualizarHijo = (index: number, campo: keyof Hijo, valor: string) =>
        setHijosList((prev) => prev.map((h, i) => (i === index ? { ...h, [campo]: valor } : h)));

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const conHijos = (formData: Record<string, unknown>) => ({
            ...formData,
            hijos: hijosList.filter((h) => h.nombre.trim() || h.edad.trim()),
        });

        if (esNuevo) {
            transform(conHijos);
            post(route('gente.colaboradores.store'), { forceFormData: true });
            return;
        }

        transform((formData) => ({ ...conHijos(formData), _method: 'PATCH' }));
        post(route('gente.colaboradores.paso1.update', colaborador.id), { forceFormData: true });
    };

    const existing = (key: string) => (colaborador?.[key] as { path: string; fecha: string | null }[]) ?? [];

    return (
        <form onSubmit={submit} className="grid gap-6">
            <SeccionCard icon={IdCard} titulo="Identificación" subtitulo="Documento de identidad del colaborador" tono="verde">
                <div className="mb-5 flex justify-center">
                    <PhotoUploader
                        file={data.imagen}
                        existingPath={(colaborador?.imagen as string | null | undefined) ?? null}
                        onChange={(file) => setData('imagen', file)}
                        error={errors.imagen}
                        disabled={processing}
                    />
                </div>
                <div className="flex-1 grid gap-4 sm:grid-cols-3 content-start">
                    <div className="grid gap-2">
                        <Label htmlFor="tipo_documento">Tipo de documento <span className="text-red-600">*</span></Label>
                        <Select
                            value={data.tipo_documento}
                            onValueChange={(value) => setData('tipo_documento', value)}
                            disabled={processing}
                        >
                            <SelectTrigger id="tipo_documento">
                                <SelectValue placeholder="Selecciona el tipo de documento" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.tiposDocumento.map((tipo) => (
                                    <SelectItem key={tipo} value={tipo}>
                                        {tipo}
                                    </SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem value="Otro" className="text-sky-600 font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <Plus className="size-3.5" />
                                        Agregar otro…
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.tipo_documento} />

                        {data.tipo_documento === 'Otro' && (
                            <div className="grid gap-1.5 border-l-2 border-sky-300 pl-3 dark:border-sky-500/30">
                                <Input
                                    placeholder="Escribe el tipo de documento"
                                    value={data.tipo_documento_otro_label}
                                    onChange={(e) => setData('tipo_documento_otro_label', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.tipo_documento_otro_label} />
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cedula">
                            Número de documento <span className="text-red-600">*</span>
                        </Label>
                        <Input id="cedula" value={data.cedula} onChange={(e) => setData('cedula', e.target.value)} disabled={processing} required autoFocus={esNuevo} />
                        <InputError message={errors.cedula} />
                    </div>
                    <DepartamentoCiudadSelect
                        label="Expedido en"
                        value={data.expedido_en}
                        onValueChange={(value) => setData('expedido_en', value)}
                        error={errors.expedido_en}
                        disabled={processing}
                    />
                </div>
                <div className="mt-4">
                    <SimpleFileField
                        label="Archivo del documento (si aplica)"
                        files={data.documento_tipo_identificacion}
                        existing={existing('documento_tipo_identificacion')}
                        onChange={(files) => setData('documento_tipo_identificacion', files)}
                        error={errorDeArchivo(errors, 'documento_tipo_identificacion')}
                        disabled={processing}
                    />
                </div>
            </SeccionCard>

            <SeccionCard icon={User} titulo="Datos básicos" subtitulo="Nombres, sexo y fecha de nacimiento" tono="verde">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="nombres">
                            Nombres <span className="text-red-600">*</span>
                        </Label>
                        <Input id="nombres" value={data.nombres} onChange={(e) => setData('nombres', e.target.value)} disabled={processing} required />
                        <InputError message={errors.nombres} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="apellidos">
                            Apellidos <span className="text-red-600">*</span>
                        </Label>
                        <Input id="apellidos" value={data.apellidos} onChange={(e) => setData('apellidos', e.target.value)} disabled={processing} required />
                        <InputError message={errors.apellidos} />
                    </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <PillToggle
                        label="Sexo"
                        value={data.sexo}
                        onChange={(value) => setData('sexo', value)}
                        disabled={processing}
                        options={[
                            { value: 'femenino', label: 'Femenino' },
                            { value: 'masculino', label: 'Masculino' },
                        ]}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
                        <Input id="fecha_nacimiento" type="date" value={data.fecha_nacimiento} onChange={(e) => setData('fecha_nacimiento', e.target.value)} disabled={processing} />
                        <InputError message={errors.fecha_nacimiento} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Edad</Label>
                        <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">{edadCalculada}</div>
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={MapPin} titulo="Contacto y ubicación" tono="azul">
                <div className="grid gap-4 sm:grid-cols-3">
                    <DepartamentoCiudadSelect
                        label="Ciudad de residencia"
                        value={data.ciudad_residencia}
                        onValueChange={(value) => setData('ciudad_residencia', value)}
                        error={errors.ciudad_residencia}
                        disabled={processing}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="estrato">Estrato</Label>
                        <Select value={data.estrato} onValueChange={(value) => setData('estrato', value)} disabled={processing}>
                            <SelectTrigger id="estrato">
                                <SelectValue placeholder="Selecciona el estrato" />
                            </SelectTrigger>
                            <SelectContent>
                                {['1', '2', '3', '4', '5', '6'].map((estrato) => (
                                    <SelectItem key={estrato} value={estrato}>
                                        {estrato}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.estrato} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="direccion">Dirección</Label>
                        <Input id="direccion" value={data.direccion} onChange={(e) => setData('direccion', e.target.value)} disabled={processing} />
                        <InputError message={errors.direccion} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="celular_1">Celular 1</Label>
                        <Input
                            id="celular_1"
                            inputMode="numeric"
                            maxLength={10}
                            value={data.celular_1}
                            onChange={(e) => setData('celular_1', e.target.value.replace(/\D/g, ''))}
                            disabled={processing}
                        />
                        <InputError message={errors.celular_1} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="celular_2">Celular 2</Label>
                        <Input
                            id="celular_2"
                            inputMode="numeric"
                            maxLength={10}
                            value={data.celular_2}
                            onChange={(e) => setData('celular_2', e.target.value.replace(/\D/g, ''))}
                            disabled={processing}
                        />
                        <InputError message={errors.celular_2} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="correo">Correo electrónico</Label>
                        <Input id="correo" type="email" value={data.correo} onChange={(e) => setData('correo', e.target.value)} disabled={processing} />
                        <InputError message={errors.correo} />
                    </div>
                </div>
            </SeccionCard>

            {/* ── Información personal ── */}
            <SeccionCard icon={User} titulo="Información personal" tono="azul">
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="estado_civil">Estado civil</Label>
                        <Select value={data.estado_civil} onValueChange={(value) => setData('estado_civil', value)} disabled={processing}>
                            <SelectTrigger id="estado_civil">
                                <SelectValue placeholder="Selecciona el estado civil" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.estadosCiviles.map((estado) => (
                                    <SelectItem key={estado} value={estado}>
                                        {estado}
                                    </SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem value="Otro" className="text-sky-600 font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <Plus className="size-3.5" />
                                        Agregar otro…
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.estado_civil} />
                        {data.estado_civil === 'Otro' && (
                            <div className="grid gap-1.5 border-l-2 border-sky-300 pl-3 dark:border-sky-500/30">
                                <Input
                                    placeholder="Escribe el estado civil"
                                    value={data.estado_civil_otro}
                                    onChange={(e) => setData('estado_civil_otro', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.estado_civil_otro} />
                            </div>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nombre_pareja">Nombre del cónyuge o compañero(a) permanente</Label>
                        <Input
                            id="nombre_pareja"
                            value={data.nombre_pareja}
                            onChange={(e) => setData('nombre_pareja', e.target.value)}
                            disabled={processing}
                        />
                    </div>

                    {/* Tercera columna: Hijos (label + botón) */}
                    <div className="grid gap-2">
                        <Label>Hijos</Label>
                        <Button type="button" variant="outline" onClick={agregarHijo} disabled={processing} className="w-full">
                            <Plus className="size-4" />
                            Agregar hijo
                        </Button>
                    </div>
                    </div>

                    {/* Campos de hijos ya agregados (debajo, full width) */}
                    {hijosList.length > 0 && (
                        <div className="grid gap-3">
                            {hijosList.map((hijo, index) => (
                                <div key={index} className="grid grid-cols-3 items-end gap-3">
                                    <div className="grid gap-1">
                                        <Label className="text-xs text-muted-foreground">Nombre</Label>
                                        <Input
                                            value={hijo.nombre}
                                            onChange={(e) => actualizarHijo(index, 'nombre', e.target.value)}
                                            disabled={processing}
                                            placeholder="Nombre del hijo/a"
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-xs text-muted-foreground">Fecha de nacimiento</Label>
                                        <Input
                                            type="date"
                                            value={hijo.fecha_nacimiento}
                                            onChange={(e) => {
                                                const fn = e.target.value;
                                                const edadCalc = calcularEdadHijo(fn);
                                                setHijosList((prev) => prev.map((h, i) =>
                                                    i === index ? { ...h, fecha_nacimiento: fn, edad: edadCalc } : h
                                                ));
                                            }}
                                            disabled={processing}
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="grid flex-1 gap-1">
                                            <Label className="text-xs text-muted-foreground">
                                                Edad {hijo.fecha_nacimiento && <span className="text-muted-foreground/60">(calculada)</span>}
                                            </Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="120"
                                                value={hijo.edad}
                                                onChange={(e) => actualizarHijo(index, 'edad', e.target.value)}
                                                disabled={processing || !!hijo.fecha_nacimiento}
                                                placeholder="Edad"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removerHijo(index)}
                                            disabled={processing}
                                        >
                                            <Trash2 className="size-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SeccionCard>

            {/* ── Contactos de emergencia ── */}
            <SeccionCard icon={Phone} titulo="Contactos de emergencia" tono="azul">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="emergencia_parentezco_1">Parentezco 1</Label>
                        <Input
                            id="emergencia_parentezco_1"
                            value={data.emergencia_parentezco_1}
                            onChange={(e) => setData('emergencia_parentezco_1', e.target.value)}
                            disabled={processing}
                            placeholder="Ej: Esposo/a, Padre, Madre"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="emergencia_nombre_1">Nombre completo 1</Label>
                        <Input
                            id="emergencia_nombre_1"
                            value={data.emergencia_nombre_1}
                            onChange={(e) => setData('emergencia_nombre_1', e.target.value)}
                            disabled={processing}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="emergencia_telefono_1">Teléfono 1</Label>
                        <Input
                            id="emergencia_telefono_1"
                            inputMode="numeric"
                            value={data.emergencia_telefono_1}
                            onChange={(e) => setData('emergencia_telefono_1', e.target.value.replace(/\D/g, ''))}
                            disabled={processing}
                            placeholder="Número de teléfono"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="emergencia_parentezco_2">Parentezco 2</Label>
                        <Input
                            id="emergencia_parentezco_2"
                            value={data.emergencia_parentezco_2}
                            onChange={(e) => setData('emergencia_parentezco_2', e.target.value)}
                            disabled={processing}
                            placeholder="Ej: Esposo/a, Padre, Madre"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="emergencia_nombre_2">Nombre completo 2</Label>
                        <Input
                            id="emergencia_nombre_2"
                            value={data.emergencia_nombre_2}
                            onChange={(e) => setData('emergencia_nombre_2', e.target.value)}
                            disabled={processing}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="emergencia_telefono_2">Teléfono 2</Label>
                        <Input
                            id="emergencia_telefono_2"
                            inputMode="numeric"
                            value={data.emergencia_telefono_2}
                            onChange={(e) => setData('emergencia_telefono_2', e.target.value.replace(/\D/g, ''))}
                            disabled={processing}
                            placeholder="Número de teléfono"
                        />
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={ShieldCheck} titulo="Condiciones particulares" tono="verde">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-3">
                        <PillToggle
                            label="Discapacidad"
                            value={data.discapacidad}
                            onChange={(value) => setData('discapacidad', value)}
                            disabled={processing}
                            options={[{ value: 'no_aplica', label: 'No aplica' }, { value: 'aplica', label: 'Aplica' }]}
                        />
                        {data.discapacidad === 'aplica' && (
                            <div className="grid gap-2 border-l-2 border-emerald-300 pl-3 dark:border-emerald-500/30">
                                <Input
                                    placeholder="Tipo de discapacidad"
                                    value={data.discapacidad_tipo}
                                    onChange={(e) => setData('discapacidad_tipo', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.discapacidad_tipo} />
                                <Textarea
                                    placeholder="Observaciones"
                                    value={data.discapacidad_observaciones}
                                    onChange={(e) => setData('discapacidad_observaciones', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.discapacidad_observaciones} />
                            </div>
                        )}
                    </div>
                    <div className="grid gap-3">
                        <PillToggle
                            label="Víctima de conflicto"
                            value={data.victima_conflicto}
                            onChange={(value) => setData('victima_conflicto', value)}
                            disabled={processing}
                            options={[{ value: 'no', label: 'No aplica' }, { value: 'si', label: 'Aplica' }]}
                        />
                        {data.victima_conflicto === 'si' && (
                            <div className="grid gap-2 border-l-2 border-emerald-300 pl-3 dark:border-emerald-500/30">
                                <Textarea
                                    placeholder="Observaciones"
                                    value={data.victima_conflicto_observaciones}
                                    onChange={(e) => setData('victima_conflicto_observaciones', e.target.value)}
                                    disabled={processing}
                                />
                                <InputError message={errors.victima_conflicto_observaciones} />
                            </div>
                        )}
                    </div>
                    <div className="grid gap-3">
                        <PillToggle
                            label="Libreta militar"
                            value={data.libreta_militar}
                            onChange={(value) => setData('libreta_militar', value)}
                            disabled={processing}
                            options={[{ value: 'no_aplica', label: 'No aplica' }, { value: 'aplica', label: 'Aplica' }]}
                        />
                        {data.libreta_militar === 'aplica' && (
                            <SimpleFileField
                                files={data.documento_libreta_militar}
                                existing={existing('documento_libreta_militar')}
                                onChange={(files) => setData('documento_libreta_militar', files)}
                                error={errorDeArchivo(errors, 'documento_libreta_militar')}
                                disabled={processing}
                            />
                        )}
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={Stethoscope} titulo="Seguridad social" subtitulo="EPS, AFP y ARL" tono="azul">
                <div className="grid gap-6 sm:grid-cols-3">
                    <SelectConOtro
                        id="eps"
                        label="EPS"
                        options={catalogos.epsOpciones}
                        value={data.eps}
                        otroValue={data.eps_otro}
                        onValueChange={(value) => setData('eps', value)}
                        onOtroChange={(value) => setData('eps_otro', value)}
                        archivoFiles={data.documento_eps}
                        onArchivoChange={(files) => setData('documento_eps', files)}
                        existingDocumentos={existing('documento_eps')}
                        error={errors.eps}
                        otroError={errors.eps_otro}
                        disabled={processing}
                    />
                    <SelectConOtro
                        id="afp"
                        label="AFP"
                        options={catalogos.afpOpciones}
                        value={data.afp}
                        otroValue={data.afp_otro}
                        onValueChange={(value) => setData('afp', value)}
                        onOtroChange={(value) => setData('afp_otro', value)}
                        archivoFiles={data.documento_pension}
                        onArchivoChange={(files) => setData('documento_pension', files)}
                        existingDocumentos={existing('documento_pension')}
                        error={errors.afp}
                        otroError={errors.afp_otro}
                        disabled={processing}
                    />
                    <SelectConOtro
                        id="arl"
                        label="ARL"
                        options={catalogos.arlOpciones}
                        value={data.arl}
                        otroValue={data.arl_otro}
                        onValueChange={(value) => setData('arl', value)}
                        onOtroChange={(value) => setData('arl_otro', value)}
                        archivoFiles={data.documento_arl}
                        onArchivoChange={(files) => setData('documento_arl', files)}
                        existingDocumentos={existing('documento_arl')}
                        error={errors.arl}
                        otroError={errors.arl_otro}
                        disabled={processing}
                    />
                </div>
            </SeccionCard>

            <div className="hidden">
                {usuarios && (
                    <SeccionCard icon={UserCog} titulo="Usuario del sistema" subtitulo="Corrige el vínculo con la cuenta del portal si es necesario" tono="azul">
                        <div className="grid gap-2 sm:max-w-md">
                            <Label htmlFor="user_id">Cuenta de colaborador</Label>
                            <Select value={data.user_id || 'none'} onValueChange={(value) => setData('user_id', value === 'none' ? '' : value)} disabled={processing}>
                                <SelectTrigger id="user_id">
                                    <SelectValue placeholder="Sin vincular" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin vincular</SelectItem>
                                    {usuarios.map((usuario) => (
                                        <SelectItem key={usuario.id} value={String(usuario.id)}>
                                            {usuario.name} · {usuario.identification_number}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.user_id} />
                        </div>
                    </SeccionCard>
                )}
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={processing}>
                    {processing && <LoaderCircle className="size-4 animate-spin" />}
                    Siguiente
                    <ArrowRight className="size-4" />
                </Button>
            </div>
        </form>
    );
}
