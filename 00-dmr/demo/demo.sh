#!/bin/bash
curl http://localhost:12434/engines/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "ai/qwen2.5:0.5B-F16",
        "messages": [{"role": "user", "content": "Who is Iron Man?"}]
    }'
