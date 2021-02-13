# Kubernetes Setup

Based off - [Standalone Mongodb on Kubernetes Cluster](https://medium.com/@dilipkumar/standalone-mongodb-on-kubernetes-cluster-19e7b5896b27), but adapted for docker desktop on Mac

### Apply these templates as below
```
kubectl apply -f storageclass.yaml
kubectl apply -f persistent-volume.yaml
kubectl apply -f persistent-volume-claim.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f statefulsets.yaml
kubectl apply -f service.yaml
```

### Connect to the container's console and test
```
kubectl exec -it mongodb-standalone-0 sh
mongo mongodb://mongodb-standalone-0.database:27017
use training
db.auth('training','password')
db.users.insert({name: 'your name'})
```

### Alternatively expose the containers internal port to the node allowing testing through MongoDB Compass
```
kubectl port-forward mongodb-standalone-0 27017:27017
connection string = mongodb://admin:password@localhost:27017
```

### Delete statefulsets and redeploy again to check if data persists or not
```
kubectl delete statefulsets mongodb-standalone
kubectl apply -f statefulsets.yaml
kubectl exec -it mongodb-standalone-0 sh
mongo mongodb://mongodb-standalone-0.database:27017
use training
db.auth('training','password')
show collections
```

### Complete Removal Steps
```
kubectl delete service database
kubectl delete statefulsets mongodb-standalone
kubectl delete ConfigMap mongodb-standalone
kubectl delete Secret mongo-root
kubectl delete PersistentVolumeClaim mongodb-standalone
kubectl delete PersistentVolume mongodb-standalone
kubectl delete StorageClass mongodb-standalone
```

### Some troubleshooting commands
```
kubectl get nodes
kubectl get pod mongodb-standalone-0
kubectl describe pods
kubectl describe pod mongodb-standalone-0
kubectl get pvc
```