#!/bin/bash
source mcp.env
source mcp.server.env

MCP_SERVER=${MCP_SERVER:-"http://localhost:${MCP_HTTP_PORT}"}

echo "🔧 Getting list of available tools..."
curl -s -X POST ${MCP_SERVER}/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq .