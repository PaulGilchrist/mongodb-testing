'use strict';
/*
Setup Redis using either Docker Desktop (recommended), Azure Container Instance, or Kubernetes
    as documented in their respective setup folders

    Recommend the RedisInsight client when requiring a GUI
*/
const faker = require('faker/locale/en_US');
const { exit } = require('process');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const redis = require("redis");
const v8 = require('v8');

// Configuration
let batchSize = 2000;
let insertInterval = 500;
const numContactsToCreate = 20000000;
const consoleUpdateRate = Math.max(insertInterval * 2, 1000); // Must be larger than insertInterval

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

client.on("error", (err) => {
    console.log('Main error handler');
    console.log(JSON.stringify(err));
    if(err.code==='ECONNREFUSED' || err.code==='ECONNRESET') {
        process.exit(err.errno);
    }
});

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let previousInsertRate = 0;
let previousContacts = 0;
let currentContacts = 0;
let rateCounter = 0; // Count up each time inserts increase, and down each time inserts decrease
const rateLimit = 5;

const main = async () => {
    // Determine how many contacts currently exist
    client.dbsize((err, count) => {
        if (err) {
            console.log('DBSIZE error handler');
            console.log(err);
            process.exit(err.errno);
        }
        currentContacts = previousContacts = count;
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
        consoleUpdateTimer = setInterval(updateConsole, consoleUpdateRate);
    });
}

const close = () => {
    clearInterval(consoleUpdateTimer);
    clearInterval(insertIntervalTimer);
    client.quit();
    console.log(`Currently inserted contacts = ${currentContacts}`);
}

const insertContacts = () => {
    if (currentContacts >= numContactsToCreate) {
        close();
        return;
    }
    let batch = client.batch();
    for (let i = 0; i < batchSize; i++) {
        const firstName = faker.name.firstName().replace(/[^a-zA-Z ]/g, '');
        const lastName = faker.name.lastName().replace(/[^a-zA-Z ]/g, '');
        const contact = {
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`,
            addresses: [
                {
                    street: faker.address.streetAddress().replace(/[^0-9a-zA-Z ]/g, ''),
                    city: faker.address.city().replace(/[^a-zA-Z ]/g, ''),
                    state: faker.address.stateAbbr(),
                    zip: faker.address.zipCode()
                }
            ],
            emails: [
                {
                    email: faker.internet.email(firstName, lastName).replace(/[^a-zA-Z@\. ]/g, '')
                }
            ],
            phones: [
                {
                    phoneNumber: faker.phone.phoneNumber()
                }
            ]
        }
        batch.set(uuidv4(), JSON.stringify(contact));
    }
    batch.exec((err, replies) => {
        if (err) {
            console.log('BATCH SET error handler');
            console.log(err);
        } else {
            currentContacts += batchSize;
        }
    });
}

const updateConsole = () => {
    let insertRate = (currentContacts - previousContacts) * 1000 / consoleUpdateRate; // per second
    // Track how many times in a row we are increasing or decreasing rate
    if(insertRate >= previousInsertRate && rateCounter < rateLimit) {
        rateCounter++;
    } else if(insertRate < previousInsertRate && rateCounter > -rateLimit) {
        rateCounter--;
    }
    if(rateCounter === rateLimit) {
        // Speed up since we have climbed consistently over the last rateLimit checks
        batchSize = Math.round(batchSize * 1.01);
        rateCounter=0; // Reset so we can see if this new change kaes a difference
    } else if (rateCounter === -rateLimit) {
        // Slow down since we have fallen consistently over the last rateLimit checks
        batchSize = Math.round(batchSize / 1.01);
        rateCounter=0; // Reset so we can see if this new change kaes a difference
    }
    previousContacts = currentContacts;
    previousInsertRate = insertRate;
    console.log(`${currentContacts}/${numContactsToCreate} - ${insertRate.toFixed()} per sec`);
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

main();
