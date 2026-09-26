# Yvaine Weather Dashboard

Yvaine is a responsive weather dashboard built with plain HTML, CSS, and JavaScript. It shows current conditions, the next 12 hours, and a 10-day forecast without a framework or build step.

<img width="1189" height="894" alt="image" src="https://github.com/user-attachments/assets/9d0b1886-6a59-49e7-b864-5b1a09be9c3f" />

## Features

- Search suggestions for cities and places worldwide
- Browser geolocation with a readable city, region, and country label
- Current temperature, precipitation, humidity, wind, and UV index
- A scrollable 12-hour forecast with rain probabilities
- A 10-day forecast with daily highs, lows, conditions, and rain chances
- Weather advice based on upcoming rain, wind, and temperature
- Celsius/Fahrenheit and km/h/mph switching
- Day and night illustrations that follow the current conditions
- Responsive keyboard- and touch-friendly controls
- Reduced-motion support

## Technology

- HTML, CSS, and JavaScript
- Local Playfair Display and IBM Plex Mono font files
- [Phosphor Icons](https://phosphoricons.com/) for interface and weather symbols
- [Open-Meteo](https://open-meteo.com/) for forecasts and place search
- [BigDataCloud](https://www.bigdatacloud.com/) for reverse geocoding after location access

## Implementation notes

### Current UV index

The UV card uses the value for the current hour from `hourly.uv_index`. It reports zero after sunset instead of showing the day's peak UV level.

### Rain advice

Rain advice only considers the hours still ahead today. Rain that occurred earlier cannot trigger an umbrella recommendation later in the day.

### Request ordering

Search, geolocation, and unit changes receive an intent ID as soon as the user starts the action. If an older request finishes later, Yvaine ignores it instead of replacing the newest location or unit selection.

### Hourly forecast track

The hourly cards use a consistent sans-serif typeface. Arrow controls, horizontal scrolling, and a continuous custom track make the remaining hours accessible without letting cards or labels spill outside the panel.

## Run locally

You need Node.js 18 or newer. From the `weather-dashboard` folder, run:

```powershell
node dev-server.mjs
```

Open `http://localhost:4174` in a browser. The server also prints a local-network address that you can open on a phone connected to the same network.

No package installation is required.
