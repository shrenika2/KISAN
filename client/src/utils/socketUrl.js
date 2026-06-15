/**
 * Socket.io must hit the Node server directly in dev — Vite's WS proxy breaks
 * Engine.IO (polling + upgrade), causing ECONNRESET / ECONNABORTED spam.
 */
export function getSocketURL() {
    const fromEnv = import.meta.env.VITE_SOCKET_URL;
    if (fromEnv && String(fromEnv).trim()) {
        return String(fromEnv).replace(/\/$/, '');
    }
    if (import.meta.env.DEV) {
        return 'http://localhost:5000';
    }
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return '';
}
