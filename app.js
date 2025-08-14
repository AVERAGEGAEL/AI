const WORKER_URL = "https://chatgpt.uraverageopdoge.workers.dev/chat"; // your Worker route

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("userInput");
const systemEl = document.getElementById("system");
const modelEl = document.getElementById("model");
const tempEl = document.getElementById("temp");
const tempValEl = document.getElementById("tempVal");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");

let controller = null;
let chatHistory = []; // [{role, content}]

tempEl.addEventListener("input", () => {
  tempValEl.textContent = Number(tempEl.value).toFixed(2);
});

document.querySelectorAll(".preset").forEach(btn => {
  btn.addEventListener("click", () => {
    systemEl.value = btn.dataset.system || "";
  });
});

// UX sugar: Shift+Enter new line, Enter to send
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

  // add user message
  pushMessage("user", text);
  inputEl.value = "";

  // placeholder for assistant
  const assistantNode = pushMessage("assistant", "");
  assistantNode.dataset.streaming = "1";

  // build payload
  const payload = {
    model: modelEl.value,
    temperature: parseFloat(tempEl.value),
    system: systemEl.value || "You are StudyZone AI. Explain like I am in middle school. Be helpful and concise.",
    messages: [...chatHistory, { role: "user", content: text }],
  };

  // stream from worker
  controller = new AbortController();
  toggleBusy(true);
  try {
    // We are consuming an SSE stream. We use fetch + reader.
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const t = await res.text();
      assistantNode.textContent = "Error: " + t;
      toggleBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      // SSE format: lines starting with "data:"
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim(); // after 'data:'

        if (data === "[DONE]") {
          assistantNode.dataset.streaming = "0";
          break;
        }

        try {
          const obj = JSON.parse(data);
          // Chat Completions delta format
          const delta = obj?.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            assistantNode.textContent = fullText;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch {
          // ignore non-JSON keepalives
        }
      }
    }

    // commit assistant message to history
    chatHistory.push({ role: "user", content: text });
    chatHistory.push({ role: "assistant", content: assistantNode.textContent });

  } catch (err) {
    if (err.name !== "AbortError") {
      assistantNode.textContent = "Stream error. Try again.";
    }
  } finally {
    toggleBusy(false);
    controller = null;
  }
});

stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
});

function pushMessage(role, content) {
  const node = document.createElement("div");
  node.className = `msg ${role}`;
  node.innerHTML = `<small>${role.toUpperCase()}</small>${escapeHtml(content)}`;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}

function toggleBusy(on) {
  sendBtn.disabled = on;
  stopBtn.disabled = !on;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}
