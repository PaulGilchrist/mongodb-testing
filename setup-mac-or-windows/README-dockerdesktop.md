# Docker Desktop Setup for Persistent MongoDB on Mac OS

Before running this code, run the [Docker Desktop](https://www.docker.com/products/docker-desktop) command below to install and start mongodb (change DB path as needed).

* Make sure to choose a path that exists, or create it before running the Docker command.  The above example is for MacOS, but would not pre-exist for Windows users

```
docker run -d --name mongodb -p 27017:27017 -v /Users/Shared/mongodb:/data/db mongo:latest
```

You may want to download the [MongoDB Compass](https://www.mongodb.com/try/download/compass) applications connecting using the string [mongodb://localhost:27017/](mongodb://localhost:27017/).

You will start the record insert process using the command `node insertMongo`.  It will take quite a while to insert the 20 million rows, but the program can be stopped and restarted at any time and it will resume where it left off.  You can later check that records are being inserted successfully using [MongoDB Compass](https://www.mongodb.com/try/download/compass).

Once all records have been inserted, using MongoDB Compass, add indexes on at least the firstName and state before running the performance test using the command `node perfTestMongo`

