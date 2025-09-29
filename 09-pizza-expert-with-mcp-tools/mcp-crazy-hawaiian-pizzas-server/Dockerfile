FROM --platform=$BUILDPLATFORM golang:1.24.4-alpine AS builder
ARG TARGETOS
ARG TARGETARCH
WORKDIR /app

# Copy Go module files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and data
COPY . .

# Build the application
RUN <<EOF
go mod tidy 
GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o mcp-crazy-hawaiian-pizzas-server
EOF

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates wget curl jq

WORKDIR /app

# Copy the binary and data files
COPY --from=builder /app/mcp-crazy-hawaiian-pizzas-server .
COPY --from=builder /app/data ./data

# Create a non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser
USER appuser

# Expose the port
EXPOSE 9091

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9091/health || exit 1

ENTRYPOINT ["./mcp-crazy-hawaiian-pizzas-server"]