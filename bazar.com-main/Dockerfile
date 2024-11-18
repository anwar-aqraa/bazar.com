FROM node as base 

# Set working directory
WORKDIR /app

# Update packages and install SQLite3, Node.js, and npm
RUN apt-get update -y && \
    apt-get install -y sqlite3 nodejs npm

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Building Catalog Service
FROM base AS catalog
WORKDIR /app/catalog
COPY ./catalog . 
RUN npm install
EXPOSE 3001
CMD ["npm", "run", "start-catalog"]

# Building Order Service
FROM base AS order
WORKDIR /app/order
COPY ./order .  
RUN npm install
EXPOSE 3002
CMD ["npm", "run", "start-order"]

# Building Frontend Service
FROM base AS client
WORKDIR /app/frontend
COPY ./frontend .  
RUN npm install
EXPOSE 3000
CMD ["npm", "run", "start-client"]
