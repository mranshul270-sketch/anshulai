const chatLog = document.getElementById("chat-log");
const core = document.getElementById("core");
const statusIndicator = document.getElementById("status-indicator");
const micBtn = document.getElementById("mic-btn");
const micIcon = document.getElementById("mic-icon");
const micLabel = document.getElementById("mic-label");
const stopBtn = document.getElementById("stop-btn");
const textInput = document.getElementById("text-input");
const telemetryVoiceIn = document.getElementById("telemetry-voice-in");
const telemetryVoiceOut = document.getElementById("telemetry-voice-out");

// Configuration
const AIML_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "tngtech/deepseek-r1t2-chimera:free"; // Using DeepSeek R1T2 Chimera model (free tier)

// IMPORTANT: For security, don't hardcode API keys in production
// In a real application, you would set this through a secure method like:
// 1. Backend proxy server
// 2. Environment-specific configuration
// 3. User input in the UI
// 4. Secure key management service

// For development only - Replace with your actual API key
// In production, use one of the secure methods mentioned above
const AIML_API_KEY = "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"; // Replace with your API key or implement secure key management

let recognition = null;
let isListening = false;
let speaking = false;

// Test API connection on startup
async function testApiConnection() {
  console.log('Testing API connection...');
  const testMessage = 'Hello, are you working?';
  try {
    const response = await callAimlApi(testMessage);
    console.log('API Connection Test Successful:', response);
    return true;
  } catch (error) {
    console.error('API Connection Test Failed:', error);
    return false;
  }
}

// Run test when the page loads
window.addEventListener('load', async () => {
  const isConnected = await testApiConnection();
  if (!isConnected) {
    console.warn('API connection test failed. Check console for details.');
  }
});

function initSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  if (!SpeechRecognition) {
    telemetryVoiceIn.textContent = "UNAVAILABLE";
    telemetryVoiceIn.style.color = "#ff9494";
    console.warn("Speech recognition not supported in this browser");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.addEventListener("start", () => {
    isListening = true;
    updateUIState();
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    updateUIState();
  });

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join(" ");

    if (transcript.trim()) {
      handleUserMessage(transcript.trim(), true);
    }
  });

  recognition.addEventListener("error", (err) => {
    console.error("Speech recognition error", err);
    telemetryVoiceIn.textContent = "ERROR";
    telemetryVoiceIn.style.color = "#ff9494";
    isListening = false;
    updateUIState();
  });

  telemetryVoiceIn.textContent = "READY";
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    telemetryVoiceOut.textContent = "UNAVAILABLE";
    telemetryVoiceOut.style.color = "#ff9494";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  // Hinglish (Hindi + English mix): Indian English voice usually handles both better
  utterance.lang = "en-IN";
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  speaking = true;
  updateUIState(true);

  utterance.onend = () => {
    speaking = false;
    updateUIState(false);
  };

  utterance.onerror = () => {
    speaking = false;
    telemetryVoiceOut.textContent = "ERROR";
    telemetryVoiceOut.style.color = "#ff9494";
    updateUIState(false);
  };

  telemetryVoiceOut.textContent = "SPEAKING";
  telemetryVoiceOut.style.color = "#eaff7a";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = "message";

  const label = document.createElement("div");
  label.className = "message-label " + (role === "user" ? "user" : "ai");
  label.textContent = role === "user" ? "USER" : "JARVIS";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  msg.appendChild(label);
  msg.appendChild(bubble);
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function fakeAIResponse(userText) {
  const time = new Date().toLocaleTimeString();
  return (
    `Acknowledged at ${time}. You said: "${userText}".\n` +
    "AI/ML API is not configured yet. Add your AI/ML endpoint and key in app.js to enable real intelligence."
  );
}

