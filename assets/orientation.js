/* Orientation weeks. Staff can update this file each week. Do not edit the
   tile text in content.js, and do not copy these dates into app.js.

   How to add a week:
   1. Copy one object in the list below and paste it at the top.
   2. Set week to a short label, such as "Week 3".
   3. Set each session date as YYYY-MM-DD. name is "Session 1" and so on.
      title is the session name participants should see.
   4. Paste that week's Zoom register link into register.
   5. Leave start as "10:00" and zone as "America/New_York" unless the
      whole week really begins at a different New York time.
   6. note is optional. Use it for a one-line reminder, such as a clock change.

   A week stays on the page until its last session's start time. After that
   it drops off by itself. You do not need to delete old weeks. Office
   holidays do not hide these sessions. WhatsApp hours are a separate list. */

const ORIENTATION_WEEKS = [
  {
    week: 'Week 2',
    start: '10:00',
    zone: 'America/New_York',
    note: 'The U.S. changed clocks back on November 1.',
    register: 'https://us02web.zoom.us/webinar/register/WN_e5OfXP9_T-W9HwNsS-RbyQ',
    sessions: [
      { date: '2026-11-10', name: 'Session 1', title: 'Before You Fly' },
      { date: '2026-11-11', name: 'Session 2', title: 'Arrival & Getting to Work' },
      { date: '2026-11-12', name: 'Session 3', title: 'Living the Program' }
    ]
  }
];
