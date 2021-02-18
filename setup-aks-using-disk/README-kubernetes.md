# Kubernetes Setup

Based off - [Standalone Mongodb on Kubernetes Cluster](https://medium.com/@dilipkumar/standalone-mongodb-on-kubernetes-cluster-19e7b5896b27), but adapted for docker desktop on Mac

### Apply these templates as below (troubleshooting steps with #)
Make sure to first add an Azure Public IP address in the resource group created when the AKS cluster was created.  When creating the AKS cluster, you choose to support either standard or basic load balancers.  Based on what was choosen, make sure to make the same selection when creating the Azure IP address.
```
kubectl apply -f storageclass.yaml
kubectl apply -f persistent-volume-claim.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
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

### Connect to the container's console and test
```
kubectl exec -it mongodb-0 sh
mongo mongodb://mongodb-0:27017
use training
db.auth('training','password')
db.users.insert({name: 'your name'})
exit
exit
```

### Delete statefulsets and redeploy again to check if data persists or not
```
kubectl delete statefulsets mongodb
kubectl apply -f statefulsets.yaml
kubectl exec -it mongodb-0 sh
mongo mongodb://mongodb-0:27017
use training
db.auth('training','password')
show collections
```

### Complete Removal Steps
```
kubectl delete service azure-load-balancer
kubectl delete statefulsets mongodb
kubectl delete ConfigMap mongodb-cm
kubectl delete Secret mongodb-secret
kubectl delete PersistentVolumeClaim azure-managed-disk
kubectl delete StorageClass default-expandable
```
