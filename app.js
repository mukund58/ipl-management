// app.js
const express = require('express');
const { MongoClient } = require('mongodb');
const randomString=require('randomstring')
const app = express();
const PORT = 3000;
const mongoUrl = 'mongodb://gon:gon@localhost:27017/ims?authSource=ims';
const dbName = 'ims';

let db;

app.use(express.json());

// Connect to MongoDB
MongoClient.connect(mongoUrl)
  .then(client => {
    console.log(' Connected to MongoDB');
    db = client.db(dbName);

    // Start server only after successful DB connection
    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error(' MongoDB connection failed:', err);
  });

// Insert user



app.post('/users', async (req, res) => {
	  const email = req.body.email;

	  const existingUser = await db.collection('users').findOne({ email })
	    .catch(err => {
		          return res.status(500).send({ error: 'DB find error', details: err });
		        });

	  if (existingUser) {
		      return res.status(409).send({ error: 'Email already exists' });
		    }

	  const result = await db.collection('users').insertOne(req.body)
	    .catch(err => {
		          return res.status(500).send({ error: 'Insert failed', details: err });
		        });

	  if (result && result.insertedId) {
		      res.status(201).send({ message: 'User added', result });
		    }
});


// Login users


app.post('/login', async (req, res) => {
	    const { email, password } = req.body;

	    const collection = await db.collection('users');
	    const user = await collection.findOne({ email });

	    if (!user) {
		            return res.status(404).send({ error: 'User not found' });
		        }

	    if (user.password !== password) {
		            return res.status(401).send({ error: 'Incorrect password' });
		        }

	    const token = randomString.generate(7);

	    await collection.updateOne(
		            { _id: user._id },
		            { $set: { token: token } }
		        );

	    res.send({
		            message: 'Login successful',
		            token,
		            user: {
				     name: user.name,
				     email: user.email
			     }
		        });
});

