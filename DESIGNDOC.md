Questboard Design Document
Static Multi-Group Event Planner with Supabase and Discord Auth
1. Product Summary
A static web application for friend groups to organize tabletop, gaming, DnD, Warhammer, miniature painting, and similar online/offline activities.

The core experience is a calendar-based event planner where authenticated users can join groups via invite links, view group events, create events, RSVP, and coordinate attendance. Events may be online, offline, or hybrid. Offline events support physical locations and map links. Online events support customizable connection details.

The app starts as a static frontend hosted on GitHub Pages, backed by Supabase for authentication, database storage, row-level security, and user/group/event data.

Working title: Questboard

2. Goals
2.1 Primary Goals
Enable friends to:

Log in with Discord.
Create or join groups through invite links.
Belong to multiple groups.
View group events in a calendar.
Create events with date, time, category, attendance limits, online/offline information, and location/link details.
RSVP to events.
Mark events as viable once a minimum number of attendees is reached.
Allow group admins to define custom event categories.
Keep event history instead of silently losing changes.
Export events to external calendars.
Archive, not permanently delete, old or cancelled events.
2.2 Secondary Goals
Fantasy-themed but still usable UI.
Mobile and desktop support.
Browser notifications/reminders.
Public events visible outside group context, where explicitly enabled.
Future support for Discord announcements/reminders.
3. Non-Goals for MVP
These should not be included in the first version unless they are trivial:

Discord bot integration.
Discord role/server-based access control.
Waitlists.
Highly customized category-specific event fields.
Advanced recurring-event editing.
Full moderation tooling.
Payment, subscriptions, or paid event handling.
Native mobile apps.
Complex admin dashboard.
Server-side custom backend.
4. Users and Roles
4.1 Site Admin
Global administrator of the application.

Can:

Manage all groups.
Resolve abuse or broken data.
Promote/demote group admins if needed.
View application-level diagnostics.
For MVP, this can be implemented minimally through a database flag.

4.2 Group Admin
Administrator of a specific group.

Can:

Edit group settings.
Create invite links.
Manage members.
Define custom categories.
Edit/archive any group event.
Manage reusable locations.
Assign group admin role to other group members.
4.3 Event Owner
The user who created an event.

Can:

Edit their own event.
Archive their own event.
Manage event-specific details.
Configure attendance limits and reminders.
4.4 Regular Member
A normal group member.

Can:

View group events.
Create events.
RSVP to events.
Comment on events.
Invite others if group settings allow it.
5. Authentication
5.1 Provider
Authentication is handled through Supabase Auth using Discord OAuth.

Discord is used for:

Login identity.
Display name.
Avatar.
Discord user ID.
Discord is not used for:

Server membership checks.
Discord roles.
Bot announcements.
Mandatory Discord server membership.
5.2 Login Flow
User opens the app.
User clicks Login with Discord.
Supabase redirects to Discord OAuth.
User authorizes.
Supabase creates or retrieves the user.
App loads the user profile.
App loads groups the user belongs to.
5.3 Profile Data
Stored user profile fields:

id
discord_user_id
display_name
avatar_url
created_at
last_seen_at
Optional later:

Preferred display name override.
Timezone.
Theme preferences.
Notification preferences.
6. Groups
6.1 Group Model
Users can belong to multiple groups.

Each group contains:

Events
Members
Categories
Invite links
Locations
Group settings
6.2 Group Visibility
Default behavior:

Group data is private.
Only members can see group events.
Exception:

Individual events may be marked as public.
Public events should expose only safe fields, not private group discussions or internal member data.

6.3 Invite Links
Groups are joined through invite links.

Invite link properties:

Unique token.
Target group.
Created by group admin.
Optional expiry date.
Optional max uses.
Active/inactive status.
Basic flow:

Group admin creates invite link.
Link is shared with friend.
Friend opens link.
Friend logs in with Discord.
Friend joins group.
User is added as regular member.
7. Event Categories
7.1 Default Categories
Initial default categories:

DnD
Gaming
Warhammer
Mini Painting
Board Games
Other
7.2 Custom Categories
Group admins can define custom categories.

Category fields:

Name
Color
Icon
Sort order
Active/inactive status
For MVP, categories should remain simple and generic.

Category-specific fields can come later. For example:

DnD: campaign, DM, character level
Warhammer: points limit, system, army
Gaming: platform, game, voice channel
Painting: theme, bring-your-own-materials
8. Event Model
8.1 Core Event Fields
Each event should contain:

Title
Description
Group
Category
Start date/time
End date/time
Timezone
Online/offline/hybrid mode
Location reference
Online details
Minimum attendees
Maximum attendees
RSVP status per user
Event owner
Visibility: private/public
Status
Created timestamp
Updated timestamp
Archived timestamp
8.2 Event Modes
Online
Used for events that happen remotely.

