FROM node:22 AS dev
WORKDIR /app

COPY package*.json ./
RUN npm install 

CMD ["npm", "run", "dev"]

FROM node:22 AS prod
WORKDIR /app

COPY package*.json ./
RUN npm install 
COPY . .
RUN npm run build

CMD ["npm", "start"]