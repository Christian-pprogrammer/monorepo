FROM node:20.19.5-alpine

WORKDIR /app

COPY package*.json ./

# Clear cache and install
RUN npm install --legacy-peer-deps

COPY . .

RUN cd src/plugins/email-spider && npm install --legacy-peer-deps && npm run build

RUN npm run build

EXPOSE 1337

CMD ["npm", "start"]