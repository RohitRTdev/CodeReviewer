FROM node:22 AS dev

WORKDIR /app
COPY package*.json .
RUN npm install 

CMD ["npm", "run", "dev"]

FROM node:22 AS builder

WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .

RUN npm run build

FROM nginx:alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf