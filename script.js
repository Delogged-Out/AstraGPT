async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

class KeyGenerator {
  static async generateKeys(mode = "normal") {
    const today = new Date();
    const [year, month, day] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];

    const rawSeed = Math.pow(month, 2) * Math.pow(year, day) * Math.pow(2, day);
    const hash = await sha256(rawSeed.toString());

    const key0Raw = 2 * year + 7 * Math.pow(month, Math.round(day / 2.5)) + Math.pow(day, Math.round(day / 2) + Math.round(day % 3 + Math.pow(0.5, Math.pow(day, 0.6))));
    const key1Raw = Math.round(Math.pow((key0Raw + 1 - month), 0.8));
    const key2Raw = Math.round(key0Raw * (month + year - day * 2) + Math.sqrt(key1Raw) - Math.pow(2, month));
    const key3Raw = Math.round(((key1Raw + key2Raw) / 2 + Math.pow((key1Raw / key0Raw), (day + (month % 3) % 2))) * Math.pow(month, 3.14));

    const keys = await Promise.all([key0Raw, key1Raw, key2Raw, key3Raw].map(k => sha256(k.toString())));
    if (mode === "shared") return await sha256(keys[0] + keys[1]);
    return keys;
  }
}

class AstraGPTClient {
  constructor(apiKey, baseUrl, model = "gpt-3.5-turbo") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.history = [{
      role: "system",
      content: "You are AstraGPT, created by InfernalAtom683. You speak English, Chinese, Korean, and Arabic."
    }];
  }

  async chat(message) {
    this.history.push({ role: "user", content: message });

    const response = await fetch(this.baseUrl + "chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.history,
        temperature: 1.0
      })
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;
    this.history.push({ role: "assistant", content: reply });
    return reply;
  }
}

// UI Setup
const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let client;

async function init() {
  const apiKey = prompt("Enter your API key:");
  const userKey = prompt("Enter access key:");
  const normalKeys = await KeyGenerator.generateKeys("normal");
  const sharedKey = await KeyGenerator.generateKeys("shared");

  let model = "gpt-3.5-turbo";
  if (userKey === sharedKey) {
    alert("Shared key accepted. Switching to GPT-4o Mini.");
    model = "gpt-4o-mini";
  } else if (!normalKeys.includes(userKey)) {
    alert("Incorrect key. Please refresh.");
    throw new Error("Invalid access");
  }

  client = new AstraGPTClient(apiKey, "https://free.v36.cm/v1/", model);
}

function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  appendMessage("user", text);
  input.value = "...";
  try {
    const reply = await client.chat(text);
    appendMessage("bot", reply);
  } catch (e) {
    appendMessage("bot", "Error: " + e.message);
  }
  input.value = "";
};

init();
