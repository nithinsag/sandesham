# to start application from docker container
# add additional environment variables for docker here


VERSION="1.0.7"
docker build --tag "sandesham/$VERSION" .

# using host network so that application can connect to mongo server on the 
# same host and also binds application port to host port
docker stop $(docker ps -a -q)
docker run --env-file env.list --network=host --detach "sandesham/$VERSION"
