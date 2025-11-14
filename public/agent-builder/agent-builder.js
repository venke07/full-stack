const qs = (s, el=document)=>el.querySelector(s);
  const qsa = (s, el=document)=>[...el.querySelectorAll(s)];
  const badges = {
    formality: qs('#formalityBadge'),
    creativity: qs('#creativityBadge'),
    safety: qs('#safetyBadge')
  };
  const BACKEND_URL = window.AGENT_API_BASE || 'http://localhost:8001';

  // Slider labels
  function mapRange(v, labels){
    const i = Math.round((v/100)*(labels.length-1));
    return labels[i];
  }

  function updateBadges(){
    const f = +qs('#formality').value;
    const c = +qs('#creativity').value;
    const s = +qs('#safety').value;
    badges.formality.textContent = mapRange(f,["Casual","Warm","Neutral","Confident","Professional"]);
    badges.creativity.textContent = mapRange(c,["Strictly factual","Grounded","Balanced","Exploratory","Imaginative"]);
    badges.safety.textContent = mapRange(s,["Lenient","Standard","Careful","Conservative","Strict"]);
  }
  qsa('.slider').forEach(sl=>sl.addEventListener('input',updateBadges));
  updateBadges();

  // Switch interactions
  qsa('.switch').forEach(sw=>{
    sw.addEventListener('click',()=>{
      sw.classList.toggle('active');
    });
  });

  // Character counter
  const desc = qs('#agentDesc');
  const descCount = qs('#descCount');
  function count(){descCount.textContent = `${desc.value.length}/280`;}
  desc.setAttribute('maxlength','280');
  desc.addEventListener('input',count); count();

  // Dynamic intro bubble mirrors name + description
  function refreshIntro(){
    const name = qs('#agentName').value.trim() || 'your agent';
    const d = qs('#agentDesc').value.trim();
    const tone = badges.formality.textContent.toLowerCase();
    const safety = badges.safety.textContent.toLowerCase();
    qs('#dynamicIntro').textContent = `You are chatting with ${name}. I aim for a ${tone} tone and ${safety} responses. ${d?d:''}`;
  }
  qsa('#agentName, #agentDesc, #formality, #safety').forEach(el=>el.addEventListener('input',refreshIntro));
  refreshIntro();

  // Chat mock
  qs('#sendBtn').addEventListener('click',()=>{
    const input = qs('#chatInput');
    const val = input.value.trim();
    if(!val) return;
    const me = document.createElement('div'); me.className='bubble me'; me.textContent=val; qs('#chat').appendChild(me);
    input.value='';
    // mock reply
    setTimeout(()=>{
      const reply = document.createElement('div'); reply.className='bubble';
      reply.textContent = 'Got it. I will analyze this using the enabled tools'+(qs('.switch[data-key="web"]').classList.contains('active')?' (web search on)':'')+(qs('.switch[data-key="rfd"]').classList.contains('active')?' and your uploaded sources':'')+'.';
      qs('#chat').appendChild(reply);
      qs('#chat').scrollTop = qs('#chat').scrollHeight;
    }, 300);
  });

  function buildAgentPayload(){
    const toggleState = {};
    qsa('.switch').forEach(sw=>{
      if(sw.dataset.key){
        toggleState[sw.dataset.key] = sw.classList.contains('active');
      }
    });
    return {
      agentName: qs('#agentName').value.trim(),
      agentDesc: qs('#agentDesc').value.trim(),
      agentPrompt: qs('#agentPrompt').value.trim(),
      formality: Number(qs('#formality').value),
      creativity: Number(qs('#creativity').value),
      toggles: toggleState,
      modelPick: qs('#modelPick').value
    };
  }

  async function publishAgent(){
    const payload = buildAgentPayload();
    if(!payload.agentName){
      alert('Please provide a name for your agent first.');
      return;
    }
    if(!payload.agentPrompt){
      alert('Please enter a system prompt so the backend knows how to run the agent.');
      return;
    }

    const publishBtn = qs('#publish');
    const originalText = publishBtn.textContent;
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';

    try{
      const res = await fetch(`${BACKEND_URL}/api/build-agent`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data = await res.json();
      if(!res.ok || !data.ok){
        throw new Error(data.detail || 'Backend rejected the request.');
      }

      // Persist a short-lived snapshot so chat.html can show context
      sessionStorage.setItem('latestAgent', JSON.stringify({
        ...payload,
        research_plan: data.research_plan || null,
        createdAt: new Date().toISOString()
      }));

      const encoded = encodeURIComponent(payload.agentName || 'Your Agent');
      window.location.href = `/chat.html?agent=${encoded}`;
    }catch(err){
      console.error('Error publishing agent', err);
      alert(`Failed to publish agent: ${err.message}`);
    }finally{
      publishBtn.disabled = false;
      publishBtn.textContent = originalText;
    }
  }

  // Footer buttons
  qs('#discard').addEventListener('click',()=>{
    if(confirm('Discard all changes?')) location.reload();
  });
  qs('#saveDraft').addEventListener('click',()=>{
    alert('Draft saved locally. (Wire up to your backend)');
  });
  qs('#publish').addEventListener('click', publishAgent);

  // File uploads (demo only)
  qs('#fileUp').addEventListener('change',(e)=>{
    const files = [...e.target.files].map(f=>f.name).join(', ');
    if(files) alert('Added sources: '+files);
  });