Examples:

Discord voice session
Foundry VTT
Roll20
Steam multiplayer
Tabletop Simulator
Online painting hangout
Online event fields:

Platform label
URL/link
Free-text connection instructions
Offline
Used for physical events.

Fields:

Location
Address
Map URL
Optional notes, for example parking or doorbell name
Hybrid
Used when users can attend either physically or online.

Fields:

Physical location
Online details
Optional distinction between online and offline attendees
8.3 Event Status
Possible event statuses:

Draft
Open
Confirmed
Cancelled
Archived
Suggested logic:

Open: event is visible and accepting RSVPs.
Confirmed: minimum attendee threshold has been reached.
Cancelled: event will not happen.
Archived: event is no longer active but kept for history.
The will happen condition is derived from RSVP count:

confirmed_attendees >= minimum_attendees
The UI can show this as:

Needs 2 more
Minimum reached
Full
Cancelled
Archived
8.4 Attendance Limits
Each event may define:

Minimum attendees
Maximum attendees
Example:

DnD one-shot:

Minimum: 3
Maximum: 5
Painting evening:

Minimum: 2
Maximum: 8
Online gaming:

Minimum: 2
Maximum: 4
8.5 RSVP Status
RSVP statuses:

Attending
Maybe
Declined
No response
Only Attending counts toward the minimum attendee threshold.

Later possible additions:

Waitlist
Online attending
Offline attending
Bringing guest
Bringing materials
8.6 Recurring Events
Recurring events are required, but the MVP should keep them constrained.

Suggested MVP recurrence options:

Does not repeat
Daily
Weekly
Every two weeks
Monthly
Avoid complex Outlook-level recurrence editing in the first version.

Later support:

Edit this event only
Edit this and following
Edit entire series
Exceptions
Cancel single occurrence
8.7 Multi-Day Events
Events should support separate start and end timestamps.

This allows:

One evening session
All-day events
Weekend events
Multi-day conventions or campaigns
9. Calendar UX
9.1 Main Page
The main page should be the calendar.

Default views:

Month view
List/agenda view
Later:

Week view
User-customizable default view
9.2 Calendar Interaction
Users should be able to:

Click a date to create an event.
Click an event to view details.
Filter by group.
Filter by category.
Filter by online/offline/hybrid.
Filter by RSVP status.
Filter public/private if relevant.
9.3 Event Detail View
Event detail should show:

Title
Category
Date/time
Status
Minimum/maximum attendees
RSVP summary
Attendee list
Location or online details
Description
Comments
Edit/archive actions if permitted
9.4 Event Creation Flow
Suggested creation form:

Title
Category
Group
Date/time
Repeat setting
Online/offline/hybrid
Location or online info
Minimum attendees
Maximum attendees
Visibility
Reminder settings
Description
9.5 Mobile/Desktop
The app should be responsive.

Desktop:

Calendar-first layout.
Side panel for filters.
Modal or drawer for event details.
Mobile:

List-first or compact month view.
Bottom navigation.
Event details in full-screen sheet.
Large touch targets.
10. Locations and Maps
10.1 Reusable Locations
Groups can store reusable locations.

Examples:

Marc's place
Local game store
Club room
Gaming café
Location fields:

Name
Address
Latitude
Longitude
Map URL
Notes
Created by
Group ID
10.2 Map Integration
For MVP, use map links rather than embedded maps if simplicity matters.

Recommended MVP:

Store address.
Generate Google Maps/OpenStreetMap link.
Show Open in Maps button.
Later:

Embedded map preview.
Geocoding.
Route links.
Favorite locations.
Location privacy settings.
11. Notifications and Reminders
11.1 MVP Notifications
Browser notifications can be included, but they require user permission and only work reliably under certain browser conditions.

MVP reminder types:

In-app bell icon.
Browser notification where supported.
Reminder settings:

No reminder
15 minutes before
1 hour before
1 day before
Custom later
11.2 Later Notifications
Future options:

Discord reminders.
Email reminders.
Push notifications via PWA.
Group-level announcement settings.
12. Comments and Discussion
Events should support comments.

Comment fields:

Event ID
User ID
Body
Created timestamp
Edited timestamp
Deleted/archived timestamp
MVP rule:

Group members can comment on events in their group.
Comment authors can edit/delete their own comments.
Group admins can moderate comments.
13. Event History
Event history is required.

Use a history/audit table to store changes.

Track changes such as:

Date/time changed
Location changed
Description changed
Status changed
Minimum/maximum attendees changed
Event archived/cancelled
Category changed
For MVP, store snapshots or simple change records.

