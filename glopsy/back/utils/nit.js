// Dígito de verificación del NIT (algoritmo DIAN, módulo 11).
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export const computeNitDv = (nit) => {
  const digitos = String(nit || '').replace(/\D/g, '');
  if (!digitos) return null;
  const rev = digitos.split('').reverse();
  let suma = 0;
  for (let i = 0; i < rev.length && i < PESOS.length; i++) {
    suma += Number(rev[i]) * PESOS[i];
  }
  const mod = suma % 11;
  return mod < 2 ? mod : 11 - mod;
};
