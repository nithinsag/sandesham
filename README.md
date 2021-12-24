# Readme

Sandesham is the mono repo with the api server and batch jobs for
running ulkka

## Running the app in development

Install docker for your development environment and add the user to docker
group to run docker command without sudo.

Requires mongodb, you can start one by running `./start-mongo.sh`
Requires redis, you can start one by running `./start-redis.sh`

Update `.env` with the mongo url, if you are using the 
docker mongodb, you don't need to update this

Run `yarn install`
Run `yarn dev` to bring up the development server


## TODO
- integrate authentication and authorization
- impliment graphql for better querying
