# Manual interno de políticas y procedimientos para el tratamiento de datos personales

**Responsable del tratamiento:** Nodux Technology — NIT 700351291
**Plataforma:** Glopsy® (app.glopsy.shop)
**Versión del manual:** v1.0
**Fecha de adopción:** [AAAA-MM-DD]
**Aprobado por:** [Representante legal]
**Oficial de protección de datos:** [Nombre] — [cargo] — soporte@glopsy.com

> Documento de uso interno. No se publica en la web. La Política de Privacidad
> publicada en `/privacidad` es la versión de cara al titular.
>
> Borrador para revisión de un abogado. Ajustar los campos entre corchetes.

---

## 1. Objetivo

Establecer las políticas y procedimientos internos que Nodux Technology (en
adelante "Glopsy" o "el Responsable") aplica para garantizar el adecuado
tratamiento de los datos personales de sus usuarios, en cumplimiento de la
Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015)
y las directrices de la Superintendencia de Industria y Comercio (SIC),
especialmente para la atención de consultas y reclamos.

## 2. Alcance

Aplica a todas las bases de datos y sistemas de Glopsy donde se traten datos
personales, y a todo el personal, contratistas y encargados que accedan a ellos.

## 3. Marco legal

- Ley 1581 de 2012 — protección de datos personales.
- Decreto 1377 de 2013 y Decreto 1074 de 2015 — reglamentación.
- Ley 1480 de 2011 — Estatuto del Consumidor (incluye derecho de retracto, art. 47).
- Ley 527 de 1999 — comercio electrónico.
- Circulares y guías de la SIC sobre protección de datos.

## 4. Definiciones

- **Titular:** persona natural cuyos datos se tratan.
- **Responsable:** Nodux Technology, quien decide sobre la base de datos.
- **Encargado:** tercero que trata datos por cuenta del Responsable.
- **Autorización:** consentimiento previo, expreso e informado del titular.
- **Dato sensible:** incluye los biométricos (huella/rostro), que requieren
  autorización expresa y separada.

## 5. Principios rectores

Finalidad, libertad, veracidad, transparencia, acceso y circulación restringida,
seguridad y confidencialidad (Ley 1581, art. 4).

## 6. Roles y responsables

| Rol | Quién | Responsabilidad |
|-----|-------|-----------------|
| Responsable del tratamiento | Nodux Technology | Decide finalidades y trata los datos |
| Oficial de protección de datos | [Por designar] | Atender consultas/reclamos, custodiar este manual y el log |
| Encargados | Pasarelas de pago, transportadoras, proveedores de nube (Railway, Neon, Cloudflare, Upstash) | Tratan datos por instrucción del Responsable |

## 7. Bases de datos y categorías de datos

| Base | Datos | Sensible |
|------|-------|----------|
| `users` | nombre, correo, teléfono, documento, fecha de nacimiento, género, avatar | |
| `users` (biométrico) | credencial WebAuthn / huella | Sí |
| `user_addresses` | dirección, ciudad, teléfono | |
| `user_cards` | titular, últimos 4 dígitos, marca, vencimiento (nunca la tarjeta completa) | |
| `orders`, `returns` | pedidos, devoluciones, montos, dirección de entrega | |
| `notifications` | notificaciones y suscripciones push | |
| `user_aceptaciones` | constancia de consentimiento (Términos/Privacidad/biométrico) | |
| `tienda_aceptaciones` | aceptación de Términos y contrato de mandato (vendedores) | |

## 8. Finalidades

Prestación del servicio (cuenta, autenticación, compras, pagos, envíos,
devoluciones y garantías), seguridad y prevención de fraude, comunicaciones
transaccionales, comunicaciones comerciales solo con autorización, y
cumplimiento de obligaciones legales, fiscales y contables.

## 9. Autorización y su trazabilidad

- **Registro por correo:** checkbox obligatorio de Términos y Privacidad antes de crear la cuenta.
- **Registro/login por redes (OAuth):** aviso de aceptación y registro de constancia tras el ingreso.
- **Datos biométricos:** autorización **expresa y separada** antes de enrolar; es
  opcional y revocable.
- **Constancia:** cada aceptación se guarda en `user_aceptaciones` con versión
  (`user_aceptaciones.terms_version` / `privacy_version`), fecha, IP, navegador,
  dispositivo, país, idioma y metadatos.
- **Versionado:** al cambiar Términos/Privacidad se incrementa `TERMS_VERSION` /
  `PRIVACY_VERSION` (`frontend/src/utils/termsContent.js`); la app vuelve a
  registrar el consentimiento cuando la versión difiere.

## 10. Derechos de los titulares

Conocer, actualizar, rectificar y suprimir sus datos; solicitar prueba de la
autorización; ser informado del uso dado a sus datos; revocar la autorización;
presentar quejas ante la SIC.

**Autoservicio implementado:** descarga de datos (`GET /auth/me/export`),
eliminación/anonimización de cuenta (`DELETE /auth/me`), revocatoria biométrica
(`DELETE /auth/biometric`) e historial de autorizaciones en Mi Perfil → Privacidad.

## 11. Procedimiento de consultas y reclamos

