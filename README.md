[![Deploy to Hatchable](https://hatchable.com/deploy-button.svg)](https://hatchable.com/deploy?repo=https://github.com/anjalianju2956-ui/coach-connect-to-stalls)

# Coach-Connect — Live Train Next-Halt Tracker

This version is intentionally limited to live train status. Enter a 5-digit train number to fetch the current reported location, next halt, distance, delay, and train details from RailKit. The app does not request GPS, coach number, stall data, or location permissions.

## Hosted stack

- Frontend: HTML, CSS and vanilla JavaScript in `public/`.
- Backend: Hatchable serverless API handler at `api/journey.js`.
- Secret storage: Hatchable project Setup; `RAILKIT_API_KEY` remains server-side.
- Live provider: RailKit WIMT v2 endpoint `GET https://api.railkit.in/api/v2/trains/{trainNumber}/live/{YYYY-MM-DD}`, authenticated with the same request-signing headers as the RailKit SDK.

## Enable real live tracking

1. Open Hatchable Console → Coach-Connect Passenger → Setup.
2. Add the RailKit key as `RAILKIT_API_KEY`. Do not paste the key into frontend code or commit it to Git.
3. Save, then use the Track Train form with a valid 5-digit train number.
4. If the request fails, the UI displays the actual configuration/API error; the app does not fabricate a station or fall back to demo data.

RailKit's documented v2 route and response fields are referenced at https://railkit.in/docs/live-tracking-v2. The backend accepts the response's `data.nextHalt`, `data.currentLocation`, `data.trainInfo`, `data.delayMinutes`, `data.statusText`, and `data.lastUpdatedAt` fields. REST authentication headers are set server-side. The real provider response should be tested after the owner's API key is configured; this environment did not have access to a configured key, so no successful real-data request is claimed here.

## Usage and freshness

Each Track/Refresh action makes one upstream request. There is no automatic polling, to avoid consuming the API quota without the user's knowledge. Press Refresh to fetch the latest available RailKit response.

## Local project note

This is deployed on Hatchable, which uses its serverless runtime and does not run `npm install`. A standalone local Node/Express project would require a separate export/rebuild and an `.env.example` containing `RAILKIT_API_KEY=your_key_here`.