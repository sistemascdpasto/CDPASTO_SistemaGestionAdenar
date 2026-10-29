<?php

namespace App\Support\Seguridad;

/**
 * Única fuente de verdad de qué claves de `colaborador_documentos.campo`
 * (o columnas legacy de un solo archivo) existen por paso del wizard de
 * colaboradores (HU02). La usan tanto los Request classes (para las reglas
 * de validación) como ColaboradorController (para guardar/leer archivos),
 * así ambos lados siempre están de acuerdo.
 *
 * Las definiciones viven en config/seguridad/documentos_colaborador.php.
 */
class ColaboradorDocumentoCampos
{
    /**
     * Devuelve las claves (key) de los documentos que aplican a un paso dado.
     *
     * @return array<int, string>
     */
    public static function paso(int $paso): array
    {
        return collect(config('seguridad.documentos_colaborador.documentos', []))
            ->filter(fn (array $doc) => in_array($paso, $doc['pasos'], true))
            ->pluck('key')
            ->all();
    }

    /** Paso 1 — Datos personales. */
    public static function paso1(): array
    {
        return self::paso(1);
    }

    /** Paso 2 — Requisitos del cargo. */
    public static function paso2(): array
    {
        return self::paso(2);
    }

    /** Paso 3 — Puesto de trabajo. */
    public static function paso3(): array
    {
        return self::paso(3);
    }

    /** Paso 4 — Archivos digitales. */
    public static function paso4(): array
    {
        return self::paso(4);
    }

    /**
     * Todas las claves de documento conocidas, sin duplicados.
     *
     * @return array<int, string>
     */
    public static function todas(): array
    {
        return collect(config('seguridad.documentos_colaborador.documentos', []))
            ->pluck('key')
            ->unique()
            ->values()
            ->all();
    }
}
