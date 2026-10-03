<?php

namespace App\Http\Requests\Gente;

use Illuminate\Foundation\Http\FormRequest;

class ImportarPlanPadrinoCriteriosRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'archivo' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
        ];
    }

    public function messages(): array
    {
        return [
            'archivo.required' => 'Debes seleccionar un archivo Excel o CSV.',
            'archivo.mimes' => 'El archivo debe estar en formato Excel (.xlsx, .xls) o CSV (.csv).',
            'archivo.max' => 'El archivo no puede pesar más de 10 MB.',
        ];
    }
}
