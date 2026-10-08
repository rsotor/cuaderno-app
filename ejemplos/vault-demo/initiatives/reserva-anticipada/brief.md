---
type: brief
initiative: reserva-anticipada
status: DEFINING
teams:
  - Pedal
owner: Roberto
created: 2026-09-20
epic: PDL-200
---

# Reserva anticipada de bici

## Problema

Hoy el usuario solo puede coger la bici que hay en la estación cuando llega. En hora punta llega y no queda ninguna: es la primera causa de quejas en la tienda de apps (38 % de las reseñas de 1 estrella del último trimestre).

## Qué queremos

Que el usuario reserve una bici en una estación concreta y la tenga guardada 15 minutos. Si no llega, la reserva caduca y la bici vuelve a estar libre.

## Fuera de alcance

- Reservar con más de 15 minutos de antelación.
- Pagar la reserva: es gratis en esta fase (ver [[_archive/pago-con-bono/brief|pago con bono]], cerrado).

## Decisiones

| Tema | Decisión | Quién |
| --- | --- | --- |
| Duración de la reserva | 15 min, configurable por ciudad | [[people/lucia-ferrer\|Lucía]] |
| Reservas simultáneas | Una por usuario | Producto |
| Qué pasa si caduca | La bici se libera y el usuario recibe un aviso | TBD — email o solo push |

## Preguntas abiertas

- ¿Penalizamos al que reserva y no llega? TBD
- ¿Cómo se ve la reserva en el [[mapa-estaciones|mapa]]?

@@ añade el dato de cuántas reservas esperamos al día, lo tiene Marco
