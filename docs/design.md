# Questboard Design Document

Static multi-group event planner with Supabase and Discord Auth.

## Product Summary

Questboard is a static web application for friend groups to organize tabletop, gaming, DnD, Warhammer, miniature painting, and similar online/offline activities.

The core experience is a calendar-based event planner where authenticated users can join groups via invite links, view group events, create events, RSVP, and coordinate attendance. Events may be online, offline, or hybrid. Offline events support physical locations and map links. Online events support customizable connection details.

The app starts as a static frontend hosted on GitHub Pages, backed by Supabase for authentication, database storage, row-level security, and user/group/event data.

## MVP Product Decisions

The following decisions resolve the initial open questions and should guide implementation:

1. **Group creation:** every authenticated user may create a group.
2. **Invite links:** invite links are reusable by default, with optional expiry and optional maximum-use limits.
3. **Public events:** public events are visible without login, but expose only safe public fields.
4. **Public attendance display:** public events show attendance counts only, not attendee names or private RSVP details.
5. **Invite approval:** invite possession is enough to join for MVP; group-admin approval can be added later.
6. **Archived events:** archived events are hidden from the default calendar view but remain available through history/search views.
7. **Recurring events:** store recurrence data in the MVP schema, but defer complex recurrence editing UI beyond the first version.
8. **Map provider:** use provider-neutral map links for MVP, preferring generated links that can open in common map applications.
9. **Notifications:** prepare the reminder data model and implement simple in-app reminders first; browser notifications are optional after the core reminder flow works.
10. **Timezones:** support full per-event timezone from the beginning.

## Goals

### Primary Goals

Enable friends to:

- Log in with Discord.
- Create or join groups through invite links.
- Belong to multiple groups.
- View group events in a calendar.
- Create events with date, time, category, attendance limits, online/offline information, and location/link details.
- RSVP to events.
- Mark events as viable once a minimum number of attendees is reached.
- Allow group admins to define custom event categories.
- Keep event history instead of silently losing changes.
- Export events to external calendars.
- Archive, not permanently delete, old or cancelled events.

### Secondary Goals

- Fantasy-themed but still usable UI.
- Mobile and desktop support.
- Browser notifications/reminders where supported.
- Public events visible outside group context, where explicitly enabled.
- Future support for Discord announcements/reminders.

## Non-Goals for MVP

These should not be included in the first version unless they are trivial:

- Discord bot integration.
- Discord role/server-based access control.
- Waitlists.
- Highly customized category-specific event fields.
- Advanced recurring-event editing.
- Full moderation tooling.
- Payment, subscriptions, or paid event handling.
- Native mobile apps.
- Complex admin dashboard.
- Server-side custom backend.

## Users and Roles

### Site Admin

Global administrator of the application. For MVP, this can be implemented minimally through a database flag.

Can:

- Manage all groups.
- Resolve abuse or broken data.
- Promote/demote group admins if needed.
- View application-level diagnostics.

### Group Admin

Administrator of a specific group.

Can:

- Edit group settings.
- Create invite links.
- Manage members.
- Define custom categories.
- Edit/archive any group event.
- Manage reusable locations.
- Assign group admin role to other group members.

### Event Owner

The user who created an event.

Can:

- Edit their own event.
- Archive their own event.
- Manage event-specific details.
- Configure attendance limits and reminders.

### Regular Member

A normal group member.

Can:

- View group events.
- Create events.
- RSVP to events.
- Comment on events.
- Invite others if group settings allow it.

## Authentication

Authentication is handled through Supabase Auth using Discord OAuth.

Discord is used for login identity, display name, avatar, and Discord user ID. Discord is not used for server membership checks, Discord roles, bot announcements, or mandatory Discord server membership.

Stored user profile fields:

- `id`
- `discord_user_id`
- `display_name`
- `synced_display_name`
- `avatar_url`
- `created_at`
- `last_seen_at`
- `is_site_admin`

Optional later fields:

- Timezone.
- Theme preferences.
- Notification preferences.

## Groups and Invites

