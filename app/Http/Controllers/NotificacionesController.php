<?php

namespace App\Http\Controllers;

use App\Services\Notificaciones\NotificacionesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificacionesController extends Controller
{
    /**
     * Feed JSON de la campana de notificaciones del header: agrupa las
     * novedades pendientes según los roles del usuario (el Administrador ve
     * todo). Se consume desde `notifications-bell.tsx`.
     */
    public function index(Request $request, NotificacionesService $notificaciones): JsonResponse
    {
        return response()->json($notificaciones->paraUsuario($request->user()));
    }
}
