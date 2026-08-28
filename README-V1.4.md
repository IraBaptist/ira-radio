# Ira Bulldogs Radio Game Center V1.4 — Phone First

V1.4 consolidates the live phone testing fixes and radio-workflow improvements.

Highlights:
- Phone-first play entry: 16px inputs, no quick-yard keyboard focus, full-height play dialog, sticky Save/Cancel.
- Run/pass result buttons replace result dropdowns.
- Strong offense color cue: Ira orange; opponent configured color with gray fallback.
- Player dropdowns learn frequently used players and move them toward the top.
- Structured Ball Side + Yard Line and automatic Goal-to-Go when inside 15 yards.
- Sack entry uses positive yards-lost and records the play as negative yardage.
- Accepted penalties adjust distance based on which team is penalized.
- Undo restores prior down, distance, possession and ball position.
- New Drive resets to 1st & 15.
- Touchdown workflow prompts conversion, normal/onside kick, recovery, possession and starting field position.
- Dedicated Stats tab for Ira and opponent player/team stats.
- Roster Edit + Delete.
- Postgame readable on phone, Finalize Game, Start Next Game, standout-player suggestions and Next Game Preview.
- Public Game Center adds passing and receiving leader sections.
- SixManFootball sync refuses to replace the known-good schedule with an incomplete parse.
- Service worker cache bumped to V1.4.

Deployment: replace the website files with the V1.4 files. Because Code.gs has a sync validation change, also replace Code.gs in Apps Script and redeploy the existing web app as a new version.
