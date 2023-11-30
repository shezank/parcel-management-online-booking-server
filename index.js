const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;


const corsConfig = {
    origin: [
        'http://localhost:5173',
        'https://trust-line-parcel.web.app',
        'https://trust-line-parcel.firebaseapp.com'

    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
app.use(cors(corsConfig));
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iyzg5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db("TrustLine").collection("users");
        const parcelBookCollection = client.db("TrustLine").collection("parcelBooks");

        app.get('/', (req, res) => {
            res.send('Welcome To Trust Line Server')
        })

        app.post('/jwt', async (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1h' })
            res.send({ token });
        })

        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ massage: ' Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ massage: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbiden Access' })
            }
            next();
        }


        app.get('/users/check/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbiden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let userOnly = false;
            if (user) {
                userOnly = user.role === 'User' || user.role === undefined;
            }
            res.send({ userOnly })
        })
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbiden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin';
            }
            res.send({ admin })
        })
        app.get('/users/deliveryman/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbiden access' })
            }
            const query = { email: email };
            const userMan = await userCollection.findOne(query);
            let deliveryMan = false;
            if (userMan) {
                deliveryMan = userMan.role === 'Delivery Man';
            }
            res.send({ deliveryMan})
        })

        app.get('/users/count', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
    
            const result = await userCollection.find()
            .skip(page * size)
            .limit(size)
            .toArray();
            res.send(result);
          })

        app.get('/users', async(req,res)=>{
            const result = await userCollection.find().toArray();
            res.send(result);
        })
        app.get('/usersCount', async(req,res)=>{
            const count = await userCollection.estimatedDocumentCount();
            res.send({count});
        })

        app.get('/Countall', async(req,res)=>{
            const usersCount = await userCollection.estimatedDocumentCount();
            const bookingsCount = await parcelBookCollection.estimatedDocumentCount();
            const filter = {status: 'Delivered'};
            const delivery = await parcelBookCollection.find(filter).toArray();
            const deliveryCount = delivery.length;
            res.send({usersCount, bookingsCount, deliveryCount});
        })



        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result);
        })

        app.patch('/users/deliveryman/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'Delivery Man'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result);
        })

        app.get('/users/:deliveryman', async(req,res)=>{
            const deliveryMan = req.params.deliveryman;
            const query = {role: deliveryMan};
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/users/delimeryman/:email', async(req,res)=>{
            const email = req.params.email;
            const query = {email: email};
            const result = await userCollection.findOne(query);
            res.send(result);
        })

    

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const exitingUser = await userCollection.findOne(query);
            if (exitingUser) {
                return res.send({ message: 'user Already Exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.post('/parcelBooks', async(req,res)=>{
            const parcel = req.body;
            const result = await parcelBookCollection.insertOne(parcel);
            res.send(result);
        })

        app.get('/parcelbooks/deliveryList/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {deliveryManID: id};
            const result = await parcelBookCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/parcelBooks', async(req,res)=>{
            const result = await parcelBookCollection.find().toArray();
            res.send(result);
        })
       
        app.patch('/parcelbooks/:id', async(req,res)=>{
            const parcel = req.body;
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const updateParcel = {
                $set:{
                    Name: parcel.Name, 
                    email: parcel.email, 
                    phone: parcel.phone, 
                    parcelType: parcel.parcelType, 
                    reciverName: parcel.reciverName, 
                    reciverPhoneNumber: parcel.reciverPhoneNumber, 
                    parcelDeliveryAddress: parcel.parcelDeliveryAddress, 
                    deliveryAddressLatitude: parcel.deliveryAddressLatitude, 
                    deliveryAddressLongitude: parcel.deliveryAddressLongitude, 
                    parcelDeliveryDate: parcel.parcelDeliveryDate, 
                    parcelWeight: parcel.parcelWeight, 
                    parcelDeliveryPrice: parcel.parcelDeliveryPrice,
                    status: parcel.status 
                }
            }

            const result = await parcelBookCollection.updateOne(query, updateParcel)
            res.send(result);

        })

        app.patch('/parcelbooks/statusUpdate/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const updateStatus = {
                $set: {
                    status: "Cancel"
                }
            }
            const result = await parcelBookCollection.updateOne(query,  updateStatus);
            res.send(result);
        })
        
        app.patch('/parcelbooks/statusUpdate/delivery/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const updateStatus = {
                $set: {
                    status: "Delivered"
                }
            }
            const result = await parcelBookCollection.updateOne(query,  updateStatus);
            res.send(result);
        })
        
        app.get('/parcelBooks/:email', async(req,res)=>{
            const email = req.params.email;
            const query = {email: email}
            const result = await parcelBookCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/parcelBooks/update/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await parcelBookCollection.findOne(query);
            res.send(result);
        })

        app.patch('/parcelBooks/assign/:id', async(req,res)=>{
            const id = req.params.id;
            const assign = req.body;
            const query = {_id: new ObjectId(id)};
            const updateAssingData = {
                $set:{
                    approximateDeliveryDate: assign.approximateDeliveryDate,
                    status: assign.status,
                    deliveryManID: assign.deliveryManID,
                }
            }
            const result = await parcelBookCollection.updateOne(query, updateAssingData);
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})