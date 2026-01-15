# VegaLens - Vega Dashboard Builder for Elasticsearch

A powerful, visual dashboard builder for creating Vega visualizations with Elasticsearch data. Build beautiful, interactive charts and export them directly to Kibana.

## Features

### Visual Dashboard Builder
- **Drag-and-drop interface** for creating visualizations
- **40+ visualization types** including bar, line, area, scatter, heatmap, sankey (multi-stage), waterfall, ternary, population pyramid, dual-axis, violin, density, and more
- **Real-time preview** as you configure your charts
- **Dark theme** with beautiful glass morphism design
- **Pre-built templates** with sample data for quick start

### Elasticsearch Integration
- **Connect to Elasticsearch Cloud** with API key authentication
- **Elasticsearch Serverless** support
- **On-premise Elasticsearch** support
- **Browse indices** and explore field mappings
- **Query data** with full Elasticsearch DSL support
- **Sample data preview** before building visualizations

### Vega Spec Generation
- **Automatic Vega spec generation** based on your configuration
- **Kibana-compatible output** ready to paste into Kibana visualizations
- **Export to JSON** for use in other Vega-compatible tools
- **Live spec editing** with syntax validation

### Dashboard Management
- **Save dashboards** with multiple visualizations
- **Export to Kibana format** for seamless integration
- **Organize and manage** your visualization library

## Quick Start

### Using Docker (Recommended)

The fastest way to get started is with Docker:

```bash
# Clone the repository
git clone <repository-url>
cd projectFlow

# Create environment file with your Elasticsearch credentials
cat > .env << EOF
ELASTIC_SERVERLESS_ENDPOINT=https://your-project.es.region.aws.elastic.cloud
ELASTIC_API_KEY=your-api-key-here
EOF

# Build and run
docker compose up --build

# Open http://localhost:3001
```

### Docker Configuration Options

**Option 1: Elasticsearch Serverless**
```env
ELASTIC_SERVERLESS_ENDPOINT=https://your-project.es.region.aws.elastic.cloud
ELASTIC_API_KEY=your-api-key-here
```

**Option 2: Elastic Cloud**
```env
ELASTIC_CLOUD_ID=deployment-name:base64encodedstring
ELASTIC_API_KEY=your-api-key-here
```

**Option 3: On-Premise Elasticsearch**
```env
ELASTIC_NODE=https://localhost:9200
ELASTIC_USERNAME=elastic
ELASTIC_PASSWORD=your-password
ELASTIC_SKIP_TLS=true
```

### Manual Installation

#### Prerequisites

- Node.js 18+
- npm or yarn
- Elasticsearch Cloud account (or on-premise Elasticsearch 7.x/8.x)

#### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd projectFlow
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure Elasticsearch connection**

   Copy the sample environment file and configure your Elasticsearch credentials:
   ```bash
   cp backend/env.sample backend/.env
   ```

   Edit `backend/.env` with your credentials (see options above).

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This starts both the backend (port 3001) and frontend (port 5173).

