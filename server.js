const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const voices = [
  {
    id: "american-male",
    name: "American Male",
    language: "en-US",
    gender: "male"
  },
  {
    id: "american-female",
    name: "American Female",
    language: "en-US",
    gender: "female"
  },
  {
    id: "british-male",
    name: "British Male",
    language: "en-GB",
    gender: "male"
  },
  {
    id: "british-female",
    name: "British Female",
    language: "en-GB",
    gender: "female"
  },
  {
    id: "nigerian-male",
    name: "Nigerian Male",
    language: "en-NG",
    gender: "male"
  },
  {
    id: "nigerian-female",
    name: "Nigerian Female",
    language: "en-NG",
    gender: "female"
  }
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
    version: "1.0.0",
    voiceSystem: true,
    translationSystem: false,
    videoSystem: false,
    replySystem: false
  });
});

app.get("/api/voices", (req, res) => {
  res.json({
    success: true,
    voices
  });
});

app.post("/api/speak", (req, res) => {
  try {
    const { text, voice, language, style } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required."
      });
    }

    if (!voice) {
      return res.status(400).json({
        success: false,
        error: "
