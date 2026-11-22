# AlphaSim

Offline tick-data backtesting simulator (Electron, Windows x64). Charts: TradingView Lightweight Charts.

## Build the .exe on GitHub
1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. Open the **Actions** tab. The "Build AlphaSim (Windows x64)" workflow runs on every push, or run it with "Run workflow".
3. When it finishes, open the run and download the **AlphaSim-win-x64** artifact. It holds the installer and the portable .exe.

## Run locally
`npm install` then `npm start`

## Windows
Dashboard, Trade log, Trade details, Reports, Calendar, Backtesting, Playbook, Notebook, Data center. Trades come from saved Backtesting sessions. Light and dark themes (button in the sidebar).

## Backtesting shortcuts
Space play/pause, Right arrow next candle, Left arrow back one candle (only with no open trades), B buy, S sell, Delete removes the selected drawing, Esc cancels a tool, Ctrl+Z undoes.

## Data center
Downloads are manual: pick provider, symbol and dates, press Download. CSV files go to a folder you choose (default: Documents/AlphaSim/Downloads, one subfolder per provider and symbol). Import them into the simulator any time with the Import button; importing the same file twice is safe.
- Dukascopy: one CSV per day. Weekends are skipped, hours already fetched are cached, and a busy server makes the downloader pause and retry. Stop it or close the app at any time; pressing Download again continues where it stopped.
- HistData: one CSV per finished month (automatic download is best-effort).
- TrueFX: needs a free login. Download the monthly zip on their site, then use "Import files from elsewhere".

## Demo vs full
Edit `license.js`. Demo: EURUSD only, 3-day range, no saving. Full: everything. The key check in `activate()` is a placeholder; replace it with your Supabase call.

## Releases and auto-update
Pushing to main builds an artifact only. To publish a release that installed copies can update to, raise `version` in package.json, then tag and push: `git tag v0.1.1 && git push origin v0.1.1`. The installed app checks GitHub for a newer release at start and does nothing when offline. The portable exe does not auto-update.
