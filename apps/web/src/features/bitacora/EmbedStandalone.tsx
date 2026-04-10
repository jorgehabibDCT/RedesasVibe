/**
 * Shown when the app is opened without a session token (e.g. direct URL or new tab).
 * Token validation and embedding policy are enforced on the server (BFF and deployment headers).
 */
export function EmbedStandalone() {
  return (
    <div className="page">
      <div className="section embed-standalone">
        <h1>Bitácora de Siniestro REDESAS LITE</h1>
        <p className="banner warn">
          Para ver un expediente, abra esta aplicación desde <strong>Pegasus</strong> con un token de
          sesión en la URL (<code>auth</code> o <code>access_token</code>). Sin ese token no hay datos
          que mostrar.
        </p>
        <p className="muted small">
          El servidor valida la sesión. La vista dentro de un iframe depende de la política de
          seguridad del sitio (<code>frame-ancestors</code>) además de la autenticación en el BFF.
        </p>
      </div>
    </div>
  );
}
