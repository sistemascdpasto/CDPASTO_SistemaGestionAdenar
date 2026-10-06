import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findModule } from '@/data/modules';

export interface ModuleRegistryEntry {
    key: string;
    label: string;
}

export type ModuleRegistry = Record<string, ModuleRegistryEntry[]>;

export interface UserFormData {
    first_name: string;
    last_name: string;
    identification_number: string;
    email: string;
    password: string;
    password_confirmation: string;
    roles: string[];
    is_active: boolean;
    modulos_personalizados: boolean;
    submodulos: Record<string, string[]>;
    [key: string]: string | string[] | boolean | Record<string, string[]>;
}

interface UserFormFieldsProps {
    data: UserFormData;
    setData: <K extends keyof UserFormData>(key: K, value: UserFormData[K]) => void;
    errors: Partial<Record<keyof UserFormData | `roles.${number}` | 'submodulos', string>>;
    availableRoles: string[];
    moduleRegistry: ModuleRegistry;
    showPassword: boolean;
    processing: boolean;
}

export function UserFormFields({ data, setData, errors, availableRoles, moduleRegistry, showPassword, processing }: UserFormFieldsProps) {
    const toggleRole = (role: string, checked: boolean) => {
        setData('roles', checked ? [...data.roles, role] : data.roles.filter((r) => r !== role));
    };

    const toggleSubmodulo = (moduleSlug: string, key: string, checked: boolean) => {
        const actuales = data.submodulos[moduleSlug] ?? [];
        const siguientes = checked ? [...actuales, key] : actuales.filter((k) => k !== key);
        setData('submodulos', { ...data.submodulos, [moduleSlug]: siguientes });
    };

    const marcarTodosDelModulo = (moduleSlug: string, entries: ModuleRegistryEntry[]) => {
        setData('submodulos', { ...data.submodulos, [moduleSlug]: entries.map((e) => e.key) });
    };

    const desmarcarTodosDelModulo = (moduleSlug: string) => {
        setData('submodulos', { ...data.submodulos, [moduleSlug]: [] });
    };

    return (
        <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="first_name">Nombres</Label>
                    <Input
                        id="first_name"
                        value={data.first_name}
                        onChange={(e) => setData('first_name', e.target.value)}
                        disabled={processing}
                        required
                        autoFocus
                    />
                    <InputError message={errors.first_name} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="last_name">Apellidos</Label>
                    <Input id="last_name" value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} disabled={processing} required />
                    <InputError message={errors.last_name} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="identification_number">Número de identificación</Label>
                    <Input
                        id="identification_number"
                        value={data.identification_number}
                        onChange={(e) => setData('identification_number', e.target.value)}
                        disabled={processing}
                        required
                    />
                    <InputError message={errors.identification_number} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="email">Correo electrónico (opcional)</Label>
                    <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} disabled={processing} />
                    <InputError message={errors.email} />
                </div>
            </div>

            {showPassword && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            disabled={processing}
                            required
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password_confirmation">Confirmar contraseña</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            disabled={processing}
                            required
                        />
                        <InputError message={errors.password_confirmation} />
                    </div>
                </div>
            )}

            <div className="grid gap-2">
                <Label>Roles</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                    {availableRoles.map((role) => (
                        <div key={role} className="flex items-center space-x-2">
                            <Checkbox
                                id={`role-${role}`}
                                checked={data.roles.includes(role)}
                                onCheckedChange={(checked) => toggleRole(role, checked === true)}
                                disabled={processing}
                            />
                            <Label htmlFor={`role-${role}`} className="font-normal">
                                {role}
                            </Label>
                        </div>
                    ))}
                </div>
                <InputError message={errors.roles} />
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="is_active"
                    checked={data.is_active}
                    onCheckedChange={(checked) => setData('is_active', checked === true)}
                    disabled={processing}
                />
                <Label htmlFor="is_active" className="font-normal">
                    Usuario activo
                </Label>
            </div>

            <div className="grid gap-3 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="modulos_personalizados"
                        checked={data.modulos_personalizados}
                        onCheckedChange={(checked) => setData('modulos_personalizados', checked === true)}
                        disabled={processing}
                    />
                    <Label htmlFor="modulos_personalizados" className="font-normal">
                        Personalizar a qué submódulos tiene acceso este usuario
                    </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    Por defecto, un usuario con un rol (ej. Reparto) tiene acceso a todas las funciones de ese rol. Activa esto para elegir
                    exactamente cuáles — las que dejes sin marcar quedan ocultas y bloqueadas para este usuario, aunque su rol normalmente las
                    permita.
                </p>

                {data.modulos_personalizados && (
                    <div className="mt-2 grid gap-4">
                        {Object.entries(moduleRegistry).map(([moduleSlug, entries]) => {
                            const mod = findModule(moduleSlug);
                            const seleccionados = data.submodulos[moduleSlug] ?? [];

                            return (
                                <div key={moduleSlug} className="grid gap-2 rounded-md border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-foreground">{mod?.title ?? moduleSlug}</p>
                                        <div className="flex gap-2 text-[11px]">
                                            <button
                                                type="button"
                                                className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                                onClick={() => marcarTodosDelModulo(moduleSlug, entries)}
                                                disabled={processing}
                                            >
                                                Marcar todos
                                            </button>
                                            <button
                                                type="button"
                                                className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                                onClick={() => desmarcarTodosDelModulo(moduleSlug)}
                                                disabled={processing}
                                            >
                                                Quitar todos
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5 sm:grid-cols-2">
                                        {entries.map((entry) => (
                                            <div key={entry.key} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`submodulo-${moduleSlug}-${entry.key}`}
                                                    checked={seleccionados.includes(entry.key)}
                                                    onCheckedChange={(checked) => toggleSubmodulo(moduleSlug, entry.key, checked === true)}
                                                    disabled={processing}
                                                />
                                                <Label htmlFor={`submodulo-${moduleSlug}-${entry.key}`} className="text-xs font-normal">
                                                    {entry.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        <InputError message={errors.submodulos} />
                    </div>
                )}
            </div>
        </div>
    );
}
