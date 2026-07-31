/**
 * Configuración de Firebase — InmaculadaApp
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBjYl1dShz3XEav3bITPRQp-QjVNeMRU4E",
  authDomain: "inmaculadaapp-83a89.firebaseapp.com",
  projectId: "inmaculadaapp-83a89",
  storageBucket: "inmaculadaapp-83a89.firebasestorage.app",
  messagingSenderId: "67387265313",
  appId: "1:67387265313:web:5501ba100d6515ea35ae60",
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
