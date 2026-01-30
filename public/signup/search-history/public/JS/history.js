

const mockConversations = [
  { date: '23 Oct 2025', title: 'Market insights' },
  { date: '20 Oct 2025', title: 'Profit making' },
  { date: '15 Oct 2025', title: 'Statistics analysis' },
];

const makeConversations = (data) => `
  <div class="conversations-header"><h2>Conversations</h2></div>
  <div class="conversation-list">
    ${data.map(c => `
      <div class="conversation-item" id="conversation-item">
        <div class="conversation-date">${c.date} -</div>
        <div class="conversation-title">${c.title}</div>
      </div>`).join('')}
  </div>
`;

function addConversation() {
  const conversation_panel = document.querySelector('.conversation-panel');
  const emptyPrompt = document.getElementById('empty-agent-prompt');
  const agentButtons = document.querySelectorAll('.agent-item');
  const search_container = document.querySelector('.search-container')
  let activeAgent = null; // track which agent is currently open

  agentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const agentName = btn.querySelector('.agent-name').innerText.trim();
      // Case 1: clicking a new agent
      if (activeAgent !== agentName) {
        // Clear all highlights
        agentButtons.forEach(b => (b.style.background = 'none'));

        // Highlight this one
        btn.style.background = 'grey';
        activeAgent = agentName;

        // Replace empty prompt with new conversation panel
        conversation_panel.innerHTML = makeConversations(mockConversations);
        conversation_panel.classList.add('active');
        emptyPrompt.classList.add('hidden');
        setTimeout(() => (emptyPrompt.style.display = 'none'), 300);
        conversationSelected();
      }

      // Case 2: clicking the same agent again (toggle close)
      else {
        btn.style.background = 'none';
        activeAgent = null;

        // Hide conversation panel and bring back prompt
        conversation_panel.classList.remove('active');
        setTimeout(() => (conversation_panel.innerHTML = ''), 400);
        emptyPrompt.style.display = 'flex';
        setTimeout(() => emptyPrompt.classList.remove('hidden'), 300);

            if (search_container){
            search_container.innerHTML = '';
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', addConversation);

const search_stuff = `
        <div class="search-box">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input type="text" class="search-input" id="search-input" value="market analysis">
        </div>

        <h2 class="results-header">3 similar search results</h2>

        <div class="result-card">
          <div class="result-header">
            <div class="avatar">BA</div>
            <div class="result-content">
              <div class="result-title">Business Analyst • Market insights</div>
              <div class="result-meta">Used in 3 searches • Last accessed 2 days ago</div>
              <div class="result-description">"insights, market analysis, and business reporting..."</div>
            </div>
          </div>
        </div>

        <div class="result-card">
          <div class="result-header">
            <div class="avatar avatar-me">Me</div>
            <div class="result-content">
              <div class="result-title">Business Analyst • Market insights</div>
              <div class="result-meta">Used in 3 searches • Last accessed 3 days ago</div>
              <div class="result-description">"proceed with doing proper market analysis...?"</div>
            </div>
          </div>
        </div>

        <div class="result-card">
          <div class="result-header">
            <div class="avatar">BA</div>
            <div class="result-content">
              <div class="result-title">Business Analyst • Market insights</div>
              <div class="result-meta highlighted">Used in 3 searches • Last accessed 4 days ago</div>
              <div class="result-description">"Market analysis is one of the essential profit driv..."</div>
            </div>
          </div>
        </div>
      `;

function conversationSelected() {
  const conversationItems = document.querySelectorAll('.conversation-item');
  const searchContainer = document.querySelector('.search-container');

  if (!searchContainer || conversationItems.length === 0) return;

  conversationItems.forEach(btn => {
    btn.addEventListener('click', () => {
      // Clear previous results (optional)
        searchContainer.innerHTML = search_stuff;
      // Add new results HTML
    });
  });
}

