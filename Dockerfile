FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["sh", "-c", "echo 'crit-front skeleton ready. Add frontend source files before running the app.' && tail -f /dev/null"]
