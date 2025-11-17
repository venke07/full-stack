const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');

function createMessageElement(text, sender) {
  const row = document.createElement('div');
  row.className = 'message-row ' + (sender === 'user' ? 'user' : 'ai');

  if (sender === 'ai') {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const img = document.createElement('img');
    img.src = 'https://cdn-icons-png.flaticon.com/512/4712/4712101.png';
    img.alt = 'agent';
    avatar.appendChild(img);
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (sender === 'user' ? 'user-bubble' : 'ai-bubble');
  bubble.innerText = text;
  row.appendChild(bubble);

  return row;
}

function addMessage(text, sender) {
  const el = createMessageElement(text, sender);
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function fakeAIResponse(userMessage) {
  const responses = [
    "That's an interesting point. Let me analyze that for you.",
    "I understand. I can help you with forecasting on that.",
    "Great question! This relates to financial analysis.",
    "I see what you're looking for. Let me process that.",
    "Excellent! Let's dive deeper into this insight."
  ];

  const randomReply = responses[Math.floor(Math.random() * responses.length)];

  setTimeout(() => {
    addMessage(randomReply, 'ai');
  }, 900);
}

sendBtn.addEventListener('click', () => {
  const message = userInput.value.trim();
  if (message === '') return;
  addMessage(message, 'user');
  userInput.value = '';
  sendBtn.disabled = true;
  fakeAIResponse(message);
});

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

userInput.addEventListener('input', () => {
  sendBtn.disabled = userInput.value.trim() === '';
});