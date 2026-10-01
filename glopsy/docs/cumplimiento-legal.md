# Hoja de ruta de cumplimiento legal — Glopsy

Marco: **Ley 1581 de 2012** y **Decreto 1377 de 2013** (protección de datos),
**Ley 1480 de 2011** (Estatuto del Consumidor), **Ley 527 de 1999** (comercio
electrónico), **Decreto 1074 de 2015** y directrices de la **SIC**.

> Este documento describe el estado técnico. No constituye asesoría jurídica.

## Implementado (código)

| # | Requisito | Norma | Estado | Dónde |
|---|-----------|-------|--------|-------|
| 1 | Autorización previa, expresa e informada en el registro | Ley 1581 art. 9 | ✅ | `frontend/src/pages/log/login.jsx`, `back/controllers/auth.controller.js`, tabla `user_aceptaciones` |
| 2 | Constancia/trazabilidad del consentimiento (IP, UA, fecha, país) | Ley 1581 arts. 8-9 | ✅ | `back/services/auth.service.js` (`recordUserConsent`), `back/migrations/20261001_create_user_aceptaciones.sql` |
| 3 | Consentimiento en registro/login por redes (OAuth) | Ley 1581 art. 9 | ✅ | `frontend/src/pages/log/authSuccess.jsx`, `frontend/src/pages/log/login.jsx`, `POST /auth/consent` |
| 4 | Banner y consentimiento de cookies / rastreo | Ley 1581, Decreto 1377, RGPD (invitados UE) | ✅ | `frontend/src/components/CookieConsent.jsx`, `frontend/src/utils/cookieConsent.js`, `frontend/src/utils/analytics.js` |
| 5 | Identificación del proveedor (razón social, NIT, domicilio, canal) | Ley 1480 art. 50; Decreto 1074/2015 art. 2.2.2.53.1 | ✅ | `frontend/src/components/footer.jsx`, `frontend/src/utils/termsContent.js` (NIT 700351291) |
| 6 | Derecho de retracto: cláusula e información | Ley 1480 art. 47 | ✅ | `frontend/src/utils/termsContent.js`, `frontend/src/components/RetractoNotice.jsx` (producto y checkout) |
| 7 | Mecanismo de ejercicio del retracto | Ley 1480 art. 47 | ✅ | `frontend/src/pages/compras/compraDetail.jsx` (opción "Retracto"), `back/controllers/returns.controller.js` |
| 8 | Derechos ARCO (acceso, supresión, revocatoria) | Ley 1581 art. 8 | ✅ | `GET /auth/me/export`, `DELETE /auth/me`, pestaña Privacidad en `frontend/src/pages/profile/profile.jsx` |
| 9 | Autorización expresa y separada para datos biométricos (sensibles) | Ley 1581 arts. 5-6 | ✅ | `frontend/src/components/navbar.jsx`, `frontend/src/pages/profile/profile.jsx` |
| 10 | Verificación de mayoría de edad (18+) | Ley 1480; Ley 1581 (menores) | ✅ | `frontend/src/pages/log/login.jsx`, `back/controllers/auth.controller.js` |
| 11 | Operación y transferencia internacional (Colombia/Venezuela) | Decreto 1377/2013 | ✅ | `frontend/src/utils/termsContent.js`, `frontend/src/pages/privacidad/privacidad.jsx` |

## Pendiente (no resuelve código / gestión legal)

| # | Requisito | Norma | Responsable |
|---|-----------|-------|-------------|
| A | RUT y registro mercantil de Nodux Technology | Código de Comercio | Legal/contable |
| B | Facturación electrónica DIAN | DIAN | Contable (campos fiscales ya implementados) |
| C | Dirección física y teléfono del proveedor (si existen) | Ley 1480 art. 50 | Legal — hoy solo canal electrónico |
| D | Manual interno de políticas y procedimientos de datos | Decreto 1377/2013 | Legal — borrador creado en `docs/manual-proteccion-datos.md` (faltan [designar oficial] y firma) |
| E | Registro Nacional de Bases de Datos (RNBD) ante la SIC si se supera el umbral de activos (100.000 UVT) | Ley 1581, Decreto 1074/2015 | Legal |
| F | Verificación de vendedores (RUT / registro mercantil) | Ley 1480; términos | Operaciones |
| G | Revisión por abogado del contenido de Términos, Privacidad y Contrato de Mandato | — | Legal |

## Venezuela — modelo transfronterizo (cripto/pagos)

Glopsy opera en Venezuela como **empresa transfronteriza**, sin realizar por
cuenta propia las actividades reguladas de criptoactivos que la ley venezolana
reserva a sujetos habilitados.

**Diseño declarado**
- **IVA/SENIAT:** el impuesto de la venta corresponde al **vendedor/proveedor**;
  Glopsy actúa como intermediario tecnológico bajo contrato de mandato.
- **Bolívares (VES):** la conversión y la pata en bolívares la ejecuta un
  **tercero regulado (VexPay)**. Glopsy no opera el cambio a VES.
- **USDT:** la custodia/recepción se realiza en la **red blockchain**, fuera de
  Venezuela, sin que Glopsy mantenga los activos en el país ni preste servicios
  de intercambio o custodia por cuenta de terceros dentro del territorio.

**Criterios que sostienen la posición (a mantener)**
- La entidad, las claves/wallets y la operación permanecen fuera de Venezuela.
- No hay establecimiento ni actividad de intercambio/custodia en el país.
- El tramo en bolívares lo asume VexPay, que es el sujeto regulado.
- El servicio no se ofrece como casa de cambio ni custodia de criptoactivos.

**Riesgos residuales a cubrir (no bloqueantes)**
- La regulación atiende a la **actividad**, no a la moneda: evitar que Glopsy
  custodie activos *por cuenta de terceros* o intermedie precios desde Venezuela.
- **AML/CFT y sanciones (OFAC):** al mover USDT aplican expectativas de
  prevención de legitimación de capitales y, sobre todo, cumplimiento de
  sanciones internacionales. Mantener política de KYC/riesgo en la contraparte.
- **Comisión de Glopsy:** el IVA de los bienes es del vendedor, pero la
  **comisión/servicio de intermediación** de Glopsy puede ser un servicio digital
  gravado en Venezuela; definir quién factura y desde dónde.
- **VexPay:** dejar por contrato que asume la pata VES, su KYC/AML y su número de
  habilitación (dependencia de un tercero regulado).
- **Consumidor (SUNDDE)** y **habeas data** siguen aplicando a los clientes en
  Venezuela independientemente de la naturaleza transfronteriza de la empresa.

## Notas de mantenimiento

- Al cambiar el contenido de Términos o Privacidad, actualizar `TERMS_VERSION` /
  `PRIVACY_VERSION` en `frontend/src/utils/termsContent.js`. La app registra el
  consentimiento cuando la versión cambia.
- La firma electrónica de la aceptación del vendedor (contrato de mandato) se
  registra en `tienda_aceptaciones`.
- Los datos con obligación legal/fiscal (pedidos) se conservan anonimizados tras
  la supresión de cuenta.
