/**
 * Shown when the app is opened without a Pegasus session token (e.g. standalone tab).
 * Enforcement of embedding and auth is server-side (BFF + deployment headers).
 */
export function EmbedStandalone() {
  return (
    <div className="page">
      <div className="section embed-standalone">
        <h1>Bitácora de Siniestro REDESAS LITE</h1>
        <p className="banner warn">
          Esta vista se abre desde <strong>Pegasus</strong> con un token de sesión en la URL (
          <code>access_token</code>). Sin ese token no hay datos que mostrar.
        </p>
        <p className="muted small">
          <strong>Vista previa local:</strong> agregue{' '}
          <code>?access_token=token-opaco-de-prueba</code> a la dirección. En integración, el BFF
          valida el token con Pegasus cuando la validación HTTP está habilitada.
        </p>
        <p className="muted small">
          La incrustación en iframe depende de la política de seguridad configurada en el servidor o
          en el proxy (<code>frame-ancestors</code>), además de la autenticación en el BFF.
        </p>
      </div>
    </div>
  );
}