Recommended simple model:

event_history
- id
- event_id
- changed_by
- change_type
- old_value jsonb
- new_value jsonb
- created_at
This does not need a sophisticated UI at first. A simple Event history section is enough.

14. Calendar Export
Support .ics export.

MVP options:

Download .ics file for one event.
Copy calendar link later.
Later options:

Subscribe to personal calendar feed.
Subscribe to group calendar feed.
Export only accepted events.
Export public events.
15. Data Model Draft
15.1 Tables
Suggested Supabase tables:

profiles
groups
group_members
group_invites
categories
locations
events
event_rsvps
event_comments
event_history
event_reminders
15.2 profiles
id uuid primary key references auth.users(id)
discord_user_id text
display_name text
avatar_url text
created_at timestamptz
last_seen_at timestamptz
is_site_admin boolean
15.3 groups
id uuid primary key
name text
description text
theme text
created_by uuid references profiles(id)
created_at timestamptz
archived_at timestamptz
15.4 group_members
id uuid primary key
group_id uuid references groups(id)
user_id uuid references profiles(id)
role text -- group_admin | regular
joined_at timestamptz
archived_at timestamptz
15.5 group_invites
id uuid primary key
group_id uuid references groups(id)
token text unique
created_by uuid references profiles(id)
expires_at timestamptz
max_uses integer
used_count integer
is_active boolean
created_at timestamptz
15.6 categories
id uuid primary key
group_id uuid references groups(id)
name text
color text
icon text
sort_order integer
is_active boolean
created_at timestamptz
15.7 locations
id uuid primary key
group_id uuid references groups(id)
name text
address text
latitude numeric
longitude numeric
map_url text
notes text
created_by uuid references profiles(id)
created_at timestamptz
archived_at timestamptz
15.8 events
id uuid primary key
group_id uuid references groups(id)
category_id uuid references categories(id)
owner_id uuid references profiles(id)

title text
description text

start_at timestamptz
end_at timestamptz
timezone text

mode text -- online | offline | hybrid
location_id uuid references locations(id)
location_text text
online_details jsonb

minimum_attendees integer
maximum_attendees integer

visibility text -- private | public
status text -- draft | open | confirmed | cancelled | archived

recurrence_rule text
recurrence_parent_id uuid references events(id)

created_at timestamptz
updated_at timestamptz
archived_at timestamptz
15.9 event_rsvps
id uuid primary key
event_id uuid references events(id)
user_id uuid references profiles(id)
status text -- attending | maybe | declined
created_at timestamptz
updated_at timestamptz
Unique constraint:

unique(event_id, user_id)
15.10 event_comments
id uuid primary key
event_id uuid references events(id)
user_id uuid references profiles(id)
body text
created_at timestamptz
updated_at timestamptz
archived_at timestamptz
15.11 event_history
id uuid primary key
event_id uuid references events(id)
changed_by uuid references profiles(id)
change_type text
old_value jsonb
new_value jsonb
created_at timestamptz
15.12 event_reminders
id uuid primary key
event_id uuid references events(id)
user_id uuid references profiles(id)
remind_at timestamptz
method text -- in_app | browser
is_sent boolean
created_at timestamptz
16. Row-Level Security Concept
Supabase RLS is important because this is a static frontend. The frontend must not be trusted.

16.1 Basic Rules
Profiles
Users can read profiles of users who share a group with them.
Users can update their own profile.
Site admins can read all profiles.
Groups
Users can read groups they belong to.
Group admins can update their groups.
Site admins can update all groups.
Group Members
Users can read members of their groups.
Group admins can manage members of their groups.
Events
Users can read events in their groups.
Anyone can read public events.
Group members can create events in their groups.
Event owner can update/archive their own events.
Group admins can update/archive any group event.
RSVPs
Group members can read RSVPs for events in their groups.
Users can create/update their own RSVP.
Group admins can view/manage group event RSVPs if necessary.
Comments
Group members can read comments for events in their groups.
Users can create comments.
Users can edit/archive their own comments.
Group admins can moderate comments.
History
Group members can read history for group events.
Insert should happen via controlled logic where possible.
17. Frontend Architecture
17.1 Recommended Stack
Since a framework is acceptable:

Vite + React + TypeScript + Supabase JS
Reasoning:

Still static-hostable.
Works with GitHub Pages.
Good calendar component options.
Easier state management than plain JavaScript.
TypeScript helps once the data model grows.
Can later evolve into a PWA.
17.2 Suggested Libraries
Potential frontend libraries:

@supabase/supabase-js
react-router-dom
date-fns or luxon
fullcalendar
zod
react-hook-form
Possible UI options:

