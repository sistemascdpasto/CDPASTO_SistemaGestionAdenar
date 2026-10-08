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

        {{-- PWA: instalable, pantalla completa sin barra del navegador, propio
             ícono y color de marca en la barra de estado/tareas. --}}
        <link rel="manifest" href="/build/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/images/pwa/apple-touch-icon-180.png">
        <meta name="theme-color" content="#E41515">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Adenar">

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
