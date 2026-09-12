const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
const JWKS = createRemoteJWKSet(
   new URL(`${process.env.FRONT_END_URL}/api/auth/jwks`)
)

const verifyToken = async(req,res,next)=>{

   const result = req?.headers.authorization

   if(!result){
      return res.status(401).json({message:"Unauthorized"})
   }

   const token = result.split(" ")[1]




   if(!token){
      return res.status(401).json({message:"Unauthorized"})
   }

   try{

   

      const {payload} = await jwtVerify(token,JWKS)
      console.log(payload)
       next()
     
   }

   catch(error){

    console.log("JWT ERROR",error)

      return res.status(403).json({message:"Forbidden"})
   }
  
  
}



async function run() {
  try {
   // await client.connect();

    const database = client.db("mediCare");
    const usersCollection = database.collection("user");
    const doctorsCollection = database.collection("doctors");
    const appointmentsCollection = database.collection("appointments");
    const reviewsCollection = database.collection("reviews");
    const prescriptionsCollection = database.collection("prescriptions")

  
    app.get('/', (req, res) => {
      res.send("MediCare API Server Running...");
    });

   
    app.get('/api/users', async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.status(200).json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });
   
    app.get('/api/doctors',async (req,res)=>{
      const doctors = await doctorsCollection.find().toArray();
      res.send(doctors)
    })
  
    app.get('/api/appointments',async (req,res)=>{
      const appointments = await appointmentsCollection.find().toArray();
      res.send(appointments)
    })
   
    app.get('/api/reviews',async (req,res)=>{
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews)
    })

    
 
app.get('/api/doctors/featured', async (req, res) => {
  try {
   
    const limit = parseInt(req.query.limit) || 4;

  
    const doctors = await doctorsCollection.find({}).limit(limit).toArray();

    res.status(200).json(doctors);
  } catch (error) {
    console.error("Error fetching featured doctors:", error);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});


app.get('/api/reviews/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const cleanUserId = userId.trim();

    
    const filter = {
      $or: [
        { userId: cleanUserId },
        { userId: ObjectId.isValid(cleanUserId) ? new ObjectId(cleanUserId) : cleanUserId }
      ]
    };

    const reviews = await reviewsCollection
      .find(filter)
      .sort({ createdAt: -1 }) 
      .toArray();

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

app.get('/api/reviews/doctor/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const cleandoctorId = doctorId.trim();

    
    const filter = {
      $or: [
        { doctorId: cleandoctorId },
        { doctorId: ObjectId.isValid(cleandoctorId) ? new ObjectId(cleandoctorId) : cleandoctorId }
      ]
    };

    const reviews = await reviewsCollection
      .find(filter)
      .sort({ createdAt: -1 }) 
      .toArray();

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

    
  
app.get('/api/doctorsSort', async (req, res) => {
  try {
    const { search, specialization, sortBy } = req.query;

    console.log("Backend porjnto pouchaise:", { search, specialization, sortBy });

    let matchQuery = {};

 
    if (search && search.trim() !== "") {
      matchQuery.doctorName = { $regex: search.trim(), $options: "i" };
    }

  
    if (specialization && specialization !== "All") {
      matchQuery.specialization = specialization.trim();
    }

    let pipeline = [{ $match: matchQuery }];

   
    if (sortBy === "fee-low") {
      pipeline.push({
        $addFields: {
          numericFee: { $toInt: "$consultationFee" }
        }
      });
      pipeline.push({ $sort: { numericFee: 1 } });
    }

    else if (sortBy === "exp-high") {
      pipeline.push({
        $addFields: {
          numericExperience: {
            $toInt: {
              $arrayElemAt: [{ $split: ["$experience", " "] }, 0]
            }
          }
        }
      });
      pipeline.push({ $sort: { numericExperience: -1 } });
    }

    const doctors = await doctorsCollection.aggregate(pipeline).toArray();
    res.status(200).json(doctors);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});


app.get('/api/doctors/:id', verifyToken, async (req, res) => {
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


app.get('/api/appointments/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    
    const appointments = await appointmentsCollection
      .find({ 
        $or: [{ userId: userId }, { applicantId: userId }] 
      })
      .sort({ _id: -1 }) 
      .toArray();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments for user:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});
app.get('/api/appointments/doctor/:doctorId', async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    if (!doctorId) {
      return res.status(400).json({ error: "User ID is required" });
    }

   
    const appointments = await appointmentsCollection
      .find({ 
        $or: [{ doctorId: doctorId }, { applicantId: doctorId }] 
      })
      .sort({ _id: -1 }) 
      .toArray();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments for user:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});




app.get('/api/doctors/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("ASCE TO:", userId);

    
    const cleanUserId = userId ? userId.trim() : "";

  
    const doctor = await doctorsCollection.findOne({
      userId: { $regex: `^${cleanUserId}$`, $options: "i" }
    });

    console.log("FOUND DOCTOR:", doctor);

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    res.status(200).json({ success: true, doctor });
  } catch (error) {
    console.error("Error fetching doctor by userId:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.post('/api/prescriptions', async (req, res) => {

  console.log("Hit khaise")
  try {
    const { appointmentId, doctorId, userId, prescriptionText } = req.body;

    if (!appointmentId || !doctorId || !userId || !prescriptionText) {
      return res.status(400).json({ success: false, message: "Required fields are missing" });
    }

    const newPrescription = {
      appointmentId,
      doctorId,
      userId,
      prescriptionText,
      status: "completed",
      createdAt: new Date(),
    };

    const result = await prescriptionsCollection.insertOne(newPrescription);

    
    const filter = {
      $or: [
        { _id: appointmentId },
        { _id: ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId }
      ]
    };

    await appointmentsCollection.updateOne(filter, {
      $set: { status: "completed" }
    });

    res.status(201).json({
      success: true,
      message: "Prescription saved and appointment completed successfully!",
      prescriptionId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating prescription:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.post('/api/reviews', async (req, res) => {
  try {
    const { appointmentId, doctorId, userId, rating, reviewText } = req.body;

    if (!appointmentId || !doctorId || !userId || !rating || !reviewText) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const newReview = {
      appointmentId,
      doctorId,
      userId,
      rating: Number(rating),
      reviewText,
      createdAt: new Date(),
    };

    const result = await reviewsCollection.insertOne(newReview);
    res.status(201).json({ success: true, message: "Review submitted successfully!", reviewId: result.insertedId });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});
  
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
   
   app.post('/api/appointments', async (req, res) => {
  try {
    const appointmentData = req.body;
    const userId = appointmentData.userId || appointmentData.applicantId;
    const { doctorId, date, time } = appointmentData;

    if (!userId || !doctorId || !date || !time) {
      return res.status(400).json({ error: "Missing required appointment fields" });
    }

 
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



app.delete('/api/users/:id', async (req, res) => {
   const id = req.params.id;
   console.log("ID ASCHE ", id)
  try {
    

    console.log("ID from params:", id);
    console.log("Is valid:", ObjectId.isValid(id));

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid ObjectId format"
      });
    }

    const query = {
      _id: new ObjectId(id)
    };

    console.log("Delete query:", query);

    const result = await usersCollection.deleteOne(query);

    console.log("Delete result:", result);

    if (result.deletedCount === 1) {
      return res.status(200).json({
        success: true,
        message: "User deleted"
      });
    }

    return res.status(404).json({
      error: "User not found in database"
    });

  } catch (error) {
    console.error("Delete error:", error);

    res.status(500).json({
      error: "Server error during delete"
    });
  }
});


app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Review ID" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await reviewsCollection.deleteOne(query);

    if (result.deletedCount === 1) {
      res.status(200).json({ success: true, message: "Review deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Review not found" });
    }
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ success: false, message: "Failed to delete review" });
  }
});


app.delete('/api/doctors/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Doctor ID" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await doctorsCollection.deleteOne(query);

    if (result.deletedCount === 1) {
      res.status(200).json({ success: true, message: "Doctor deleted successfully" });
    } else {
      res.status(404).json({ error: "Doctor not found" });
    }
  } catch (error) {
    console.error("Error deleting doctor:", error);
    res.status(500).json({ error: "Failed to delete doctor" });
  }
});



app.patch('/api/doctors/:id/verify', async (req, res) => {
  console.log("CAll hoccha")
  try {
    const id = req.params.id;
    const { verificationStatus } = req.body; 

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Doctor ID" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        verificationStatus: String(verificationStatus), 
      },
    };

    const result = await doctorsCollection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 1 || result.matchedCount === 1) {
      res.status(200).json({ success: true, message: "Status updated successfully" });
    } else {
      res.status(404).json({ error: "Doctor not found" });
    }
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Failed to update verification status" });
  }
});