Tailwind CSS
shadcn/ui
daisyUI
For a fantasy feel, Tailwind with custom theme tokens may be easiest.

17.3 App Structure
Suggested route structure:

/
  redirects to /calendar or /login

/login
  Discord login

/join/:inviteToken
  accept group invite

/calendar
  main calendar

/events/:eventId
  event detail

/events/new
  create event

/groups
  group selector / group overview

/groups/:groupId/settings
  group admin settings

/groups/:groupId/categories
  manage categories

/groups/:groupId/locations
  manage reusable locations

/profile
  user profile and notification settings
18. UI Concept
18.1 Visual Direction
The app should feel like a casual fantasy friend hub, not corporate scheduling software.

Possible motifs:

Parchment cards
Subtle fantasy map background
Category icons like dice, sword, brush, controller
Warm dark mode
Tavern-board style event list
Calendar as a quest board
Avoid overdoing the theme. Usability should win.

18.2 Main Calendar Page
Main elements:

Header with app name, group selector, profile avatar.
Month calendar.
List/agenda view toggle.
Category filters.
Online/offline/hybrid filter.
Create event button.
Bell/reminder icon.
Event cards with category color and status.
Event card examples:

[DND] Curse of Strahd
Fri, 19:30-23:00
Marc's place
3/5 attending - Minimum reached
[Gaming] Helldivers
Sat, 20:00
Online - Discord
2/4 attending - Needs 1 more
[Painting] Spearhead Night
Sun, 14:00
Hybrid
4/8 attending - Minimum reached
19. MVP Scope
19.1 MVP Features
The first useful version should include:

Discord login through Supabase.
User profile creation from Discord profile.
Multi-group support.
Invite links.
Group membership.
Group roles:
group admin
regular member
Calendar month view.
Event list view.
Create/edit/archive events.
Event categories.
Group-admin-defined custom categories.
Online/offline/hybrid event mode.
Date/time start and end.
Reusable locations.
Map link support.
Online details field.
Minimum and maximum attendees.
RSVP:
attending
maybe
declined
Event status derived from attendee threshold.
Comments.
Event history.
Public/private event visibility.
Basic .ics export.
Basic notification bell / in-app reminders.
Responsive layout.
19.2 MVP Constraints
Static frontend only.
Supabase free-tier compatible.
No custom backend.
No Discord bot.
No server membership check.
No payment logic.
No native mobile app.
No complex Outlook-level recurrence editing.
20. Later Features
Later features:

Discord event announcements.
Discord reminders.
Waitlists.
Category-specific fields.
Advanced recurring events.
Calendar subscription feeds.
Embedded map view.
PWA install mode.
Push notifications.
Event templates.
Poll-based date finding.
Availability voting.
Material checklists.
Warhammer army list attachment.
DnD campaign/session tracking.
Painting project gallery.
Board-game library.
Public event landing pages.
21. Open Questions
These are the remaining decisions before turning this into implementation tasks.

Should every user be allowed to create a new group, or only site admins?
Should invite links be reusable by default, or single-use by default?
Should public events be visible without login?
Should public events show attendee names, attendee count only, or no attendance info?
Should group admins approve new members after invite-link signup, or is invite possession enough?
Should archived events remain visible in the calendar, or only in history/search?
Should recurring events be included in MVP, or should we defer them to version 2 despite wanting them generally?
Which map provider do you prefer: Google Maps links, Apple Maps links, OpenStreetMap, or provider-neutral generated links?
Should browser notifications be MVP, or should the MVP only prepare the reminder data model?
Should the first version support only one timezone, probably Europe/Zurich, or full per-event timezone?
22. Possible Names
Fantasy/Social Planning Leaning
Questboard
Tavern Time
Party Planner
The Gathering Table
Guild Calendar
Tabletop Tavern
Questlog
Hearth & Dice
The Common Room
Rollcall
Campaign Clock
Warband Planner
Dice & Dates
The Painted Tavern
Guildhall
More Practical
Friendforge
Eventforge
GameNight
PartyHub
Sessionboard
GroupQuest
HobbyHub
TableReady
Gatherly
ReadyCheck
Recommended Working Title
Questboard

This fits the core metaphor: events are quests, groups are guilds, and the main calendar is the board.

Suggested first chunks:

Supabase project setup and Discord OAuth configuration.
Initial database schema.
Row-level security policies.
Vite/React/TypeScript frontend scaffold.
Authentication and profile sync.
Group creation and invite-link flow.
Calendar view and event read model.
Event creation/edit/archive.
RSVP and attendance threshold logic.
Comments and event history.
Location/map link handling.
Basic notifications and .ics export.
