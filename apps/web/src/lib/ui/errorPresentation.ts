/**
 * User-facing copy for errors — avoids raw problem codes and fetch internals in the UI.
 */

const AUTH_PROBLEM_LABEL: Record<string, string> = {
  missing_token: 'Falta el token de sesión.',
  invalid_token: 'La sesión no es válida.',
  token_expired: 'La sesión expiró. Vuelva a abrir la vista desde Pegasus.',
  auth_unavailable: 'No se pudo validar la sesión con Pegasus en este momento. Intente de nuevo.',
  malformed_auth_header: 'El encabezado de autorización no es válido.',
};

/**
 * Maps BFF `problem` codes to short Spanish copy. Returns null if unknown (caller may use API message).
 */
export function labelForAuthProblem(problem: string | null | undefined): string | null {
  if (!problem) return null;
  return AUTH_PROBLEM_LABEL[problem] ?? null;
}

/**
 * Turns thrown Error / fetch failures into a single line for the banner (no `bitacora_fetch_failed:502`).
 */
export function messageForUnknownError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    if (m.startsWith('bitacora_client:404:')) {
      return m.slice('bitacora_client:404:'.length);
    }
    if (m.startsWith('bitacora_client:400:')) {
      return m.slice('bitacora_client:400:'.length);
    }
    if (m.startsWith('bitacora_fetch_failed:')) {
      const code = m.split(':')[1];
      if (code === '502' || code === '503' || code === '504') {
        return 'No se pudo obtener la información del servidor. Intente de nuevo en unos momentos.';
      }
      if (code === '404') {
        return 'No se encontró el recurso solicitado.';
      }
      return 'No se pudo cargar la información. Verifique la conexión e intente de nuevo.';
    }
    if (m === 'unknown_error') {
      return 'Ocurrió un error inesperado. Intente de nuevo.';
    }
    return m;
  }
  return 'Ocurrió un error inesperado. Intente de nuevo.';
}
