FROM node:20.19.5-alpine

WORKDIR /app

COPY package*.json ./

RUN  npm install --legacy-peer-deps

COPY . .

RUN npm run build

CMD ["node", "dist/index.js", "--help"]