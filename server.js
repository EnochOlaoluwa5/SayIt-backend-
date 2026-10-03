const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
    version: "3.0.0",
    voiceSystem: true,
    translationSystem: false,
    videoSystem: false,
    replySystem: false,
    provider: "ElevenLabs"
  });
});

app.get("/api/voices", async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "ElevenLabs API key is not configured."
      });
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v2/voices?page_size=100",
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.detail || "Unable to load ElevenLabs voices."
      });
    }

    const voices = (data.voices || []).map(function (voice) {
      const labels = voice.labels || {};

      return {
        id: voice.voice_id,
        name: voice.name,
        accent: labels.accent || "",
        gender: labels.gender || "",
        age: labels.age || "",
        description: voice.description || "",
        previewUrl: voice.preview_url || "",
        languages: voice.verified_languages || []
      };
    });

    res.json({
      success: true,
      voices: voices
    });

  } catch (error) {
    console.error("Voice list error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Unable to load voices."
    });
  }
});

app.post("/api/speak", async (req, res) => {
  try {
    const text = req.body.text;
    const voiceId = req.body.voice;

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

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "ElevenLabs API key is not configured."
      });
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/" +
        encodeURIComponent(voiceId) +
        "?output_format=mp3_44100_128",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        success: false,
        error: errorText || "ElevenLabs could not generate the speech."
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    res.json({
      success: true,
      message: "Speech generated successfully.",
      audioBase64: buffer.toString("base64"),
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

app.use(function (req, res) {
  res.status(404).json({
    success: false,
    error: "SayIt endpoint not found."
  });
});

app.listen(PORT, function () {
  console.log("SayIt backend running on port " + PORT);
});
