# 🚆 Coach-Connect to Stalls

**Discover food, refreshments, and local stalls at railway stations based on your train journey, coach number, and platform information.**

## 📌 About the Project

Coach-Connect to Stalls is a railway passenger and vendor platform designed to bridge the gap between train passengers and local stall vendors at railway stations.

Passengers can discover nearby station stalls, explore menus and prices, check item availability, and access directions to stall locations. Vendors can register their stalls, manage stall information, update menus and prices, and maintain stock availability through a separate vendor portal.

The project aims to make station-side stall discovery more convenient while helping local vendors improve their visibility among railway passengers.

## 🎯 Objectives

- Help passengers discover food stalls and other useful services at railway stations.
- Display stall information according to station, platform, and coach-side location where reliable matching information is available.
- Allow passengers to view menus, prices, and stock availability.
- Provide Google Maps directions to stall locations when location information is available.
- Give vendors a dedicated portal to manage their stalls and menu information.
- Synchronize vendor updates with the passenger-facing stall listings.
- Integrate live train information through the RailKit API.

## 👥 Main Modules

### 1. Passenger Website
- Enter train number and coach number.
- Retrieve train journey information using the RailKit integration.
- View the next station and platform information when provided by the live data source.
- Browse station stalls and filter listings by category.
- View stall details, menus, prices, and stock status.
- Access directions to available stall locations.

### 2. Vendor Portal
- Register and manage stalls.
- Provide station name, station code, platform number, and coach-side location.
- Add, edit, and remove menu items.
- Update item prices and stock availability.
- Manage stall availability and passenger publication status.
- Reflect published stall and menu changes in passenger listings.

### 3. Stall Discovery and Matching
- Match stalls to the relevant station.
- Use platform and coach-side information to improve stall relevance.
- Support approximate proximity matching when reliable location or station-layout data is available.
- Avoid presenting unverified coach positions or distances as confirmed information.

### 4. Live Train Information
- Retrieve train journey information through the RailKit API.
- Display the next station and platform when available from the API response.
- Keep API credentials on the server side.
- Use caching and controlled API requests to reduce unnecessary usage.

## 🛠️ Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** JavaScript serverless API routes
- **Platform:** Hatchable
- **External API:** RailKit for live train information
- **Version Control:** Git and GitHub
- **Database and Storage:** To be finalized or verified against the current project configuration

## 🔄 Expected Workflow

1. A passenger enters a train number and coach number.
2. The application retrieves the available train journey information.
3. The passenger selects the relevant next-station stall listing.
4. The system displays matching published stalls, their menus, prices, and stock availability.
5. The passenger views directions to a stall.
6. A vendor updates stall details, menu items, prices, or stock through the vendor portal.
7. The passenger website retrieves the updated information from the shared backend.

## 🔐 Security and Reliability

- Keep API keys and sensitive configuration out of frontend code and public GitHub files.
- Validate vendor inputs and API responses.
- Show clear messages when live train, platform, location, or stock information is unavailable.
- Distinguish demo data from verified vendor listings.
- Avoid claiming precise coach-to-stall distances without reliable station-layout or coordinate data.

## 🚧 Project Status

The passenger website, vendor portal, and API source files are maintained in this repository. The project is under active development, with further integration, local testing, vendor-to-passenger synchronization, and deployment verification planned.

Features should be considered complete only after they have been tested against the actual backend and passenger-facing application.

## 🌟 Vision

To make railway station stall discovery easier for passengers while helping local vendors connect with travellers through a simple, accessible digital platform.

---

**Repository:** `coach-connect-to-stalls`

**Project:** Coach-Connect to Stalls

**Purpose:** Railway passenger stall discovery and vendor management.
