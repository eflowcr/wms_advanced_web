// Proxy de `npm run start:api`: la consola llama a su propio origen y la API Go recibe la ruta sin
// el prefijo. Mismo origen: sin CORS, la CSP intacta y la cookie de renovación viaja sola.
// Ver vault: Requerimientos de la API para el login.
const PREFIX = '/api/v1/security';
const target = process.env.EWMS_API_URL ?? 'http://localhost:8080';

export default {
  [PREFIX]: {
    target,
    changeOrigin: true,
    pathRewrite: { [`^${PREFIX}`]: '' },
    cookiePathRewrite: { '/auth': `${PREFIX}/auth` },
  },
};
