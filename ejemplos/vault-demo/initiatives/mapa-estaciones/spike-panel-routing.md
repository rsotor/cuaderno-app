---
type: spike
title: "SPIKE: Open the station panel without leaving the map route"
slug: spike-panel-routing
publication_status: published
initiative: mapa-estaciones
components:
  - Web
teams:
  - Ruta
parent_key: RUT-88
story_points: 3
jira_keys:
  - RUT-89
---
## ❓ Question

How does the web app open the station panel over the map so that a reload keeps it open and the browser back button closes it?

## Options to compare

1. A secondary route (named outlet) for the panel.
2. A query parameter read by the map page.

> [!NOTE]
> The team decides; product only needs reload and back to behave as described.

## Time box

2 days.
