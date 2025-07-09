const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const randomString = require('randomstring');

const app = express();
const PORT = 3001;

const mongoUrl = 'mongodb://gon:gon@localhost:27017/ims?authSource=ims';
const dbName = 'ims';

let db;

app.use(express.json());
app.use(cors());

// Connect to MongoDB once
const client = new MongoClient(mongoUrl);
client.connect()
  .then(() => {
    db = client.db(dbName);
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Connected to MongoDB: ${dbName}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });


// ========== ROUTES ========== //

// ✅ Register new user
app.post('/users', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const collection = db.collection('users');
    const existingUser = await collection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await collection.insertOne({
      name,
      email,
      phone,
      password: hashedPassword,
      is_admin: false,
      playing_for: null,
      owner_of: null,
      token: null
    });

    res.status(201).json({ message: "User registered", user_id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "Signup failed", details: err.message });
  }
});


// ✅ Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const collection = db.collection('users');

    const user = await collection.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    const token = randomString.generate(7);
    await collection.updateOne({ _id: user._id }, { $set: { token } });

    res.json({ message: 'Login successful', token, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});


// ✅ Get players
app.get("/players", async (req, res) => {
  try {
    const collection = db.collection("users");
    const players = await collection.find({ playing_for: { $ne: null } }).toArray();

    if (!players.length) return res.status(404).json({ error: "No players found" });

    res.json(players.map(player => ({
      id: player._id,
      name: player.name,
      email: player.email,
      phone: player.phone,
      slogan: player.slogan,
      profile_pic: player.profile_pic,
      playing_for: player.playing_for,
    })));
  } catch (err) {
    res.status(500).json({ error: "Error fetching players", details: err.message });
  }
});


// ✅ Get player by ID
app.get('/playerStats/:id', async (req, res) => {
  try {
    const player = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: "Error fetching player", details: err.message });
  }
});


// ✅ Update player stats
app.put('/playerStats/:id', async (req, res) => {
  try {
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    res.json({ message: "Player updated", updated: result.modifiedCount > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to update player", details: err.message });
  }
});


// ✅ Delete player
app.delete('/playerStats/:id', async (req, res) => {
  try {
    const result = await db.collection("users").deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json({ message: "Player deleted", deleted: result.deletedCount > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete player", details: err.message });
  }
});

app.post('/teams', async (req, res) => {
  try {
    const { name, short_name, logo } = req.body;

    if (!name || !short_name) {
      return res.status(400).json({ error: "Name and short name are required" });
    }

    const collection = db.collection('teams');
    const token = req.headers.token;
    const user = await db.collection('users').findOne({ token });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await collection.insertOne({
      name,
      short_name,
      logo: logo || null,
      owner: user.email, // or user._id, depending on your design
    });

    res.status(201).json({ _id: result.insertedId, name, short_name, logo, owner: user.email });

  } catch (err) {
    console.error("Add team error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// ✅ Get teams
app.get('/teams', async (req, res) => {
  try {
    const teams = await db.collection('teams').find().toArray();
    if (!teams.length) return res.status(404).json({ error: 'No teams found' });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: "Error fetching teams", details: err.message });
  }
});
// Get a single team by ID
app.get('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection('teams');

    const team = await collection.findOne({ _id: new ObjectId(id) });

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.json(team);
  } catch (err) {
    console.error("Get team by ID error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// PUT /teams/:id
// PUT update team
app.put('/teams/:id', async (req, res) => {
  try {
    const collection = db.collection('teams');
    const { id } = req.params;

    // Clone and remove _id from the body if it exists
    const updateData = { ...req.body };
    delete updateData._id;

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Team not found or no changes" });
    }

    const updatedTeam = await collection.findOne({ _id: new ObjectId(id) });
    res.json(updatedTeam);

  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});



// DELETE /teams/:id
app.delete('/teams/:id', async (req, res) => {
  try {
    await db.collection('teams').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Team deleted" });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});


// ✅ Get roles
app.get('/roles', async (req, res) => {
  try {
    const token = req.headers.token;
    if (!token) return res.status(400).json({ error: "Token missing" });

    const user = await db.collection('users').findOne({ token });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      message: 'User roles fetched successfully',
      is_admin: !!user.is_admin,
      playing_for: user.playing_for || null,
      owner_of: user.owner_of || null,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching roles", details: err.message });
  }
});
