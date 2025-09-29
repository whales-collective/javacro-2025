# MCP Pizzerias Server

A specialized HTTP streamable MCP (Model Context Protocol) server implemented in Go that provides access to Hawaiian pizza restaurant data worldwide.

## Goal

The MCP Pizzerias Server enables AI assistants and applications to query a comprehensive database of pizzerias serving Hawaiian pizza through the standardized MCP protocol. This server provides:

- **Hawaiian Pizza Database**: Access to detailed information about pizzerias worldwide that serve Hawaiian pizza
- **Location-based Search**: Find pizzerias by city or country with case-insensitive matching
- **Country Discovery**: Get a complete list of countries where Hawaiian pizza is available
- **HTTP Streaming**: Built on the MCP streamable HTTP protocol for real-time communication
- **Minimal Dependencies**: Lightweight implementation for easy deployment and maintenance

## Use Cases

- **Travel Planning**: Find Hawaiian pizza restaurants in destination cities
- **Market Research**: Analyze global Hawaiian pizza availability by region
- **Food Discovery**: Explore pizza specialties and restaurant details
- **Geographic Analysis**: Understand Hawaiian pizza distribution patterns
- **Restaurant Recommendations**: Get detailed information about specific pizzerias

## Tools

### `get_pizzerias_by_city`
Retrieves all pizzerias serving Hawaiian pizza in a specific city.

**Parameters:**
- `city` (string, required): Name of the city to search for pizzerias (case-insensitive)

**Returns:** JSON array of pizzeria objects matching the specified city

### `get_pizzerias_by_country`
Retrieves all pizzerias serving Hawaiian pizza in a specific country.

**Parameters:**
- `country` (string, required): Name of the country to search for pizzerias (case-insensitive)

**Returns:** JSON array of pizzeria objects matching the specified country

### `get_hawaiian_pizza_countries`
Retrieves a list of all countries that have pizzerias serving Hawaiian pizza.

**Parameters:** None

**Returns:** JSON array of country names where Hawaiian pizza is available

## Data Structure

Each pizzeria object contains the following information:
- `name`: Restaurant name
- `city`: City location
- `country`: Country (inferred from city if not explicitly provided)
- `address`: Full street address
- `website`: Restaurant website URL
- `phone`: Contact phone number
- `specialty`: Signature Hawaiian pizza description
- `description`: Detailed restaurant information

## Architecture

The server follows the MCP protocol specification and provides:

1. **Data Loading**: Loads pizzeria data from `data/hawaiian_pizza_directory.json`
2. **Country Inference**: Smart mapping of cities to countries when country field is missing
3. **Case-Insensitive Search**: All city and country searches are case-insensitive
4. **Tool Registration**: Three specialized tools for Hawaiian pizza discovery
5. **Error Handling**: Comprehensive error responses for data access issues
6. **Health Monitoring**: `/health` endpoint for service monitoring

## Configuration

Configure the server using environment variables:

```bash
MCP_HTTP_PORT=9090    # HTTP port for the server (default: 9090)
```

## Data Source

The server uses the Hawaiian Pizza Directory (`data/hawaiian_pizza_directory.json`), which contains information about pizzerias worldwide that serve Hawaiian pizza, including:

- Famous chains like Domino's, Pizza Hut, and Papa John's
- Local artisanal pizzerias in major cities
- Award-winning establishments
- Specialty Hawaiian pizza variations
- Historical locations (like the birthplace of Hawaiian pizza in Canada)

## Docker Support

The project includes Docker configuration for easy deployment.

### Use the Docker Image

Image: https://hub.docker.com/repository/docker/k33g/mcp-pizzerias-server/tags

```yaml
services:
  mcp-pizzerias-server:
    image: k33g/mcp-pizzerias-server:0.0.0
    ports:
      - 9090:9090
    environment:
      - MCP_HTTP_PORT=9090
    volumes:
      - ./data:/app/data
```

Start the server with:

```bash
docker compose up
```

## Example Usage

1. Find pizzerias in Paris:
   ```json
   {"city": "paris"}
   ```

2. Find pizzerias in the United States:
   ```json
   {"country": "united states"}
   ```

3. Get all countries with Hawaiian pizza:
   ```json
   {}
   ```

The server will return detailed information about each matching pizzeria, including their specialty Hawaiian pizza variations and contact details.