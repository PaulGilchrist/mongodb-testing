# Kubernetes Setup

Based off - [Standalone Mongodb on Kubernetes Cluster](https://medium.com/@dilipkumar/standalone-mongodb-on-kubernetes-cluster-19e7b5896b27), but adapted for docker desktop on Mac

### Apply these templates as below
```
# kubectl get nodes
kubectl apply -f storageclass.yaml
# kubectl get sc
kubectl apply -f persistent-volume.yaml
# kubectl get pv
kubectl apply -f persistent-volume-claim.yaml
# kubectl get pvc
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml
kubectl apply -f statefulsets.yaml
# kubectl get pod mongodb-0
# kubectl describe pods
# kubectl describe pod mongodb-0
kubectl apply -f service.yaml
# kubectl get service
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

### Alternatively expose the containers internal port to the node allowing testing through MongoDB Compass
```
kubectl port-forward mongodb-0 27017:27017
connection string = mongodb://admin:password@localhost:27017
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
kubectl delete service mongodb-service
kubectl delete statefulsets mongodb
kubectl delete ConfigMap mongodb-cm
kubectl delete Secret mongodb-secret
kubectl delete PersistentVolumeClaim mongodb-pvc
kubectl delete PersistentVolume mongodb-pv
kubectl delete StorageClass local-sc
```
