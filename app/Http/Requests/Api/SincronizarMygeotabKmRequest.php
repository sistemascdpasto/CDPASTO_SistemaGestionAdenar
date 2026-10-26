<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class SincronizarMygeotabKmRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La autorización real la hace el middleware de ruta (mygeotab.token),
        // no un usuario autenticado — mismo criterio que las otras requests
        // de ingesta en App\Http\Requests\Api.
        return true;
    }

    public function rules(): array
    {
        return [
            'fecha' => ['sometimes', 'date_format:Y-m-d'],
        ];
    }
}