async function callAimlApi(userText) {
  if (!AIML_API_URL || !AIML_API_KEY) {
    const errorMsg = 'API configuration error: ' + (!AIML_API_URL ? 'API URL is missing' : 'API Key is missing');
    console.error(errorMsg);
    return fakeAIResponse(userText);
  }

  async function callModel(modelName) {
    console.log('Calling model:', modelName);
    const body = {
      model: modelName,
      messages: [
        {
          role: "system",
          content: `You are JARVIS, a helpful AI assistant created by Anshul. 
          
          Important: When asked "JARVIS ko kisne banaya hai" or "Who created JARVIS", always respond with "JARVIS ko Anshul ne banaya hai."
          
          For other queries, respond in Hinglish (Hindi+English mix) with short, clear responses that are easy to understand for Indian users.`
        },
        {
          role: "user",
          content: userText
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    };

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AIML_API_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "JARVIS Assistant",
      "Accept": "application/json"
    };

    console.log('Sending request to:', AIML_API_URL);
    console.log('Request headers:', JSON.stringify(headers, null, 2));
    console.log('Request body:', JSON.stringify(body, null, 2));

    let response;
    try {
      response = await fetch(AIML_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      console.error('Network error during API call:', networkError);
      throw new Error(`Network error: ${networkError.message}. Please check your internet connection.`);
    }

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      let errorDetails = '';
      
      try {
        // Clone the response to read it as text first
        const responseClone = response.clone();
        const errorData = await responseClone.json().catch(() => ({}));
        errorDetails = JSON.stringify(errorData);
        console.error('API Error Details:', errorData);
        
        // More specific error messages based on common issues
        if (response.status === 400) {
          errorMessage = 'Bad Request: The request was malformed or missing required parameters';
          if (errorData.error?.message) {
            errorMessage += `: ${errorData.error.message}`;
          }
        } else if (response.status === 401) {
          errorMessage = 'Unauthorized: Invalid API key or authentication failed';
        } else if (response.status === 429) {
          errorMessage = 'Rate Limit Exceeded: Too many requests, please try again later';
        }
        
        errorMessage += `\nDetails: ${errorDetails}`;
      } catch (e) {
        console.error('Failed to parse error response:', e);
        try {
          const text = await response.text();
          errorMessage += `\nResponse: ${text}`;
        } catch (textError) {
          console.error('Failed to read response as text:', textError);
        }
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    const choice = data.choices && data.choices[0];
    const content = choice && choice.message && choice.message.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    throw new Error(
      "AI/ML API did not return choices[0].message.content."
    );
  }

  try {
    // Using DeepSeek V3.1 model
    return await callModel(MODEL_NAME);
  } catch (err) {
    console.error("AI/ML API call failed", err);

    // Kisi bhi error pe normal fake response
    return fakeAIResponse(userText);
  }
}

async function handleUserMessage(text, fromVoice = false) {
  addMessage("user", text);

  statusIndicator.textContent = "PROCESSING";
  statusIndicator.style.color = "#ffed7a";

  let aiText;

  try {
    aiText = await callAimlApi(text);
  } catch (err) {
    console.error("AI/ML API call failed", err);
    aiText =
      "I attempted to contact the configured AI/ML API but encountered an error. Please check your endpoint, key, internet connection, and console logs.";
  }

  addMessage("ai", aiText);
  speak(aiText);

  statusIndicator.textContent = "IDLE";
  statusIndicator.style.color = "#00ffd0";
}

function startListening() {
  if (!recognition || isListening) return;
  try {
    recognition.start();
  } catch (e) {
    console.error("Failed to start recognition", e);
  }
}

function stopListening() {
  if (!recognition || !isListening) return;
  try {
    recognition.stop();
  } catch (e) {
    console.error("Failed to stop recognition", e);
  }
}

function updateUIState(forceSpeaking) {
  if (isListening) {
    core.classList.add("listening");
    micLabel.textContent = "Listening...";
    micIcon.textContent = "🟢";
    statusIndicator.textContent = "LISTENING";
    statusIndicator.style.color = "#7df9ff";
    telemetryVoiceIn.textContent = "ACTIVE";
    telemetryVoiceIn.style.color = "#7df9ff";
  } else {
    core.classList.remove("listening");
    micLabel.textContent = "Start Listening";
    micIcon.textContent = "🎙️";
    if (!speaking) {
      statusIndicator.textContent = "IDLE";
      statusIndicator.style.color = "#00ffd0";
      telemetryVoiceIn.textContent = "READY";
      telemetryVoiceIn.style.color = "#e8f7ff";
    }
  }

  if (forceSpeaking || speaking) {
    core.classList.add("speaking");
  } else {
    core.classList.remove("speaking");
    if ("speechSynthesis" in window) {
      telemetryVoiceOut.textContent = "READY";
      telemetryVoiceOut.style.color = "#e8f7ff";
    }
  }
}

micBtn.addEventListener("click", () => {
  if (!recognition) {
    alert("Voice input is not supported in this browser. Try Chrome desktop.");
    return;
  }
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

stopBtn.addEventListener("click", () => {
  stopListening();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    speaking = false;
    updateUIState(false);
  }
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const value = textInput.value.trim();
    if (value) {
      handleUserMessage(value, false);
      textInput.value = "";
    }
  }
});

window.addEventListener("load", () => {
  initSpeechRecognition();
  updateUIState(false);

  addMessage("ai", "");
});