Users can belong to multiple groups. Every authenticated user may create a group in the MVP, and the creator becomes a group admin.

Group data is private by default. Only members can see group events unless an individual event is marked public. Public event views must expose only safe fields and must not expose private discussion, member names, or internal member data.

Groups contain:

- Events.
- Members.
- Categories.
- Invite links.
- Locations.
- Group settings.

Invite links are reusable by default and may have an optional expiry date, optional maximum-use limit, and active/inactive status. Possession of a valid invite is enough to join for MVP; approval workflows can be added later.

## Event Categories

Initial default categories:

- DnD
- Gaming
- Warhammer
- Mini Painting
- Board Games
- Other

Group admins can define custom categories with:

- Name.
- Color.
- Icon.
- Sort order.
- Active/inactive status.

Category-specific fields can come later.

## Events

Core event fields:

- Title.
- Description.
- Group.
- Category.
- Start date/time.
- End date/time.
- Timezone.
- Online/offline/hybrid mode.
- Location reference.
- Online details.
- Minimum attendees.
- Maximum attendees.
- RSVP status per user.
- Event owner.
- Visibility: private/public.
- Status.
- Created timestamp.
- Updated timestamp.
- Archived timestamp.
- Recurrence data for future recurrence support.

Event modes:

- `online`: remote events such as Discord voice sessions, Foundry VTT, Roll20, Steam multiplayer, Tabletop Simulator, or online painting hangouts. Online events should capture a platform label, URL/link, and free-text connection instructions.
- `offline`: physical events with a reusable location or one-off location text, address, map URL, and optional notes such as parking or doorbell information.
- `hybrid`: events that support both physical and remote attendance, combining physical location and online connection details. Distinguishing online and offline attendees can be added later.

Events should support separate start and end timestamps so the app can represent evening sessions, all-day events, weekend events, and multi-day conventions or campaigns.

Event statuses:

- `draft`
- `open`
- `confirmed`
- `cancelled`
- `archived`

The “will happen” condition is derived from RSVP counts: attending RSVPs must be greater than or equal to `minimum_attendees`. The UI can show derived labels such as “Needs 2 more,” “Minimum reached,” “Full,” “Cancelled,” and “Archived.”

Archived events are hidden from the default calendar view but kept for history/search views.

## RSVP

RSVP statuses:

- `attending`
- `maybe`
- `declined`
- no response

Only `attending` counts toward the minimum attendee threshold. Waitlists, online/offline attendance distinctions, guests, and material tracking are later features.

## Recurring Events

Recurring events are represented in the MVP schema, but complex recurrence editing is deferred. The initial UI may support only non-recurring events or a simple recurrence field, while preserving future compatibility.

Suggested later recurrence options:

- Does not repeat.
- Daily.
- Weekly.
- Every two weeks.
- Monthly.
- Edit this event only.
- Edit this and following.
- Edit entire series.
- Exceptions.
- Cancel single occurrence.

## Calendar UX

The main page should be the calendar.

Default views:

- Month view.
- List/agenda view.

Users should be able to:

- Click a date to create an event.
- Click an event to view details.
- Filter by group.
- Filter by category.
- Filter by online/offline/hybrid.
- Filter by RSVP status.
- Filter public/private if relevant.

Event detail views should show title, category, date/time, status, minimum/maximum attendees, RSVP summary, attendee list for private member views, location or online details, description, comments, and edit/archive actions when permitted. Public event views must omit private attendee identities and internal discussion.

Suggested event creation fields include title, category, group, date/time, repeat setting, online/offline/hybrid mode, location or online details, minimum and maximum attendees, visibility, reminder settings, and description.

Mobile should use a list-first or compact month layout with large touch targets and full-screen event details. Desktop should prioritize a calendar-first layout with a side panel for filters and a modal or drawer for event details.

## Locations and Maps

Groups can store reusable locations with:

- Name.
- Address.
- Latitude.
- Longitude.
- Map URL.
- Notes.
- Created by.
- Group ID.

