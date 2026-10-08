// Nombres públicos de access-rules; el barril los reexporta con `export *` (ver security-api.ts).
export {
  assignableTo,
  effectiveAccess,
  inForce,
  internalCapability,
  isoToday,
  parsePermission,
} from './access-rules';
