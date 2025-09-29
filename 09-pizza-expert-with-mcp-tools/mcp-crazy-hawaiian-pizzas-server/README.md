# MCP Crazy Hawaiian Pizzas Server 🍕🌺

A Model Context Protocol (MCP) server that provides access to a collection of absolutely bonkers Hawaiian pizza recipes. This server offers tools to search and explore the most creative (and perhaps questionable) Hawaiian pizza variations ever conceived.

## Features

This MCP server provides three powerful tools:

### 🔍 `get_recipe_by_id`
Search for a specific pizza recipe by its unique ID.

**Parameters:**
- `id` (string, required): The unique ID of the pizza recipe

**Example IDs:**
- `volcanic_pineapple` - The Volcanic Pineapple Explosion
- `upside_down_tornado` - The Upside-Down Tropical Tornado  
- `pizza_sushi_roll` - The Pineapple Pizza Sushi Roll
- And 10 more crazy variations!

### 🌪️ `get_recipes_by_madness_factor`
Find recipes based on their level of culinary madness.

**Parameters:**
- `madness_factor` (string, required): The madness level to search for

**Available Madness Factors:**
- `EXTREME` - For the truly brave
- `MIND-BENDING` - Reality-defying combinations
- `CULTURALLY CONFUSED` - Cross-cultural chaos
- `BREAKFAST CHAOS` - Morning pizza madness
- `ASTRONOMICALLY ABSURD` - Out-of-this-world creations
- `DESSERT DELIRIUM` - Sweet pizza insanity
- `LIQUID LUNACY` - Drinkable pizza concepts
- `TEMPORALLY CONFUSED` - Time-traveling ingredients
- `MYSTERIOUSLY MIND-BENDING` - Nearly invisible pizzas
- `ARCHITECTURALLY ABSURD` - Structurally impossible
- `MICROSCOPICALLY RIDICULOUS` - Tiny pizza madness
- `PHILOSOPHICALLY DEVASTATING` - Existential pizza crisis
- `METEOROLOGICALLY MENTAL` - Weather-dependent recipes

### 🧀 `get_recipes_by_base_ingredients`
Search for recipes containing specific keywords in their base ingredients.

**Parameters:**
- `keyword` (string, required): Keyword to search for in base ingredients

**Example Keywords:**
- `cheese` - Find all cheese-based foundations
- `sauce` - Discover sauce variations
- `dough` - Explore crust alternatives
- `marinara` - Traditional tomato bases
- `cream` - Creamy base options

## Data Source

All recipes are stored in `data/crazy-pizzas.yaml` and include:
- 13 utterly unique Hawaiian pizza variations
- Complete ingredient lists (base + toppings)
- Cooking instructions and times
- Spice level indicators
- Madness factor ratings
- Creative descriptions and warnings

## Quick Start

### Option 1: Direct Go Execution

#### 1. Install Dependencies
```bash
go mod tidy
```

#### 2. Start the Server
```bash
./start.sh
# OR
export MCP_HTTP_PORT=9091
go run main.go
```

#### 3. Health Check
```bash
curl http://localhost:9091/health
```

### Option 2: Docker (Recommended)

#### 1. Using Docker Compose
```bash
# Start the server
docker compose up -d

# Check logs
docker compose logs -f

# Stop the server
docker compose down
```

#### 2. Using Docker directly
```bash
# Build the image
docker build -t mcp-crazy-hawaiian-pizzas-server .

# Run the container
docker run -d \
  --name mcp-crazy-hawaiian-pizzas-server \
  -p 9091:9091 \
  -v $(pwd)/data:/app/data \
  mcp-crazy-hawaiian-pizzas-server

# Check health
curl http://localhost:9091/health
```

#### 3. Multi-platform Build
```bash
# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 -t mcp-crazy-hawaiian-pizzas-server .
```

## Testing

The `tests/` directory contains shell scripts to test each tool:

```bash
cd tests
chmod +x *.sh

# Initialize test environment
./initialize.sh

# Test individual tools (requires running server)
./tool.get_recipe_by_id.call.sh
./tool.get_recipes_by_madness_factor.call.sh
./tool.get_recipes_by_base_ingredients.call.sh
```

## Configuration

- **Port**: Set `MCP_HTTP_PORT` environment variable (default: 9091)
- **Data File**: Located at `data/crazy-pizzas.yaml`
- **Health Endpoint**: `/health`
- **MCP Endpoint**: `/mcp`

## Docker Configuration

### Environment Variables
- `MCP_HTTP_PORT`: Server port (default: 9091)

### Volumes
- `./data:/app/data`: Mount data directory for recipe files

### Health Check
The Docker container includes a health check that monitors the `/health` endpoint every 30 seconds.

### Networks
The compose file creates a dedicated `mcp-network` bridge network for container communication.

## Example Recipes

### 🌋 The Volcanic Pineapple Explosion (EXTREME)
A fiery twist with ghost pepper marinara, Carolina Reaper ham, and sriracha-infused olive oil.

### 🍣 The Pineapple Pizza Sushi Roll (CULTURALLY CONFUSED)  
Hawaiian pizza meets Japanese cuisine with sushi rice crust and wasabi cream cheese.

### 👻 The Invisible Hawaiian Mystery (MYSTERIOUSLY MIND-BENDING)
Nearly transparent pizza using clear gelatin "cheese" and ham powder.

## Warning ⚠️

> These recipes may cause uncontrollable laughter, existential pizza crises, and/or culinary enlightenment. Proceed with caution and an open mind!

## Philosophy

*"Life is too short for boring Hawaiian pizza. If you're going to put pineapple on pizza, might as well go completely bonkers with it!"* 🍍🏄‍♂️

---

*Built with Go and the MCP-Go framework*