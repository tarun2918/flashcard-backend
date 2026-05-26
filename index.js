require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const mongoose = require('mongoose'); // Add Mongoose

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
// Paste your copied string here. Replace <db_password> with your real password!
const dbURI = process.env.MONGO_URI;

mongoose.connect(dbURI)
  .then(() => console.log("Connected to MongoDB successfully!"))
  .catch((err) => console.log("Failed to connect to MongoDB:", err));
// ---------------------------
// --- DATABASE BLUEPRINT (SCHEMA) ---
const flashcardSchema = new mongoose.Schema({
  question: String,
  answer: String,
  createdAt: { type: Date, default: Date.now }
});

// This turns the blueprint into an active tool we can use to save data
const Flashcard = mongoose.model('Flashcard', flashcardSchema);
// -----------------------------------

app.get('/', (req, res) => {
  res.send('Hello from the Flashcard Backend!');
});

// --- GET ROUTE: Send saved cards to the frontend ---
app.get('/api/flashcards', async (req, res) => {
  try {
    // 1. Ask MongoDB to find all flashcards, sorted by newest first
    const allCards = await Flashcard.find().sort({ createdAt: -1 });
    
    // 2. Send them to the frontend
    res.json({
      status: "Success",
      data: allCards
    });
  } catch (error) {
    console.log("Error fetching cards:", error);
    res.status(500).json({ error: "Failed to fetch cards" });
  }
});

// --- DELETE ROUTE: Wipe all flashcards ---
app.delete('/api/flashcards', async (req, res) => {
  try {
    // Tell MongoDB to delete all records in this collection
    await Flashcard.deleteMany({}); 
    
    console.log("All cards deleted from the database.");
    res.json({ status: "Success", message: "Database wiped clean!" });
  } catch (error) {
    console.log("Error deleting cards:", error);
    res.status(500).json({ error: "Failed to delete cards" });
  }
});

// Upgraded API endpoint to save data!
app.post('/api/generate', async (req, res) => {
  try {
    // 1. Capture the exact question and answer from the frontend
    const frontendQuestion = req.body.question;
    const frontendAnswer = req.body.answer;

    // 2. Save it permanently to MongoDB using our blueprint
    const newCard = await Flashcard.create({
      question: frontendQuestion,
      answer: frontendAnswer
    });

    console.log("Successfully saved a new card:", newCard);

    // 3. Send a success message back to the frontend
    res.json({
      status: "Success",
      message: "Flashcard saved to the database!",
      data: newCard
    });
  } catch (error) {
    console.log("Error saving card:", error);
    res.status(500).json({ error: "Failed to save card to database" });
  }
});

// The new AI-powered generation route
app.post('/api/ai-generate', async (req, res) => {
    try {
        const { text } = req.body; // We no longer need maxCards here
        
        if (!text) {
            return res.status(400).json({ error: "No text provided" });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json", 
            }
        });

        // NEW PROMPT: Telling the AI to decide the perfect amount of cards
        const prompt = `Act as an expert tutor. Analyze the following text and extract ALL key concepts into flashcards. 
        Generate as many flashcards as necessary to comprehensively cover the material, but do NOT create repetitive or filler cards. 
        Only extract meaningful information.
        The output MUST be a JSON array of objects, where each object has a "q" string and an "a" string.
        
        Text to analyze:
        ${text}`;

        const result = await model.generateContent(prompt);
        const aiText = result.response.text();
        
        const flashcards = JSON.parse(aiText);
        res.json(flashcards);

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI flashcards." });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});