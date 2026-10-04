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
    version: "3.1.0",
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


/*
  SAYIT NATURAL SPEECH PACING

  Adds carefully controlled pauses around:
  - commas
  - semicolons
  - colons
  - sentence endings
  - em dashes
  - ellipses

  It does NOT add pauses between ordinary words.
*/

function addNaturalPacing(text) {

  let result = String(text || "").trim();

  if (!result) {
    return result;
  }

  // Remove any existing break tags from user input.
  result = result.replace(
    /<break\b[^>]*\/?>/gi,
    ""
  );

  // Normalize excessive spaces.
  result = result.replace(
    /[ \t]+/g,
    " "
  );

  // Short natural pause after commas.
  result = result.replace(
    /,\s+/g,
    ', <break time="0.25s" /> '
  );

  // Slightly longer pause after semicolons.
  result = result.replace(
    /;\s+/g,
    '; <break time="0.35s" /> '
  );

  // Natural pause after a colon.
  result = result.replace(
    /:\s+/g,
    ': <break time="0.30s" /> '
  );

  // Em dash = change of thought / natural break.
  result = result.replace(
    /\s*[—–]\s*/g,
    ' <break time="0.40s" /> '
  );

  // Three dots = thinking / hesitation pause.
  result = result.replace(
    /\.{3,}/g,
    '... <break time="0.70s" /> '
  );

  // Normal sentence-ending punctuation.
  result = result.replace(
    /([.!?])\s+/g,
    '$1 <break time="0.55s" /> '
  );

  // Clean up repeated spaces around breaks.
  result = result.replace(
    /\s{2,}/g,
    " "
  );

  return result.trim();
}


app.post("/api/speak", async (req, res) => {
  try {
    const originalText = req.body.text;
    const requestedVoiceId = req.body.voice;

    if (!originalText || !originalText.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required."
      });
    }

    if (!requestedVoiceId) {
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

    const speechText = addNaturalPacing(originalText);

    console.log("SayIt original text:", originalText);
    console.log("SayIt paced text:", speechText);
    console.log("SayIt requested voice:", requestedVoiceId);

    /*
      IMPORTANT:
      Some ElevenLabs Voice Library voices cannot be used
      through the API on the free plan.

      We keep a small list of voices that have already been
      confirmed to work with this SayIt account.
    */

    const fallbackVoices = [
      "Nat6qYufULflyrQSpS8W",
      "wevlkhfRsG0ND2D2pQHq",
      "6F5Zhi321D3Oq7v1oNT4"
    ];

    /*
      Try the user's selected voice first.
      If ElevenLabs rejects it because of plan/access,
      automatically try our working fallback voices.
    */

    const voicesToTry = [
      requestedVoiceId,
      ...fallbackVoices.filter(
        function (id) {
          return id !== requestedVoiceId;
        }
      )
    ];

    let lastError = "";

    for (const voiceId of voicesToTry) {

      console.log(
        "SayIt trying voice:",
        voiceId
      );

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
            text: speechText,
            model_id: "eleven_multilingual_v2"
          })
        }
      );

      if (response.ok) {

        const buffer =
          Buffer.from(
            await response.arrayBuffer()
          );

        const usedFallback =
          voiceId !== requestedVoiceId;

        console.log(
          usedFallback
            ? "SayIt used fallback voice: " + voiceId
            : "SayIt used selected voice: " + voiceId
        );

        return res.json({
          success: true,
          message: "Speech generated successfully.",
          audioBase64:
            buffer.toString("base64"),
          audioMimeType: "audio/mpeg",
          requestedVoice:
            requestedVoiceId,
          usedVoice:
            voiceId,
          fallbackUsed:
            usedFallback
        });
      }

      const errorText =
        await response.text();

      lastError = errorText;

      console.log(
        "SayIt voice failed:",
        voiceId,
        errorText
      );

      /*
        If this voice is restricted, continue to the
        next working voice instead of stopping.
      */
    }

    /*
      Only reach this point if every available fallback failed.
    */

    return res.status(502).json({
      success: false,
      error:
        "SayIt could not generate speech with the available voices.",
      details:
        lastError
    });

  } catch (error) {

    console.error(
      "SayIt TTS error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to generate speech."
    });
  }
});
    const originalText = req.body.text;
    const voiceId = req.body.voice;

    if (!originalText || !originalText.trim()) {
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

    /*
      Keep the original text for the user,
      but send naturally paced text to ElevenLabs.
    */
    const speechText =
      addNaturalPacing(originalText);

    console.log("SayIt original text:", originalText);
    console.log("SayIt paced text:", speechText);

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
          text: speechText,
          model_id: "eleven_multilingual_v2"
        })
      }
    );

    if (!response.ok) {

      const errorText =
        await response.text();

      return res.status(response.status).json({
        success: false,
        error:
          errorText ||
          "ElevenLabs could not generate the speech."
      });
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.json({
      success: true,
      message: "Speech generated successfully.",
      audioBase64:
        buffer.toString("base64"),
      audioMimeType: "audio/mpeg"
    });

  } catch (error) {

    console.error(
      "SayIt TTS error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to generate speech."
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
  console.log(
    "SayIt backend running on port " +
    PORT
  );
});
