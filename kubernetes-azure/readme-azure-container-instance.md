# Setup Instructions for Azure Container Instance

Adapt the below workign example with your own region, subscription, resource group, storage account and file share, and container names.  Also, adjust the cpu and memory settings as needed.

```
az account set --subscription 'Azure Testing'

az storage account create --name acistorage3191 --resource-group ApiDev --location "westus" --sku Standard_LRS

az storage share create --name mongodata --account-name acistorage3191 --account-key "c+AjeswgqzgybtNwY8bQ9v3KeMtAthsup6zR56ACDE8MPcs8wrnsYkHLqcQwg4XVyxlpLGl/iZaKeN5M5w8TAw=="

az container create --resource-group <your azure resource group> --name acimongotest --image mongo:latest --azure-file-volume-account-name acistorage3191 --azure-file-volume-account-key "<your azure storage key here>" --azure-file-volume-share-name mongodata --azure-file-volume-mount-path "/data/mongoaz" --ports 27017 --cpu 2 --ip-address public --memory 8 --os-type Linux --protocol TCP --dns-name-label acimongotest --restart-policy OnFailure --command-line "mongod --dbpath=/data/mongoaz --bind_ip_all"
```

Reference: [An adventure in containers and command-line tools: Running MongoDB in Azure](https://jussiroine.com/2019/02/an-adventure-in-containers-and-command-line-tools-running-mongodb-in-azure/)

## Production Additions

* Setup Azure Backup for the Azure Storage File Share
* Connect to the container's console and create a new admin account and password (see above link)
* Possibly limit container to private IP address only 