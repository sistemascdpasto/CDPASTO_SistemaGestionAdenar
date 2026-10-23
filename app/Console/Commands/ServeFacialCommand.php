<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class ServeFacialCommand extends Command
{
    private const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

    protected $signature = 'facial:serve
        {--host=127.0.0.1 : La dirección IP en la que escuchará el servicio}
        {--port=8001 : El puerto en el que escuchará el servicio}
        {--log-level=info : Nivel de log de Uvicorn (critical, error, warning, info, debug)}';

    protected $description = 'Inicia el microservicio de reconocimiento facial FastAPI con Uvicorn';

    public function handle(): int
    {
        $host = (string) $this->option('host');
        $port = (int) $this->option('port');
        $logLevel = (string) $this->option('log-level');

        if ($port < 1 || $port > 65535) {
            $this->error('El puerto debe estar entre 1 y 65535.');

            return self::FAILURE;
        }

        if (! in_array($logLevel, ['critical', 'error', 'warning', 'info', 'debug', 'trace'], true)) {
            $this->error("Nivel de log inválido: {$logLevel}");

            return self::FAILURE;
        }

        $apiKey = (string) config('services.facial.api_key', '');

        // Sin clave solo se permite escuchar en loopback (datos biométricos).
        if ($apiKey === '' && ! in_array($host, self::LOOPBACK_HOSTS, true)) {
            $this->error("FACIAL_API_KEY es obligatoria para escuchar en {$host}.");

            return self::FAILURE;
        }

        if ($apiKey === '') {
            $this->warn('FACIAL_API_KEY no está definida: el servicio quedará sin autenticación (solo desarrollo).');
        }

        $python = $this->resolvePython();

        $this->info('Iniciando microservicio de reconocimiento facial ADENAR...');
        $this->line("Python: {$python}");
        $this->line("URL: http://{$host}:{$port}");

        $process = new Process(
            [$python, '-m', 'uvicorn', 'facial_service.main:app',
                '--host', $host, '--port', (string) $port, '--log-level', $logLevel],
            base_path(),
            array_filter([
                'PYTHONUTF8' => '1',
                'FACIAL_API_KEY' => $apiKey,
                'FACIAL_CORS' => (string) config('services.facial.cors', ''),
                'FACIAL_ALLOWED_DIR' => (string) config('services.facial.allowed_dir', ''),
            ], fn (string $v) => $v !== ''),
        );
        $process->setTimeout(null);

        // Reenvía Ctrl+C / SIGTERM al proceso hijo (solo donde exista pcntl).
        if (method_exists($this, 'trap') && extension_loaded('pcntl')) {
            $this->trap([SIGINT, SIGTERM], fn () => $process->stop(5));
        }

        $process->run(function (string $type, string $buffer): void {
            $this->output->write($buffer);
        });

        if (! $process->isSuccessful() && $process->getExitCode() !== null) {
            $this->error("El servicio terminó con código {$process->getExitCode()}.");
        }

        return $process->getExitCode() ?? self::SUCCESS;
    }

    /**
     * Intérprete de Python: configuración explícita, luego el venv del proyecto
     * (según el sistema operativo) y, como último recurso, el del PATH.
     */
    private function resolvePython(): string
    {
        $candidates = array_filter([
            config('services.facial.python'),
            PHP_OS_FAMILY === 'Windows'
                ? base_path('.venv_facial2/Scripts/python.exe')
                : base_path('.venv_facial2/bin/python'),
        ]);

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        $this->warn('No se encontró el entorno virtual .venv_facial2; se usará "python" del PATH.');

        return 'python';
    }
}