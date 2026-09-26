import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDianPlantilla,
  buildDianPlantilla,
  serializeDianPlantilla,
  dianPlantillaFileName,
  generateDianPlantillaFile,
} from './dianPlantilla.service.js';

const baseInput = () => ({
  VersionPlantilla: '1.0',
  TipoDocumento: '01',
  InformacionResolucion: {
    NumeroResolucion: '187640000001',
    Prefijo: 'SETT',
    ConsecutivoDesde: 1,
    ConsecutivoHasta: 500000,
  },
  Emisor: {
    TipoIdentificacion: '31',
    NumeroIdentificacion: '900123456',
    DV: '7',
    RazonSocial: 'MI EMPRESA S.A.S.',
    RegimenFiscal: '48',
    ResponsabilidadFiscal: 'O-47',
    Departamento: '23',
    Municipio: '23001',
  },
  AdquirentePredeterminado: {
    TipoIdentificacion: '13',
    NumeroIdentificacion: '1010123456',
    NombreCompleto: 'JUAN PEREZ',
    RegimenFiscal: '49',
    ResponsabilidadFiscal: 'R-99-PN',
    CorreoElectronico: 'cliente@correo.com',
  },
  DetallesFactura: {
    FechaEmision: '2026-09-20',
    HoraEmision: '10:30:00-05:00',
    Moneda: 'COP',
    FormaPago: '1',
    MedioPago: '10',
  },
  LineasDeFactura: [
    {
      CodigoProducto: 'REF-001',
      NombreProducto: 'SERVICIO DE CONSULTORIA',
      Cantidad: 1,
      UnidadMedida: '94',
      PrecioUnitario: 100000,
      PorcentajeIva: 19,
    },
  ],
});

test('valida y construye una plantilla correcta', () => {
  const { ok, errors } = validateDianPlantilla(baseInput());
  assert.equal(ok, true, errors.join(' | '));

  const { ok: built, plantilla } = buildDianPlantilla(baseInput());
  assert.equal(built, true);
  assert.equal(plantilla.VersionPlantilla, '1.0');
  assert.equal(plantilla.TipoDocumento, '01');
  assert.equal(plantilla.Emisor.NumeroIdentificacion, '900123456');
  assert.equal(plantilla.LineasDeFactura[0].Impuestos[0].CodigoImpuesto, '01');
  assert.equal(plantilla.LineasDeFactura[0].Impuestos[0].ValorImpuesto, 19000);
  assert.equal(plantilla.Totales.SubtotalSinImpuestos, 100000);
  assert.equal(plantilla.Totales.TotalImpuestos, 19000);
  assert.equal(plantilla.Totales.TotalFactura, 119000);
});

test('aplica descuento antes de impuestos', () => {
  const input = baseInput();
  input.LineasDeFactura[0].PrecioUnitario = 100000;
  input.LineasDeFactura[0].Descuento = 20000;
  const { plantilla } = buildDianPlantilla(input);
  assert.equal(plantilla.LineasDeFactura[0].SubtotalLinea, 80000);
  assert.equal(plantilla.LineasDeFactura[0].Impuestos[0].ValorImpuesto, 15200);
  assert.equal(plantilla.Totales.TotalDescuentos, 20000);
  assert.equal(plantilla.Totales.TotalFactura, 95200);
});

test('facturación en nombre y por cuenta de tercero (mandato)', () => {
  const input = baseInput();
  input.FacturaPorCuentaDe = {
    TipoIdentificacion: '31',
    NumeroIdentificacion: '900999999',
    DV: '5',
    RazonSocial: 'MASTERSHOP S.A.S.',
  };
  const { ok, errors } = validateDianPlantilla(input);
  assert.equal(ok, true, errors.join(' | '));

  const { plantilla } = buildDianPlantilla(input);
  assert.equal(plantilla.FacturaPorCuentaDe.RazonSocial, 'MASTERSHOP S.A.S.');
  assert.equal(plantilla.FacturaPorCuentaDe.NumeroIdentificacion, '900999999');
  assert.match(plantilla.DetallesFactura.Observaciones, /EN NOMBRE Y POR CUENTA DE TERCERO/);
  assert.match(plantilla.DetallesFactura.Observaciones, /MASTERSHOP S\.A\.S\./);
});

test('rechaza mandato sin datos del tercero', () => {
  const input = baseInput();
  input.FacturaPorCuentaDe = { RazonSocial: 'X', NumeroIdentificacion: '123' };
  assert.equal(validateDianPlantilla(input).ok, false);
});

test('rechaza tipo de documento inválido', () => {
  const input = baseInput();
  input.TipoDocumento = '99';
  assert.equal(validateDianPlantilla(input).ok, false);
});

test('exige DV cuando el emisor es NIT', () => {
  const input = baseInput();
  delete input.Emisor.DV;
  const { ok, errors } = validateDianPlantilla(input);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('Emisor.DV')));
});

test('no exige DV para cédula', () => {
  const input = baseInput();
  input.AdquirentePredeterminado.TipoIdentificacion = '13';
  assert.equal(validateDianPlantilla(input).ok, true);
});

test('exige PlazoDias cuando FormaPago es crédito', () => {
  const input = baseInput();
  input.DetallesFactura.FormaPago = '2';
  const { ok, errors } = validateDianPlantilla(input);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('PlazoDias')));

  input.DetallesFactura.PlazoDias = 30;
  assert.equal(validateDianPlantilla(input).ok, true);
});

test('rechaza medio de pago inválido', () => {
  const input = baseInput();
  input.DetallesFactura.MedioPago = '99';
  assert.equal(validateDianPlantilla(input).ok, false);
});

test('rechaza descuento mayor al valor de la línea', () => {
  const input = baseInput();
  input.LineasDeFactura[0].Descuento = 999999;
  assert.equal(validateDianPlantilla(input).ok, false);
});

test('rechaza plantilla sin líneas', () => {
  const input = baseInput();
  input.LineasDeFactura = [];
  assert.equal(validateDianPlantilla(input).ok, false);
});

test('rechaza régimen y responsabilidad inconsistentes por código', () => {
  const input = baseInput();
  input.Emisor.RegimenFiscal = '99';
  assert.equal(validateDianPlantilla(input).ok, false);
});

test('serializa con salto de línea final y nombre de archivo .json.dian', () => {
  const { plantilla } = buildDianPlantilla(baseInput());
  const content = serializeDianPlantilla(plantilla);
  assert.ok(content.endsWith('\n'));
  assert.deepEqual(JSON.parse(content).Totales.TotalFactura, 119000);
  assert.equal(dianPlantillaFileName(plantilla), 'plantilla-FE-SETT-187640000001.json.dian');
});

test('generateDianPlantillaFile devuelve errores legibles si es inválido', () => {
  const res = generateDianPlantillaFile({});
  assert.equal(res.ok, false);
  assert.ok(res.errors.length > 0);
});

test('impuesto explícito con base y valor se respeta', () => {
  const input = baseInput();
  input.LineasDeFactura[0] = {
    CodigoProducto: 'X',
    NombreProducto: 'PRODUCTO',
    Cantidad: 2,
    UnidadMedida: '94',
    PrecioUnitario: 50000,
    Impuestos: [{ CodigoImpuesto: '04', Porcentaje: 8, BaseImponible: 100000, ValorImpuesto: 8000 }],
  };
  const { ok, plantilla } = buildDianPlantilla(input);
  assert.equal(ok, true);
  assert.equal(plantilla.LineasDeFactura[0].TotalLinea, 108000);
});