**Canal único:** soporte@glopsy.com (y soporte dentro de la app).

**Consultas** (Ley 1581, art. 14): se responde en máximo **10 días hábiles**,
prorrogables **5 días hábiles** más, informando el motivo.

**Reclamos** (Ley 1581, art. 15): se responde en máximo **15 días hábiles**,
prorrogables **8 días hábiles** más, informando el motivo.

**Pasos:**
1. Recepción: se registra en el log (Anexo A) con fecha y hora.
2. Verificación de identidad del titular (documento y correo registrado).
3. Clasificación: consulta o reclamo; y tipo (acceso, corrección, supresión, revocatoria…).
4. Gestión: si aplica, se ejecuta en el sistema (export/supresión/etc.).
5. Respuesta por escrito dentro del plazo, con las acciones tomadas.
6. Cierre: se actualiza el log con la fecha de respuesta.
7. Si el titular queda inconforme, se le informa que puede acudir a la SIC.

Si la solicitud llega incompleta, se pide subsanación dentro de los 5 días
siguientes; si no responde, se archiva (Ley 1581, art. 16).

## 12. Medidas de seguridad

**Técnicas:** HTTPS/TLS; cookies de sesión `HttpOnly` + `Secure` + `SameSite`;
JWT con expiración y sesiones revocables en Redis; contraseñas con hashing
`scrypt`; autenticación biométrica WebAuthn (la huella nunca sale del
dispositivo); cifrado de secretos de integración (`APP_ENC_KEY`); encabezados de
seguridad (Helmet) y límite de peticiones (rate limiting); almacenamiento de
tarjetas solo con últimos 4 dígitos y token de la pasarela.

**Administrativas:** acceso mínimo necesario, control por roles, registro de
aceptaciones, este manual y su revisión periódica.

**Humanas:** inducción al personal con acceso a datos y obligación de
confidencialidad.

## 13. Conservación y supresión

Los datos se conservan mientras exista la finalidad o una obligación legal. Al
eliminar la cuenta, los datos personales se anonimizan y se revoca la sesión;
los pedidos con obligación fiscal/contable se conservan sin datos que identifiquen
directamente a la persona.

## 14. Transferencias y transmisiones

Se comparten datos con vendedores, transportadoras y pasarelas de pago solo en lo
necesario para la operación. Las transferencias internacionales se realizan bajo
medidas de seguridad y mecanismos de protección (Decreto 1377/2013). Para usuarios
en Venezuela aplica además la normativa venezolana en lo pertinente.

## 15. Cookies y tecnologías de seguimiento

Solo se cargan cookies/analítica no esenciales (p. ej. Google Analytics) tras el
consentimiento del usuario en el banner. El usuario puede rechazarlas o cambiar
su decisión desde "Cookies" en el pie de página.

## 16. Incidentes de seguridad

1. Detección y contención del incidente.
2. Registro (fecha, alcance, datos afectados).
3. Evaluación del riesgo para los titulares.
4. Si hay riesgo, informar a los titulares afectados y reportar a la SIC.
5. Acciones correctivas y cierre documentado.

## 17. Capacitación

Inducción anual y al ingreso a todo el personal con acceso a datos, con constancia.

## 18. Vigencia y actualización

Rige desde su adopción. Se revisa al menos anualmente o cuando cambien procesos,
proveedores, países de operación o la normativa. Cada cambio genera una nueva
versión con fecha.

---

## Anexo A — Formato del log de solicitudes

Mantener en `docs/log-solicitudes-datos.csv` (una fila por solicitud):

| Campo | Descripción |
|-------|-------------|
| `id` | consecutivo |
| `fecha_recepcion` | fecha y hora de entrada |
| `canal` | correo/app |
| `titular_nombre` | nombre |
| `titular_documento` | documento |
| `titular_correo` | correo asociado |
| `tipo` | consulta / reclamo |
| `subtipo` | acceso / correccion / supresion / revocatoria / otro |
| `detalle` | descripción de la solicitud |
| `identidad_verificada` | sí/no |
| `fecha_limite` | fecha máxima de respuesta según plazos |
| `accion_tomada` | gestión realizada |
| `fecha_respuesta` | fecha de respuesta |
| `estado` | abierta / respondida / archivada |
| `responsable` | quien atiende |

## Anexo B — Plantilla de respuesta a consulta

> Asunto: Respuesta a su consulta sobre datos personales — [radicado]
>
> Estimado(a) [nombre]: en atención a su consulta radicada el [fecha], le
> informamos que [respuesta]. Usted puede ejercer sus derechos escribiendo a
> soporte@glopsy.com. Si no está conforme, puede acudir a la Superintendencia de
> Industria y Comercio (SIC).
>
> Atentamente, Nodux Technology — Protección de Datos.

## Anexo C — Plantilla de respuesta a reclamo

> Asunto: Respuesta a su reclamo sobre datos personales — [radicado]
>
> Estimado(a) [nombre]: en atención a su reclamo radicado el [fecha], y tras
> verificar [hechos], le informamos que [decisión y acciones]. Esta respuesta se
> emite dentro del término legal. Puede acudir a la SIC si no está conforme.
>
> Atentamente, Nodux Technology — Protección de Datos.
