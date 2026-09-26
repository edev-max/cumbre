import { app } from './estado.svelte';

/* Personalización del cliente: acento de color, logo y fondo propios.
   El triángulo rojo del logo de Cumbre no cambia: es la firma de Apex. */
export const ACENTOS: { id: string; nombre: string; a: string; b: string }[] = [
  { id: 'apex', nombre: 'Rojo Apex', a: '#E8380D', b: '#FF5A2E' },
  { id: 'azul', nombre: 'Azul', a: '#2458E6', b: '#4C7DFF' },
  { id: 'verde', nombre: 'Verde', a: '#0E9459', b: '#22C07A' },
  { id: 'morado', nombre: 'Morado', a: '#6D35DE', b: '#9466FF' },
  { id: 'ambar', nombre: 'Ámbar', a: '#C96A06', b: '#F29A1F' },
  { id: 'rosa', nombre: 'Fucsia', a: '#C81E6E', b: '#EE4B97' },
  { id: 'turquesa', nombre: 'Turquesa', a: '#0B8A94', b: '#18B8C4' }
];
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');

export function aplicarMarca() {
  const ac = ACENTOS.find((x) => x.id === app.ajustes.marca_acento) || ACENTOS[0];
  const r = document.documentElement.style;
  r.setProperty('--acento', ac.a); r.setProperty('--acento-2', ac.b);
  r.setProperty('--acento-rgb', rgb(ac.a)); r.setProperty('--acento-2-rgb', rgb(ac.b));
}
