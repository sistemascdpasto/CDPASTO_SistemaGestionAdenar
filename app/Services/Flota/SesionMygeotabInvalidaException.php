<?php

namespace App\Services\Flota;

use RuntimeException;

/**
 * El sessionId cacheado ya no es válido del lado de MyGeotab (expiró o fue
 * cerrado). MygeotabClient la atrapa internamente para reautenticar una vez
 * y reintentar la llamada — no debería escapar fuera del cliente.
 */
class SesionMygeotabInvalidaException extends RuntimeException {}
