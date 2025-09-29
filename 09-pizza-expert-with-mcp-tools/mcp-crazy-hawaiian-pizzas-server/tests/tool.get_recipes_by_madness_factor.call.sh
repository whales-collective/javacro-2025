#!/bin/bash
source mcp.env
source mcp.server.env

MCP_SERVER=${MCP_SERVER:-"http://localhost:${MCP_HTTP_PORT}"}

echo "🌪️ Testing get_recipes_by_madness_factor tool..."
curl -s -X POST ${MCP_SERVER}/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_recipes_by_madness_factor",
      "arguments": {
        "madness_factor": "EXTREME"
      }
    }
  }' | jq .