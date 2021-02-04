# mongodb-testing
Used to learn MongoDB capabilities and differences from relational databases.  Also used to do performance comparisons between Microsoft SQL server and MongoDB.

## Example Files
`exampleCrossCollection.js` shows how to join multiple MOngoDB collections together in queries similar to how SQL would.

`exampleNestedDocument.js` shows how to perform CRUD operations within a single document with multiple layers deep of nested documents.

To leverage the best perforance from MongoDB, a well thought out prodcution level data model would fall somewhere between these two extremes. 

## Performance Testing
`insertMongo.js` and `insertSqljs` are used for populating matching sized databases for performance comparisons.  Make sure to read the comments at the top of each of these files for initial database and DB engine setup.

