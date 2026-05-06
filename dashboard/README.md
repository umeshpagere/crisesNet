# CrisisNet Dashboard

Real-time crisis response coordination dashboard built with React 18, TypeScript, and Leaflet.

## Features

- **Live Map**: OpenStreetMap with boat tracking and heatmap overlay
- **SSE Stream**: Real-time boat positions and alerts via Server-Sent Events
- **Threat Heatmap**: Time-decayed crisis intensity visualization
- **Alerts Panel**: Color-coded crisis alerts with severity indicators
- **Stats Bar**: Active crises, deployed boats, coverage metrics
- **Connection Status**: Live SSE connection indicator

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Leaflet** + React-Leaflet - Mapping
- **Native EventSource** - SSE streaming

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Integration

The dashboard connects to the Flask backend at `http://localhost:8080`:

- `GET /api/v1/stream/live-ops` - SSE stream (boats + alerts)
- `GET /api/v1/heatmap` - Threat heatmap (60s cache)

## Components

- `LiveMap` - Main map container with Nashik center (19.9975, 73.7898)
- `BoatMarker` - Boat markers with rotation by heading
- `HeatmapLayer` - Crisis intensity circles
- `AlertsPanel` - Scrollable alerts list
- `StatsBar` - Real-time metrics
- `ConnectionStatus` - SSE connection indicator

## Hooks

- `useSSEStream` - SSE connection with auto-reconnect (3s delay)
- `useHeatmap` - Heatmap polling (60s refresh)

## Map Center

**Nashik, Maharashtra**: 19.9975°N, 73.7898°E (Zoom: 11)
