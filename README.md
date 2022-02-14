# Readme

Sandesham is the mono repo with the api server and batch jobs for
running ulkka

## Running the app in development

Install docker for your development environment and add the user to docker
group to run docker command without sudo.

Requires mongodb & redis, you can create by running `./start-db.sh` (You will need `docker` command accessible without root)


Update `.env` with the mongo url, if you are using the 
docker mongodb, you don't need to update this

Run `yarn install`
Run `yarn dev` to bring up the development server
