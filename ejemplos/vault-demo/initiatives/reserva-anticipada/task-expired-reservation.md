---
type: task
title: Notify the user when the reservation expires
slug: task-expired-reservation
publication_status: published
initiative: reserva-anticipada
components:
  - iOS
  - Android
teams:
  - Pedal
parent_key: PDL-200
labels:
  - product-development
story_points: 2
jira_keys:
  - PDL-214
---
## 📝 Summary

When the 15 minutes pass, the reservation expires, the bike is free again and the user gets a push notification.

## 💼 Behaviour

- Push text: "Your reservation at {station} has expired."
- Tapping the push opens the station on the map.
- Email: TBD (see [[people/lucia-ferrer|Lucía]]).

## ✅ Acceptance Criteria

- [x] Copy validated with Sara.
- [ ] Checked on a device with the app closed and in the background.
