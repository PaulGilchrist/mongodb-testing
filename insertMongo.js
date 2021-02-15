'use strict';
/*
Setup MongoDB using either Docker Desktop (recommended), Azure Container Instance, or Kubernetes
    as documented in their respective setup folders
*/
const faker = require('faker/locale/en_US');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const mongoClient = require('mongodb').MongoClient;
const v8 = require('v8');

// Configuration
const environment = 'cosmosDbProvisioned'// mongoDb, cosmosDbProvisioned, or cosmosDbServerless
let batchSize = 500;
let insertInterval = 250; 
const numContactsToCreate = 20000000;

// Global variables
let client = null;
const collectionName = 'contacts';
let db = null;
const dbName = 'mongotest';
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

let connectionString = null;
switch (environment) {
    case 'cosmosDbProvisioned':
        connectionString = args['cosmosDbProvisionedConnectionString'] || process.env.cosmosDbProvisionedConnectionString;
        break;
    case 'cosmosDbServerless':
        connectionString = args['cosmosDbServerlessConnectionString'] || process.env.cosmosDbServerlessConnectionString;
        break;
    default:
        connectionString = args['mongoDbConnectionString'] || process.env.mongoDbConnectionString || 'mongodb://localhost:27017/';
}

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null

let currentContacts = 0;

let inErrorState = false;
let timeInErrorState = Date.now();

const main = async () => {
    try {
        client = await mongoClient.connect(connectionString, mongoClientOptions);
        db = client.db(dbName);
        // Determine how many contacts currently exist
        let count = await db.collection(collectionName).countDocuments({});
        currentContacts = count;
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
        consoleUpdateTimer = setInterval(updateConsole, 5000);
        throttleIntervalTimer = setInterval(() => {
            let heapSpaceStatistics = v8.getHeapSpaceStatistics()
            let lowHeapSpace = heapSpaceStatistics.some(hss => hss.space_available_size < hss.space_size / 5 && (hss.space_name === 'code_space' || hss.space_name === 'map_space')); // Less than 20% remains
            // If we went this whole time without an error then try going faster
            if(!lowHeapSpace && !inErrorState && Date.now() - timeInErrorState >= insertInterval * 100) {
                // Speed up inserts by 1%
                insertInterval -= (insertInterval/100);
                console.log(`Lowering insert interval to ${insertInterval.toFixed(0)} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContacts, insertInterval);
            }
        }, insertInterval * 200);
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}

const close = () => {
    clearInterval(consoleUpdateTimer);
    clearInterval(insertIntervalTimer);
    clearInterval(throttleIntervalTimer);
    client.close();
    console.log(`Currently inserted contacts = ${currentContacts}`);    
}

const insertContacts = () => {
    try {
        if(currentContacts>=numContactsToCreate) {
            close();
            return;
        }
        if(!inErrorState) {
            let contacts = [];
            for(let i = 0; i < batchSize; i++) {
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
                contacts.push(contact);
            }
            db.collection(collectionName).insertMany(contacts).then(result => {
                currentContacts += batchSize;
            }).catch(err => {
                setErrorState(err);
            });
        }        
    } catch {
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
        if(error.code === 50) {
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
        insertInterval += (insertInterval/20);
        console.log(`Raising insert interval to ${insertInterval} ms`);
        clearInterval(insertIntervalTimer);
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
    }
}

const updateConsole = () => {
    console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
}

main();