For MVP, use provider-neutral map links rather than embedded maps. Later features can include embedded map previews, geocoding, route links, favorite locations, and location privacy settings.

## Notifications and Reminders

MVP should prepare the data model and provide simple in-app reminders. Browser notifications can be added where supported after the core reminder flow works.

Reminder options:

- No reminder.
- 15 minutes before.
- 1 hour before.
- 1 day before.
- Custom later.

Future notification channels can include Discord reminders, email, and PWA push notifications.

## Comments and Event History

Events support comments. Group members can comment on events in their group. Comment authors can edit/archive their own comments. Group admins can moderate comments.

Event history is required and should track changes such as date/time, location, description, status, attendance limits, archival/cancellation, and category changes.

Recommended simple history model:

```text
event_history
- id
- event_id
- changed_by
- change_type
- old_value jsonb
- new_value jsonb
- created_at
```

## Calendar Export

Support `.ics` export.

MVP:

- Download `.ics` file for one event.

Later:

- Personal calendar subscription feed.
- Group calendar subscription feed.
- Export accepted events only.
- Export public events.

## Data Model Draft

Suggested Supabase tables:

- `profiles`
- `groups`
- `group_members`
- `group_invites`
- `categories`
- `locations`
- `events`
- `event_rsvps`
- `event_comments`
- `event_history`
- `event_reminders`

The schema should include per-event timezone, recurrence columns for future support, archived timestamps instead of hard deletes, reusable invite links, and safe public event visibility.

### `profiles`

- `id uuid primary key references auth.users(id)`
- `discord_user_id text`
- `display_name text`
- `synced_display_name text`
- `avatar_url text`
- `created_at timestamptz`
- `last_seen_at timestamptz`
- `is_site_admin boolean`

### `groups`

- `id uuid primary key`
- `name text`
- `description text`
- `theme text`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`
- `archived_at timestamptz`

### `group_members`

- `id uuid primary key`
- `group_id uuid references groups(id)`
- `user_id uuid references profiles(id)`
- `role text -- group_admin | regular`
- `joined_at timestamptz`
- `archived_at timestamptz`

### `group_invites`

- `id uuid primary key`
- `group_id uuid references groups(id)`
- `token text unique`
- `created_by uuid references profiles(id)`
- `expires_at timestamptz`
- `max_uses integer`
- `used_count integer`
- `is_active boolean`
- `created_at timestamptz`

### `categories`

- `id uuid primary key`
- `group_id uuid references groups(id)`
- `name text`
- `color text`
- `icon text`
- `sort_order integer`
- `is_active boolean`
- `created_at timestamptz`

### `locations`

- `id uuid primary key`
- `group_id uuid references groups(id)`
- `name text`
- `address text`
- `latitude numeric`
- `longitude numeric`
- `map_url text`
- `notes text`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`
- `archived_at timestamptz`

### `events`

- `id uuid primary key`
- `group_id uuid references groups(id)`
- `category_id uuid references categories(id)`
- `owner_id uuid references profiles(id)`
- `title text`
- `description text`
- `start_at timestamptz`
- `end_at timestamptz`
- `timezone text`
- `mode text -- online | offline | hybrid`
- `location_id uuid references locations(id)`
- `location_text text`
- `online_details jsonb`
- `minimum_attendees integer`
- `maximum_attendees integer`
- `visibility text -- private | public`
- `status text -- draft | open | confirmed | cancelled | archived`
- `recurrence_rule text`
- `recurrence_parent_id uuid references events(id)`
- `created_at timestamptz`
- `updated_at timestamptz`
- `archived_at timestamptz`

### `event_rsvps`

- `id uuid primary key`
- `event_id uuid references events(id)`
- `user_id uuid references profiles(id)`
- `status text -- attending | maybe | declined`
- `created_at timestamptz`
- `updated_at timestamptz`

Add a unique constraint on `(event_id, user_id)`.

### `event_comments`

- `id uuid primary key`
- `event_id uuid references events(id)`
- `user_id uuid references profiles(id)`
- `body text`
- `created_at timestamptz`
- `updated_at timestamptz`
- `archived_at timestamptz`

