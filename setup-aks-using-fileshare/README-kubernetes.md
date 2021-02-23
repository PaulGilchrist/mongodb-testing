# Kubernetes Setup

Based off - [Standalone Mongodb on Kubernetes Cluster](https://medium.com/@dilipkumar/standalone-mongodb-on-kubernetes-cluster-19e7b5896b27), but adapted for docker desktop on Mac

### Azure Kubernetes Services Setup

* Basics
  * Choosing the Node size (VM) is very critical, as you can add more nodes later, but you cannot change their size.  This only applies to the primary node pool, as new pools can be added at a later time.  For production, D8as_v4 or larger is recommended. 
* Node Pools
  * Do `NOT` select "Enable virtual nodes"
* Authentication
  * Keep the defaults of "System-assigned managed identity", RBAC enabled, and AKS-managed Azure Active Directory disabled
* Networking
  * Keep network configuration to `Kubenet`
  * Enable "Enable HTTP application routing"
  * Keep the rest of this section at the defaults
* Integrations
  * Connect to Azure Container Registry if one is already setup
  * Connect to an existing or create a new Log Analytics Workspace
* Create or use existing Azure File Share located within the resource group created by AKS
  * Add the storage account name to `storageclass.yaml` 
* Create an Azure Public IP address (standard) in the resource group created when the AKS cluster was created.
  * Add the IP address to `service.yaml`
  * Add the resource group name to the annotation in `service.yaml`
* Open the AKS cluster in the portal, and choose to `connect` following the instructions t get credentials
  * Run the command `kubectl get nodes` and add the node names to the nodeSelectorTerms in `statefulsets.yaml`
  * Upload the files in this folder to the Azure CLI


### Apply these templates as below

```
kubectl apply -f storageclass.yaml
kubectl apply -f persistent-volume-claim.yaml
kubectl apply -f statefulsets.yaml
kubectl apply -f service.yaml
```

### Optional troubleshooting commands

```
kubectl get pod mongodb-0
kubectl describe pods
kubectl describe pod mongodb-0
kubectl get services
kubectl describe service azure-load-balancer
```

Since Azure file share does not allow mounting to `/data/db` since there are already files there, there are some extra steps to perform.  In summary, we will need to manually add user credentials before we can remotly connect.

### Connect to the container's console and setup admin and other user accounts
```
kubectl exec -it mongodb-0 sh
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

### Test from MongoDB Compass
```
mongodb://admin:password@<dns for public IP>:27017/
```

### Complete Removal Steps
```
kubectl delete service azure-load-balancer
kubectl delete statefulsets mongodb
kubectl delete pvc azure-file
kubectl delete storageclass azure-file
```
