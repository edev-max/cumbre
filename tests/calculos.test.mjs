import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linea, totales, aCentavosUsd, costoPromedio, estadoPago, saldo } from '../src/lib/calculos.ts';
import { leerMonto, leerNumero } from '../src/lib/formato.ts';

test('línea con descuento e IVA 16 %', () => {
  const r = linea({ cantidad: 3, precio_c: 250, descuento: 10, impuesto_tasa: 16 });
  assert.equal(r.bruto_c, 750); assert.equal(r.descuento_c, 75); assert.equal(r.base_c, 675);
  assert.equal(r.impuesto_c, 108); assert.equal(r.total_c, 783);
});
test('totales cuadran con la suma de líneas', () => {
  const t = totales([{ cantidad: 2, precio_c: 199, impuesto_tasa: 16 }, { cantidad: 0.5, precio_c: 800 }]);
  assert.deepEqual(t, { subtotal_c: 798, descuento_c: 0, impuesto_c: 64, total_c: 862 });
});
test('bolívares a centavos de dólar con la tasa', () => {
  assert.equal(aCentavosUsd(3650, 'VES', 36.5), 10000);
  assert.equal(aCentavosUsd(12.34, 'USD', 36.5), 1234);
  assert.equal(aCentavosUsd(100, 'VES', 0), 0);
});
test('costo promedio ponderado', () => {
  assert.equal(costoPromedio(10, 100, 10, 200), 150);
  assert.equal(costoPromedio(-3, 100, 5, 200), 200);
});
test('estado de pago y saldo', () => {
  assert.equal(estadoPago(1000, 0), 'pendiente'); assert.equal(estadoPago(1000, 400), 'parcial');
  assert.equal(estadoPago(1000, 1000), 'pagada'); assert.equal(saldo(1000, 1200), 0);
});
test('leer montos en formato venezolano', () => {
  assert.equal(leerMonto('1.234,56'), 123456); assert.equal(leerMonto('12.5'), 1250);
  assert.equal(leerMonto('$ 7,00'), 700); assert.equal(leerNumero('0,250'), 0.25);
});
