'use strict';
/*
Setup Redis using either Docker Desktop (recommended), Azure Container Instance, or Kubernetes
    as documented in their respective setup folders
*/
const faker = require('faker/locale/en_US');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const redis = require("redis");
const { promisify } = require("util");
const v8 = require('v8');

// Configuration
let batchSize = 5000; // Recommend 500 for remote server
let insertInterval = 1; // Recommend 150-250 for remote server
const numContactsToCreate = 20000000;

// Global variables

const redisClientOptions = {
    host: "127.0.0.1",
    port: 6379
};
let client = redis.createClient(redisClientOptions);
const dbsizeAsync = promisify(client.dbsize).bind(client);
const msetAsync = promisify(client.mset).bind(client);
const setAsync = promisify(client.set).bind(client);

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null

let currentContacts = 0;

let inErrorState = false;
let timeInErrorState = Date.now();

const main = async () => {
    try {
        // Determine how many contacts currently exist
        let count = await dbsizeAsync();
        currentContacts = count;
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
        consoleUpdateTimer = setInterval(updateConsole, 5000);
        throttleIntervalTimer = setInterval(() => {
            let heapSpaceStatistics = v8.getHeapSpaceStatistics()
            let lowHeapSpace = heapSpaceStatistics.some(hss => hss.space_available_size < hss.space_size / 5 && (hss.space_name === 'code_space' || hss.space_name === 'map_space')); // Less than 20% remains
            // If we went this whole time without an error then try going faster
            if (!lowHeapSpace && !inErrorState && Date.now() - timeInErrorState >= insertInterval * 100 && insertInterval > 1) {
                // Speed up inserts by 1%
                insertInterval -= (insertInterval / 100);
                console.log(`Lowering insert interval to ${insertInterval.toFixed(0)} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContacts, insertInterval);
            }
        }, insertInterval * 200);
    } catch (err) {
        if (client) {
            client.quit();
        }
        console.log(err);
    }
}

const close = () => {
    clearInterval(consoleUpdateTimer);
    clearInterval(insertIntervalTimer);
    clearInterval(throttleIntervalTimer);
    client.quit();
    console.log(`Currently inserted contacts = ${currentContacts}`);
}

const insertContacts = () => {
    try {
        if (currentContacts >= numContactsToCreate) {
            close();
            return;
        }
        if (!inErrorState) {
            let msetArray = [];
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
                msetArray.push(uuidv4());
                msetArray.push(JSON.stringify(contact));
            }
            msetAsync(msetArray).then(result => {
                currentContacts += batchSize;
            }).catch(err => {
                setErrorState(err);
            });
        }
    } catch(err) {
        console.log(err);
        close();
    }
}

const setErrorState = (error) => {
    if (error && !inErrorState) {
        inErrorState = true;
        timeInErrorState = Date.now();
        // Do not leave this error state until a delay has passed
        let currentThrottleDelay = insertInterval * 100;
        if (error.code === 50) {
            currentThrottleDelay = insertInterval * 300;
            console.warn(`ExceededTimeLimit. Pausing for ${currentThrottleDelay.toFixed(0)} ms`)
        } else {
            console.error(error);
        }
        setTimeout(() => {
            inErrorState = false;
            timeInErrorState = Date.now();
        }, currentThrottleDelay);
        // Slow down future inserts by 5%
        insertInterval += (insertInterval / 20);
        console.log(`Raising insert interval to ${insertInterval} ms`);
        clearInterval(insertIntervalTimer);
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
    }
}

const updateConsole = () => {
    console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

main();
