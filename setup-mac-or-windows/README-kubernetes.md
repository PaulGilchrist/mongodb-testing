# Kubernetes Setup

Start with the creation of three folders named mongodb0, mongodb1, and mongodb2 located at `/Users/Shared`.  These folders can be moved to any other root folder, as long as the 3 files named mongodb0-pv.yaml, mongodb1-pv.yaml, and mongodb2-pv.yaml have their `spec.local.path` changed accordingly.

To simulate public DNS names, edit local /private/etc/hosts/hosts.d file adding the following names:

1) The nodes have internal hostnames that are used to initiate the replica set, but external clients can't resolve those names.  In order to get this to work, you will want the MongoDB pods to use the same DNS names as external clients.  To simulate public DNS names on a Mac computer you would modify the `/private/etc/hosts/hosts.d` file adding the following lines:

```
127.0.0.1	mongodb0.pgtech.com
127.0.0.1	mongodb1.pgtech.com
127.0.0.1	mongodb2.pgtech.com
```

2) To support persistent storage for each mongodb pod, create 3 new directories located on teh mac at `/Users/Shared` names `mongodb0`, `mongodb1`, and `mongodb2`

3) Create a keyfile using the following commands, then copy it into the persistent volume for each pod (/Users/Shared/mongodb0, 1, & 2)

```
openssl rand -base64 756 > <path-to-keyfile>
```

4) Apply the templates needed to setup the first pod

```
kubectl apply -f storageclass.yaml

kubectl apply -f mongodb0-pvc.yaml
kubectl apply -f mongodb0-pv.yaml
kubectl apply -f mongodb0-ss.yaml
kubectl apply -f mongodb0-service.yaml
```

5) Optional troubleshooting commands

```
kubectl describe pvc
kubectl get pod mongodb0-0
kubectl describe pods
kubectl describe pod mongodb0-0
kubectl get services
kubectl describe service mongodb0-service
kubectl logs -f=true mongodb0-0
command: ["sleep", "infinity"] # used to start container without launching mondod,  then enter container and start manually to observe any errors
```

6) If wanting to build a 2 or 3 node replica set, execute the following commands

```
kubectl apply -f mongodb1-pvc.yaml
kubectl apply -f mongodb1-pv.yaml
kubectl apply -f mongodb1-ss.yaml
kubectl apply -f mongodb1-service.yaml

kubectl apply -f mongodb2-pvc.yaml
kubectl apply -f mongodb2-pv.yaml
kubectl apply -f mongodb2-ss.yaml
kubectl apply -f mongodb2-service.yaml
```

Here we need to add DNS entries to K8s CName mongodb0.pgtech.com to mongodb0-service


7) Since `--auth` is being required, but no accounts have yet been setup, you will not be able to remotely connect at this time, and must first setup an admin and/or user accounts. At this same time, we will also set the appropriate permissions on the keyfile we created earlier. Finally we will modify the hosts.d file to recognize each pods public external DNS name

```
kubectl exec  mongodb0-0 -i -- bash
chmod 400 /data/db/keyfile
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

6) Repeat the above steps on the reamin pods

7) Optionally test external connectivity using MongoDB Compass

```
mongodb://admin:password@localhost:27017
mongodb://admin:password@localhost:27018
mongodb://admin:password@localhost:27019
```

8) Optionally test internal connectivity between pods

```
kubectl exec -it mongodb0-0 sh
mongo --host mongodb0-service:27017
exit
mongo --host mongodb1-service:27018
exit
mongo --host mongodb2-service:27019
exit
exit
```

9) Add the `--replSet` args to the StatefulSets (already in file but commented out) and re-apply them

```
kubectl apply -f mongodb0-ss.yaml
kubectl apply -f mongodb1-ss.yaml
kubectl apply -f mongodb2-ss.yaml
```

* External connectivity will not work at this point until after the replication set configuration is complete

10) Re-connect to pod 0 and initiate the replSet

```
kubectl exec -it mongodb0-0 sh
mongo
use admin
db.auth('admin','password')
rs.initiate(
  {
    _id : "rs0",
    members: [
      { _id: 0, host: "mongodb0-service:27017" },
      { _id: 1, host: "mongodb1-service:27018" },
      { _id: 2, host: "mongodb2-service:27019" }
    ]
  }
)
exit
exit
```

* You can then view the configuration using `rs.conf()`, `rs.status()`, and rs.isMaster()

11) The nodes have internal hostnames that are used to initiate the replica set, but external clients can't resolve those names.  In order to get this to work, you will want to map the kubernetes service names CName to the public IP (localhost in this case).  On a Mac computer you would modify the `/private/etc/hosts/hosts` file adding the following lines:

```
127.0.0.1	mongodb0-service
127.0.0.1	mongodb1-service
127.0.0.1	mongodb2-service
```

12) You can now connect to the full replica set using the following connection string

```
mongodb://admin:password@localhost:27017,localhost:27018,localhost:27019/?authSource=admin&replicaSet=rs0&readPreference=nearest
```

## Appendix

### Complete Removal Steps
```
kubectl delete service mongodb0-service
kubectl delete statefulSet mongodb0
kubectl delete persistentVolumeClaim mongodb0-pvc
kubectl delete persistentVolume mongodb0-pv

kubectl delete service mongodb1-service
kubectl delete statefulSet mongodb1
kubectl delete persistentVolumeClaim mongodb1-pvc
kubectl delete persistentVolume mongodb1-pv

kubectl delete service mongodb2-service
kubectl delete statefulSet mongodb2
kubectl delete persistentVolumeClaim mongodb2-pvc
kubectl delete persistentVolume mongodb2-pv

kubectl delete storageclass local-sc
```
