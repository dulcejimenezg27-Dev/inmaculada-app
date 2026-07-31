/** Contraseña del panel de administración. */
window.ADMIN_CONFIG = {
  password: "Inmaculada2026Admin",
  sessionKey: "inmaculada_admin_session",

  /**
   * Usuario de Firebase Authentication para publicar en la nube
   * (comunicados, honor y agenda). Créalo en:
   * Firebase → Authentication → Users → Add user
   * El correo debe coincidir con isAdmin() en firestore.rules
   */
  firebaseEmail: "admin@inmaculada.app",
  firebasePassword: "Inmaculada2026Admin",
};
