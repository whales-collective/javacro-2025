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
	"gopkg.in/yaml.v3"
)

type Ingredient struct {
	Base     []string `yaml:"base"`
	Toppings []string `yaml:"toppings"`
}

type CrazyPizza struct {
	Name         string     `yaml:"name"`
	ID           string     `yaml:"id"`
	Description  string     `yaml:"description"`
	Ingredients  Ingredient `yaml:"ingredients"`
	CookingTime  string     `yaml:"cooking_time"`
	SpiceLevel   string     `yaml:"spice_level"`
	MadnessFactor string    `yaml:"madness_factor"`
}

type PizzaData struct {
	CrazyHawaiianPizzas []CrazyPizza `yaml:"crazy_hawaiian_pizzas"`
	CookingTips        []string     `yaml:"cooking_tips"`
	Warning            string       `yaml:"warning"`
	ChefPhilosophy     string       `yaml:"chef_philosophy"`
}

func main() {
	// Create MCP server
	s := server.NewMCPServer(
		"mcp-crazy-hawaiian-pizzas-server",
		"1.0.0",
	)

	// Recipe search by ID tool
	recipeByIdTool := mcp.NewTool("get_recipe_by_id",
		mcp.WithDescription("Get a crazy Hawaiian pizza recipe by its ID"),
		mcp.WithString("id",
			mcp.Required(),
			mcp.Description("ID of the pizza recipe to retrieve"),
		),
	)
	s.AddTool(recipeByIdTool, recipeByIdHandler)

	// Recipe search by madness factor tool
	recipeByMadnessFactorTool := mcp.NewTool("get_recipes_by_madness_factor",
		mcp.WithDescription("Get crazy Hawaiian pizza recipes by madness factor (EXTREME, MIND-BENDING, CULTURALLY CONFUSED, etc.)"),
		mcp.WithString("madness_factor",
			mcp.Required(),
			mcp.Description("Madness factor to search for (EXTREME, MIND-BENDING, CULTURALLY CONFUSED, BREAKFAST CHAOS, ASTRONOMICALLY ABSURD, DESSERT DELIRIUM, LIQUID LUNACY, TEMPORALLY CONFUSED, MYSTERIOUSLY MIND-BENDING, ARCHITECTURALLY ABSURD, MICROSCOPICALLY RIDICULOUS, PHILOSOPHICALLY DEVASTATING, METEOROLOGICALLY MENTAL)"),
		),
	)
	s.AddTool(recipeByMadnessFactorTool, recipeByMadnessFactorHandler)

	// Recipe search by base ingredients keywords tool
	recipeByBaseIngredientsTool := mcp.NewTool("get_recipes_by_base_ingredients",
		mcp.WithDescription("Search for crazy Hawaiian pizza recipes by keywords in base ingredients"),
		mcp.WithString("keyword",
			mcp.Required(),
			mcp.Description("Keyword to search for in base ingredients (e.g., 'cheese', 'sauce', 'dough', 'marinara', 'mozzarella')"),
		),
	)
	s.AddTool(recipeByBaseIngredientsTool, recipeByBaseIngredientsHandler)

	// Start the HTTP server
	httpPort := os.Getenv("MCP_HTTP_PORT")
	if httpPort == "" {
		httpPort = "9091"
	}

	log.Println("MCP Crazy Hawaiian Pizzas Server is running on port", httpPort)

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

func loadPizzaData() (*PizzaData, error) {
	dataPath := "data/crazy-pizzas.yaml"

	content, err := os.ReadFile(dataPath)
	if err != nil {
		return nil, fmt.Errorf("error reading pizza data: %v", err)
	}

	var pizzaData PizzaData
	err = yaml.Unmarshal(content, &pizzaData)
	if err != nil {
		return nil, fmt.Errorf("error parsing pizza data: %v", err)
	}

	return &pizzaData, nil
}

func recipeByIdHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := request.GetArguments()

	idArg, exists := args["id"]
	if !exists || idArg == nil {
		return nil, fmt.Errorf("missing required parameter 'id'")
	}

	id, ok := idArg.(string)
	if !ok {
		return nil, fmt.Errorf("parameter 'id' must be a string")
	}

	pizzaData, err := loadPizzaData()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	for _, pizza := range pizzaData.CrazyHawaiianPizzas {
		if pizza.ID == id {
			result, err := json.MarshalIndent(pizza, "", "  ")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Error formatting result: %v", err)), nil
			}
			
			log.Printf("Found pizza recipe with ID: %s", id)
			return mcp.NewToolResultText(string(result)), nil
		}
	}

	log.Printf("No pizza recipe found with ID: %s", id)
	return mcp.NewToolResultText(fmt.Sprintf("No pizza recipe found with ID: %s", id)), nil
}

func recipeByMadnessFactorHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := request.GetArguments()

	madnessFactorArg, exists := args["madness_factor"]
	if !exists || madnessFactorArg == nil {
		return nil, fmt.Errorf("missing required parameter 'madness_factor'")
	}

	madnessFactor, ok := madnessFactorArg.(string)
	if !ok {
		return nil, fmt.Errorf("parameter 'madness_factor' must be a string")
	}

	// Convert to uppercase for comparison
	madnessFactorUpper := strings.ToUpper(madnessFactor)

	pizzaData, err := loadPizzaData()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	var matchingPizzas []CrazyPizza
	for _, pizza := range pizzaData.CrazyHawaiianPizzas {
		if strings.ToUpper(pizza.MadnessFactor) == madnessFactorUpper {
			matchingPizzas = append(matchingPizzas, pizza)
		}
	}

	result, err := json.MarshalIndent(matchingPizzas, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Error formatting results: %v", err)), nil
	}

	log.Printf("Found %d pizza recipes with madness factor: %s", len(matchingPizzas), madnessFactor)
	return mcp.NewToolResultText(string(result)), nil
}

func recipeByBaseIngredientsHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := request.GetArguments()

	keywordArg, exists := args["keyword"]
	if !exists || keywordArg == nil {
		return nil, fmt.Errorf("missing required parameter 'keyword'")
	}

	keyword, ok := keywordArg.(string)
	if !ok {
		return nil, fmt.Errorf("parameter 'keyword' must be a string")
	}

	// Convert to lowercase for comparison
	keywordLower := strings.ToLower(keyword)

	pizzaData, err := loadPizzaData()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	var matchingPizzas []CrazyPizza
	for _, pizza := range pizzaData.CrazyHawaiianPizzas {
		// Search in base ingredients
		for _, baseIngredient := range pizza.Ingredients.Base {
			if strings.Contains(strings.ToLower(baseIngredient), keywordLower) {
				matchingPizzas = append(matchingPizzas, pizza)
				break // Found match, no need to check other base ingredients for this pizza
			}
		}
	}

	result, err := json.MarshalIndent(matchingPizzas, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Error formatting results: %v", err)), nil
	}

	log.Printf("Found %d pizza recipes with base ingredient keyword: %s", len(matchingPizzas), keyword)
	return mcp.NewToolResultText(string(result)), nil
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]interface{}{
		"status": "healthy",
		"server": "mcp-crazy-hawaiian-pizzas-server",
	}
	json.NewEncoder(w).Encode(response)
}