// Nombres públicos de auth-session; el barril los reexporta con `export *` (ver security-api.ts).
export {
  AuthError,
  AuthSession,
  type AuthErrorCode,
  type SessionGrant,
  type SessionInfo,
} from './auth-session';
