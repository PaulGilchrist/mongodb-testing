'use strict';
/*
Setup Redis using either Docker Desktop (recommended), Azure Container Instance, or Kubernetes
    as documented in their respective setup folders

    Recommend the RedisInsight client when requiring a GUI to identify 2 keys, then insert them on line 39 below
*/
const chalk = require('chalk');
const faker = require('faker/locale/en_US');
const { exit } = require('process');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const { promisify } = require("util");
const redis = require("redis");
const util = require('util');
const v8 = require('v8');

// Global variables
const redisHost = args['redisHost'] || process.env.redisHost || 'localhost';
const redisKey = args['redisKey'] || process.env.redisKey || null;
const redisPort = args['redisPort'] || process.env.redisPort || 6379
let client = null
if(redisKey) {
    client = redis.createClient(redisPort, redisHost, {auth_pass: redisKey, tls: {servername: redisHost}});
} else {
     client = redis.createClient(redisPort, redisHost);
}
const getAsync = promisify(client.get).bind(client);
client.on("error", (err) => {
    console.log('Main error handler');
    console.log(JSON.stringify(err));
    if(err.code==='ECONNREFUSED' || err.code==='ECONNRESET') {
        process.exit(err.errno);
    }
});

const main = async () => {
    // Determine how many contacts currently exist
    let startTime = new Date();
    let contacts = [await getAsync('57b7eabb-85d2-4dfb-9519-93191e2e758e'), await getAsync('e0e7cae4-5248-468f-84db-3192c7c29971')];
    let endTime = new Date();
    let elapsedTime = endTime - startTime;
    console.log(chalk.cyan(`Search for 2 specific contacts by their key`));
    console.log(util.inspect(contacts, false, null, true /* enable colors */));
    console.log(chalk.cyan(`Elapsed time = ${elapsedTime} ms`));
    client.quit();
}

main();
