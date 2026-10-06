<?php

namespace App\Http\Requests\Admin;

use App\Support\ModuleAccessRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'identification_number' => [
                'required', 'string', 'max:30',
                Rule::unique('users', 'identification_number')->whereNull('deleted_at'),
            ],
            'email' => [
                'nullable', 'email', 'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at'),
            ],
            'password' => ['required', 'confirmed', 'min:8'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', Rule::exists('roles', 'name')],
            'is_active' => ['boolean'],
            'modulos_personalizados' => ['boolean'],
            'submodulos' => ['nullable', 'array'],
            'submodulos.*' => ['array'],
            'submodulos.*.*' => ['string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ((array) $this->input('submodulos', []) as $moduleSlug => $keys) {
                foreach ((array) $keys as $key) {
                    if (! ModuleAccessRegistry::exists((string) $moduleSlug, (string) $key)) {
                        $validator->errors()->add('submodulos', "Submódulo inválido: {$moduleSlug}.{$key}.");
                    }
                }
            }
        });
    }
}
