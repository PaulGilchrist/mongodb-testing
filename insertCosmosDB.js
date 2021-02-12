'use strict';

/*
Before running this code, make sure to setup an Azure CosmosDB environment with Mongo support, and add its connection string to nodemon.json
*/

const faker = require('faker/locale/en_US');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const mongoClient = require('mongodb').MongoClient;

// Global variables
let client = null;
const collectionName = 'contacts';
let db = null;
const dbName = 'mongotest';
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};
const connectionString = args['cosmosDbServerlessConnectionString'] || process.env.cosmosDbServerlessConnectionString;
/*
    MS SQL serverless with max 8 vCPU can handle batchSize=200 with insertInterval=250 (averaged 1760 records per second)
    Cosmos DB serverless can handle batchSize=250 with insertInterval=250 (averaged 3520 records per second)
    Cosmos DB Max 10k RU/s can handle batchSize=500 with insertInterval=50 (averaged 7200 records per second)
    Mongo DB local can handle batchSize=1000 with insertInterval=1 (averaged 44,444 records per second)
*/
let batchSize = 250;
let consoleUpdateDelay = 5000;
let errorThrottleDelay = 30000;
let throttleAdaptationDelay = 60000

let insertInterval = 250;
let maxInsertInterval = 250;
let minInsertInterval = 150;

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null

let currentContacts = 0;
const numContactsToCreate = 20000000; // Default 20 million

let inErrorState = false;
let timeInErrorState = Date.now();

const main = async () => {
    try {
        client = await mongoClient.connect(connectionString, mongoClientOptions);
        db = client.db(dbName);
        await db.createCollection(collectionName);
        // Determine how many contacts currently exist
        let count = await db.collection(collectionName).find({}).count();
        currentContacts = count;
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
        consoleUpdateTimer = setInterval(updateConsole, consoleUpdateDelay);
        throttleIntervalTimer = setInterval(() => {
            // If we went this whole time without an error then try going faster
            if (!inErrorState && Date.now() - timeInErrorState >= errorThrottleDelay * 10 && insertInterval > minInsertInterval) {
                insertInterval--;
                console.log(`Lowering insert interval to ${insertInterval} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContacts, insertInterval);
            }
        }, throttleAdaptationDelay);
    } catch (err) {
        if (client) {
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
        if (currentContacts >= numContactsToCreate) {
            close();
            return;
        }
        if (!inErrorState) {
            let contacts = [];
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
                contacts.push(contact);
            }
            db.collection(collectionName).insertMany(contacts).then(result => {
                currentContacts += batchSize;
            }).catch(err => {
                setErrorState(true);
            });
        }
    } catch {
        console.log(err);
        close();
    }
}

const setErrorState = (state) => {
    if (state != inErrorState) {
        inErrorState = state;
        timeInErrorState = Date.now();
        if (inErrorState) {
            // We have an error so slow down
            if (insertInterval < maxInsertInterval) {
                insertInterval += 5;
                console.log(`Raising insert interval to ${insertInterval} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContacts, insertInterval);
            }
            setTimeout(() => {
                setErrorState(false);
            }, errorThrottleDelay);
        }
    }
}

const updateConsole = () => {
    console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
}

main();