5. **Open the application**

   Navigate to [http://localhost:5173](http://localhost:5173)

## Technology Stack

- **Frontend**: Vue 3 + Vite + Tailwind CSS + Pinia
- **Backend**: Express.js + Elasticsearch Client
- **Visualization**: Vega + Vega-Embed
- **Icons**: Lucide Vue
- **Containerization**: Docker

## Usage Guide

### Creating Your First Visualization

1. **Select Data Source**
   - Click "Dashboard Builder" in the sidebar
   - Choose an Elasticsearch index from the dropdown
   - Preview sample data and available fields

2. **Choose Chart Type**
   - Browse visualization types organized by category
   - Click on a chart type to select it
   - See description and use case for each type

3. **Configure the Chart**
   - Map your data fields to chart properties
   - Customize appearance settings
   - Adjust dimensions and styling options

4. **Preview & Export**
   - See real-time preview as you configure
   - View the generated Vega specification
   - Save to dashboard or export for Kibana

### Supported Visualization Types

| Category | Types |
|----------|-------|
| **Comparison** | Bar Chart, Radial Bar, Comet Chart, Population Pyramid, Radar Chart, Pareto Chart |
| **Trends** | Line Chart, Area Chart, Rolling Average, Dual-Axis, Trellis Area, Lasagna Plot, Sparkline, Horizon Chart, Streamgraph |
| **Composition** | Ternary Chart, Marimekko Chart |
| **Correlation** | Scatter Plot |
| **Distribution** | Histogram, Heatmap, 2D Histogram Heatmap, Box Plot, Heat Lane, Density Plot, Violin Plot, Error Bars |
| **Hierarchy** | Circle Packing |
| **Flow** | Sankey Diagram (2-4 stages), Waterfall Chart, Funnel Chart, Chord Diagram |

> See [VISUALIZATION_PLAN.md](./VISUALIZATION_PLAN.md) for detailed documentation of each chart type.

### Exporting to Kibana

1. Create your visualization in VegaLens
2. Click "Export" or view the Vega Spec tab
3. Copy the generated specification
4. In Kibana:
   - Go to Visualize → Create Visualization → Vega
   - Paste the specification
   - Save the visualization

> **Note:** Some complex visualizations (like multi-stage Sankey) may show a "Leave site?" browser popup when loading in Kibana. Click "Cancel" to continue - the visualization will render correctly. See [docs/how-to/kibana-quirks.md](docs/how-to/kibana-quirks.md) for details.

## API Reference

### Elasticsearch Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/elastic/connection` | GET | Test connection status |
| `/api/elastic/indices` | GET | List all indices |
| `/api/elastic/indices/:name/mapping` | GET | Get field mappings |
| `/api/elastic/indices/:name/sample` | GET | Get sample data |
| `/api/elastic/query` | POST | Execute custom query |

### Vega Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vega/types` | GET | List visualization types |
| `/api/vega/types/:type/schema` | GET | Get config schema |
| `/api/vega/generate` | POST | Generate Vega spec |
| `/api/vega/generate-kibana` | POST | Generate Kibana-ready spec |

### Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboards` | GET | List dashboards |
| `/api/dashboards` | POST | Create dashboard |
| `/api/dashboards/:id` | GET | Get dashboard |
| `/api/dashboards/:id` | PUT | Update dashboard |
| `/api/dashboards/:id` | DELETE | Delete dashboard |
| `/api/dashboards/:id/export/kibana` | GET | Export for Kibana |

## Project Structure

```
projectFlow/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── elasticsearch.js    # ES client configuration
│   │   ├── middleware/
│   │   │   └── errorHandler.js     # Error handling
│   │   ├── routes/
│   │   │   ├── elastic.routes.js   # Elasticsearch API
│   │   │   ├── vega.routes.js      # Vega generation API
│   │   │   └── dashboard.routes.js # Dashboard CRUD API
│   │   ├── services/
│   │   │   └── vega/               # Vega spec generators
│   │   └── server.js               # Express server
│   ├── env.sample                  # Environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── builder/            # Dashboard builder components
│   │   │   └── layout/             # App layout components
│   │   ├── stores/                 # Pinia stores
│   │   ├── views/                  # Page components
│   │   ├── services/               # API service
│   │   ├── router/                 # Vue Router
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css
│   ├── index.html
│   └── package.json
├── docs/
│   ├── how-to/                     # How-to guides
│   └── testing/                    # Testing documentation
├── Dockerfile                      # Production Docker image
├── docker-compose.yml              # Docker Compose config
├── package.json                    # Root package.json
└── README.md
```

## Development

### Running in Development Mode

```bash
# Start both servers with hot reload
npm run dev

# Or run separately
npm run dev:backend   # Backend on port 3001
npm run dev:frontend  # Frontend on port 5173
```

### Building for Production

```bash
# Build frontend
npm run build

# Start production server
npm start
```

### Running with Docker

```bash
# Build and run in foreground
docker compose up --build

# Run in background
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Running Tests

```bash
# Run backend tests
npm test

# Run schema validation tests
cd backend && npm run test:schema

# Run visual regression tests
cd backend && npm run test:visual

# Update visual baselines
cd backend && npm run test:visual:update
```

## Vega Resources

- [Vega Documentation](https://vega.github.io/vega/docs/)
- [Vega-Lite Documentation](https://vega.github.io/vega-lite/docs/)
- [Vega Examples](https://vega.github.io/vega/examples/)
- [Kibana Vega Visualization](https://www.elastic.co/docs/explore-analyze/visualize/custom-visualizations-with-vega)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

---

Built with Vue.js, Express, and Vega
