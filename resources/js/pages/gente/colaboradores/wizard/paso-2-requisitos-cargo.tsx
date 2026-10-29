import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PillToggle, SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Award, History, LoaderCircle, Mountain } from 'lucide-react';
import { FormEventHandler } from 'react';
import { SimpleFileField } from './components/simple-file-field';
import { type WizardCatalogos } from './catalogos';
import { type ColaboradorRecord, type Paso2FormData } from './types';
import { errorDeArchivo } from './utils';

interface Paso2Props {
    colaborador: ColaboradorRecord;
    catalogos: WizardCatalogos;
    onBack: () => void;
}

export function Paso2RequisitosCargo({ colaborador, catalogos, onBack }: Paso2Props) {
    const tieneDatosPreviosCentroContrato = Boolean(
        colaborador.fecha_retiro_empresa ||
        colaborador.motivo_retiro ||
        colaborador.motivo_retiro_observaciones ||
        colaborador.cargo_anterior ||
        (colaborador.cargo && colaborador.fecha_retiro_empresa)
    );

    const valorHaTrabajadoAntes = (colaborador.ha_trabajado_antes as Paso2FormData['ha_trabajado_antes'])
        || (tieneDatosPreviosCentroContrato ? 'si' : '');

    const valorCargoAnterior = (colaborador.cargo_anterior as string)
        || (colaborador.cargo as string)
        || '';

    const valorFechaUltimaLaboral = (colaborador.fecha_ultima_laboral as string)
        || (colaborador.fecha_retiro_empresa as string)
        || '';

    const valorMotivoRetiro = (colaborador.motivo_retiro as string) || '';
    const valorMotivoRetiroObs = (colaborador.motivo_retiro_observaciones as string) || '';

    const { data, setData, post, processing, errors, transform } = useForm<Paso2FormData>({
        ha_trabajado_antes: valorHaTrabajadoAntes,
        cargo_anterior: valorCargoAnterior,
        fecha_ultima_laboral: valorFechaUltimaLaboral,
        motivo_retiro: valorMotivoRetiro,
        motivo_retiro_observaciones: valorMotivoRetiroObs,

        tiene_experiencia: (colaborador.tiene_experiencia as Paso2FormData['tiene_experiencia']) ?? '',
        anios_experiencia: colaborador.anios_experiencia?.toString() ?? '',

        manejo_defensivo_aplica: (colaborador.manejo_defensivo_aplica as Paso2FormData['manejo_defensivo_aplica']) ?? '',
        conduccion_carga_pesada_aplica: (colaborador.conduccion_carga_pesada_aplica as Paso2FormData['conduccion_carga_pesada_aplica']) ?? '',
        experiencia_terreno_plano: (colaborador.experiencia_terreno_plano as Paso2FormData['experiencia_terreno_plano']) ?? '',
        experiencia_terreno_montanoso: (colaborador.experiencia_terreno_montanoso as Paso2FormData['experiencia_terreno_montanoso']) ?? '',

        documento_carnet_manejo_defensivo: [],
        documento_certificado_manejo_defensivo: [],
        documento_certificado_carga_pesada: [],
        documento_certificados_terreno_plano: [],
    });

    const existing = (key: string) => (colaborador[key] as { path: string; fecha: string | null }[]) ?? [];

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => ({ ...formData, _method: 'PATCH' }));
        post(route('gente.colaboradores.paso2.update', colaborador.id), { forceFormData: true });
    };

    return (
        <form onSubmit={submit} className="grid gap-6">
            <SeccionCard icon={History} titulo="Antecedentes en la empresa" subtitulo="¿Ha trabajado anteriormente en la empresa?" tono="verde">
                <PillToggle
                    label=""
                    value={data.ha_trabajado_antes}
                    onChange={(value) => setData('ha_trabajado_antes', value)}
                    disabled={processing}
                    options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
                />
                {data.ha_trabajado_antes === 'si' && (
                    <div className="mt-4 grid gap-4 border-l-2 border-emerald-300 pl-4 sm:grid-cols-2 dark:border-emerald-500/30">
                        <div className="grid gap-2">
                            <Label htmlFor="cargo_anterior">Cargo desempeñado</Label>
                            <Input id="cargo_anterior" value={data.cargo_anterior} onChange={(e) => setData('cargo_anterior', e.target.value)} disabled={processing} />
                            <InputError message={errors.cargo_anterior} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="fecha_ultima_laboral">Fecha del último día laborado</Label>
                            <Input id="fecha_ultima_laboral" type="date" value={data.fecha_ultima_laboral} onChange={(e) => setData('fecha_ultima_laboral', e.target.value)} disabled={processing} />
                            <InputError message={errors.fecha_ultima_laboral} />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="motivo_retiro">Motivo de retiro</Label>
                            <Select value={data.motivo_retiro} onValueChange={(value) => setData('motivo_retiro', value)} disabled={processing}>
                                <SelectTrigger id="motivo_retiro">
                                    <SelectValue placeholder="Selecciona el motivo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {catalogos.motivosRetiro.map((motivo) => (
                                        <SelectItem key={motivo} value={motivo}>
                                            {motivo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.motivo_retiro} />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="motivo_retiro_observaciones">Observaciones</Label>
                            <Textarea
                                id="motivo_retiro_observaciones"
                                value={data.motivo_retiro_observaciones}
                                onChange={(e) => setData('motivo_retiro_observaciones', e.target.value)}
                                placeholder="Observaciones sobre el motivo de retiro..."
                                disabled={processing}
                                rows={3}
                            />
                            <InputError message={errors.motivo_retiro_observaciones} />
                        </div>
                    </div>
                )}
            </SeccionCard>

            <SeccionCard icon={Award} titulo="Requerimientos del cargo" tono="azul">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-3">
                        <PillToggle
                            label="Manejo defensivo y preventivo"
                            value={data.manejo_defensivo_aplica}
                            onChange={(value) => setData('manejo_defensivo_aplica', value)}
                            disabled={processing}
                            options={[{ value: 'no_aplica', label: 'No aplica' }, { value: 'aplica', label: 'Sí aplica' }]}
                        />
                        {data.manejo_defensivo_aplica === 'aplica' && (
                            <SimpleFileField
                                files={data.documento_carnet_manejo_defensivo}
                                existing={existing('documento_carnet_manejo_defensivo')}
                                onChange={(files) => setData('documento_carnet_manejo_defensivo', files)}
                                error={errorDeArchivo(errors, 'documento_carnet_manejo_defensivo')}
                                disabled={processing}
                            />
                        )}
                    </div>
                    <div className="grid gap-3">
                        <PillToggle
                            label="Certificado de conducción de carga pesada"
                            value={data.conduccion_carga_pesada_aplica}
                            onChange={(value) => setData('conduccion_carga_pesada_aplica', value)}
                            disabled={processing}
                            options={[{ value: 'no_aplica', label: 'No aplica' }, { value: 'aplica', label: 'Sí aplica' }]}
                        />
                        {data.conduccion_carga_pesada_aplica === 'aplica' && (
                            <SimpleFileField
                                files={data.documento_certificado_carga_pesada}
                                existing={existing('documento_certificado_carga_pesada')}
                                onChange={(files) => setData('documento_certificado_carga_pesada', files)}
                                error={errorDeArchivo(errors, 'documento_certificado_carga_pesada')}
                                disabled={processing}
                            />
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="anios_experiencia">Experiencia laboral (años)</Label>
                        <Input id="anios_experiencia" type="number" min="0" value={data.anios_experiencia} onChange={(e) => setData('anios_experiencia', e.target.value)} disabled={processing} />
                        <InputError message={errors.anios_experiencia} />
                    </div>
                    <PillToggle
                        label="¿Tiene experiencia previa relevante?"
                        value={data.tiene_experiencia}
                        onChange={(value) => setData('tiene_experiencia', value)}
                        disabled={processing}
                        options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
                    />
                </div>
            </SeccionCard>

            <SeccionCard icon={Mountain} titulo="Experiencia en terreno" tono="verde">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-3">
                        <PillToggle
                            label="Experiencia en terreno plano"
                            value={data.experiencia_terreno_plano}
                            onChange={(value) => setData('experiencia_terreno_plano', value)}
                            disabled={processing}
                            options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
                        />
                        {data.experiencia_terreno_plano === 'si' && (
                            <SimpleFileField
                                label="Certificados laborales"
                                files={data.documento_certificados_terreno_plano}
                                existing={existing('documento_certificados_terreno_plano')}
                                onChange={(files) => setData('documento_certificados_terreno_plano', files)}
                                error={errorDeArchivo(errors, 'documento_certificados_terreno_plano')}
                                disabled={processing}
                            />
                        )}
                    </div>
                    <PillToggle
                        label="Experiencia en terreno montañoso / curvas"
                        value={data.experiencia_terreno_montanoso}
                        onChange={(value) => setData('experiencia_terreno_montanoso', value)}
                        disabled={processing}
                        options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
                    />
                </div>
            </SeccionCard>

            <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
                    <ArrowLeft className="size-4" />
                    Anterior
                </Button>
                <Button type="submit" disabled={processing}>
                    {processing && <LoaderCircle className="size-4 animate-spin" />}
                    Siguiente
                    <ArrowRight className="size-4" />
                </Button>
            </div>
        </form>
    );
}
