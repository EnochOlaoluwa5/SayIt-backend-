const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const voices = [
  { id: "american-male", name: "American Male", language: "en-US", gender: "male", modelVoice: "onyx" },
  { id: "american-female", name: "American Female", language: "en-US", gender: "female", modelVoice: "nova" },
  { id: "british-male", name: "British Male", language: "en-GB", gender: "male", modelVoice: "echo" },
  { id: "british-female", name: "British Female", language: "en-GB", gender: "female", modelVoice: "shimmer" },
  { id: "nigerian-male", name: "Nigerian Male", language: "en-NG", gender: "male", modelVoice: "onyx" },
  { id: "nigerian-female", name: "Nigerian Female", language: "en-NG", gender: "female", modelVoice: "nova" }
];

app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "SayIt",
    message: "SayIt backend is running"
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    success: true,
    app: "SayIt",
    version: "2.0.0",
    voiceSystem: true,
    translationSystem: false,
    videoSystem: false,
    replySystem: false
  });
});

app.get("/api/voices", (req, res) => {
  res.json({
    success: true,
    voices: voices
  });
});

app.post("/api/speak", async (req, res) => {
  try {
    const text = req.body.text;
    const voiceId = req.body.voice;
    const language = req.body.language;
    const style = req.body.style || "Natural";

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required."
      });
    }

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        error: "Please choose a voice."
      });
    }

    const selectedVoice = voices.find(function(item) {
      return item.id === voiceId;
    });

    if (!selectedVoice) {
      return res.status(400).json({
        success: false,
        error: "The selected voice is not configured."
      });
    }

    let instructions = "Speak naturally and clearly.";

    if (style === "Friendly") {
      instructions = "Speak in a warm, friendly and natural way.";
    } else if (style === "Professional") {
      instructions = "Speak clearly, confidently and professionally.";
    } else if (style === "Calm") {
      instructions = "Speak calmly, gently and clearly.";
    } else if (style === "Excited") {
      instructions = "Speak with natural energy and enthusiasm.";
    }

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: selectedVoice.modelVoice,
      input: text,
      instructions: instructions,
      response_format: "mp3"
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const audioBase64 = buffer.toString("base64");

    res.json({
      success: true,
      message: "Speech generated successfully.",
      voice: selectedVoice,
      language: language || selectedVoice.language,
      style: style,
      text: text,
      audioBase64: audioBase64,
      audioMimeType: "audio/mpeg"
    });

  } catch (error) {
    console.error("SayIt TTS error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Unable to generate speech."
    });
  }
});

app.use(function(req, res) {
  res.status(404).json({
    success: false,
    error: "SayIt endpoint not found."
  });
});

app.listen(PORT, function() {
  console.log("SayIt backend running on port " + PORT);
});
