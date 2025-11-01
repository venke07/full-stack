const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');

function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
  msg.innerText = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  typingIndicator.classList.add('active');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  typingIndicator.classList.remove('active');
}

function fakeAIResponse(userMessage) {
  const responses = [
    "That's really interesting! Tell me more about that.",
    "I understand what you're saying. How can I help?",
    "Great question! Let me think about that for a moment.",
    "I'm here to assist you with anything you need.",
    "That sounds fascinating! Could you elaborate a bit more?",
    "I appreciate you sharing that with me.",
    "Let's explore that idea together!"
  ];

  const randomReply = responses[Math.floor(Math.random() * responses.length)];
  
  showTyping();
  
  setTimeout(() => {
    hideTyping();
    addMessage(randomReply, 'ai');
  }, 1200);
}

sendBtn.addEventListener('click', () => {
  const message = userInput.value.trim();
  if (message === '') return;
  addMessage(message, 'user');
  userInput.value = '';
  fakeAIResponse(message);
});

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});