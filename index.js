const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if(!authorization){
      return res.status(401).send({error : true, message : "Unauthorized access"});
    }
    // bearer token
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err){
        return res.status(401).send({error : true, message : "Unauthorized access"});
      }
      req.decoded = decoded;
      next();
    })
  } 


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gpvu0c0.mongodb.net/?retryWrites=true&w=majority`;

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
    await client.connect();

    const usersCollection = client.db('languageDb').collection('users');
    const classesCollection = client.db('languageDb').collection('classes');
    const instructorsCollection = client.db('languageDb').collection('instructors');
    const cartCollection = client.db('languageDb').collection('carts');


    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7d'})
        res.send({token})
    })

    const verifyAdmin = async(req, res, next) => {
        const email = req.decoded.email;
        const query = {email : email};
        const user = await usersCollection.findOne(query)
        if(user?.role !== 'admin'){
          return res.status(403).send({error : true, message : "Unauthorized access"});
        }
        next();
      } 
    const verifyInstructor = async(req, res, next) => {
        const email = req.decoded.email;
        const query = {email : email};
        const user = await usersCollection.findOne(query)
        if(user?.role !== 'instructor'){
          return res.status(403).send({error : true, message : "Unauthorized access"});
        }
        next();
      } 


    // users related apis
    app.get('/users', verifyJWT, verifyAdmin, async(req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    })
    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = {email : user?.email}
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
            return res.send({message: 'User already exist'})
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
    })
    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
        const email = req.params.email;
  
        if(req.decoded.email !== email){
          res.send({admin : false})
        }
  
        const query = {email : email}
        const user = await usersCollection.findOne(query);
        const result = {admin : user?.role === 'admin'}
        res.send(result);
      })
    app.patch('/users/admin/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id : new ObjectId(id)};
        const updateDoc = {
            $set: {
              role: 'admin'
            },
          };

          const result = await usersCollection.updateOne(query, updateDoc);
          res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async(req, res) => {
        const email = req.params.email;
  
        if(req.decoded.email !== email){
          res.send({instructor : false})
        }
  
        const query = {email : email}
        const user = await usersCollection.findOne(query);
        const result = {instructor : user?.role === 'instructor'}
        res.send(result);
      })
    app.patch('/users/instructor/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id : new ObjectId(id)};
        const updateDoc = {
            $set: {
              role: 'instructor'
            },
          };

          const result = await usersCollection.updateOne(query, updateDoc);
          res.send(result);
    })





    app.get('/classes',  async(req, res) => {
        const result = await classesCollection.find().toArray();
        res.send(result);
    })
    
    app.post('/classes', async (req, res) => {
        const newClass = req.body
        const result = await classesCollection.insertOne(newClass);
        res.send(result);
    });
    app.get('/classes', async (req, res) => {
        let query = {};
        if (req.query.email) {
            query = { email: req.query.email };
        }
        const result = await classesCollection.find(query).toArray();
        res.send(result);
    });

    app.get('/myclasses', async (req, res) => {
        let query = {};
        if (req.query?.email) {
          query = { email: req.query.email };
        }
  
        const result = await classesCollection.find(query).toArray();
        res.send(result)
      });

    app.patch('/classes/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        let updateDoc;

        if (req.body.action === 'approve') {
            updateDoc = {
                $set: {
                    status: 'approved'
                }
            };
        } else if (req.body.action === 'deny') {
            updateDoc = {
                $set: {
                    status: 'denied'
                }
            };
        } else if (req.body.action === 'feedback') {
            updateDoc = {
                $set: {
                    feedback: req.body.feedback
                }
            };
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const result = await classesCollection.findOneAndUpdate(filter, updateDoc);
        res.send(result);
    })

    app.get('/instructors', async(req, res) => {
        const result = await instructorsCollection.find().toArray();
        res.send(result);
    })



    // cart collection

    app.get('/carts', verifyJWT, async (req, res) => {
        const email = req.query.email;
        if(!email){
            res.send([]);
        }

        const decodedEmail = req.decoded.email;
        if(email !== decodedEmail){
        return res.status(403).send({error : true, message : "Forbidden access"});
      }

        const query = {email : email}
        const result = await cartCollection.find(query).toArray();
        res.send(result);
    })
    app.post('/carts', async (req, res) => {
        const item = req.body;
        console.log(item);
        const result = await cartCollection.insertOne(item);
        res.send(result);
    })
    app.delete('/carts/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id : new ObjectId(id)}
        const result = await cartCollection.deleteOne(query);
        res.send(result);

    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("The greatest joys of life aren't gifted they're earned.")
})
app.listen(port, () => {
    console.log(`final assignment running on port : ${port}`);
})