const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database URI (সরাসরি পাসওয়ার্ড কোডে না রেখে .env ফাইলে রাখুন)
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const database = client.db("mediCare");
    const usersCollection = database.collection("user");
    const doctorsCollection = database.collection("doctors");
    const appointmentsCollection = database.collection("appointments");
    const reviewsCollection = database.collection("reviews");

    // Root route for testing
    app.get('/', (req, res) => {
      res.send("MediCare API Server Running...");
    });

    // GET API: Fetch all users
    app.get('/api/users', async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.status(200).json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });
    // get api : fetch all doctors
    app.get('/api/doctors',async (req,res)=>{
      const doctors = await doctorsCollection.find().toArray();
      res.send(doctors)
    })
    // get api : fetch all appointments
    app.get('/api/appointments',async (req,res)=>{
      const appointments = await appointmentsCollection.find().toArray();
      res.send(appointments)
    })
    // get api : fetch all reviews
    app.get('/api/reviews',async (req,res)=>{
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews)
    })

    // get api for featured doctors
 
app.get('/api/doctors/featured', async (req, res) => {
  try {
    // ১. Query параметр থেকে limit রিসিভ করা (ডিফল্ট ৪)
    const limit = parseInt(req.query.limit) || 4;

    // ২. MongoDB থেকে সরাসরি প্রথম ৪টি ডাটা ফেচ করা
    const doctors = await doctorsCollection.find({}).limit(limit).toArray();

    res.status(200).json(doctors);
  } catch (error) {
    console.error("Error fetching featured doctors:", error);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

    
   // GET API: Search & Filter Doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const { search, specialization } = req.query;
    let query = {};

    
    if (search) {
      query.doctorName = { $regex: search, $options: "i" };
    }

    
    if (specialization && specialization !== "All") {
      query.specialization = specialization;
    }

    const doctors = await doctorsCollection.find(query).toArray();
    res.status(200).json(doctors);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// GET API: Fetch doctor by ID
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctorId = req.params.id;
    const doctor = await doctorsCollection.findOne({ _id: new ObjectId(doctorId) });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    res.status(200).json(doctor);
  } catch (error) {
    console.error("Error fetching doctor:", error);
    res.status(500).json({ error: "Failed to fetch doctor" });
  }
});

// GET API: Fetch appointment by userID
app.get('/api/appointments/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // 🔴 userId অনুযায়ী ডাটাবেজ থেকে অ্যাপয়েন্টমেন্ট বের করা
    // আপনার ডকুমেন্টে যদি ফিল্ডের নাম 'userId' বা 'applicantId' থাকে সে অনুযায়ী ফিল্টার হবে
    const appointments = await appointmentsCollection
      .find({ 
        $or: [{ userId: userId }, { applicantId: userId }] 
      })
      .sort({ _id: -1 }) // নতুন অ্যাপয়েন্টমেন্টগুলো আগে দেখানোর জন্য
      .toArray();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments for user:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});
    // POST API: Insert doctor data
    app.post('/api/doctors', async (req, res) => {
      try {
        const doctorData = req.body;
        const result = await doctorsCollection.insertOne(doctorData);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error inserting doctor:", error);
        res.status(500).json({ error: "Failed to insert doctor" });
      }
    });
    // POST API: Insert appointment data
   app.post('/api/appointments', async (req, res) => {
  try {
    const appointmentData = req.body;
    const userId = appointmentData.userId || appointmentData.applicantId;
    const { doctorId, date, time } = appointmentData;

    if (!userId || !doctorId || !date || !time) {
      return res.status(400).json({ error: "Missing required appointment fields" });
    }

    // ডুপ্লিকেট এন্ট্রি আটকানোর জন্য চেক
    const existingAppointment = await appointmentsCollection.findOne({
      $or: [{ userId: userId }, { applicantId: userId }],
      doctorId,
      date,
      time,
    });

    if (existingAppointment) {
      return res.status(200).json({
        message: "Appointment already exists",
        insertedId: existingAppointment._id,
      });
    }

    // স্ট্যাটাস ও টাইমস্ট্যাম্পসহ ডাটা ইনসার্ট
    const finalPayload = {
      ...appointmentData,
      userId: userId,
      status: appointmentData.status || "Pending",
      createdAt: new Date(),
    };

    const result = await appointmentsCollection.insertOne(finalPayload);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error inserting appointment:", error);
    res.status(500).json({ error: "Failed to insert appointment" });
  }
});
    // Ping check
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);

// ⚠️ বাধ্যতামূলক: Express Server Start করা
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});