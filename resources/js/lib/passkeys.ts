/**
 * Ingreso con huella / Face ID (passkeys, estándar WebAuthn).
 *
 * El navegador crea y usa la llave; la huella o el rostro nunca salen del dispositivo. Aquí solo
 * se traduce entre el JSON del servidor (laragear/webauthn, binarios en base64url) y la API
 * navigator.credentials, que trabaja con ArrayBuffer.
 */

type Json = Record<string, unknown>;

export class PasskeyError extends Error {
    constructor(
        message: string,
        public readonly cancelled = false,
    ) {
        super(message);
    }
}

export function passkeysSupported(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext && 'PublicKeyCredential' in window && !!navigator.credentials;
}

/** ¿El dispositivo tiene un lector biométrico o bloqueo de pantalla utilizable (huella, rostro, PIN)? */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
    if (!passkeysSupported()) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

function toBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return bytes.buffer;
}

function toBase64Url(buffer: ArrayBuffer | null): string | null {
    if (!buffer) return null;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

async function post<T = Json>(url: string, body: unknown = {}): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Json;

    if (!response.ok) {
        const errors = data.errors as Record<string, string[]> | undefined;
        const first = errors ? Object.values(errors)[0]?.[0] : undefined;
        throw new PasskeyError(first ?? (data.message as string) ?? 'No fue posible completar la operación.');
    }

    return data as T;
}

function credentialIds(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
    if (!Array.isArray(list)) return undefined;

    return list.map((item: Json) => ({ ...(item as object), id: toBuffer(item.id as string) }) as PublicKeyCredentialDescriptor);
}

function cancelledOrFailed(error: unknown): never {
    if (error instanceof PasskeyError) throw error;
    const name = (error as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'AbortError') {
        throw new PasskeyError('Se canceló la verificación o se agotó el tiempo.', true);
    }
    if (name === 'InvalidStateError') {
        throw new PasskeyError('Este dispositivo ya tiene activado el ingreso con huella para tu cuenta.');
    }
    throw new PasskeyError('Tu dispositivo no pudo completar la verificación.');
}

/** Activa el ingreso con huella / Face ID para el usuario conectado en este dispositivo. */
export async function registerPasskey(): Promise<void> {
    const options = await post<Json>('/webauthn/register/options');
    const publicKey = {
        ...options,
        challenge: toBuffer(options.challenge as string),
        user: { ...(options.user as Json), id: toBuffer((options.user as Json).id as string) },
        excludeCredentials: credentialIds(options.excludeCredentials),
    } as PublicKeyCredentialCreationOptions;

    let credential: PublicKeyCredential;
    try {
        credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    } catch (error) {
        cancelledOrFailed(error);
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    await post('/webauthn/register', {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: toBase64Url(response.clientDataJSON),
            attestationObject: toBase64Url(response.attestationObject),
        },
    });
}

/** Inicia sesión con una llave guardada en el dispositivo. Devuelve la URL a la que ir. */
export async function loginWithPasskey(remember = true): Promise<string> {
    const options = await post<Json>('/webauthn/login/options');
    const publicKey = {
        ...options,
        challenge: toBuffer(options.challenge as string),
        allowCredentials: credentialIds(options.allowCredentials),
    } as PublicKeyCredentialRequestOptions;

    let credential: PublicKeyCredential;
    try {
        credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
    } catch (error) {
        cancelledOrFailed(error);
    }

    const response = credential.response as AuthenticatorAssertionResponse;
    const result = await post<{ redirect: string }>('/webauthn/login', {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: credential.type,
        remember,
        response: {
            authenticatorData: toBase64Url(response.authenticatorData),
            clientDataJSON: toBase64Url(response.clientDataJSON),
            signature: toBase64Url(response.signature),
            userHandle: toBase64Url(response.userHandle),
        },
    });

    return result.redirect;
}
