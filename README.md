# mongodb-testing
Used to learn MongoDB capabilities and differences from relational databases.  Also used to do performance comparisons between Microsoft SQL server and MongoDB.

## Example Files
`exampleCrossCollection.js` shows how to join multiple MongoDB collections together in queries similar to how SQL would.

`exampleNestedDocument.js` shows how to perform CRUD operations within a single document with multiple layers deep of nested documents.

To leverage the best perforance from MongoDB, a well thought out prodcution level data model would fall somewhere between these two extremes. 

## Performance Testing
### Goal
Compare MSSQL against document database inserting 20 million contacts, (80 million objects), and determine which DB model perform best.

#### Results
* Azure SQL Database (8 vCPU) 
  * Insert = 1750 records per sec
  * Read = 4900 ms
  * Cost = $220-$780 per month (lower requires existing license and 3yr reservation)
  * `Twice the size and cost of Mongo DB yet still 10-54x slower`
* Cosmos DB (serverless)
  * Insert = 3520 records per second (`2x improvement`)
  * Read = 1200 ms (`4x improvement`)
* Cosmos DB (10k RU/s max)
  * Insert = 7200 records per second (`4x improvement`)
  * Cost = $584 per month
* Mongo DB (2 vCPU 8GB Azure Container Instance)
  * Insert = 17,800 records per sec (`10x improvement`)
  * Read = 90 ms (`54x improvement`)
  * Cost = $132 per month (`half cost vs SQL`)

#### Notes
* *Cosmos DB indexes every property during inserts, where MongoDB and SQL both setup their indexes only after all the inserts were completed.  This makes this performance much better than what it initially looks like
* `Cosmos DB only supports up to version 3.6 of MongoDB which does not support multi-document and distributed transactions.`  This feature is currently in development as of February 2021.
