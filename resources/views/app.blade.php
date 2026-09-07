<!DOCTYPE html>
{{-- La app es 100% en español y no tiene i18n. Se fuerza lang="es" y se
     desactiva la traducción automática del navegador: Google Translate
     reescribe los nodos de texto del DOM (los envuelve en <font>), y cuando
     React vuelve a reconciliar tras navegar rompe con errores de
     insertBefore/removeChild → pantalla en blanco hasta recargar. --}}
<html lang="es" translate="no" class="notranslate">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="google" content="notranslate">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/images/icono-square.png" type="image/png">
        <link rel="shortcut icon" href="/images/icono-square.png">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
