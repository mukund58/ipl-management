// app.js
const express = require('express');
const cors = require('cors');

const { MongoClient } = require('mongodb');
const randomString=require('randomstring')
const app = express();
const PORT = 3001;
const mongoUrl = 'mongodb://gon:gon@localhost:27017/ims?authSource=ims';
const dbName = 'ims';

let db;

app.use(cors());

app.use(express.json());

const connection = new MongoClient(mongoUrl);
// start Express server
app.listen(PORT, () => {
	console.log(PORT);
	console.log(` Database: ${dbName}`);
});

// Insert user

app.post('/users', async (req, res) => {


	const email = req.body.email;
	await connection.connect();
	db = connection.db('ims');
	console.log("Connected to MongoDB");
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
	connection.close();
});


// Login users


app.post('/login', async (req, res) => {
	await connection.connect();
	db = connection.db('ims');
	console.log("Connected to MongoDB");
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
	connection.close();
});

app.get('/players', async (req, res) => {
	try {
		await connection.connect();
		const db = connection.db('ims');
		console.log("Connected to MongoDB");

		const collection = db.collection('users');
		const players = await collection.find({ "playing_for": { $exists: true } }).toArray();

		if (players.length === 0) {
			console.log("No players found");
			return res.status(404).send({ error: 'No players found' });
		}

		console.log("Players found");
		// Option 1: Send the entire list
		res.send(players.map(player => ({
			name: player.name,
			email: player.email,
			phone: player.phone,
			slogan: player.slogan,
			profile_pic: player.profile_pic,
			playing_for: player.playing_for
		})));

	} catch (err) {
		console.error("Error fetching players:", err);
		res.status(500).send({ error: 'Internal Server Error' });
	} finally {
		await connection.close(); 
	}
});


app.get('/teams', async (req, res) => {
	try {
		await connection.connect();
		const db = connection.db('ims');
		console.log("Connected to MongoDB");

		const collection = db.collection('teams');
		const result = collection.find().toArray();

		if (result>0) {

		res.json(result);

		}else{

			console.log("No players found");
			return res.status(404).send({ error: 'No players found' });
		}
	} catch (err) {
		console.error("Error fetching Teams:", err);
		res.status(500).send({ error: 'Internal Server Error' });
	} 
		await connection.close(); 
	
});
app.get('/roles', async (req, res) => {
	try {
		const token = req.headers.token;
		if (!token) {
			return res.status(400).json({ error: "Token not provided in header" });
		}

		console.log("Fetching user roles");
		const collection = await db.collection('users');
		const result = await collection.find({ token: token }).toArray();

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
