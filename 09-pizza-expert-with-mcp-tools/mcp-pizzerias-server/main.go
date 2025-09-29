package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Pizzeria struct {
	Name        string `json:"name"`
	City        string `json:"city"`
	Country     string `json:"country,omitempty"`
	Address     string `json:"address"`
	Website     string `json:"website"`
	Phone       string `json:"phone"`
	Specialty   string `json:"specialty"`
	Description string `json:"description"`
}

func main() {

	// Create MCP server
	s := server.NewMCPServer(
		"mcp-pizzerias-server",
		"0.0.0",
	)

	// Pizzerias by city tool
	pizzeriasByCityTool := mcp.NewTool("get_pizzerias_by_city",
		mcp.WithDescription("Get list of pizzerias in a specific city"),
		mcp.WithString("city",
			mcp.Required(),
			mcp.Description("Name of the city to search for pizzerias"),
		),
	)
	s.AddTool(pizzeriasByCityTool, pizzeriasByCityHandler)

	// Pizzerias by country tool
	pizzeriasByCountryTool := mcp.NewTool("get_pizzerias_by_country",
		mcp.WithDescription("Get list of pizzerias in a specific country"),
		mcp.WithString("country",
			mcp.Required(),
			mcp.Description("Name of the country to search for pizzerias"),
		),
	)
	s.AddTool(pizzeriasByCountryTool, pizzeriasByCountryHandler)

	// Countries with Hawaiian pizza tool
	hawaiianCountriesTool := mcp.NewTool("get_hawaiian_pizza_countries",
		mcp.WithDescription("Get list of countries that serve Hawaiian pizzas"),
	)
	s.AddTool(hawaiianCountriesTool, hawaiianCountriesHandler)

	// Start the HTTP server
	httpPort := os.Getenv("MCP_HTTP_PORT")
	if httpPort == "" {
		httpPort = "9090"
	}

	log.Println("MCP Files Server is running on port", httpPort)

	// Create a custom mux to handle both MCP and health endpoints
	mux := http.NewServeMux()

	// Add healthcheck endpoint
	mux.HandleFunc("/health", healthCheckHandler)

	// Add MCP endpoint
	httpServer := server.NewStreamableHTTPServer(s,
		server.WithEndpointPath("/mcp"),
	)

	// Register MCP handler with the mux
	mux.Handle("/mcp", httpServer)

	// Start the HTTP server with custom mux
	log.Fatal(http.ListenAndServe(":"+httpPort, mux))
}

func loadPizzeriaData() ([]Pizzeria, error) {
	dataPath := "data/hawaiian_pizza_directory.json"

	content, err := os.ReadFile(dataPath)
	if err != nil {
		return nil, fmt.Errorf("error reading pizzeria data: %v", err)
	}

	var pizzerias []Pizzeria
	err = json.Unmarshal(content, &pizzerias)
	if err != nil {
		return nil, fmt.Errorf("error parsing pizzeria data: %v", err)
	}

	return pizzerias, nil
}

func pizzeriasByCityHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := request.GetArguments()

	cityArg, exists := args["city"]
	if !exists || cityArg == nil {
		return nil, fmt.Errorf("missing required parameter 'city'")
	}

	city, ok := cityArg.(string)
	if !ok {
		return nil, fmt.Errorf("parameter 'city' must be a string")
	}

	// Convert to lowercase for comparison
	cityLower := strings.ToLower(city)

	pizzerias, err := loadPizzeriaData()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	var matchingPizzerias []Pizzeria
	for _, pizzeria := range pizzerias {
		if strings.ToLower(pizzeria.City) == cityLower {
			matchingPizzerias = append(matchingPizzerias, pizzeria)
		}
	}

	result, err := json.MarshalIndent(matchingPizzerias, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Error formatting results: %v", err)), nil
	}

	log.Printf("Found %d pizzerias in city: %s", len(matchingPizzerias), city)
	return mcp.NewToolResultText(string(result)), nil
}

func pizzeriasByCountryHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := request.GetArguments()

	countryArg, exists := args["country"]
	if !exists || countryArg == nil {
		return nil, fmt.Errorf("missing required parameter 'country'")
	}

	country, ok := countryArg.(string)
	if !ok {
		return nil, fmt.Errorf("parameter 'country' must be a string")
	}

	// Convert to lowercase for comparison
	countryLower := strings.ToLower(country)

	pizzerias, err := loadPizzeriaData()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	var matchingPizzerias []Pizzeria
	for _, pizzeria := range pizzerias {
		// Check both explicit country field and infer from city names
		pizzeriaCountry := pizzeria.Country
		if pizzeriaCountry == "" {
			// Infer country from well-known cities
			cityLower := strings.ToLower(pizzeria.City)
			switch cityLower {
			case "paris":
				pizzeriaCountry = "France"
			case "london":
				pizzeriaCountry = "United Kingdom"
			case "rome", "milan", "naples":
				pizzeriaCountry = "Italy"
			case "berlin":
				pizzeriaCountry = "Germany"
			case "tokyo":
				pizzeriaCountry = "Japan"
			case "sydney", "melbourne":
				pizzeriaCountry = "Australia"
			case "toronto", "vancouver", "calgary", "montreal", "chatham":
				pizzeriaCountry = "Canada"
			case "new york", "san francisco", "chicago", "los angeles", "berkeley", "oakland", "honolulu", "dallas", "pasadena", "phoenix", "des moines":
				pizzeriaCountry = "United States"
			case "auckland":
				pizzeriaCountry = "New Zealand"
			case "rovinj":
				pizzeriaCountry = "Croatia"
			}
		}

		if strings.ToLower(pizzeriaCountry) == countryLower {
			// Set the inferred country for consistency
			if pizzeria.Country == "" {
				pizzeria.Country = pizzeriaCountry
			}
			matchingPizzerias = append(matchingPizzerias, pizzeria)
		}
	}

	result, err := json.MarshalIndent(matchingPizzerias, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Error formatting results: %v", err)), nil
	}

	log.Printf("Found %d pizzerias in country: %s", len(matchingPizzerias), country)
	return mcp.NewToolResultText(string(result)), nil
}

func hawaiianCountriesHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	pizzerias, err := loadPizzeriaData()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	countrySet := make(map[string]bool)

	for _, pizzeria := range pizzerias {
		country := pizzeria.Country
		if country == "" {
			// Infer country from well-known cities
			cityLower := strings.ToLower(pizzeria.City)
			switch cityLower {
			case "paris":
				country = "France"
			case "london":
				country = "United Kingdom"
			case "rome", "milan", "naples":
				country = "Italy"
			case "berlin":
				country = "Germany"
			case "tokyo":
				country = "Japan"
			case "sydney", "melbourne":
				country = "Australia"
			case "toronto", "vancouver", "calgary", "montreal", "chatham":
				country = "Canada"
			case "new york", "san francisco", "chicago", "los angeles", "berkeley", "oakland", "honolulu", "dallas", "pasadena", "phoenix", "des moines":
				country = "United States"
			case "auckland":
				country = "New Zealand"
			case "rovinj":
				country = "Croatia"
			}
		}

		if country != "" {
			countrySet[country] = true
		}
	}

	var countries []string
	for country := range countrySet {
		countries = append(countries, country)
	}

	result, err := json.MarshalIndent(countries, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Error formatting results: %v", err)), nil
	}

	log.Printf("Found %d countries that serve Hawaiian pizza", len(countries))
	return mcp.NewToolResultText(string(result)), nil
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]interface{}{
		"status": "healthy",
		"server": "mcp-pizzerias-server",
	}
	json.NewEncoder(w).Encode(response)
}
