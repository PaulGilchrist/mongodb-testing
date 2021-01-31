
// Before running this code, run the docker command below to install and start mongodb (change DB path if needed)
// docker run -d -p 27017:27017 -v ~/Temp/mongo-testing/db:/data/db --name mongo-testing-db mongo:latest

const chalk = require('chalk');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const util = require('util');

// Global variables
const collectionName = 'nestedDocument';
const documentsFileName = './data/nestedDocument.json';
const dbName = 'nestedDocument';
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};
const url = 'mongodb://localhost:27017/'; // default mongo port

const createDatabase = async (url, mongoClientOptions) => {
    return MongoClient.connect(url, mongoClientOptions);
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

const throwError = (err, client) => {
    client.close();
    throw err;
}

const main = async () => {
    let client = null;
    try {
        // Create or connect to database
        client = await createDatabase(url, mongoClientOptions);
        console.log(chalk.cyan("Database connected"));
        const db = client.db(dbName);
        // Create or connect to collection
        await createCollection(db, collectionName);
        console.log(chalk.cyan("Collection created"));
        // Insert document
        const documentsJson = fs.readFileSync(documentsFileName);
        const documents = JSON.parse(documentsJson);
        await db.collection(collectionName).insertMany(documents);
        console.log(chalk.cyan("Documents inserted - Below is the full document"));
        console.log(util.inspect(documents, false, null, true /* enable colors */));
        // Find documents
        // Could optionally sort({ name: 1 }) between find() and toArray()
        // Could optionally limit(5) between find() and toArray()
        // Could also join collections together.  See...https://www.w3schools.com/nodejs/nodejs_mongodb_join.asp
        let query = {'countries.states.cities.name':'Detroit'};
        result = await db.collection(collectionName).find(query).toArray();
        if (result && result.length > 0) {
            console.log(chalk.cyan("Documents with city named Detroit listed below (excludes South America)"));
            console.log(util.inspect(result, false, null, true /* enable colors */));
        } else {
            console.error(`Document not found - find`);
        }
        // Project (select) only the city names
        const projection = {'countries.states.cities.name': 1}
        result = await db.collection(collectionName).find({}).project(projection).toArray();
        if (result && result.length > 0) {
            console.log(chalk.cyan("Projecting only the city names"));
            console.log(util.inspect(result, false, null, true /* enable colors */));
        } else {
            console.error(`Document not found - find`);
        }
        // Push (insert) a new nested document to an existing parent array
        let updateValues = { $push: { 'countries.$[country].states.$[state].cities': {'name': 'Tucson'} } };
        let arrayFilters = { 
            arrayFilters: [
                { 'country.name': 'United States' },
                { 'state.name': 'Arizona' },
            ]
        };
        let response = await db.collection(collectionName).updateMany({'countries.name':'United States', 'countries.states.name': 'Arizona'}, updateValues, arrayFilters);
        if(response.modifiedCount > 0) {
            console.log(chalk.cyan("New city Tucson added to state Arizona"));
            result = await db.collection(collectionName).find({'countries.states.cities.name': 'Tucson'}).toArray();
            if (result && result.length > 0) {
                console.log(util.inspect(result, false, null, true /* enable colors */));
            }
        } else if(response.upsertedCount > 0) {
            console.log(chalk.cyan(`Document upserted - upsertedId: ${response.upsertedId}`));
        } else {
            console.error(`Document not found - updateMany`);
        }
        // Pull (delete) a nested document from a parent array without removing the parent or the array
        updateValues = { $pull: { 'countries.$[country].states.$[state].cities': { name: 'Tucson' } } };
        arrayFilters = { 
            arrayFilters: [
                { 'country.name': 'United States' },
                { 'state.name': 'Arizona' }
            ]
        };
        response = await db.collection(collectionName).updateMany({'countries.states.cities.name': 'Tucson'}, updateValues, arrayFilters);
        if(response.modifiedCount > 0) {
            console.log(chalk.cyan("Tucson removed from state Arizona"));
            result = await db.collection(collectionName).find({'countries.states.name': 'Arizona'}).toArray();
            if (result && result.length > 0) {
                console.log(util.inspect(result, false, null, true /* enable colors */));
            }
        } else {
            console.error(`Document not found - Delete nested document`);
        }
        // Update a nested document
        updateValues = { $set: { 'countries.$[country].states.$[state].cities.$[city].newProperty': 'Some all new property added to exsiting nested document' } };
        arrayFilters = { 
            arrayFilters: [
                { 'country.states': { $exists: true } },
                { 'state.cities': { $exists: true } },
                { 'city.name': 'Detroit' }
            ]
        };
        response = await db.collection(collectionName).updateMany({'countries.states.cities.name':'Detroit'}, updateValues, arrayFilters);
        if(response.modifiedCount > 0) {
            console.log(chalk.cyan("Documents with city named Detroit updated to add a new property on city"));
        } else if(response.upsertedCount > 0) {
            console.log(chalk.cyan(`Document upserted - upsertedId: ${response.upsertedId}`));
        } else {
            console.error(`Document not found - updateMany`);
        }
        result = await db.collection(collectionName).find({'countries.states.cities.name': 'Detroit'}).toArray();
        console.log(util.inspect(result, false, null, true /* enable colors */));
        // Delete document
        response = await db.collection(collectionName).deleteMany({'countries.states.cities.name':'Detroit'});
        if(response.deletedCount > 0) {
            console.log(chalk.cyan("Documents with city named Detroit have been deleted - Below is what remains"));
            result = await db.collection(collectionName).find({}).toArray();
            if (result && result.length > 0) {
                console.log(util.inspect(result, false, null, true /* enable colors */));
            }
        } else {
            console.error(`Document not found - deleteOne`);
        }
        // Drop collection
        await dropCollection(db, collectionName);
        console.log(chalk.cyan("Collection dropped"));
        client.close();
        console.log(chalk.cyan("Database closed"));
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}
main();
