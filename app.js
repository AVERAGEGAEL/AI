const WORKER_URL = "https://chatgpt.uraverageopdoge.workers.dev/chat";

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("userInput");
const systemEl = document.getElementById("system");
const modelEl = document.getElementById("model");
// Provider element removed from HTML, so we don't select it here
const tempEl = document.getElementById("temp");
const tempValEl = document.getElementById("tempVal");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");

let controller = null;
let chatHistory = [];

const allowedGeminiModels = ["gemini-2.5-pro","gemini-2.5-flash","gemini-2.5-flash-lite"];

tempEl.addEventListener("input", () => {
  tempValEl.textContent = Number(tempEl.value).toFixed(2);
});

document.querySelectorAll(".preset").forEach(btn => {
  btn.addEventListener("click", () => { systemEl.value = btn.dataset.system; });
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("chatForm").requestSubmit();
  }
});

clearBtn.addEventListener("click", () => {
  chatHistory = [];
  messagesEl.innerHTML = "";
});

document.getElementById("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  pushMessage("user", text);
  inputEl.value = "";

  const assistantNode = pushMessage("assistant", "Thinking...");
  assistantNode.dataset.streaming = "1";

  // Validate Gemini model
  let selectedModel = modelEl.value;
  if (!allowedGeminiModels.includes(selectedModel)) {
    selectedModel = "gemini-2.5-flash"; // default fallback
  }

  // Hardcoded to gemini since OpenAI is removed
  const payload = {
    provider: "gemini", 
    model: selectedModel,
    temperature: parseFloat(tempEl.value),
    system: systemEl.value || "You are a helpful AI assistant. Explain simply.",
    messages: [...chatHistory, { role: "user", content: text }],
  };

  controller = new AbortController();
  toggleBusy(true);

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      assistantNode.textContent = "Error: " + await res.text();
      toggleBusy(false);
      return;
    }

    // Gemini handling (Normal JSON)
    const data = await res.json();
    assistantNode.textContent = data.text;
    chatHistory.push({ role: "user", content: text });
    chatHistory.push({ role: "assistant", content: data.text });
    
  } catch (err) {
    if (err.name !== "AbortError") assistantNode.textContent = "Request error.";
  } finally {
    toggleBusy(false);
    controller = null;
  }
});

stopBtn.addEventListener("click", () => { if (controller) controller.abort(); });

function pushMessage(role, content) {
  const node = document.createElement("div");
  node.className = `msg ${role}`;
  node.innerHTML = `<small>${role.toUpperCase()}</small>${escapeHtml(content)}`;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}

function toggleBusy(on) { sendBtn.disabled = on; stopBtn.disabled = !on; }

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}
