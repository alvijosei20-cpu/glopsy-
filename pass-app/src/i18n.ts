// i18n ligero: detecta el idioma del dispositivo (es/en) y traduce las cadenas.
// No requiere expo-localization: usa Intl (soportado por Hermes).

export type Lang = 'es' | 'en';

export function detectLang(): Lang {
  try {
    const loc = (Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase();
    if (loc.startsWith('es')) return 'es';
  } catch {}
  return 'en';
}

export const lang: Lang = detectLang();

type Dict = Record<string, string>;

const es: Dict = {
  // app / común
  'app.tagline': 'Bóveda segura',
  'app.saving': 'Guardando…',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.borrar': 'Borrar',
  'common.continue': 'Continuar',
  'common.retry': 'Reintentar',
  'common.close': 'Cerrar',

  // pestañas
  'tab.home': 'Inicio',
  'tab.vault': 'Caja',
  'tab.settings': 'Ajustes',

  // ProtectedText
  'protected.copied': 'Copiado al portapapeles',

  // SecurityGate
  'gate.checking': 'Comprobando seguridad…',
  'gate.rooted.title': 'Dispositivo no compatible',
  'gate.rooted.body':
    'Esta aplicación no se puede ejecutar en dispositivos con acceso root (superusuario).',
  'gate.overlay.title': 'Superposición detectada',
  'gate.overlay.body':
    'Hay una aplicación superpuesta activa (p. ej. un overlay de terceros). Desactívala para continuar.',

  // AuthContext
  'auth.bio.prompt': 'Desbloquear Pass con tu huella',
  'auth.bio.cancel': 'Usar PIN',
  'auth.import.ok': 'Base de datos restablecida',
  'auth.import.err': 'No se pudo importar',
  'auth.notFound': 'No se encontró la cuenta',

  // Login
  'login.remembered.tagline': 'Hola, {user}. Introduce tu PIN para desbloquear tu bóveda.',
  'login.default.tagline': 'Introduce tu usuario y tu PIN para desbloquear tu bóveda.',
  'login.change': 'Cambiar',
  'login.user': 'Usuario',
  'login.userPh': 'tu_usuario',
  'login.hint': 'Pulsa «hecho/listo» en el teclado y teclea tu PIN abajo.',
  'login.err.userFirst': 'Escribe tu usuario primero',
  'login.err.locked': 'Demasiados intentos. Espera {time}',
  'login.err.bad': 'Usuario o PIN incorrecto',
  'login.err.badAttempts': 'Usuario o PIN incorrecto. Te quedan {n} intentos',
  'login.err.badLocked': 'Usuario o PIN incorrecto. PIN bloqueado {time}',
  'login.err.fail': 'No se pudo iniciar sesión',
  'login.unlocking': 'Desbloqueando…',
  'login.unlockingPct': 'Desbloqueando… {pct}%',
  'login.bio': 'Desbloquear con huella',
  'login.bio.hint': 'Entra con tu PIN para reactivar la huella.',
  'login.submit': 'Entrar',
  'login.noAccount': '¿No tienes cuenta?',
  'login.register': 'Regístrate',
  'bio.no-session': 'No hay sesión guardada. Entra primero con tu PIN.',
  'bio.canceled': 'Cancelado. Usa el PIN.',
  'bio.failed': 'Huella no reconocida.',
  'bio.unavailable': 'Huella no disponible en este dispositivo.',
  'bio.bad-vault': 'La sesión no es válida. Entra con tu PIN.',

  // Registro
  'reg.tagline': 'Crea tu bóveda. Tu PIN cifra todos tus datos.',
  'reg.sub.choose': 'Elige un PIN de 6 dígitos.',
  'reg.sub.confirm': 'Confirma repitiendo tu PIN.',
  'reg.user': 'Usuario',
  'reg.userPh': 'tu_usuario',
  'reg.err.user': 'Escribe tu usuario',
  'reg.err.userFormat': 'Usuario: 3-32 caracteres (letras, números, _ - .)',
  'reg.err.exists': 'Ese usuario ya existe. Inicia sesión',
  'reg.err.weakPin': 'PIN demasiado predecible (evita secuencias o repetidos)',
  'reg.err.mismatch': 'Los PIN no coinciden',
  'reg.err.create': 'No se pudo crear la cuenta',
  'reg.creating': 'Creando bóveda…',
  'reg.creatingPct': 'Creando bóveda… {pct}%',
  'reg.hasAccount': '¿Ya tienes cuenta?',
  'reg.signin': 'Inicia sesión',
  'reg.terms': 'Al registrarte aceptas los',
  'reg.termsLink': 'Términos y condiciones',
  'license.title': 'Activa tu licencia',
  'license.subtitle': 'Tu licencia está vinculada a este dispositivo.',
  'license.deviceLabel': 'ID de dispositivo',
  'license.copy': 'Copiar',
  'license.copied': 'ID de dispositivo copiado',
  'license.activate': 'Activar',
  'license.codeLabel': 'Código de activación',
  'license.codePh': 'XXXX-XXXX-XXXX-XXXX',
  'license.sendMe': 'Envía este ID al soporte para recibir tu código.',
  'license.err.invalid': 'Código de activación inválido para este dispositivo',
  'license.err.empty': 'Introduce el código de activación',
  'license.ok': 'Licencia activada',
  'license.unavailable': 'Device Binding no disponible en este dispositivo',
  'license.deviceMismatch': 'La cuenta está vinculada a otro dispositivo',

  // Cambiar PIN
  'pin.title': 'Cambiar PIN',
  'pin.sub.old': 'Introduce tu PIN actual',
  'pin.sub.new': 'Introduce el nuevo PIN (6 dígitos)',
  'pin.sub.confirm': 'Confirma el nuevo PIN',
  'pin.err.locked': 'Cuenta temporalmente bloqueada',
  'pin.err.wrong': 'PIN actual incorrecto',
  'pin.err.blocked': 'PIN actual incorrecto · bloqueado {time}',
  'pin.err.change': 'No se pudo cambiar el PIN',
  'pin.ok': 'PIN actualizado',

  // Home
  'home.greet.morning': 'Buenos días',
  'home.greet.afternoon': 'Buenas tardes',
  'home.greet.evening': 'Buenas noches',
  'home.stat.total': 'Total',
  'home.stat.password': 'Contraseñas',
  'home.stat.crypto': 'Cripto',
  'home.stat.cards': 'Tarjetas',
  'home.recent': 'Recientes',
  'home.openVault': 'Ver caja fuerte',
  'home.empty.title': 'Tu bóveda está vacía',
  'home.empty.text': 'Añade tu primera contraseña, semilla cripto, tarjeta o nota.',
  'home.add': 'Añadir elemento',

  // Caja fuerte
  'vault.title': 'Caja fuerte',
  'vault.search': 'Buscar por nombre, usuario, URL…',
  'vault.all': 'Todos',
  'vault.empty.title': 'Sin resultados',
  'vault.empty.text': 'No hay elementos que coincidan con tu búsqueda.',

  // Ajustes
  'settings.account': 'Cuenta',
  'settings.items.one': '{n} elemento guardado',
  'settings.items.other': '{n} elementos guardados',
  'settings.security': 'Seguridad',
  'settings.changePin': 'Cambiar PIN',
  'settings.changePin.sub': 'Actualiza tu código de desbloqueo',
  'settings.bio': 'Desbloqueo con huella',
  'settings.bio.sub': 'Abre la app con tu huella en vez del PIN',
  'settings.autofill': 'Autofill en otras apps',
  'settings.autofill.sub': 'Rellena tus credenciales guardadas desde el sistema',
  'settings.appearance': 'Apariencia',
  'settings.night': 'Modo noche',
  'settings.day': 'Modo día',
  'settings.theme.sub': 'Cambia entre tema claro y oscuro',
  'settings.db': 'Base de datos (JSON)',
  'settings.dbFile': 'Archivo de base de datos',
  'settings.dbFile.sub': 'Se guarda cifrado en pass-database.json',
  'settings.dbSave': 'Guardar base de datos',
  'settings.dbSave.sub': 'Comparte pass-database.json (cifrada)',
  'settings.dbRestore': 'Restablecer base de datos',
  'settings.dbRestore.sub': 'Carga un pass-database.json descargado',
  'settings.data': 'Datos',
  'settings.export': 'Exportar bóveda en claro',
  'settings.export.sub': 'Copia legible de tus elementos',
  'settings.session': 'Sesión',
  'settings.logout': 'Cerrar sesión',
  'settings.logout.sub': 'Bloquea la bóveda',
  'settings.danger': 'Zona de peligro',
  'settings.wipe': 'Borrar todo',
  'settings.wipe.sub': 'Elimina la cuenta y todos los datos',
  'settings.legal': 'Legal',
  'settings.terms': 'Términos y Condiciones',
  'settings.terms.sub': 'Responsabilidad y uso de la app',
  'settings.support': 'Soporte',
  'settings.support.sub': '¿Problemas? Únete a nuestro grupo de Discord',
  'settings.exported': 'Copia de seguridad exportada',
  'settings.err.db': 'No se pudo guardar la base de datos',
  'settings.err.nobio': 'Este dispositivo no tiene sensor de huellas',
  'settings.autofill.android': 'Autofill solo está disponible en Android',
  'settings.autofill.err': 'No se pudo abrir la configuración de Autofill',
  'settings.restore.title': 'Restablecer base de datos',
  'settings.restore.body':
    'Esto reemplazará la base de datos actual por el contenido del archivo. ¿Continuar?',
  'settings.wipe.title': 'Borrar todo',
  'settings.wipe.body': 'Esto borrará PERMANENTEMENTE tu cuenta y todos tus datos. ¿Continuar?',

  // Añadir / editar
  'addedit.edit': 'Editar elemento',
  'addedit.new': 'Nuevo elemento',
  'addedit.category': 'Categoría',
  'addedit.name': 'Nombre',
  'addedit.namePh': 'Ej. Gmail, Binance, Wi-Fi…',
  'addedit.username': 'Usuario',
  'addedit.password': 'Contraseña',
  'addedit.generate': 'Generar segura',
  'addedit.url': 'URL',
  'addedit.urlPh': 'https://…',
  'addedit.seed': 'Semilla / Frase de recuperación',
  'addedit.seedPh': '12 o 24 palabras…',
  'addedit.card': 'Número de tarjeta',
  'addedit.cardPh': '0000 0000 0000 0000',
  'addedit.cvv': 'CVV',
  'addedit.expiry': 'Caducidad',
  'addedit.expiryPh': 'MM/AA',
  'addedit.holder': 'Titular',
  'addedit.note': 'Nota',
  'addedit.notes': 'Notas extra',
  'addedit.optional': 'Opcional',
  'addedit.save': 'Guardar cambios',
  'addedit.saveNew': 'Guardar elemento',
  'addedit.delete.title': 'Eliminar elemento',
  'addedit.delete.body': '¿Eliminar este elemento?',
  'addedit.saved': 'Cambios guardados',
  'addedit.savedNew': 'Elemento guardado',
  'addedit.deleted': 'Elemento eliminado',
  'addedit.pwgen': 'Contraseña generada',

  // Detalle de elemento
  'item.password': 'Contraseña',
  'item.username': 'Usuario',
  'item.url': 'URL',
  'item.seed': 'Semilla',
  'item.card': 'Tarjeta',
  'item.cvv': 'CVV',
  'item.expiry': 'Caducidad',
  'item.notes': 'Notas',
  'item.edit': 'Editar',
  'item.delete.title': 'Borrar elemento',
  'item.delete.body': '¿Borrar este elemento?',

  // Autofill
  'autofill.title': 'Rellenar credenciales',
  'autofill.for': 'Para',
  'autofill.app': 'Esta aplicación',
  'autofill.empty.title': 'Sin credenciales',
  'autofill.empty.text': 'No hay contraseñas guardadas que puedan usarse aquí.',
  'autofill.filling': 'Rellenando…',
  'autofill.nouser': 'Sin usuario',
  'autofill.err': 'No se pudo rellenar el formulario',

  // Términos
  'terms.title': 'Términos y Condiciones',
  'terms.0.title': 'Términos y Condiciones de Uso',
  'terms.0.body':
    'Pass — Bóveda segura (en adelante, la "Aplicación") es desarrollada y operada por Nodus Technology (en adelante, "Nodus Technology" o "la Empresa"). Al descargar, instalar, acceder o utilizar la Aplicación, el usuario acepta de manera plena, expresa e incondicional estos Términos y Condiciones. Si el usuario no está de acuerdo con los mismos, deberá abstenerse de utilizar la Aplicación.',
  'terms.1.title': '1. Naturaleza del servicio',
  'terms.1.body':
    'La Aplicación es un gestor local de contraseñas, semillas criptográficas, tarjetas y notas que cifra los datos en el propio dispositivo mediante el PIN del usuario. Toda la información se almacena de forma local y no existe ningún servidor central. Nodus Technology no tiene acceso, control ni conocimiento de los datos, contraseñas, semillas o PIN del usuario.',
  'terms.2.title': '2. Responsabilidad del usuario',
  'terms.2.body':
    'El usuario es el único responsable de: (a) mantener en secreto y proteger su PIN, usuario y cualquier método de desbloqueo; (b) el uso que dé a la Aplicación, incluido el almacenamiento, la revelación o el tratamiento de la información guardada en ella; (c) realizar y conservar copias de seguridad de su base de datos (pass-database.json) en un lugar seguro; (d) la seguridad y custodia del dispositivo donde esté instalada la Aplicación; y (e) no ceder, compartir ni transferir su cuenta o sus datos a terceros.',
  'terms.3.title': '3. Riesgo de pérdida de datos',
  'terms.3.body':
    'Nodus Technology no será responsable por la pérdida, corrupción, destrucción o filtración de datos derivada de: la desinstalación de la Aplicación, el reinicio o restauración del dispositivo, el borrado del almacenamiento, el olvido o pérdida del PIN, el robo o pérdida del dispositivo, o fallos del hardware o del software. El usuario asume dicho riesgo y debe mantener respaldos actualizados.',
  'terms.4.title': '4. Seguridad y contraseñas',
  'terms.4.body':
    'El cifrado depende del PIN del usuario. Un PIN débil, corto o compartido reduce la protección de los datos. Nodus Technology no puede recuperar PIN, contraseñas ni datos cifrados: ante la pérdida del PIN, la información almacenada resulta irrecuperable.',
  'terms.5.title': '5. Sin garantías',
  'terms.5.body':
    'La Aplicación se proporciona "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas, incluidas, sin limitación, las de idoneidad para un fin determinado, exactitud, disponibilidad o ausencia de errores.',
  'terms.6.title': '6. Limitación de responsabilidad',
  'terms.6.body':
    'En la máxima medida permitida por la ley aplicable, Nodus Technology y sus directivos, empleados, agentes y colaboradores no serán responsables ante el usuario ni ante terceros por daños directos, indirectos, incidentales, especiales, consecuentes o punitivos, lucro cesante, pérdida de datos, pérdida de oportunidades, acceso no autorizado a la información o cualquier otra pérdida o perjuicio derivados del uso o de la imposibilidad de uso de la Aplicación, aun cuando se hubiera advertido de la posibilidad de tales daños.',
  'terms.7.title': '7. Indemnización',
  'terms.7.body':
    'El usuario se obliga a mantener indemne, defender y eximir de toda responsabilidad a Nodus Technology y a sus directivos, empleados y colaboradores frente a cualquier reclamación, demanda, acción o procedimiento judicial o administrativo, así como frente a daños, pérdidas, costos o gastos (incluidos honorarios legales razonables) que surjan directa o indirectamente del uso que el usuario haga de la Aplicación, del incumplimiento de estos Términos o de la violación de derechos de terceros o de la ley aplicable.',
  'terms.8.title': '8. Usos prohibidos',
  'terms.8.body':
    'Queda prohibido utilizar la Aplicación para fines ilícitos, fraudulentos o que vulneren derechos de terceros, o para almacenar, gestionar o difundir información que infrinja la legislación aplicable.',
  'terms.9.title': '9. Propiedad intelectual',
  'terms.9.body':
    'La Aplicación, su código, diseño, marcas, gráficos y contenido son propiedad de Nodus Technology o de sus licenciantes. Queda prohibida su reproducción, distribución o modificación total o parcial sin autorización previa por escrito.',
  'terms.10.title': '10. Modificaciones',
  'terms.10.body':
    'Nodus Technology podrá modificar estos Términos y Condiciones en cualquier momento. El uso continuado de la Aplicación tras la publicación de las modificaciones constituye la aceptación de las mismas.',
  'terms.11.title': '11. Legislación aplicable y jurisdicción',
  'terms.11.body':
    'Estos Términos y Condiciones se regirán por la legislación aplicable. Para cualquier controversia que surja en relación con la Aplicación o con estos Términos, las partes se someten a los tribunales competentes, con renuncia expresa a cualquier otro fuero.',

  // vault.ts (tipos, categorías, metadatos)
  'type.password': 'Contraseña',
  'type.seed': 'Semilla cripto',
  'type.card': 'Tarjeta',
  'type.note': 'Nota',
  'cat.cripto': 'Cripto',
  'cat.banca': 'Banca',
  'cat.social': 'Social',
  'cat.email': 'Email',
  'cat.trabajo': 'Trabajo',
  'cat.compras': 'Compras',
  'cat.otro': 'Otro',
  'vault.unnamed': 'Sin nombre',
  'vault.seedMeta': 'Semilla · {cat}',
  'vault.noteMeta': 'Nota',
  'vault.cardMask': '•••• {last}',
  'vault.cardEmpty': 'Tarjeta',

  // store.ts
  'store.notValid': 'el archivo no contiene usuarios válidos',
  'store.notDB': 'el archivo no es una base de datos de Pass',

  // crypto.ts
  'crypto.noArgon2': 'Argon2 no disponible en este entorno',
};

const en: Dict = {
  'app.tagline': 'Secure vault',
  'app.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.borrar': 'Delete',
  'common.continue': 'Continue',
  'common.retry': 'Retry',
  'common.close': 'Close',

  'tab.home': 'Home',
  'tab.vault': 'Vault',
  'tab.settings': 'Settings',

  'protected.copied': 'Copied to clipboard',

  'gate.checking': 'Checking security…',
  'gate.rooted.title': 'Unsupported device',
  'gate.rooted.body': 'This app cannot run on devices with root access (superuser).',
  'gate.overlay.title': 'Overlay detected',
  'gate.overlay.body':
    'An overlay app is active (e.g. a third-party overlay). Disable it to continue.',

  'auth.bio.prompt': 'Unlock Pass with your fingerprint',
  'auth.bio.cancel': 'Use PIN',
  'auth.import.ok': 'Database restored',
  'auth.import.err': 'Could not import',
  'auth.notFound': 'Account not found',

  'login.remembered.tagline': 'Hi, {user}. Enter your PIN to unlock your vault.',
  'login.default.tagline': 'Enter your username and PIN to unlock your vault.',
  'login.change': 'Change',
  'login.user': 'Username',
  'login.userPh': 'your_username',
  'login.hint': 'Tap "done" on the keyboard and type your PIN below.',
  'login.err.userFirst': 'Enter your username first',
  'login.err.locked': 'Too many attempts. Wait {time}',
  'login.err.bad': 'Wrong username or PIN',
  'login.err.badAttempts': 'Wrong username or PIN. You have {n} attempts left',
  'login.err.badLocked': 'Wrong username or PIN. PIN locked {time}',
  'login.err.fail': 'Could not sign in',
  'login.unlocking': 'Unlocking…',
  'login.unlockingPct': 'Unlocking… {pct}%',
  'login.bio': 'Unlock with fingerprint',
  'login.bio.hint': 'Enter your PIN to reactivate fingerprint.',
  'login.submit': 'Sign in',
  'login.noAccount': 'No account yet?',
  'login.register': 'Sign up',
  'bio.no-session': 'No saved session. Sign in with your PIN first.',
  'bio.canceled': 'Cancelled. Use your PIN.',
  'bio.failed': 'Fingerprint not recognized.',
  'bio.unavailable': 'Fingerprint not available on this device.',
  'bio.bad-vault': 'The session is invalid. Sign in with your PIN.',

  'reg.tagline': 'Create your vault. Your PIN encrypts all your data.',
  'reg.sub.choose': 'Choose a 6-digit PIN.',
  'reg.sub.confirm': 'Confirm by repeating your PIN.',
  'reg.user': 'Username',
  'reg.userPh': 'your_username',
  'reg.err.user': 'Enter your username',
  'reg.err.userFormat': 'Username: 3-32 characters (letters, numbers, _ - .)',
  'reg.err.exists': 'That username already exists. Sign in',
  'reg.err.weakPin': 'PIN too predictable (avoid sequences or repeats)',
  'reg.err.mismatch': 'PINs do not match',
  'reg.err.create': 'Could not create account',
  'reg.creating': 'Creating vault…',
  'reg.creatingPct': 'Creating vault… {pct}%',
  'reg.hasAccount': 'Already have an account?',
  'reg.signin': 'Sign in',
  'reg.terms': 'By registering you accept the',
  'reg.termsLink': 'Terms and Conditions',
  'license.title': 'Activate your license',
  'license.subtitle': 'Your license is bound to this device.',
  'license.deviceLabel': 'Device ID',
  'license.copy': 'Copy',
  'license.copied': 'Device ID copied',
  'license.activate': 'Activate',
  'license.codeLabel': 'Activation code',
  'license.codePh': 'XXXX-XXXX-XXXX-XXXX',
  'license.sendMe': 'Send this ID to support to receive your code.',
  'license.err.invalid': 'Activation code invalid for this device',
  'license.err.empty': 'Enter the activation code',
  'license.ok': 'License activated',
  'license.unavailable': 'Device Binding is not available on this device',
  'license.deviceMismatch': 'This account is bound to another device',

  'pin.title': 'Change PIN',
  'pin.sub.old': 'Enter your current PIN',
  'pin.sub.new': 'Enter the new PIN (6 digits)',
  'pin.sub.confirm': 'Confirm the new PIN',
  'pin.err.locked': 'Account temporarily locked',
  'pin.err.wrong': 'Current PIN is wrong',
  'pin.err.blocked': 'Current PIN is wrong · blocked {time}',
  'pin.err.change': 'Could not change the PIN',
  'pin.ok': 'PIN updated',

  'home.greet.morning': 'Good morning',
  'home.greet.afternoon': 'Good afternoon',
  'home.greet.evening': 'Good evening',
  'home.stat.total': 'Total',
  'home.stat.password': 'Passwords',
  'home.stat.crypto': 'Crypto',
  'home.stat.cards': 'Cards',
  'home.recent': 'Recent',
  'home.openVault': 'Open vault',
  'home.empty.title': 'Your vault is empty',
  'home.empty.text': 'Add your first password, crypto seed, card, or note.',
  'home.add': 'Add item',

  'vault.title': 'Vault',
  'vault.search': 'Search by name, username, URL…',
  'vault.all': 'All',
  'vault.empty.title': 'No results',
  'vault.empty.text': 'No items match your search.',

  'settings.account': 'Account',
  'settings.items.one': '{n} saved item',
  'settings.items.other': '{n} saved items',
  'settings.security': 'Security',
  'settings.changePin': 'Change PIN',
  'settings.changePin.sub': 'Update your unlock code',
  'settings.bio': 'Fingerprint unlock',
  'settings.bio.sub': 'Open the app with your fingerprint instead of PIN',
  'settings.autofill': 'Autofill in other apps',
  'settings.autofill.sub': 'Fill your saved credentials from the system',
  'settings.appearance': 'Appearance',
  'settings.night': 'Night mode',
  'settings.day': 'Day mode',
  'settings.theme.sub': 'Switch between light and dark theme',
  'settings.db': 'Database (JSON)',
  'settings.dbFile': 'Database file',
  'settings.dbFile.sub': 'Saved encrypted in pass-database.json',
  'settings.dbSave': 'Save database',
  'settings.dbSave.sub': 'Share pass-database.json (encrypted)',
  'settings.dbRestore': 'Restore database',
  'settings.dbRestore.sub': 'Load a downloaded pass-database.json',
  'settings.data': 'Data',
  'settings.export': 'Export vault in plain text',
  'settings.export.sub': 'Readable copy of your items',
  'settings.session': 'Session',
  'settings.logout': 'Log out',
  'settings.logout.sub': 'Locks the vault',
  'settings.danger': 'Danger zone',
  'settings.wipe': 'Wipe everything',
  'settings.wipe.sub': 'Deletes the account and all data',
  'settings.legal': 'Legal',
  'settings.terms': 'Terms and Conditions',
  'settings.terms.sub': 'Liability and usage of the app',
  'settings.support': 'Support',
  'settings.support.sub': 'Problems? Join our Discord group',
  'settings.exported': 'Backup exported',
  'settings.err.db': 'Could not save the database',
  'settings.err.nobio': 'This device has no fingerprint sensor',
  'settings.autofill.android': 'Autofill is only available on Android',
  'settings.autofill.err': 'Could not open Autofill settings',
  'settings.restore.title': 'Restore database',
  'settings.restore.body':
    'This will replace the current database with the file contents. Continue?',
  'settings.wipe.title': 'Wipe everything',
  'settings.wipe.body':
    'This will PERMANENTLY delete your account and all data. Continue?',

  'addedit.edit': 'Edit item',
  'addedit.new': 'New item',
  'addedit.category': 'Category',
  'addedit.name': 'Name',
  'addedit.namePh': 'E.g. Gmail, Binance, Wi-Fi…',
  'addedit.username': 'Username',
  'addedit.password': 'Password',
  'addedit.generate': 'Generate strong',
  'addedit.url': 'URL',
  'addedit.urlPh': 'https://…',
  'addedit.seed': 'Seed / Recovery phrase',
  'addedit.seedPh': '12 or 24 words…',
  'addedit.card': 'Card number',
  'addedit.cardPh': '0000 0000 0000 0000',
  'addedit.cvv': 'CVV',
  'addedit.expiry': 'Expiry',
  'addedit.expiryPh': 'MM/YY',
  'addedit.holder': 'Cardholder',
  'addedit.note': 'Note',
  'addedit.notes': 'Extra notes',
  'addedit.optional': 'Optional',
  'addedit.save': 'Save changes',
  'addedit.saveNew': 'Save item',
  'addedit.delete.title': 'Delete item',
  'addedit.delete.body': 'Delete this item?',
  'addedit.saved': 'Changes saved',
  'addedit.savedNew': 'Item saved',
  'addedit.deleted': 'Item deleted',
  'addedit.pwgen': 'Password generated',

  'item.password': 'Password',
  'item.username': 'Username',
  'item.url': 'URL',
  'item.seed': 'Seed',
  'item.card': 'Card',
  'item.cvv': 'CVV',
  'item.expiry': 'Expiry',
  'item.notes': 'Notes',
  'item.edit': 'Edit',
  'item.delete.title': 'Delete item',
  'item.delete.body': 'Delete this item?',

  'autofill.title': 'Fill credentials',
  'autofill.for': 'For',
  'autofill.app': 'This app',
  'autofill.empty.title': 'No credentials',
  'autofill.empty.text': 'There are no saved passwords that can be used here.',
  'autofill.filling': 'Filling…',
  'autofill.nouser': 'No username',
  'autofill.err': 'Could not fill the form',

  'terms.title': 'Terms and Conditions',
  'terms.0.title': 'Terms and Conditions of Use',
  'terms.0.body':
    'Pass — Secure Vault (hereinafter, the "Application") is developed and operated by Nodus Technology (hereinafter, "Nodus Technology" or the "Company"). By downloading, installing, accessing or using the Application, the user fully, expressly and unconditionally accepts these Terms and Conditions. If the user does not agree with them, they must refrain from using the Application.',
  'terms.1.title': '1. Nature of the service',
  'terms.1.body':
    'The Application is a local manager of passwords, cryptographic seeds, cards and notes that encrypts data on the device itself using the user\'s PIN. All information is stored locally and there is no central server. Nodus Technology has no access, control or knowledge of the user\'s data, passwords, seeds or PIN.',
  'terms.2.title': '2. User responsibility',
  'terms.2.body':
    'The user is solely responsible for: (a) keeping secret and protecting their PIN, username and any unlock method; (b) the use they make of the Application, including the storage, disclosure or processing of the information saved in it; (c) making and keeping backups of their database (pass-database.json) in a safe place; (d) the security and custody of the device where the Application is installed; and (e) not assigning, sharing or transferring their account or data to third parties.',
  'terms.3.title': '3. Risk of data loss',
  'terms.3.body':
    'Nodus Technology shall not be liable for data loss, corruption, destruction or leakage resulting from: uninstalling the Application, restarting or restoring the device, deleting storage, forgetting or losing the PIN, theft or loss of the device, or hardware or software failures. The user assumes such risk and must keep backups up to date.',
  'terms.4.title': '4. Security and passwords',
  'terms.4.body':
    'Encryption depends on the user\'s PIN. A weak, short or shared PIN reduces data protection. Nodus Technology cannot recover PINs, passwords or encrypted data: if the PIN is lost, the stored information becomes unrecoverable.',
  'terms.5.title': '5. No warranties',
  'terms.5.body':
    'The Application is provided "as is" and "as available", without warranties of any kind, express or implied, including, without limitation, those of fitness for a particular purpose, accuracy, availability or absence of errors.',
  'terms.6.title': '6. Limitation of liability',
  'terms.6.body':
    'To the maximum extent permitted by applicable law, Nodus Technology and its officers, employees, agents and collaborators shall not be liable to the user or to third parties for direct, indirect, incidental, special, consequential or punitive damages, loss of profits, loss of data, loss of opportunities, unauthorized access to information or any other loss or harm arising from the use or inability to use the Application, even if the possibility of such damages was warned of.',
  'terms.7.title': '7. Indemnification',
  'terms.7.body':
    'The user agrees to indemnify, defend and hold harmless Nodus Technology and its officers, employees and collaborators from any claim, demand, action or judicial or administrative proceeding, as well as from damages, losses, costs or expenses (including reasonable legal fees) arising directly or indirectly from the user\'s use of the Application, from breach of these Terms or from violation of third-party rights or applicable law.',
  'terms.8.title': '8. Prohibited uses',
  'terms.8.body':
    'It is prohibited to use the Application for unlawful, fraudulent purposes or purposes that violate third-party rights, or to store, manage or disseminate information that infringes applicable legislation.',
  'terms.9.title': '9. Intellectual property',
  'terms.9.body':
    'The Application, its code, design, trademarks, graphics and content are the property of Nodus Technology or its licensors. Its reproduction, distribution or modification, in whole or in part, without prior written authorization is prohibited.',
  'terms.10.title': '10. Modifications',
  'terms.10.body':
    'Nodus Technology may modify these Terms and Conditions at any time. Continued use of the Application after the publication of the modifications constitutes acceptance of them.',
  'terms.11.title': '11. Applicable law and jurisdiction',
  'terms.11.body':
    'These Terms and Conditions shall be governed by applicable law. For any dispute arising in connection with the Application or these Terms, the parties submit to the competent courts, expressly waiving any other jurisdiction.',

  'type.password': 'Password',
  'type.seed': 'Crypto seed',
  'type.card': 'Card',
  'type.note': 'Note',
  'cat.cripto': 'Crypto',
  'cat.banca': 'Banking',
  'cat.social': 'Social',
  'cat.email': 'Email',
  'cat.trabajo': 'Work',
  'cat.compras': 'Shopping',
  'cat.otro': 'Other',
  'vault.unnamed': 'Untitled',
  'vault.seedMeta': 'Seed · {cat}',
  'vault.noteMeta': 'Note',
  'vault.cardMask': '•••• {last}',
  'vault.cardEmpty': 'Card',

  'store.notValid': 'the file contains no valid users',
  'store.notDB': 'the file is not a Pass database',

  'crypto.noArgon2': 'Argon2 is not available in this environment',
};

const table: Record<Lang, Dict> = { es, en };

export function t(key: string, params?: Record<string, string | number>): string {
  let s = table[lang][key] ?? es[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]));
    }
  }
  return s;
}

/** Variante singular/plural: clave.one / clave.other. */
export function tp(key: string, n: number, params?: Record<string, string | number>): string {
  const dict = table[lang];
  const k = n === 1 ? `${key}.one` : `${key}.other`;
  const base = dict[k] ?? dict[key] ?? es[key] ?? key;
  return t(base, params);
}
