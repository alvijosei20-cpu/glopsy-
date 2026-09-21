// IVA por país y detección heurística de bienes no gravables.
// Solo informativo: no modifica precios.

export const IVA_RATES = { CO: 19, VE: 16 };

// Bienes excluidos de IVA — Art. 424 Estatuto Tributario (Colombia).
const CO_EXCLUIDOS = [
  'animal vivo', 'animales vivos', 'ganado', 'bovino', 'porcino', 'ovino', 'caprino',
  'pollo', 'gallina', 'carne', 'pescado', 'atun', 'crustaceo', 'marisco',
  'leche', 'lacteo', 'queso', 'cuajada', 'yogurt', 'huevo',
  'cafe', 'arroz', 'maiz', 'trigo', 'avena', 'cebada', 'sorgo',
  'frijol', 'lenteja', 'garbanzo', 'arveja', 'soya',
  'pan', 'panela', 'sal', 'agua potable', 'agua embotellada',
  'papa', 'platano', 'banano', 'yuca', 'cebolla', 'tomate', 'zanahoria',
  'hortaliza', 'verdura', 'legumbre', 'fruta', 'naranja', 'mandarina', 'limon',
  'guayaba', 'mora', 'lulo', 'maracuya', 'piña', 'mango', 'aguacate', 'papaya',
  'medicamento', 'medicina', 'vacuna', 'suero',
  'abono', 'fertilizante', 'insecticida', 'semilla',
  'libro', 'revista', 'periodico',
];

// Bienes exentos de IVA (tarifa 0%) — Art. 477 Estatuto Tributario (Colombia).
const CO_EXENTOS = [
  'computador', 'computadora', 'tableta', 'telefono inteligente', 'celular inteligente',
  'modulo solar', 'panel solar', 'energia solar', 'biodigestor',
  'insumo agricola', 'maquinaria agricola',
  'jeringa', 'aguja', 'gas medicinal', 'oxigeno medicinal',
  'buque', 'embarcacion', 'avion', 'aeronave',
  'papel para imprenta',
];

// Bienes exentos — Artículo 18 Ley de IVA (Venezuela).
const VE_EXENTOS_BIENES = [
  'animal vivo', 'animales vivos', 'ganado', 'bovino', 'porcino', 'ovino', 'caprino',
  'pollo', 'gallina', 'carne', 'ave', 'pescado', 'marisco', 'crustaceo', 'huevo',
  'leche', 'lacteo', 'queso', 'mantequilla', 'grasa', 'aceite',
  'arroz', 'maiz', 'trigo', 'avena', 'cebada', 'cereal',
  'caraota', 'frijol', 'lenteja', 'garbanzo', 'arveja', 'leguminosa',
  'papa', 'yuca', 'platano', 'ocumo', 'auyama', 'apio', 'tuberculo',
  'cebolla', 'tomate', 'zanahoria', 'hortaliza', 'verdura', 'fruta',
  'sal', 'azucar', 'panela', 'pan', 'pasta alimenticia', 'cafe', 'cacao',
  'especia', 'salsa', 'producto de panaderia', 'alimento para animal',
  'medicamento', 'medicina', 'vacuna', 'suero', 'producto farmaceutico',
  'abono', 'fertilizante', 'semilla', 'planton', 'insumo agricola',
  'libro', 'revista', 'periodico',
  'vivienda de interes social',
  'combustible', 'gasolina', 'gasoil', 'hidrocarburo',
  'maquinaria', 'equipo industrial',
];

// Servicios exentos — Artículo 19 Ley de IVA (Venezuela).
const VE_EXENTOS_SERVICIOS = [
  'servicio de transporte', 'transporte de pasajero', 'transporte de carga',
  'flete', 'servicio de salud', 'consulta medica', 'servicio medico',
  'servicio de educacion', 'servicio educativo', 'servicio de aseo urbano',
  'aseo domiciliario', 'administracion de inmueble', 'intermediacion financiera',
  'servicio financiero', 'seguro', 'servicio funerario', 'suministro de agua',
  'energia electrica', 'servicio de gas', 'arrendamiento de vivienda',
  'alquiler de vivienda', 'servicio de exportacion',
];

const VE_EXENTOS = [...VE_EXENTOS_BIENES, ...VE_EXENTOS_SERVICIOS];


const CATALOGO = {
  CO: [...CO_EXCLUIDOS, ...CO_EXENTOS],
  VE: VE_EXENTOS,
};

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const ivaRateForCountry = (paisCodigo) =>
  IVA_RATES[String(paisCodigo || '').toUpperCase()] ?? IVA_RATES.CO;

// true si el nombre/descripción/categoría corresponde a un bien excluido o exento.
export const isBienNoGravable = ({ paisCodigo, name, description, categoria } = {}) => {
  const country = String(paisCodigo || '').toUpperCase();
  const terms = CATALOGO[country] || CATALOGO.CO;
  const haystack = normalize([name, description, categoria].filter(Boolean).join(' '));
  if (!haystack.trim()) return false;
  return terms.some((term) => {
    const needle = normalize(term);
    if (!needle) return false;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`);
    return re.test(haystack);
  });
};

// Resuelve si aplica IVA para el producto publicado.
// - Sin ser responsable de IVA: nunca aplica.
// - Responsable + bien excluido/exento: no gravable.
// - Responsable + bien gravable: aplica, se muestra la tarjeta.
export const resolveIva = ({ paisCodigo, responsableIva, name, description, categoria } = {}) => {
  const porcentaje = ivaRateForCountry(paisCodigo);
  const esResponsable = responsableIva === true || responsableIva === 'true';
  const noGravable = isBienNoGravable({ paisCodigo, name, description, categoria });
  const aplica = esResponsable && !noGravable;
  return { aplica, porcentaje, noGravable, esResponsable };
};