app.patch('/api/doctors/update-schedule/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { availableDays, availableSlots } = req.body;

    const filter = { userId: userId.trim() };
    const updateDoc = {
      $set: {
        availableDays: availableDays,
        availableSlots: availableSlots,
      },
    };

    const result = await doctorsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    res.status(200).json({ success: true, message: "Schedule updated successfully!" });
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.patch('/api/doctors/update-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      doctorName,
      specialization,
      qualifications,
      experience,
      consultationFee,
      hospitalName,
      profileImage,
      availableDays,
      availableSlots,
    } = req.body;

    const filter = { userId: userId.trim() };
    const updateDoc = {
      $set: {
        doctorName,
        specialization,
        qualifications,
        experience,
        consultationFee,
        hospitalName,
        profileImage,
        availableDays,
        availableSlots,
        updatedAt: new Date(),
      },
    };

    const result = await doctorsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    res.status(200).json({ success: true, message: "Profile updated successfully!" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.patch('/api/appointments/reschedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;

    if (!date || !time) {
      return res.status(400).json({ success: false, message: "Date and Time are required" });
    }

    const filter = {
      $or: [
        { _id: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : id }
      ]
    };

    const updateDoc = {
      $set: { date, time, updatedAt: new Date() }
    };

    const result = await appointmentsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    res.status(200).json({ success: true, message: "Appointment rescheduled successfully!" });
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.patch('/api/appointments/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const filter = {
      $or: [
        { _id: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : id }
      ]
    };

    const updateDoc = {
      $set: { status: status }
    };

    const result = await appointmentsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    res.status(200).json({ success: true, message: `Appointment ${status} successfully!` });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});
app.patch('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewText } = req.body;

    if (!rating || !reviewText) {
      return res.status(400).json({ success: false, message: "Rating and review text are required" });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Review ID" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        rating: Number(rating),
        reviewText,
        updatedAt: new Date(),
      },
    };

    const result = await reviewsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    res.status(200).json({ success: true, message: "Review updated successfully!" });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});