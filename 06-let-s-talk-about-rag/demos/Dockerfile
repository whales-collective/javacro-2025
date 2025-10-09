FROM node:20-slim

# Docker container for running Node.js application with LangChain
# Build: docker build -t dmr-nodejs-rag:demo .
# Run interactively: docker run -it dmr-nodejs-rag:demo
# Execute applications: 
# - node demo.01.main.js
# - node demo.02.main.js
# - node demo.03.main.js

# Set working directory
WORKDIR /app

# Copy package.json first for better Docker layer caching
COPY package.json .

# Install dependencies
RUN npm install

# Copy application files
COPY *.js .

# Default command to keep container running in interactive mode
CMD ["bash"]