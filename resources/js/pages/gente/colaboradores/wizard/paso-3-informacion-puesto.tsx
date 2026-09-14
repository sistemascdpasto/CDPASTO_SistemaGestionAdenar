import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PillToggle, SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Briefcase, Building2, History, LoaderCircle, QrCode, Umbrella } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FormEventHandler } from 'react';
import { CargoCombobox } from './components/cargo-combobox';
import { type WizardCatalogos } from './catalogos';
import { type ColaboradorRecord, type Paso3FormData } from './types';

const hoyISO = new Date().toISOString().slice(0, 10);

/**
 * Restringe el selector a "hoy en adelante" para fechas nuevas, pero sin
 * bloquear una fecha histórica que el colaborador ya tenía guardada — si no,
 * reabrir un contrato o unas vacaciones ya vencidas impide avanzar el wizard.
 */
function minDateFor(valorGuardado: unknown): string {
    const valor = typeof valorGuardado === 'string' ? valorGuardado : null;
    return valor && valor < hoyISO ? valor : hoyISO;
}

type HistorialCargo = {
    id: number;
    cargo: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    estado: 'ACTIVO' | 'INACTIVO';
};

interface Paso3Props {
    colaborador: ColaboradorRecord;
    catalogos: WizardCatalogos;
    historialCargos: HistorialCargo[];
    onBack: () => void;
}

