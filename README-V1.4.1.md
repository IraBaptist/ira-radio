# Ira Bulldogs Radio Game Center V1.4.1

Game-day hotfix release based on live phone testing on August 28, 2026.

## Critical broadcaster fixes
- Goal-to-Go recalculates immediately when inside the opponent 15, including after plays.
- Ball yard line uses a scroll/select control instead of automatically opening the keyboard.
- Game clock has minute/second scroll selectors plus optional exact manual entry.
- Score correction also saves the game clock in the same dialog.
- “Ira Bulldogs Offense” wording.
- Sack moved under Pass results.
- Pass results: Complete, Incomplete, Intercepted, Sack, Fumble, TD.
- Tackles are simple player taps: none = skip, one = full, multiple = group/shared.
- Shared sacks split sack credit among selected defenders.
- Run fumble separates yards before fumble from recovery advance/return.
- Interception separates pass distance from interception return yards.
- Pass fumble keeps completion/pass/receiving yards before the fumble.
- Penalty quick buttons: -15, -10, -5, 0, +5, +10, +15 relative to offense.
- Accepted, Declined and Offsetting penalties.
- Generic Turnover renamed Other Turnover.
- New Drive is a catch-up/reset tool with possession and starting field position.
- Generic Score renamed Other Score.
- Touchdown launches large PAT buttons instead of typed browser prompts.
- Explicit Normal Kick / Onside Kick workflow.
- Both normal and onside kicks allow Receiving Team or Kicking Team recovery, optional player, and field position.
- Stats page shows passing, receiving and defensive statistics and consistent card widths.
- Roster editing uses one in-app form for number, name and position.
- Settings includes Reset Test / Game Data while preserving rosters, schedule and setup.

## Pregame / postgame
- Pregame opponent research panel with ranking fallback, rating/record/coach when public sources provide them, recent-result notes, projection/storyline notes and players-to-watch web notes.
- Research is cached locally for offline use.
- Postgame Next Game Preview can show cached current-week/recent opponent result notes.

## Public Game Center
- Clearly labels Ira Bulldogs and the actual opponent in team statistics.
- Publishes individual rushing/passing/receiving/defensive leaders for both teams.
- Existing public play-by-play remains intact.

## IMPORTANT deployment note
`config.js` is intentionally NOT included in the V1.4.1 update ZIP. Your live GitHub `config.js` already contains the working Apps Script /exec URL for fbcira.com/radio. Leaving it untouched prevents the public page from being disconnected during the update.

Deploy the web files to GitHub, then replace the Google Apps Script Code.gs with this release's Code.gs and create a new Web App version.
