/**
 * Configuración de Firebase — InmaculadaApp
 * Completa apiKey y appId desde:
 * Firebase Console → ⚙️ Configuración del proyecto → Tus apps → App web → Configuración del SDK
 */
window.FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "inmaculadaapp-83a89.firebaseapp.com",
  projectId: "inmaculadaapp-83a89",
  storageBucket: "inmaculadaapp-83a89.appspot.com",
  messagingSenderId: "67387265313",
  appId: "TU_APP_ID",
};

/**
 * Lista opcional (el panel /admin/ usa clave local en admin/js/config.js).
 * Los docentes entran por /docentes/ con Firebase Auth.
 *
 * requireDocenteApproval: si es true, solo entran correos que existan como
 * documento en Firestore → docentes_autorizados/{correo_en_minusculas}
 * (tú autorizas creando ese documento en Firebase Console).
 */
window.ADMIN_CONFIG = window.ADMIN_CONFIG || {
  adminEmails: [],
  requireDocenteApproval: true,
};
