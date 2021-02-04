'use strict';

/*
// Before running this code, run the docker command below to install and start mongodb (change DB path if needed)
// docker run -d -p 27017:27017 -v ~/Temp/mongo-testing/db:/data/db --name mongo-testing-db mongo:latest
*/

const chalk = require('chalk'); // Add color to the console
const faker = require('faker/locale/en_US');
const mongoClient = require('mongodb').MongoClient;
const util = require('util');

// Global variables
const collectionName = 'contacts';
let db = null;
const dbName = 'mongotest';
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};
const url = 'mongodb://localhost:27017/'; // default mongo port

let batchSize = 1000; // Mongo could handle > 1000 where SQL could not go over 200
let consoleUpdateDelay = 1000;
let errorThrottleDelay = 30000; // Mongo never needed to throttle, where SQL would throttle constantly
let throttleAdaptationDelay = 60000

let insertInterval = 1; 
let maxInsertInterval = 20; // Mongo never needed more than 1, where SQL would go all the way to 250
let minInsertInterval = 1; // Mongo never needs to slowdown, where SQL min was 20

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null

let currentContacts = 0;
const numContactsToCreate = 20000000; // Default 20 million

let inErrorState = false;
let timeInErrorState = Date.now();

const main = async () => {
    let client = null;
    try {
        client = await createDatabase(url, mongoClientOptions);
        db = client.db(dbName);
        await createCollection(db, collectionName);
        // Determine how many contacts currently exist
        let count = await db.collection(collectionName).countDocuments({});
        currentContacts = count;
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
        consoleUpdateTimer = setInterval(updateConsole, consoleUpdateDelay);
        throttleIntervalTimer = setInterval(() => {
            // If we went this whole time without an error then try going faster
            if(!inErrorState && Date.now() - timeInErrorState >= errorThrottleDelay*10 && insertInterval>minInsertInterval) {
                insertInterval--;
                console.log(`Lowering insert interval to ${insertInterval} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContact, insertInterval);
            }
        }, throttleAdaptationDelay);
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}

const createCollection = async (db, collectionName) => {
    let response = {};
    try {
        response = await db.createCollection(collectionName);
    } catch (err) {
        if (err && err.codeName != 'NamespaceExists') {
            throw err;
        }
    }
    return response;
}

const createDatabase = async (url, mongoClientOptions) => {
    return mongoClient.connect(url, mongoClientOptions);
}

const insertContacts = () => {
    if(currentContacts>=numContactsToCreate) {
        clearInterval(consoleUpdateTimer);
        clearInterval(insertIntervalTimer);
        clearInterval(throttleIntervalTimer);
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
                        street: faker.address.streetAddress().replace(/[^a-zA-Z ]/g, ''),
                        city: faker.address.city().replace(/[^a-zA-Z ]/g, ''),
                        state: faker.address.stateAbbr(),
                        zip: faker.address.zipCode()
                    }
                ],
                emails: [
                    {
                        email: faker.internet.email(firstName, lastName).replace(/[^a-zA-Z ]/g, '')
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
}

const setErrorState = (state) => {
    if(state!=inErrorState) {
        inErrorState = state;
        timeInErrorState = Date.now();
        if(inErrorState) {
            // We have an error so slow down
            if(insertInterval<maxInsertInterval) {
                insertInterval += 5;
                console.log(`Raising insert interval to ${insertInterval} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContact, insertInterval);
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
