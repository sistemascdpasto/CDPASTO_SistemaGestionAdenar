<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Token compartido para que el monitor SIMIT (script Python en la PC
    // local) pueda mandar sus consultas a POST /api/simit/consultas.
    'simit' => [
        'token' => env('SIMIT_API_TOKEN'),
    ],

    // Token compartido para que la automatizacion GeoVictoria (script
    // Python en la PC local) pueda mandar sus indicadores de asistencia a
    // POST /api/geovictoria/asistencias.
    'geovictoria' => [
        'token' => env('GEOVICTORIA_API_TOKEN'),
    ],

    // Groq (API compatible con OpenAI) para el chatbot interno disponible a
    // todos los roles. Ver App\Http\Controllers\ChatbotController.
    'groq' => [
        'api_key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
    ],

    // Reconocimiento facial biométrico
    'facial' => [
        'url' => env('FACIAL_API_URL', 'http://127.0.0.1:8001'),
        'python_path' => env('FACIAL_PYTHON_PATH', null),
    ],

    // MyGeotab: credenciales INICIALES/semilla (análisis de combustible,
    // pilar Flota). El valor que la app realmente usa en tiempo de ejecución
    // vive cifrado en base de datos y se administra desde el panel, porque
    // la contraseña de MyGeotab rota periódicamente — estas quedan solo como
    // respaldo para el primer arranque. Ver App\Support\MygeotabCredentials
    // (o equivalente) una vez implementado.
    'mygeotab' => [
        'username' => env('MYGEOTAB_USERNAME'),
        'password' => env('MYGEOTAB_PASSWORD'),
        'database' => env('MYGEOTAB_DATABASE'),
        'sync_token' => env('MYGEOTAB_SYNC_TOKEN'),
    ],

    // Gemini (Google AI Studio) para extraer datos de las fotos de vouchers
    // de tanqueo en el módulo de análisis de combustible (pilar Flota).
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
    ],

];
