const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()

const { MongoClient, Admin } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const fileUpload = require('express-fileupload');

// admin
const admin = require("firebase-admin");
const { initializeApp } = require('firebase-admin/app');
// payment gateway stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());
// 
const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');
const { messaging } = require('firebase-admin');
admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
});



// database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ugo5b.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// verify token 
async function verifyToken(req, res, next) {
     if (req.headers?.authorization?.startsWith('Bearer ')) {
          const token = req.headers.authorization.split(' ')[1];
          try {
               const decodedUser = await admin.auth().verifyIdToken(token);
               req.decodedEmail = decodedUser.email;
          }
          catch {

          }
     }
     next();
}

async function run() {
     try {
          await client.connect();
          const database = client.db('doctorsPortal');
          const appointmentsCollection = database.collection('appointments');
          const userCollection = database.collection('users');
          const doctorsCollection = database.collection('doctors');


          // appointments
          // post appointments
          app.post('/appointments', async (req, res) => {
               const appointment = req.body;
               const result = await appointmentsCollection.insertOne(appointment);
               console.log(result);
               res.json(result);
          })
          // get appointments
          app.get('/appointments', verifyToken, async (req, res) => {
               const email = req.query.email;
               const date = req.query.date;
               const query = { email: email, date: date };
               const cursor = appointmentsCollection.find(query);
               const appointment = await cursor.toArray();
               res.json(appointment);
          })
          // get 
          app.get('/appointments/:id', async (req, res) => {
               const id = req.params.id;
               const query = { _id: ObjectId(id) };
               const result = await appointmentsCollection.findOne(query);
               res.json(result);
          })
          // put 
          app.put('/appointments/:id', async (req, res) => {
               const id = req.params.id;
               const payment = req.body;
               const filter = { _id: ObjectId(id) };

               const updateDoc = {
                    $set: {
                         payment: payment
                    }
               }
               const result = await appointmentsCollection.updateOne(filter, updateDoc);
               res.json(result);
          });

          // doctors
          // post
          app.post('/doctors', async (req, res) => {
               const name = req.body.name;
               const email = req.body.email;
               const pic = req.files.image;
               const picData = pic.data;
               const encodePic = picData.toString('base64');
               const imageBuffer = Buffer.from(encodePic, 'base64');
               const doctors = {
                    name,
                    email,
                    image: imageBuffer
               }
               const result = await doctorsCollection.insertOne(doctors);
               res.json(result)
          })
          // get
          app.get('/doctors', async (req, res) => {
               const cursor = doctorsCollection.find({});
               const doctors = await cursor.toArray();
               res.json(doctors);
          })

          // users
          // POST USER
          app.post('/users', async (req, res) => {
               const user = req.body;
               const result = await userCollection.insertOne(user);
               console.log(result);
               res.json(result);
          })
          // get user
          app.get('/users/:email', async (req, res) => {
               const email = req.params.email;
               const query = { email: email };
               const user = await userCollection.findOne(query);
               let isAdmin = false;
               if (user?.role === 'admin') {
                    isAdmin = true;
               }
               res.json({ Admin: isAdmin });
          })
          // put user
          app.put('/users', async (req, res) => {
               const user = req.body;
               const filter = { email: user.email };
               const options = { upsert: true };
               const updateDoc = { $set: user };
               const result = await userCollection.updateOne(filter, updateDoc, options);
               res.json(result)

          })
          // put admin user
          app.put('/users/admin', verifyToken, async (req, res) => {
               const user = req.body;
               const requester = req.decodedEmail;
               if (requester) {
                    const requesterAccount = await userCollection.findOne({ email: requester });
                    if (requesterAccount.role === 'admin') {
                         const filter = { email: user.email };
                         const updateDoc = { $set: { role: Admin } };
                         const result = await userCollection.updateOne(filter, updateDoc);
                         res.json(result);
                    }
               }
               else {
                    res.status(403).json({ message: 'you do not have access' });
               }

          });

          // stripe for payment
          // post 
          app.post('/create-payment-intent', async (req, res) => {
               const paymentInfo = req.body;
               const amount = paymentInfo * 100;
               const paymentIntent = await stripe.paymentIntents.create({
                    currency: 'usd',
                    amount: amount,
                    payment_method_types: ['card']
               });
               res.json({ clientSecret: paymentIntent.client_secret });
          });
     }
     finally {
          // await client.close();
     }

}
run().catch(console.dir);

app.get('/', (req, res) => {
     res.send('hitting the get');
})

app.listen(port, () => {
     console.log('listing the port', port)
})