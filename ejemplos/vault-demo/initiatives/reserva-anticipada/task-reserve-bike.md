---
type: story
title: Reserve a bike at a station
slug: task-reserve-bike
publication_status: draft
initiative: reserva-anticipada
components:
  - iOS
  - Android
  - Web
teams:
  - Pedal
parent_key: PDL-200
labels:
  - product-development
story_points: 5
---
## 📝 Summary

The user reserves a bike at a station and it is kept for them for 15 minutes.

![Reserve button](attachments/reserve-button.png)

---

## 💼 Rules

| Case | Condition | Outcome |
| --- | --- | --- |
| Reserve | The station has a free bike and the user has no active reservation | The bike is reserved for 15 minutes |
| Already reserved | The user has an active reservation | The button is disabled with "You already have a reservation" |
| No bikes | The station has no free bike | The button is hidden |

- The duration comes from the city's configuration; 15 minutes is the default.

---

## 🎬 User Scenarios

> [!INFO]
> **Reserve a bike**
>
> **Given** a station with 3 free bikes
> **When** the user taps "Reserve"
> **Then** the station shows 2 free bikes and the user sees the countdown ([[task-reservation-countdown]])

---

## ✅ Acceptance Criteria

- [ ] Checked on a device against the Figma.
- [ ] Two users reserving the last bike at the same time: only one gets it.

@@ el segundo criterio es de backend, ¿lo movemos a su ticket?
