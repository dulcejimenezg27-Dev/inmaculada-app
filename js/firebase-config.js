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
 * El panel /admin/ usa clave local (sin Authentication).
 * Docentes: Firebase Auth con correo y contraseña.
 */
window.ADMIN_CONFIG = window.ADMIN_CONFIG || {
  adminEmails: [],
  requireDocenteApproval: false,
};
