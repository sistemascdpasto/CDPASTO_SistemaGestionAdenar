import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useId, useState } from 'react';

type Opcion = { id: number; nombre: string };

interface DepartamentoCiudadSelectProps {
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
}

/**
 * Selector encadenado Departamento → Ciudad/Municipio, respaldado por
 * api-colombia.com (vía ReferenciaExternaController). Solo la ciudad es el
 * valor real del campo (p. ej. "expedido_en", "ciudad_residencia"); el
 * departamento es únicamente el filtro que decide qué municipios ofrecer.
 *
 * Al editar, si hay un valor guardado, se consulta el departamento al que
 * pertenece la ciudad para precargar el campo de departamento.
 */
export function DepartamentoCiudadSelect({ label, value, onValueChange, error, disabled }: DepartamentoCiudadSelectProps) {
    const baseId = useId();
    const [departamentos, setDepartamentos] = useState<Opcion[]>([]);
    const [departamentoInput, setDepartamentoInput] = useState('');
    const [ciudades, setCiudades] = useState<Opcion[]>([]);

    // Carga la lista de departamentos.
    useEffect(() => {
        let cancelado = false;

        fetch(route('gente.colaboradores.referencias.departamentos'), { headers: { Accept: 'application/json' } })
            .then((response) => response.json())
            .then((json: { data?: Opcion[] }) => {
                if (!cancelado) setDepartamentos(json.data ?? []);
            })
            .catch(() => {
                if (!cancelado) setDepartamentos([]);
            });

        return () => {
            cancelado = true;
        };
    }, []);

    // Al montar con un valor guardado (edición), busca el departamento al
    // que pertenece la ciudad para precargarlo.
    useEffect(() => {
        if (!value || departamentoInput) return;

        let cancelado = false;

        fetch(route('gente.colaboradores.referencias.buscar-departamento', { ciudad: value }), {
            headers: { Accept: 'application/json' },
        })
            .then((response) => response.json())
            .then((json: { data?: Opcion | null }) => {
                if (!cancelado && json.data) {
                    setDepartamentoInput(json.data.nombre);
                }
            })
            .catch(() => {
                // Fallo silencioso: el campo de ciudad ya muestra el valor.
            });

        return () => {
            cancelado = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const departamentoSeleccionado = departamentos.find((d) => d.nombre.toLowerCase() === departamentoInput.trim().toLowerCase());

    useEffect(() => {
        if (!departamentoSeleccionado) {
            setCiudades([]);
            return;
        }

        let cancelado = false;

        fetch(route('gente.colaboradores.referencias.ciudades', { departamento_id: departamentoSeleccionado.id }), {
            headers: { Accept: 'application/json' },
        })
            .then((response) => response.json())
            .then((json: { data?: Opcion[] }) => {
                if (!cancelado) setCiudades(json.data ?? []);
            })
            .catch(() => {
                if (!cancelado) setCiudades([]);
            });

        return () => {
            cancelado = true;
        };
    }, [departamentoSeleccionado]);

    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Input
                        id={`${baseId}-departamento`}
                        list={`${baseId}-departamentos`}
                        value={departamentoInput}
                        onChange={(e) => setDepartamentoInput(e.target.value)}
                        placeholder="Departamento"
                        autoComplete="off"
                        disabled={disabled}
                    />
                    <datalist id={`${baseId}-departamentos`}>
                        {departamentos.map((departamento) => (
                            <option key={departamento.id} value={departamento.nombre} />
                        ))}
                    </datalist>
                </div>
                <div>
                    <Input
                        id={`${baseId}-ciudad`}
                        list={`${baseId}-ciudades`}
                        value={value}
                        onChange={(e) => onValueChange(e.target.value)}
                        placeholder={departamentoSeleccionado ? 'Ciudad / Municipio' : 'Elige primero el departamento'}
                        autoComplete="off"
                        disabled={disabled}
                    />
                    <datalist id={`${baseId}-ciudades`}>
                        {ciudades.map((ciudad) => (
                            <option key={ciudad.id} value={ciudad.nombre} />
                        ))}
                    </datalist>
                </div>
            </div>
            <InputError message={error} />
        </div>
    );
}
