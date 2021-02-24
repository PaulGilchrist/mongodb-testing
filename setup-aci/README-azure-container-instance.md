# Setup Instructions for Azure Container Instance

Adapt the below working example with your own region, subscription, resource group, storage account and file share, and container names.  Also, adjust the cpu and memory settings as needed.

1) Create an Azure Resource Group in the Azure region you would like the primary MongoDB replica to live.  Include the name on the Azure region at the end of the resource group name (Ex: MongoTesting-WestUS).  Whatever name is chosen should be repeated across the other regions with the only change being the region name.

2) Create an Azure Storage Account with soft delete for file shares enabled, and point-in-time restore for containers.  Include the name on the Azure region at the end of the resource group name (Ex: acistoragewestus).  Whatever name is chosen should be repeated across the other regions with the only change being the region name.

3) Create a file share named "mongodata"

4) Create a file named `keyfile` using the following commands, then upload it into the Azure File Shares for each container.  Recommend using `Microsoft Azure Storage Explorer` rather than the Azure portal.

```
openssl rand -base64 756 > <path-to-keyfile>
```

5) Create a file named `start-mongo.sh` that contains the following commands, then upload it into the Azure File Shares for each container.  Recommend using `Microsoft Azure Storage Explorer` rather than the Azure portal.  The reason this file is needed is because Azure File Share does not properly apply the `chmod` command on the keyfile, and mongodb requires this file to be more secure than it can be when on Azure File Share.  To solve this, at each container startup, we copy the file into the container and then execute the `chmod` before starting `mongod`

```
#!/bin/bash

cp /data/mongoaz/keyfile /data/keyfile
chmod 400 /data/keyfile
mongod --dbpath=/data/mongoaz --bind_ip_all --auth --keyFile /data/mongoaz/keyfile

```

6) Create the Azure Container Instance using the Azure storage account's name, access key, and file share name.  The setting of a default subscription is only needed if multiple subscriptions exist with the same resource group name.

```
az account set --subscription '<your subscription name here>'
az container create --resource-group ApiDev-East --name acimongotest --image mongo:latest --azure-file-volume-account-name acistoragewest --azure-file-volume-account-key "<your azure storage account key here>" --azure-file-volume-share-name mongodata --azure-file-volume-mount-path "/data/mongoaz" --ports 27017 --cpu 2 --ip-address public --memory 8 --os-type Linux --protocol TCP --dns-name-label acimongotest --restart-policy OnFailure --command-line "/data/mongoaz/start-mongo.sh"
```

7) For setting up a replica set, repeat these same steps in 2 other Azure regions, keeping all the names matching other than adding the region name to the end.

8) Setup authentication by connecting to each container through the Azure portal, and setting up the desired user accounts.  At this same time, we will also set the appropriate permissions on the keyfile we created earlier.  WARNING:  Running the below `chmod` command on an Azure File Share file will net a different result than on Linux, causing mongod to consider the file not secure enough.

```
mongo
use admin
db.createUser({
    user: "admin",
    pwd: "password",
    roles: [
        { role: "userAdminAnyDatabase", db: "admin" },
        { role: "readWriteAnyDatabase", db: "admin" },
        { role: "dbAdminAnyDatabase", db: "admin" },
        { role: "clusterAdmin", db: "admin" }
    ],
    mechanisms:[ "SCRAM-SHA-1" ]
})
exit
exit
```

9) Test remote connectivity to each container separately using MongoDB Compass

```
mongodb://admin:password@acimongotest.westus.azurecontainer.io:27017
mongodb://admin:password@acimongotest.eastus.azurecontainer.io:27017
mongodb://admin:password@acimongotest.southcentralus.azurecontainer.io:27017

```

10) Edit the file named `start-mongo.sh` adding `--replSet rs0` to the end of the `mongodb` arguments, then upload it into the Azure File Shares for each container.  The full file contents are shown below

```
#!/bin/bash

cp /data/mongoaz/keyfile /data/keyfile
chmod 400 /data/keyfile
mongod --dbpath=/data/mongoaz --bind_ip_all --auth --keyFile /data/mongoaz/keyfile --replSet rs0

```

11) From the Azure Portal, restart all 3 containers so that they will read the replSet change.

* External connectivity will not work at this point until after the replication set configuration is complete

12) Use the Azure portal to re-connect to the container you would like to be the `primary` and initiate the replSet

```
mongo
use admin
db.auth('admin','password')
rs.initiate(
  {
    _id : "rs0",
    members: [
      { _id: 0, host: "acimongotest.westus.azurecontainer.io:27017", priority: 3 },
      { _id: 1, host: "acimongotest.eastus.azurecontainer.io:27017", priority: 2 },
      { _id: 2, host: "acimongotest.southcentralus.azurecontainer.io:27017", priority: 1 }
    ]
  }
)
exit
exit
```

* You can then view the configuration using `rs.conf()`, `rs.status()`, and rs.isMaster()

13) You can now connect to the full replica set using the following connection string

```
mongodb://admin:password@acimongotest.westus.azurecontainer.io:27017,acimongotest.eastus.azurecontainer.io:27017,acimongotest.southcentralus.azurecontainer.io:27017/?authSource=admin&replicaSet=rs0&readPreference=nearest
```

## Appendix

### Optional Cleanup

```
az container delete --resource-group ApiDev-West --name acimongotest
az container delete --resource-group ApiDev-East --name acimongotest
az container delete --resource-group ApiDev-SouthCentral --name acimongotest

```

## Production Additions

* Setup Azure Backup for the Azure Storage File Share
* Possibly limit container to private IP address only 
