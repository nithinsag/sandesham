FROM node:10

WORKDIR /usr/src/app
COPY packge*.json ./
COPY yarn.lock ./ 
RUN yarn
COPY . .

EXPOSE 8080
CMD [ "yarn", "start" ]
