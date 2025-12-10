// Detecta si estamos en producción (Vite lo maneja automáticamente)
const isProduction = import.meta.env.PROD;

// URL base de la API
// Si tienes una variable de entorno definida (VITE_API_URL), úsala.
// Si no, usa localhost para desarrollo.
export const API_URL = import.meta.env.PROD
    ? `${window.location.origin}/api` // Adaptive: Works on port 3001 AND correct domain
    : 'http://localhost:3001/api';

console.log(`[Config] API URL configurada en: ${API_URL}`);
