# Coach-Connect Passenger — Hatchable Demo

Mobile-first passenger demo for next-station stall discovery.

## Stack

- Frontend: HTML, CSS and vanilla JavaScript in `public/`.
- Backend: Hatchable JavaScript serverless handlers in `api/`.
- Data: Hatchable PostgreSQL, raw parameterized SQL (`db.query`).
- Live tracking adapter: `api/journey.js`; key is configured server-side with `RAILKIT_API_KEY`.
- Coach match: rank coach ranges as exact (priority 1), within ±2 coaches (priority 2), then other listings (priority 3).
- No GPS, order/cart, checkout, payments, or order status.

## Configure RailKit

1. Create an API key in your RailKit account dashboard.
2. In Hatchable Console → Coach-Connect Passenger → Setup, set `RAILKIT_API_KEY`. Never place a real key in browser JavaScript or commit it to source control.
3. Verify the current endpoint, auth headers, query parameters, and JSON response format with the RailKit docs for your subscription. The current backend adapter assumes `GET https://railkit.in/api/trains/{trainNumber}/track?date=YYYY-MM-DD`, bearer + `x-api-key` headers, and a route-oriented response; adjust the adapter if official docs differ.
4. Deploy and test with a train known to be running. Check Hatchable logs on errors.

**Important:** the assumed RailKit URL/response schema has not yet been validated by a successful real API request in this build. Without a configured key, the app marks results as demo and does not claim live train position, delay, or next halt. For judges, use “Explore demo stalls” to exercise the stall UI using the fictional Nagda Junction catalogue.

## Demo data

`seed.sql` contains 16 fictional listings at NDLS, BCT, MAS, HWH, and SBC. A four-stall Nagda Junction fallback is also included in the stalls endpoint for demonstrations. All names, menus, prices, platforms, and coach ranges are illustrative examples — not verified official vendor data.

## Endpoints

- `POST /api/journey` body `{ trainNumber, coachNumber, date? }`; returns normalized `{ ok, journey }` and cached live responses for a short TTL.
- `GET /api/stalls?station=NAD&coach=5`; returns `{ source, demo, stationCode, station, stalls[] }` sorted by coach-range relevance.

## Local environment handoff

This hosted Hatchable project does not run Next.js, Express, or `npm install`. Use a normal local Node/Express app if you need `.env.example`; the local example should contain `RAILKIT_API_KEY=your_key_here` and `PORT=3000`. For the hosted app, keep the actual key in Hatchable Setup.

## Safety

Coach-range matching is only a discovery cue; it cannot guarantee physical stall distance or that a vendor is directly beside a coach. Follow official railway signage, announcements, and staff instructions. Do not move between coaches or approach a platform edge while a train is moving. Production readiness requires validating the RailKit schema, request limits/cache behavior, real vendor onboarding and verified platform/stall coordinates before representing routes as accurate.