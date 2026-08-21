# Autenticación Biométrica con UI Condicional (Passkeys / Huella)

Se ha implementado el soporte backend completo para WebAuthn / Passkeys utilizando **UI Condicional (Conditional UI)**.

## Endpoints Backend Disponibles

1. **Registrar Huella (Requiere autenticación previa)**:
   - `POST /api/auth/biometric/register-options` (Obtiene opciones de registro WebAuthn)
   - `POST /api/auth/biometric/register-verify` (Verifica y guarda la credencial biométrica en el usuario)

2. **Iniciar Sesión con Huella (UI Condicional - Público)**:
   - `POST /api/auth/biometric/login-options` (Obtiene opciones de autenticación con `allowCredentials: []`)
   - `POST /api/auth/biometric/login-verify` (Verifica la aserción biométrica y devuelve el JWT y datos del usuario)

---

## Ejemplo de Implementación Frontend (UI Condicional)

Para habilitar la UI Condicional (autocompletado de huella en el campo de correo/usuario):

```javascript
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

// 1. REGISTRAR HUELLA (Estando logueado en configuración de perfil)
async function registerFingerprint(token) {
  // A. Obtener opciones del servidor
  const resOpts = await fetch('/api/auth/biometric/register-options', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { options } = await resOpts.json();

  // B. Ejecutar ceremonia del navegador (lector de huella / passkey)
  const attResp = await startRegistration({ optionsJSON: options });

  // C. Enviar respuesta al servidor para verificar y guardar
  const resVerify = await fetch('/api/auth/biometric/register-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(attResp)
  });
  const result = await resVerify.json();
  if (result.ok) {
    alert('¡Huella registrada con éxito!');
  }
}

// 2. INICIAR SESIÓN CON UI CONDICIONAL (En la página de Login)
async function initConditionalUI() {
  if (!window.PublicKeyCredential || !await PublicKeyCredential.isConditionalMediationAvailable?.()) {
    console.log('UI Condicional no soportada en este navegador.');
    return;
  }

  try {
    // A. Obtener opciones de login del servidor
    const resOpts = await fetch('/api/auth/biometric/login-options', { method: 'POST' });
    const { options } = await resOpts.json();

    // B. Iniciar autenticación con mediation: 'conditional'
    // Esto hace que aparezca la passkey/huella directamente en el autocompletado del input email
    const authResp = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: true, // o mediation: 'conditional'
    });

    // C. Enviar respuesta de autenticación al servidor
    const resVerify = await fetch('/api/auth/biometric/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authResp)
    });
    const result = await resVerify.json();

    if (result.ok) {
      // Guardar token JWT y redirigir
      localStorage.setItem('token', result.token);
      window.location.href = '/dashboard';
    }
  } catch (error) {
    console.error('Error en autenticación biométrica:', error);
  }
}
```
