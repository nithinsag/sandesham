FROM node:8

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install yarn -g
RUN yarn
COPY . .

EXPOSE 8080
CMD [ "yarn", "start" ]
