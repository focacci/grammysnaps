# Use an official Node.js runtime as the base image
FROM node:20

# Set working directory
WORKDIR /code

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the port Fastify will run on
EXPOSE 3000

# Command to start the app
CMD ["npm", "run", "start"]