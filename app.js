// app.js
const express = require('express');
const cors = require('cors');

const { MongoClient } = require('mongodb');
const randomString=require('randomstring')
const app = express();
const PORT = 3001;
const mongoUrl = 'mongodb://rok:rok@localhost:27017/ims?authSource=ims';
const dbName = 'ims';

let db;

app.use(express.json());
app.use(cors())

// Connect to MongoDB
MongoClient.connect(mongoUrl)
  .then(client => {
	console.log(' Connected to MongoDB');
	db = client.db(dbName);

	// Start server only after successful DB connection
	app.listen(PORT, () => {
	  console.log(PORT);
	  console.log(` Database: ${dbName}`);
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

			res.json({
							message: 'Login successful',
							token:token,
							email: user.email
						});
});
app.get('/roles', async (req, res) => {
  try {
	const token = req.headers.token;
	if (!token) {
	  return res.status(400).json({ error: "Token not provided in header" });
	}

	console.log("Fetching user roles");
	const collection = await db.collection('users');
	const result = await collection.find({ token:token }).toArray();

	if (result.length > 0) {
	  const user = result[0];
	  res.status(200).json({
		message: 'User roles fetched successfully',
		is_admin: user.is_admin === true,
		playing_for: user.playing_for,
		owner_of: !user.owner_of
	  });
	} else {
	  res.status(404).json({ info: "User not found" });
	}
  } catch (err) {
	console.error("Error fetching user roles:", err);
	res.status(500).json({ error: "Internal server error" });
  }
});
