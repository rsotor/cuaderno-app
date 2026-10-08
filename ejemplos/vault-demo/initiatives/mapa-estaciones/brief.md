---
type: brief
initiative: mapa-estaciones
status: READY FOR DEV
teams:
  - Pedal
  - Ruta
owner: Roberto
created: 2026-09-02
epic: RUT-88
---

# Panel de estación en el mapa

## Problema

Al tocar una estación en el mapa hoy se abre una página nueva y el usuario pierde el mapa. Para comparar dos estaciones cercanas tiene que ir y volver.

## Qué queremos

Un panel lateral (web, tablet) o una hoja inferior (móvil) con el resumen de la estación, sin salir del mapa.

![[station-panel.png]]

## Decisiones

- El panel muestra bicis libres, bicis eléctricas, huecos libres y la distancia.
- "Ver detalle" abre la página completa de la estación; el enlace lo decide la app, el panel solo emite el evento.
- Las bicis reservadas ([[reserva-anticipada]]) cuentan como no disponibles.

## Equipo

| Rol | Persona |
| --- | --- |
| Producto | Roberto |
| Diseño | [[people/sara-okafor\|Sara Okafor]] |
| Backend | [[people/marco-ibanez\|Marco Ibáñez]] |
