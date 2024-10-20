FROM node

WORKDIR /app

COPY package.json .

RUN yarn install --network-timeout 3600000

COPY . .

EXPOSE 3000

CMD ["yarn", "start"]