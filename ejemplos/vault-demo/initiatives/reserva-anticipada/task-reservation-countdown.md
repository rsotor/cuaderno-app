---
type: task
title: Show the reservation countdown
slug: task-reservation-countdown
publication_status: draft
initiative: reserva-anticipada
components:
  - iOS
  - Android
teams:
  - Pedal
parent_key: PDL-200
depends_on:
  - task-reserve-bike
labels:
  - product-development
---
## 📝 Summary

While a reservation is active, the user sees how much time is left and at which station.

## 💼 Behaviour

- A banner on the home screen with the station name and the minutes left.
- Under 2 minutes the banner turns to the warning colour.
- The time comes from `reservedUntil`; nothing is calculated from the device clock.

> [!WARNING]
> `reservedUntil` arrives in local time today (PDL-212). Do not start until it is UTC.

## ✅ Acceptance Criteria

- [ ] Checked on a device with the clock in another time zone.
