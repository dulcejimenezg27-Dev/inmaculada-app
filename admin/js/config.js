/** Contraseña del panel de administración (solo acceso local al panel). */
window.ADMIN_CONFIG = {
  password: "Inmaculada2026Admin",
  sessionKey: "inmaculada_admin_session",

  /**
   * Admin NO usa Firebase Authentication.
   * Publica en Firestore con la clave local del panel.
   * (Los docentes sí usan Auth en /docentes/)
   */
  adminEmails: [],
  requireDocenteApproval: false,
};
