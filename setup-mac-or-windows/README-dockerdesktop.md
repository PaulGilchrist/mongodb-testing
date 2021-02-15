# Docker Desktop Setup

Before running this code, run the [Docker Desktop](https://www.docker.com/products/docker-desktop) command below to install and start mongodb (change DB path if needed)

```
docker run -d -p 27017:27017 -v /Users/Shared/mongodb:/data/db --name mongodb mongo:latest --replSet rs0
```

* Make sure to choose a path that exists.  The above example is for MacOS, but would not pre-exist for Windows users

Next, connect to your running container through the Docker dashboard and run the `mongo` shell, and initiate the new Replica Set using command `rs.initiate()` or remove the section of this code that demonstrates a transaction.  Transactions require a replica set, even if it is a set with only 1 node.

You may also want to download the [MongoDB Compass](https://www.mongodb.com/try/download/compass) applications connecting using the string [mongodb://localhost:27017/](mongodb://localhost:27017/).

If building a multi-node replica set (see [Creating a MongoDB replica set using Docker](https://www.sohamkamani.com/blog/2016/06/30/docker-mongo-replica-set/))

```
docker network create mongodb-cluster
docker run -d -p 30001:27017 --name mongodb1 -v /Users/Shared/mongodb1:/data/db --net mongodb-cluster mongo:latest --replSet rs0
docker run -d -p 30002:27017 --name mongodb2 -v /Users/Shared/mongodb2:/data/db --net mongodb-cluster mongo:latest --replSet rs0
docker run -d -p 30003:27017 --name mongodb3 -v /Users/Shared/mongodb3:/data/db --net mongodb-cluster mongo:latest --replSet rs0
```

Run the following command from the terminal on mongodb1

```
db = (new Mongo('localhost:27017')).getDB('database-name')
config = {
    "_id" : "rs0",
    "members" : [
        {
            "_id" : 0,
            "host" : "mongodb1:27017"
        },
        {
            "_id" : 1,
            "host" : "mongodb2:27017"
        },
        {
            "_id" : 2,
            "host" : "mongodb3:27017"
        }
    ]
}
rs.initiate(config)
```

* Better would be to use Kubernetes or docker-compose

Follow by adding to or creating a `nodemon.json` file with the below environment variables:

```json
{
    "env": {
        "mongoDbConnectionString": "mongodb://localhost:27017",
    }
}
```

* If also testing against Azure Cosmos DB, add the environment variables `cosmosDbProvisionedConnectionString` and/or `cosmosDbServerlessConnectionString` based on which one you will be testing.

You will start the record insert process using the command `npm run insertMongo`.  It will take quite a while to insert the 20 million rows, but the program can be stopped and restarted at any time and it will resume where it left off.  You can later check that records are being inserted successfully using [MongoDB Compass](https://www.mongodb.com/try/download/compass).

Once all records have been inserted, using MongoDB Compass, add indexes on at least the firstName and state before running the performance test using the command `npm run perfTestMongo`
