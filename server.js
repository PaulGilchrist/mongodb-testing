
// https://www.w3schools.com/nodejs/nodejs_mongodb.asp
// docker run -d -p 27017:27017 --name my_database mongo:latest 
// docker rm -f <containerID>
const MongoClient = require('mongodb').MongoClient;

const throwError = (err, client) => {
    client.close();
    throw err;
}

// Create or connect to database
const collectionName = "customers";
const dbName = 'my_database';
let document = { name: "Company Inc", address: "Highway 37" };
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};
const query1 = { address: 'Highway 37' };
const query2 = { address: "Canyon 123" };
const updateValues = { $set: { name: "Mickey", address: "Canyon 123" } };
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

const main = async () => {
    let client = null;
    try {
        // Create or connect to database
        client = await createDatabase(url, mongoClientOptions);
        console.log("Database connected");
        const db = client.db(dbName);
        // Create or connect to collection
        await createCollection(db, collectionName);
        console.log("Collection created");
        // Insert document
        await db.collection(collectionName).insertOne(document);
        console.log("Document inserted");
        console.log(document);
        // Find first document since empty query object is passed
        let result = await db.collection(collectionName).findOne({});
        if (result) {
            console.log(`Document found - findOne - empty query`);
            console.log(result);
        } else {
            console.log(`Document not found - findOne`);
        }
        // Find documents
        // Could optionally sort({ name: 1 }) between find() and toArray()
        // Could optionally limit(5) between find() and toArray()
        // Could also join collections together.  See...https://www.w3schools.com/nodejs/nodejs_mongodb_join.asp
        result = await db.collection(collectionName).find(query1).toArray();
        if (result && result.length > 0) {
            console.log("Document found - find");
            console.log(result);
        } else {
            console.log(`Document not found - find`);
        }
        // Update document
        let response = await db.collection(collectionName).updateOne(query1, updateValues);
        if(response.modifiedCount > 0) {
            console.log("Document updated");
        } else if(response.upsertedCount > 0) {
            console.log(`Document upserted - upsertedId: ${response.upsertedId}`);
        } else {
            console.log(`Document not found - updateOne`);
        }
        // Delete document
        response = await db.collection(collectionName).deleteOne(query2);
        if(response.deletedCount > 0) {
            console.log("Document deleted");
        } else {
            console.log(`Document not found - deleteOne`);
        }
        // Drop collection
        await dropCollection(db, collectionName);
        console.log("Collection dropped");
        client.close();
        console.log("Database closed");
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}
main();
