# to start application from docker container
# add additional environment variables for docker here

docker build --tag sandesham/1.0 .

# using host network so that application can connect to mongo server on the 
# same host and also binds application port to host port
docker run --network=host --detach sandesham/1.0