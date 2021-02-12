'use strict';
// Before running this code, run insertMongo.js (and follow its setup steps)

const chalk = require('chalk');
const fs = require('fs');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const mongoClient = require('mongodb').MongoClient;
const util = require('util');

// Global variables
let client = null;
const collectionName = 'contacts';
let db = null;
const dbName = 'mongotest';
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};
const connectionString = args['mongoDbConnectionString'] || process.env.mongoDbConnectionString || 'mongodb://localhost:27017/'; // default mongo port

const main = async () => {
    try {
        await initDatabase();
        // Find first 10 contacts both with a firstName and living in a given state (parent and child object)
        let startTime = new Date();
        let query = {'firstName':'Paul', 'addresses.state':'MI'};
        let contacts = await db.collection(collectionName).find(query).limit(2).toArray();
        let endTime = new Date();
        let elapsedTime = endTime - startTime;
        if (contacts && contacts.length > 0) {
            console.log(chalk.cyan(`Documents where first name is 'Paul' and they live in Michigan. Limited to 2 results`));
            console.log(util.inspect(contacts, false, null, true /* enable colors */));
            console.log(chalk.cyan(`Elapsed time = ${elapsedTime} ms`));
        } else {
            console.error(`Document not found - find`);
        }
        client.close();
        console.log(chalk.cyan("Database closed"));
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
    client.close();
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

const dropCollection = async (db, collectionName) => {
    let dropSuccess = false;
    try {
        dropSuccess = await db.collection(collectionName).drop();
    } catch (err) {
        if (err && err.codeName != 'NamespaceNotFound') {
            throw err;
        } else {
            dropSuccess = true;
        }
    }
    return dropSuccess;
}

const initDatabase = async () => {
    try {
        // Create or connect to database
        client = await mongoClient.connect(connectionString, mongoClientOptions);
        db = client.db(dbName);
        // Create or connect to collection
        await createCollection(db, collectionName);
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}

const throwError = (err, client) => {
    client.close();
    throw err;
}

main();
