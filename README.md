# Ira Bulldogs Radio Game Center V1.2.1

V1.2.1 adds broadcaster cloud backup/load, phone-first quick yard buttons, automatic six-man down & distance, Goal-to-Go, defensive interceptions/fumble recoveries/tackles, optional group tackles, and the empty-roster modal fix.

## Upgrade from V1.1
1. Replace the GitHub Pages files with the V1.2.1 web files.
2. Replace Code.gs in the existing Google Apps Script project with the V1.2.1 Code.gs.
3. Deploy the Apps Script as a NEW VERSION of the existing Web App so the /exec URL can remain the same.
4. Keep your existing Apps Script URL and publish key in broadcaster Settings.

## Cloud behavior
Every local save still happens first. When online, the broadcaster publishes both the public scoreboard snapshot and a private broadcaster-state backup. The public endpoint strips the private broadcaster state before listeners receive it. Use **Load Current Game from Cloud** on a second broadcaster device to pull the current game and rosters.

## Offline behavior
Play entry remains local-first and works without internet after the app has been loaded/cached. When service returns, the latest complete state republishes automatically.


V1.2.1 hotfix: broadcaster cloud loading now uses JSONP, matching the public scoreboard transport, to work reliably across GitHub Pages and Google Apps Script origins.


## V1.3 broadcaster workflow improvements
- Tap either score in Live Game for +1, +2, +6, -1, or exact-score correction.
- Broadcaster-only point differential shows who leads and by how much.
- In the second half, 40+ shows distance from the 45-point threshold; 45+ shows a prominent 45-point margin warning.
- Load Current Game from Cloud is a large visible control at the top of Live Game.
- Updated service-worker cache strategy/version to reduce stale phone code after deployments.
