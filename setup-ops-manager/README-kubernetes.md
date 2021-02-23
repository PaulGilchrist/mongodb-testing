## This currently does not work - Working notes only

https://www.mongodb.com/blog/post/running-mongodb-ops-manager-in-kubernetes
https://carlos.mendible.com/2020/02/09/mongodb-enterprise-operator-deploying-mongodb-in-aks/

```
kubectl create namespace mongodb
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-enterprise-kubernetes/master/crds.yaml
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-enterprise-kubernetes/master/mongodb-enterprise.yaml
kubectl create secret generic ops-manager-admin-secret --from-literal=Username="paul.gilchrist@outlook.com" --from-literal=Password="password." --from-literal=FirstName="Paul" --from-literal=LastName="Gilchrist" -n mongodb
```

Upload ops-manager.yaml and apply it

```
kubectl apply -f ops-manager.yaml -n mongodb
```

Wait for it to start completly.  May take > 5 min, but you can monitor with the following command:

```
kubectl get om -n mongodb -o yaml -w
```

How do the Ops Manager setup persistent databases without setting up K8s persistent volumes?
* Perhaps a PV was created that we can adjust and re-apply
How do we get a Azure public IP assigned to Ops Manager?
* LoadBalancer was created, but we need to point it to a public IP