export function Paso3InformacionPuesto({ colaborador, catalogos, historialCargos, onBack }: Paso3Props) {
    const cargoActivo = historialCargos.find((h) => h.estado === 'ACTIVO');
    // El cargo con el que arrancó el formulario — no el del historial, que
    // muchos colaboradores reales no tienen (ej. los cargados por Excel). Si
    // se comparara contra el historial, a esos colaboradores les aparecía el
    // campo de "nuevo cargo" como si el usuario lo hubiera cambiado sin
    // tocar nada, y el paso 3 quedaba bloqueado pidiendo una fecha que no
    // correspondía a ningún cambio real.
    const cargoInicial = (colaborador.cargo as string) ?? '';

    const { data, setData, post, processing, errors, transform } = useForm<Paso3FormData>({
        area: (colaborador.area as Paso3FormData['area']) ?? '',
        cargo: (colaborador.cargo as string) ?? '',
        cargo_fecha_inicio: '',

        centro: (colaborador.centro as string) ?? '',
        centro_trabajo: (colaborador.centro_trabajo as string) ?? '',
        fecha_ingreso_empresa: (colaborador.fecha_ingreso_empresa as string) ?? '',
        fecha_retiro_empresa: (colaborador.fecha_retiro_empresa as string) ?? '',
        motivo_retiro: (colaborador.motivo_retiro as string) ?? '',
        tipo_contrato: (colaborador.tipo_contrato as string) ?? '',
        contrato_fecha_desde: (colaborador.contrato_fecha_desde as string) ?? '',
        contrato_fecha_hasta: (colaborador.contrato_fecha_hasta as string) ?? '',

        codigo_qr_skap: (colaborador.codigo_qr_skap as string) ?? '',

        vacaciones_aplica: (colaborador.vacaciones_aplica as Paso3FormData['vacaciones_aplica']) ?? '',
        vacaciones_fecha_desde: (colaborador.vacaciones_fecha_desde as string) ?? '',
        vacaciones_fecha_hasta: (colaborador.vacaciones_fecha_hasta as string) ?? '',
        vacaciones_pagadas_fecha_desde: (colaborador.vacaciones_pagadas_fecha_desde as string) ?? '',
        vacaciones_pagadas_fecha_hasta: (colaborador.vacaciones_pagadas_fecha_hasta as string) ?? '',
    });

    const cambioDeCargo = data.cargo !== '' && data.cargo !== cargoInicial;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => ({ ...formData, _method: 'PATCH' }));
        post(route('gente.colaboradores.paso3.update', colaborador.id), { forceFormData: true });
    };

    return (
        <form onSubmit={submit} className="grid gap-6">
            <SeccionCard icon={Briefcase} titulo="Cargo y área" tono="verde">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="area">Área</Label>
                        <Select value={data.area} onValueChange={(value) => setData('area', value as Paso3FormData['area'])} disabled={processing}>
                            <SelectTrigger id="area">
                                <SelectValue placeholder="Selecciona el área" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Administrativa">Administrativa</SelectItem>
                                <SelectItem value="Operativa">Operativa</SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.area} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cargo">Cargo</Label>
                        <CargoCombobox
                            id="cargo"
                            value={data.cargo}
                            onChange={(value) => setData('cargo', value)}
                            cargos={catalogos.cargos}
                            disabled={processing}
                        />
                        <InputError message={errors.cargo} />
                    </div>
                    {cambioDeCargo && (
                        <div className="grid gap-2 sm:col-span-2 border-l-2 border-emerald-300 pl-3 dark:border-emerald-500/30">
                            <Label htmlFor="cargo_fecha_inicio">Fecha de inicio del nuevo cargo</Label>
                            <Input
                                id="cargo_fecha_inicio"
                                type="date"
                                value={data.cargo_fecha_inicio}
                                onChange={(e) => setData('cargo_fecha_inicio', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.cargo_fecha_inicio} />
                            <p className="text-xs text-muted-foreground">
                                {cargoActivo
                                    ? `El cargo actual ("${cargoActivo.cargo}") se cerrará automáticamente un día antes de esta fecha.`
                                    : 'Se creará el primer registro de historial de cargos con esta fecha.'}
                            </p>
                        </div>
                    )}
                </div>

                {historialCargos.length > 0 && (
                    <div className="mt-4 grid gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <History className="size-3.5" />
                            Historial de cargos
                        </div>
                        <div className="grid gap-1.5">
                            {historialCargos.map((h) => (
                                <div key={h.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                                    <span className="font-medium text-foreground">{h.cargo}</span>
                                    <span className="text-muted-foreground">
                                        {h.fecha_inicio} — {h.fecha_fin ?? 'actual'}
                                    </span>
                                    <span className={h.estado === 'ACTIVO' ? 'text-emerald-600' : 'text-muted-foreground'}>{h.estado}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </SeccionCard>

            <SeccionCard icon={Building2} titulo="Centro y contrato" tono="azul">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="centro">Centro</Label>
                        <Select value={data.centro} onValueChange={(value) => setData('centro', value)} disabled={processing}>
                            <SelectTrigger id="centro">
                                <SelectValue placeholder="Selecciona el centro" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.centros.map((centro) => (
                                    <SelectItem key={centro} value={centro}>
                                        {centro}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.centro} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="centro_trabajo">Centro de trabajo</Label>
                        <Select value={data.centro_trabajo} onValueChange={(value) => setData('centro_trabajo', value)} disabled={processing}>
                            <SelectTrigger id="centro_trabajo">
                                <SelectValue placeholder="Selecciona el centro de trabajo" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.centrosTrabajo.map((centro) => (
                                    <SelectItem key={centro} value={centro}>
                                        {centro}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.centro_trabajo} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_ingreso_empresa">Fecha de ingreso a la empresa</Label>
                        <Input id="fecha_ingreso_empresa" type="date" value={data.fecha_ingreso_empresa} onChange={(e) => setData('fecha_ingreso_empresa', e.target.value)} disabled={processing} />
                        <InputError message={errors.fecha_ingreso_empresa} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_retiro_empresa">Fecha de retiro de la empresa</Label>
                        <Input
                            id="fecha_retiro_empresa"
                            type="date"
                            min={minDateFor(colaborador.fecha_retiro_empresa)}
                            value={data.fecha_retiro_empresa}
                            onChange={(e) => setData('fecha_retiro_empresa', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_retiro_empresa} />
                    </div>
                    {data.fecha_retiro_empresa && (
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
                    )}
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="tipo_contrato">Tipo de contrato</Label>
                        <Select value={data.tipo_contrato} onValueChange={(value) => setData('tipo_contrato', value)} disabled={processing}>
                            <SelectTrigger id="tipo_contrato">
                                <SelectValue placeholder="Selecciona el tipo de contrato" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogos.tiposContrato.map((tipo) => (
                                    <SelectItem key={tipo} value={tipo}>
                                        {tipo}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.tipo_contrato} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="contrato_fecha_desde">Tiempo de contrato — desde</Label>
                        <Input id="contrato_fecha_desde" type="date" value={data.contrato_fecha_desde} onChange={(e) => setData('contrato_fecha_desde', e.target.value)} disabled={processing} />
                        <InputError message={errors.contrato_fecha_desde} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="contrato_fecha_hasta">Tiempo de contrato — hasta</Label>
                        <Input id="contrato_fecha_hasta" type="date" min={minDateFor(colaborador.contrato_fecha_hasta)} value={data.contrato_fecha_hasta} onChange={(e) => setData('contrato_fecha_hasta', e.target.value)} disabled={processing} />
                        <InputError message={errors.contrato_fecha_hasta} />
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={QrCode} titulo="Código QR SKAP" tono="verde">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="grid w-full max-w-xs gap-2">
                        <Label htmlFor="codigo_qr_skap">Número de código</Label>
                        <Input
                            id="codigo_qr_skap"
                            value={data.codigo_qr_skap}
                            onChange={(e) => setData('codigo_qr_skap', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.codigo_qr_skap} />
                    </div>
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3">
                        {data.codigo_qr_skap ? (
                            <QRCodeSVG value={data.codigo_qr_skap} size={100} />
                        ) : (
                            <div className="flex size-[100px] items-center justify-center text-center text-xs text-muted-foreground">Sin código</div>
                        )}
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={Umbrella} titulo="Vacaciones" tono="azul">
                <div className="grid gap-4">
                    <PillToggle
                        label="Vacaciones"
                        value={data.vacaciones_aplica}
                        onChange={(value) => setData('vacaciones_aplica', value)}
                        disabled={processing}
                        options={[{ value: 'no_aplica', label: 'No aplica' }, { value: 'aplica', label: 'Aplica' }]}
                    />
                    {data.vacaciones_aplica === 'aplica' && (
                        <div className="grid gap-4 border-l-2 border-emerald-300 pl-4 sm:grid-cols-2 dark:border-emerald-500/30">
                            <div className="grid gap-2">
                                <Label htmlFor="vacaciones_fecha_desde">Fecha desde</Label>
                                <Input id="vacaciones_fecha_desde" type="date" min={minDateFor(colaborador.vacaciones_fecha_desde)} value={data.vacaciones_fecha_desde} onChange={(e) => setData('vacaciones_fecha_desde', e.target.value)} disabled={processing} />
                                <InputError message={errors.vacaciones_fecha_desde} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="vacaciones_fecha_hasta">Fecha hasta</Label>
                                <Input id="vacaciones_fecha_hasta" type="date" min={minDateFor(colaborador.vacaciones_fecha_hasta)} value={data.vacaciones_fecha_hasta} onChange={(e) => setData('vacaciones_fecha_hasta', e.target.value)} disabled={processing} />
                                <InputError message={errors.vacaciones_fecha_hasta} />
                            </div>
                        </div>
                    )}
                    <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="vacaciones_pagadas_fecha_desde">Vacaciones pagadas — desde</Label>
                            <Input
                                id="vacaciones_pagadas_fecha_desde"
                                type="date"
                                min={minDateFor(colaborador.vacaciones_pagadas_fecha_desde)}
                                value={data.vacaciones_pagadas_fecha_desde}
                                onChange={(e) => setData('vacaciones_pagadas_fecha_desde', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.vacaciones_pagadas_fecha_desde} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="vacaciones_pagadas_fecha_hasta">Vacaciones pagadas — hasta</Label>
                            <Input
                                id="vacaciones_pagadas_fecha_hasta"
                                type="date"
                                min={minDateFor(colaborador.vacaciones_pagadas_fecha_hasta)}
                                value={data.vacaciones_pagadas_fecha_hasta}
                                onChange={(e) => setData('vacaciones_pagadas_fecha_hasta', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.vacaciones_pagadas_fecha_hasta} />
                        </div>
                    </div>
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
