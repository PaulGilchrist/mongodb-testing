# Docker Desktop Setup for Persistent Redis on Mac OS

Before running this code, run the [Docker Desktop](https://www.docker.com/products/docker-desktop) command below to install and start Redis (change DB path as needed).

* Make sure to choose a path that exists, or create it before running the Docker command.  The above example is for MacOS, but would not pre-exist for Windows users

```
docker run -d --name redis-cache -p 6379:6379 -v /Users/Shared/redis:/data redis:latest redis-server --save 60 1
```

Use the Docker desktop dashboard to connect to the Redis console and then execute the command `redis-cli` to confirm proper functioning optionally testing the below example commands

```
info
acl whoami
set user1 "{ firstName: 'Paul', lastName: 'Gilchrist' }"
get user1
copy user1 user:1
del user1
exists user1
copy user:1 user:2
expire user:2 30
exists user:2
mset user:2 "Vicky" user:3 "Lauren"
mget user:1 user:2 user:3
keys user:*
dbsize
quit
```

A full list of command can be found [here](https://redis.io/commands)

## Data setup 

You will start the record insert process using the command `node insertRedis`.  It will take a while to insert the 20 million rows, but the program can be stopped and restarted at any time and it will resume where it left off.  You can later check that records are being inserted successfully using Docker dashboard to connect to the console and look at the data using `redis-cli`.

Once all records have been inserted, you can test performance by running the command `node perfTestRedis`

## NodeJS development
For NodeJS development use the npm package named [node-redis](https://github.com/NodeRedis/node-redis?_ga=2.122957515.1761927453.1614360391-756484973.1614360391)