### `event_history`

- `id uuid primary key`
- `event_id uuid references events(id)`
- `changed_by uuid references profiles(id)`
- `change_type text`
- `old_value jsonb`
- `new_value jsonb`
- `created_at timestamptz`

### `event_reminders`

- `id uuid primary key`
- `event_id uuid references events(id)`
- `user_id uuid references profiles(id)`
- `remind_at timestamptz`
- `method text -- in_app | browser`
- `is_sent boolean`
- `created_at timestamptz`

## Row-Level Security Concept

Supabase RLS is important because this is a static frontend. The frontend must not be trusted.

Basic rules:

- Users can update their own profile.
- Users can read profiles of users who share a group with them.
- Site admins can read all profiles.
- Users can read groups they belong to.
- Group admins can update their groups.
- Users can read events in their groups.
- Anyone can read safe public event fields for public events.
- Group members can create events in their groups.
- Event owners can update/archive their own events.
- Group admins can update/archive any group event.
- Users can create/update their own RSVP.
- Group members can read comments and history for group events.

## Frontend Architecture

Recommended stack:

- Vite.
- React.
- TypeScript.
- Supabase JS.
- React Router.
- Tailwind CSS.
- date-fns or Luxon.
- zod.
- react-hook-form.

Suggested routes:

```text
/
/login
/join/:inviteToken
/calendar
/events/:eventId
/events/new
/groups
/groups/:groupId/settings
/groups/:groupId/categories
/groups/:groupId/locations
/profile
```

## UI Concept

Questboard should feel like a casual fantasy friend hub, not corporate scheduling software. Suggested motifs include parchment cards, subtle fantasy map backgrounds, category icons, warm dark mode, tavern-board style event lists, and a calendar as a quest board.

Usability should take priority over theme density.

## MVP Scope

The first useful version should include:

- Discord login through Supabase.
- User profile creation from Discord profile.
- Multi-group support.
- User-created groups.
- Reusable invite links.
- Group membership.
- Group roles: `group_admin` and `regular`.
- Calendar month view.
- Event list view.
- Create/edit/archive events.
- Event categories.
- Group-admin-defined custom categories.
- Online/offline/hybrid event mode.
- Date/time start and end.
- Per-event timezone.
- Reusable locations.
- Provider-neutral map link support.
- Online details field.
- Minimum and maximum attendees.
- RSVP: `attending`, `maybe`, `declined`.
- Event status display derived from attendee threshold.
- Comments.
- Event history.
- Public/private event visibility with safe public fields.
- Public event attendance counts only.
- Basic `.ics` export.
- Basic in-app reminders.
- Reminder data model for later browser notifications.
- Responsive layout.

## MVP Constraints

- Static frontend only.
- Supabase free-tier compatible.
- No custom backend.
- No Discord bot.
- No server membership check.
- No payment logic.
- No native mobile app.
- No complex Outlook-level recurrence editing.

## Later Features

- Discord event announcements.
- Discord reminders.
- Browser notifications after reminder MVP.
- Waitlists.
- Category-specific fields.
- Advanced recurring events.
- Calendar subscription feeds.
- Embedded map view.
- PWA install mode.
- Push notifications.
- Event templates.
- Poll-based date finding.
- Availability voting.
- Material checklists.
- Warhammer army list attachment.
- DnD campaign/session tracking.
- Painting project gallery.
- Board-game library.
- Public event landing pages.
- Invite approval workflows.

## Recommended First Implementation Chunks

1. Supabase project setup and Discord OAuth configuration documentation.
2. Initial database schema.
3. Row-level security policies.
4. Vite/React/TypeScript frontend scaffold.
5. Authentication and profile sync.
6. Group creation and invite-link flow.
7. Calendar view and event read model.
8. Event creation/edit/archive.
9. RSVP and attendance threshold logic.
10. Comments and event history.
11. Location/map link handling.
12. Basic in-app notifications and `.ics` export.
