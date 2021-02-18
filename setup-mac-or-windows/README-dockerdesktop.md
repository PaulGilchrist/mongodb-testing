# Docker Desktop Setup

Before running this code, run the [Docker Desktop](https://www.docker.com/products/docker-desktop) command below to install and start mongodb (change DB path, username, and password as needed).

* Make sure to choose a path that exists, or create it before running the Docker command.  The above example is for MacOS, but would not pre-exist for Windows users

```
docker run -d --name mongodb -p 27017:27017 -v /Users/Shared/mongodb:/data/db -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest --replSet rs0
```

Username and password will only be writting into a newly created persisted storage location, and will be ignored if an "admin" database pre-existed. 

Next, connect to your running container through the Docker dashboard and run the `mongo` shell, and initiate the new Replica Set using command `rs.initiate()` or remove the section of this code that demonstrates a transaction.  Transactions require a replica set, even if it is a set with only 1 node.

You may also want to download the [MongoDB Compass](https://www.mongodb.com/try/download/compass) applications connecting using the string [mongodb://localhost:27017/](mongodb://localhost:27017/).

If building a multi-node replica set (see [Creating a MongoDB replica set using Docker](https://www.sohamkamani.com/blog/2016/06/30/docker-mongo-replica-set/))

```
docker network create mongodb-cluster

docker run -d --name mongodb0 -p 27017:27017 --net mongodb-cluster -v /Users/Shared/mongodb0:/data/db -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest --replSet rs0

docker run -d --name mongodb1 -p 27018:27017 --net mongodb-cluster -v /Users/Shared/mongodb1:/data/db -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest --replSet rs0

docker run -d --name mongodb2 -p 27019:27017 --net mongodb-cluster -v /Users/Shared/mongodb2:/data/db -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest --replSet rs0
```

Run the following command from the terminal on mongodb0 to setup replica set members for any given database

```
rs.initiate( {
   _id : "rs0",
   members: [
      { _id: 0, host: "mongodb0:27017" },
      { _id: 1, host: "mongodb1:27017" },
      { _id: 2, host: "mongodb2:27017" }
   ]
})
```

You can then view the configuration using `rs.conf()` and `rs.status()`

* Better would be to use Kubernetes or docker-compose

Follow by adding to or creating a `nodemon.json` file with the below environment variables:

```json
{
    "env": {
        "mongoDbConnectionString": "admin:password@mongodb://localhost:27017/?authSource=admin&replicaSet=rs0",
    }
}
```

Or if connecting to a full replica set

```json
{
    "env": {
        "mongoDbConnectionString": "admin:password@mongodb://localhost:27017,localhost:27018,localhost:27019/?authSource=admin&replicaSet=rs0",
    }
}
```

* If also testing against Azure Cosmos DB, add the environment variables `cosmosDbProvisionedConnectionString` and/or `cosmosDbServerlessConnectionString` based on which one you will be testing.

You will start the record insert process using the command `npm run insertMongo`.  It will take quite a while to insert the 20 million rows, but the program can be stopped and restarted at any time and it will resume where it left off.  You can later check that records are being inserted successfully using [MongoDB Compass](https://www.mongodb.com/try/download/compass).

Once all records have been inserted, using MongoDB Compass, add indexes on at least the firstName and state before running the performance test using the command `npm run perfTestMongo`
