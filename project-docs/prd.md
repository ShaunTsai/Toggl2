# Product Requirements Document (PRD)

## Overview
This application is a streamlined time-tracking tool inspired by Toggl Tracker, focusing on delivering only the most essential features for efficient task and time management. The app is designed for users who prefer simplicity, full data ownership, and flexibility in managing their tracked time records.

## Core Objectives
- **Essential Time Tracking:** Provide a clean, intuitive interface for users to start, stop, and manage timers for various tasks and projects.
- **No Subscription Model:** The app is free to use and does not require user subscriptions or paid plans.
- **Data Portability:** Users can export all tracked time data as CSV files for external analysis or backup.
- **Data Import:** Users can upload CSV files containing previous time tracking records, allowing them to continue tracking tasks seamlessly across sessions or devices.
- **Privacy & Ownership:** All data is stored locally or in user-controlled storage. No user data is sent to external servers or third parties.

## Functional Requirements
1. **Task & Project Management:**
   - Users can create, edit, and delete tasks and projects.
   - Each time entry is associated with a task and (optionally) a project.
2. **Timer Controls:**
   - Users can start, pause, resume, and stop timers for tasks.
   - Manual time entry is supported.
3. **CSV Export:**
   - Users can export all tracked time entries as a CSV file, with clear headers and structured data.
   - Exported CSVs are compatible with spreadsheet software and other time analysis tools.
4. **CSV Import:**
   - Users can upload CSV files containing time entries exported from this app or other compatible sources.
   - The app validates and merges imported data without duplicating existing entries.
5. **User Interface:**
   - Minimalist, distraction-free design.
   - Responsive and accessible across devices.

## Non-Functional Requirements
- **Performance:** The app must load quickly and handle large CSV files efficiently.
- **Security:** All file operations are performed locally in the user's browser or device; no sensitive data leaves the user's control.
- **Extensibility:** The codebase is modular and well-documented to allow for future enhancements (e.g., analytics, tagging, integrations).

## Out of Scope
- No subscription or user account system.
- No cloud synchronization or third-party integrations at launch.
- No advanced reporting or analytics (future enhancement).

## Guiding Principles for Future AI Agents
- Prioritize simplicity and user autonomy.
- Ensure all features respect user privacy and data ownership.
- Maintain clear, well-structured code and documentation.
- Any new feature must align with the core objectives of essential functionality and data portability.

---

**Drafted Foundation:**
Here are my initial thoughts: This is an app that mocks Toggl Tracker, but keeping only the essential functionalities. Instead of a subscription model, you enable users to download the tracked time usage for future analysis as CSV files. You will also allow users to upload CSV files of previous record to continue tracking the tasks.

---

## Features Added (2025-05-01/02 Session)

### Core Feature: Local Storage with Dexie.js
- **Event Data Stored Locally:**
  - All time entries and events are stored in the user's browser using IndexedDB, managed via the Dexie.js library.
  - This ensures full data ownership and privacy—no event data is sent to external servers.
  - The app can function offline, and user data persists across sessions and browser restarts.
- **IndexedDB Structure:**
  - Uses a single `events` table with fields for id, title, day index, date, start/end times, and project association.
  - All CRUD operations (create, read, update, delete) are performed locally for maximum speed and reliability.

### Export CSV Logic Improvements
- **Export Button Alert:**
  - The export CSV button now checks for the presence of events before attempting export.
  - If no events exist, the user receives a pop-up alert instead of being redirected to a blank or error page.
  - This prevents confusion and accidental navigation away from the app.

### User Experience Enhancements
- **No Data Loss on Export:**
  - Export logic ensures users remain on the current page if there is nothing to export, minimizing risk of memory loss or accidental state changes.
- **Fallbacks for Data Retrieval:**
  - If IndexedDB is unavailable, the app attempts to use in-memory data to determine export eligibility.

### Technical Stack Note
- **Dexie.js** is now a core dependency for local data management and should be referenced in all future development and documentation.

---
