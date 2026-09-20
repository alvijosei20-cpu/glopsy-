// ==========================================
// Generador + validador de plantilla DIAN (.json.dian)
// Solución Gratuita de Facturación Electrónica.
//
// El esquema oficial del archivo importable no está publicado por la
// DIAN, así que este módulo define el contrato interno de la aplicación:
// valida, normaliza, calcula totales y serializa una plantilla lista para
// descargar como .json.dian e importar en el portal DIAN.
// ==========================================

import {
  TIPOS_DOCUMENTO,
  TIPOS_IDENTIFICACION,
  REGIMENES,
  RESPONSABILIDADES,
  FORMAS_PAGO,
  MEDIOS_PAGO,
  TIPOS_IMPUESTO,
  isNit,
  codigoValido,
} from '../utils/dianCatalogs.js';
import { isValidDateString, isEmail } from '../utils/validation.js';

export const VERSION_PLANTILLA = '1.0';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:[+-]\d{2}:\d{2}|Z)?$/;
const MONEDA_REGEX = /^[A-Z]{3}$/;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const digits = (v) => str(v).replace(/[^\d]/g, '');
const intOf = (v) => {
  if (v === undefined || v === null || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const numOf = (v) => {
  if (v === undefined || v === null || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const pushIf = (errors, path, condition, message) => {
  if (condition) errors.push(`${path}: ${message}`);
};

// ---------------------------------------------------------------
// Validación
// ---------------------------------------------------------------

export const validateDianPlantilla = (input) => {
  const errors = [];
  if (!isPlainObject(input)) return { ok: false, errors: ['La plantilla debe ser un objeto JSON.'] };

  pushIf(errors, 'VersionPlantilla', input.VersionPlantilla !== undefined && str(input.VersionPlantilla) !== VERSION_PLANTILLA,
    `debe ser "${VERSION_PLANTILLA}".`);
  pushIf(errors, 'TipoDocumento', !codigoValido(TIPOS_DOCUMENTO, str(input.TipoDocumento)),
    'código inválido. Use 01/02/03.');

  // Información de resolución
  const res = input.InformacionResolucion;
  if (!isPlainObject(res)) {
    errors.push('InformacionResolucion: es obligatorio.');
  } else {
    pushIf(errors, 'InformacionResolucion.NumeroResolucion', !digits(res.NumeroResolucion), 'es obligatorio (solo dígitos).');
    pushIf(errors, 'InformacionResolucion.Prefijo', !str(res.Prefijo), 'es obligatorio.');
    pushIf(errors, 'InformacionResolucion.Prefijo', str(res.Prefijo).length > 20, 'máximo 20 caracteres.');
    const desde = intOf(res.ConsecutivoDesde);
    const hasta = intOf(res.ConsecutivoHasta);
    pushIf(errors, 'InformacionResolucion.ConsecutivoDesde', !Number.isFinite(desde) || desde < 1, 'debe ser un entero >= 1.');
    pushIf(errors, 'InformacionResolucion.ConsecutivoHasta', !Number.isFinite(hasta) || hasta < 1, 'debe ser un entero >= 1.');
    if (Number.isFinite(desde) && Number.isFinite(hasta) && hasta < desde) {
      errors.push('InformacionResolucion.ConsecutivoHasta: debe ser >= ConsecutivoDesde.');
    }
    if (res.FechaDesde) pushIf(errors, 'InformacionResolucion.FechaDesde', !isValidDateString(res.FechaDesde), 'fecha inválida (YYYY-MM-DD).');
    if (res.FechaHasta) pushIf(errors, 'InformacionResolucion.FechaHasta', !isValidDateString(res.FechaHasta), 'fecha inválida (YYYY-MM-DD).');
  }

  // Emisor
  errors.push(...validateParte(input.Emisor, 'Emisor', { obligatorio: true }));

  // Adquirente (opcional en la plantilla; el portal permite completarlo al emitir)
  if (input.AdquirentePredeterminado !== undefined && input.AdquirentePredeterminado !== null) {
    errors.push(...validateParte(input.AdquirentePredeterminado, 'AdquirentePredeterminado', { obligatorio: false }));
  }

  // Detalles de factura
  const det = input.DetallesFactura;
  if (!isPlainObject(det)) {
    errors.push('DetallesFactura: es obligatorio.');
  } else {
    pushIf(errors, 'DetallesFactura.FechaEmision', !isValidDateString(det.FechaEmision), 'fecha inválida (YYYY-MM-DD).');
    pushIf(errors, 'DetallesFactura.HoraEmision', !HORA_REGEX.test(str(det.HoraEmision)), 'hora inválida (HH:mm:ss con zona, ej. 10:30:00-05:00).');
    pushIf(errors, 'DetallesFactura.Moneda', !MONEDA_REGEX.test(str(det.Moneda)), 'debe ser un código ISO de 3 letras (ej. COP).');
    pushIf(errors, 'DetallesFactura.FormaPago', !codigoValido(FORMAS_PAGO, str(det.FormaPago)), 'código inválido. Use 1 (contado) o 2 (crédito).');
    const medioPago = det.MedioPago ?? det.MetodoPago;
    pushIf(errors, 'DetallesFactura.MedioPago', !codigoValido(MEDIOS_PAGO, str(medioPago)), 'código inválido (10, 20, 42, 45, 46, 47, 48, 49).');
    if (str(det.FormaPago) === '2') {
      const plazo = intOf(det.PlazoDias);
      pushIf(errors, 'DetallesFactura.PlazoDias', !Number.isFinite(plazo) || plazo < 1, 'es obligatorio y > 0 cuando FormaPago es crédito (2).');
    }
  }

  // Líneas
  if (!Array.isArray(input.LineasDeFactura) || input.LineasDeFactura.length === 0) {
    errors.push('LineasDeFactura: debe tener al menos una línea.');
  } else {
    input.LineasDeFactura.forEach((linea, i) => {
      errors.push(...validateLinea(linea, i));
    });
  }

  return { ok: errors.length === 0, errors };
};

const validateParte = (parte, path, { obligatorio }) => {
  const errors = [];
  if (!isPlainObject(parte)) {
    if (obligatorio) errors.push(`${path}: es obligatorio.`);
    return errors;
  }
  const tipo = str(parte.TipoIdentificacion);
  pushIf(errors, `${path}.TipoIdentificacion`, !codigoValido(TIPOS_IDENTIFICACION, tipo), 'código inválido (13, 31, 41, 42, ...).');
  const numero = digits(parte.NumeroIdentificacion);
  pushIf(errors, `${path}.NumeroIdentificacion`, numero.length < 5 || numero.length > 20, 'debe tener entre 5 y 20 dígitos.');
  if (isNit(tipo)) {
    pushIf(errors, `${path}.DV`, !/^\d$/.test(str(parte.DV)), 'es obligatorio (un dígito) cuando el tipo de identificación es NIT.');
  }
  const nombre = str(parte.RazonSocial) || str(parte.NombreCompleto) || str(parte.PrimerNombre);
  pushIf(errors, `${path}.RazonSocial`, !nombre, 'debe indicar RazonSocial, NombreCompleto o PrimerNombre.');
  pushIf(errors, `${path}.RegimenFiscal`, !codigoValido(REGIMENES, str(parte.RegimenFiscal)), 'código inválido (48 o 49).');
  pushIf(errors, `${path}.ResponsabilidadFiscal`, !codigoValido(RESPONSABILIDADES, str(parte.ResponsabilidadFiscal)), 'código inválido (O-13, O-15, O-23, O-47, R-99-PN).');
  if (parte.Departamento) pushIf(errors, `${path}.Departamento`, !/^\d{2}$/.test(str(parte.Departamento)), 'debe ser el código DANE de 2 dígitos.');
  if (parte.Municipio) pushIf(errors, `${path}.Municipio`, !/^\d{5}$/.test(str(parte.Municipio)), 'debe ser el código DANE de 5 dígitos.');
  if (parte.CorreoElectronico) pushIf(errors, `${path}.CorreoElectronico`, !isEmail(parte.CorreoElectronico), 'correo inválido.');
  return errors;
};

const validateLinea = (linea, i) => {
  const errors = [];
  const path = `LineasDeFactura[${i}]`;
  if (!isPlainObject(linea)) return [`${path}: debe ser un objeto.`];

  const cantidad = numOf(linea.Cantidad);
  pushIf(errors, `${path}.Cantidad`, !Number.isFinite(cantidad) || cantidad <= 0, 'debe ser mayor que 0.');
  pushIf(errors, `${path}.UnidadMedida`, !str(linea.UnidadMedida), 'es obligatoria (estándar UN/ECE, ej. 94).');
  const precio = numOf(linea.PrecioUnitario);
  pushIf(errors, `${path}.PrecioUnitario`, !Number.isFinite(precio) || precio < 0, 'debe ser >= 0.');
  pushIf(errors, `${path}.NombreProducto`, !str(linea.NombreProducto), 'es obligatorio.');
  const descuento = numOf(linea.Descuento ?? 0);
  pushIf(errors, `${path}.Descuento`, !Number.isFinite(descuento) || descuento < 0, 'debe ser >= 0.');
  if (Number.isFinite(cantidad) && Number.isFinite(precio) && Number.isFinite(descuento) && descuento > cantidad * precio) {
    errors.push(`${path}.Descuento: no puede superar el valor de la línea.`);
  }

  const impuestos = normalizarImpuestosDeEntrada(linea);
  impuestos.forEach((imp, j) => {
    const ip = `${path}.Impuestos[${j}]`;
    pushIf(errors, `${ip}.CodigoImpuesto`, !codigoValido(TIPOS_IMPUESTO, str(imp.CodigoImpuesto)), 'código inválido (01 IVA, 04 INC).');
    const pct = numOf(imp.Porcentaje);
    pushIf(errors, `${ip}.Porcentaje`, !Number.isFinite(pct) || pct < 0 || pct > 100, 'debe estar entre 0 y 100.');
    if (imp.BaseImponible !== undefined) pushIf(errors, `${ip}.BaseImponible`, !Number.isFinite(numOf(imp.BaseImponible)) || numOf(imp.BaseImponible) < 0, 'debe ser >= 0.');
    if (imp.ValorImpuesto !== undefined) pushIf(errors, `${ip}.ValorImpuesto`, !Number.isFinite(numOf(imp.ValorImpuesto)) || numOf(imp.ValorImpuesto) < 0, 'debe ser >= 0.');
  });
  return errors;
};

// Acepta Impuestos[] o el atajo PorcentajeIva.
const normalizarImpuestosDeEntrada = (linea) => {
  if (Array.isArray(linea.Impuestos) && linea.Impuestos.length > 0) return linea.Impuestos;
  const pct = numOf(linea.PorcentajeIva);
  if (Number.isFinite(pct) && pct > 0) return [{ CodigoImpuesto: '01', Porcentaje: pct }];
  return [];
};

// ---------------------------------------------------------------
// Normalización + cálculo
// ---------------------------------------------------------------

const normParte = (parte) => {
  if (!isPlainObject(parte)) return undefined;
  const tipo = str(parte.TipoIdentificacion);
  const out = {
    TipoIdentificacion: tipo,
    NumeroIdentificacion: digits(parte.NumeroIdentificacion),
    DV: isNit(tipo) || parte.DV !== undefined ? str(parte.DV) || null : null,
    RegimenFiscal: str(parte.RegimenFiscal),
    ResponsabilidadFiscal: str(parte.ResponsabilidadFiscal),
    Direccion: str(parte.Direccion) || null,
    Departamento: str(parte.Departamento) || null,
    Municipio: str(parte.Municipio) || null,
    CorreoElectronico: str(parte.CorreoElectronico) || null,
    Telefono: str(parte.Telefono) || null,
  };
  if (str(parte.RazonSocial)) out.RazonSocial = str(parte.RazonSocial);
  if (str(parte.NombreCompleto)) out.NombreCompleto = str(parte.NombreCompleto);
  if (str(parte.PrimerNombre)) out.PrimerNombre = str(parte.PrimerNombre);
  if (str(parte.PrimerApellido)) out.PrimerApellido = str(parte.PrimerApellido);
  return out;
};

const normLinea = (linea, i) => {
  const cantidad = round2(numOf(linea.Cantidad));
  const precio = round2(numOf(linea.PrecioUnitario));
  const descuento = round2(numOf(linea.Descuento ?? 0) || 0);
  const base = round2(cantidad * precio - descuento);

  const impuestos = normalizarImpuestosDeEntrada(linea).map((imp) => {
    const pct = round2(numOf(imp.Porcentaje) || 0);
    const baseImponible = imp.BaseImponible !== undefined ? round2(numOf(imp.BaseImponible)) : base;
    const valor = imp.ValorImpuesto !== undefined ? round2(numOf(imp.ValorImpuesto)) : round2(baseImponible * pct / 100);
    return {
      CodigoImpuesto: String(imp.CodigoImpuesto).padStart(2, '0'),
      Porcentaje: pct,
      BaseImponible: baseImponible,
      ValorImpuesto: valor,
    };
  });
  const totalImpuestos = round2(impuestos.reduce((acc, x) => acc + x.ValorImpuesto, 0));

  return {
    NumeroLinea: i + 1,
    CodigoProducto: str(linea.CodigoProducto) || null,
    NombreProducto: str(linea.NombreProducto),
    Cantidad: cantidad,
    UnidadMedida: str(linea.UnidadMedida),
    PrecioUnitario: precio,
    Descuento: descuento,
    Impuestos: impuestos,
    SubtotalLinea: base,
    TotalLinea: round2(base + totalImpuestos),
  };
};

export const buildDianPlantilla = (input) => {
  const { ok, errors } = validateDianPlantilla(input);
  if (!ok) return { ok: false, errors, plantilla: null };

  const res = input.InformacionResolucion;
  const det = input.DetallesFactura;
  const lineas = input.LineasDeFactura.map(normLinea);

  const subtotalSinImpuestos = round2(lineas.reduce((a, l) => a + l.SubtotalLinea, 0));
  const totalDescuentos = round2(lineas.reduce((a, l) => a + l.Descuento, 0));
  const totalImpuestos = round2(lineas.reduce((a, l) => a + l.Impuestos.reduce((b, x) => b + x.ValorImpuesto, 0), 0));

  const plantilla = {
    VersionPlantilla: VERSION_PLANTILLA,
    TipoDocumento: str(input.TipoDocumento).padStart(2, '0'),
    InformacionResolucion: {
      NumeroResolucion: digits(res.NumeroResolucion),
      FechaDesde: str(res.FechaDesde) || null,
      FechaHasta: str(res.FechaHasta) || null,
      Prefijo: str(res.Prefijo),
      ConsecutivoDesde: intOf(res.ConsecutivoDesde),
      ConsecutivoHasta: intOf(res.ConsecutivoHasta),
    },
    Emisor: normParte(input.Emisor),
    AdquirentePredeterminado: normParte(input.AdquirentePredeterminado) ?? null,
    DetallesFactura: {
      FechaEmision: str(det.FechaEmision),
      HoraEmision: str(det.HoraEmision),
      Moneda: str(det.Moneda).toUpperCase(),
      FormaPago: String(det.FormaPago),
      MedioPago: String(det.MedioPago ?? det.MetodoPago),
      PlazoDias: str(det.FormaPago) === '2' ? intOf(det.PlazoDias) : null,
      Observaciones: str(det.Observaciones) || null,
    },
    LineasDeFactura: lineas,
    Totales: {
      SubtotalSinImpuestos: subtotalSinImpuestos,
      TotalDescuentos: totalDescuentos,
      TotalImpuestos: totalImpuestos,
      TotalFactura: round2(subtotalSinImpuestos + totalImpuestos),
    },
  };

  return { ok: true, errors: [], plantilla };
};

// ---------------------------------------------------------------
// Serialización / nombre de archivo
// ---------------------------------------------------------------

export const serializeDianPlantilla = (plantilla) => `${JSON.stringify(plantilla, null, 2)}\n`;

const sanitizeFileNamePart = (value) => String(value || '').replace(/[^A-Za-z0-9._-]/g, '');

export const dianPlantillaFileName = (plantilla) => {
  const prefijo = sanitizeFileNamePart(plantilla?.InformacionResolucion?.Prefijo) || 'SINPREFIJO';
  const resolucion = sanitizeFileNamePart(plantilla?.InformacionResolucion?.NumeroResolucion) || 'SINRESOLUCION';
  return `plantilla-FE-${prefijo}-${resolucion}.json.dian`;
};

// Atajo: valida, construye y serializa. Devuelve errores legibles si falla.
export const generateDianPlantillaFile = (input) => {
  const result = buildDianPlantilla(input);
  if (!result.ok) return result;
  return {
    ok: true,
    errors: [],
    plantilla: result.plantilla,
    filename: dianPlantillaFileName(result.plantilla),
    content: serializeDianPlantilla(result.plantilla),
  };
};
