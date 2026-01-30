import os
import json
import logging
import asyncio
import time
import random
import requests
from typing import Tuple
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai

from aero.src.aero.model_researcher import suggest_models
from aero.src.aero.research_planner import plan_research
from aero.src.aero.experimentalist import experiment_suggestions
from aero.src.aero.report_writer import write_paper


# Experiment designer (optional)
try:
    from design_experiment import run_experiment_designer
except Exception:
    run_experiment_designer = None

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

ENABLE_RESEARCH_PIPELINE = os.getenv("ENABLE_RESEARCH_PIPELINE", "").lower() in {"1", "true", "yes"}
AERO_HOST = os.getenv("AERO_HOST", "127.0.0.1")
try:
    AERO_PORT = int(os.getenv("AERO_PORT", "8000"))
except ValueError:
    AERO_PORT = 8000

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Add validation right after loading:
if OPENAI_API_KEY:
    OPENAI_API_KEY = OPENAI_API_KEY.strip()  # Remove whitespace
    if not OPENAI_API_KEY.startswith("sk-"):
        logging.error("❌ Invalid OpenAI API key format")
    else:
        logging.info(f"✅ OpenAI API key loaded (starts with: {OPENAI_API_KEY[:10]}...)")
else:
    logging.error("❌ OPENAI_API_KEY not found in environment")

DEFAULT_OPENAI_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logging.info(f"✅ Supabase client initialized with URL: {SUPABASE_URL}")
        logging.info(f"✅ Using API key: {SUPABASE_KEY[:20]}...")
    except Exception as e:
        logging.error(f"❌ Failed to initialize Supabase: {e}")
        supabase = None
else:
    logging.warning("⚠️ Supabase credentials not configured")
    logging.warning(f"SUPABASE_URL present: {bool(SUPABASE_URL)}")
    logging.warning(f"SUPABASE_KEY present: {bool(SUPABASE_KEY)}")

# Load Gemini key
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-2.0-flash")
    logging.info("✅ Gemini configured")
else:
    logging.error("❌ GOOGLE_API_KEY not found")


app = FastAPI()

# CORS – allow both React apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Agent Builder
        "http://localhost:3001",      # Chat Interface
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ------------ Request models ------------ #

class AgentBuilderReq(BaseModel):
    agentName: str
    agentDesc: str
    agentPrompt: str
    formality: int
    creativity: int
    toggles: Dict[str, bool]
    modelPick: str

class ModelResearchReq(BaseModel):
    prompt: str
    streaming: bool = False
    provider: Optional[str] = None

class ResearchPlanReq(BaseModel):
    prompt: str
    streaming: bool = False

class ExperimentDesignReq(BaseModel):
    user_input: str
    stream: bool = False

class ExperimentalistReq(BaseModel):
    prompt: str
    experimental_results: Dict[str, Any] = {}
    file_path: Optional[str] = None
    streaming: bool = False

class WritePaperReq(BaseModel):
    query: str
    data: Dict[str, Any] = {}
    streaming: bool = False


# ------------ Health check ------------ #

@app.get("/api/health")
def health():
    return {"ok": True, "message": "AERO backend running"}


# ------------ Model Researcher ------------ #

def _mock_research_response(prompt: str, provider: Optional[str], detail: Optional[str] = None) -> Dict[str, Any]:
    preview_provider = provider or "your default model"
    clipped = prompt.strip().splitlines()[:3]
    condensed_prompt = " ".join(clipped)
    return {
        "ok": True,
        "data": {
            "summary": f"(Preview) [{preview_provider}] {condensed_prompt[:220]}...",
            "provider": preview_provider,
            **({"detail": detail} if detail else {}),
        },
    }


# --- Simple throttle (one call every 4s) + 60s response cache ---
_OPENAI_LOCK = asyncio.Lock()
_last_openai_call = 0.0
_RATE_WINDOW_SEC = 4.0
_RESP_CACHE: Dict[Tuple[str, str], Tuple[float, str]] = {}  # key=(provider,prompt), value=(ts, text)
_RESP_TTL = 60.0

def _cache_get(provider: str, prompt: str) -> Optional[str]:
    key = (provider, prompt.strip()[:1000])
    hit = _RESP_CACHE.get(key)
    if not hit:
        return None
    ts, text = hit
    if time.monotonic() - ts > _RESP_TTL:
        _RESP_CACHE.pop(key, None)
        return None
    return text

def _cache_set(provider: str, prompt: str, text: str) -> None:
    key = (provider, prompt.strip()[:1000])
    _RESP_CACHE[key] = (time.monotonic(), text)

async def _respect_openai_rl():
    global _last_openai_call
    async with _OPENAI_LOCK:
        now = time.monotonic()
        wait = _RATE_WINDOW_SEC - (now - _last_openai_call)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_openai_call = time.monotonic()


async def _post_json(url: str, headers: Optional[Dict[str, str]] = None, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """POST request with retry logic for rate limiting."""
    def _send():
        max_retries = 5
        for attempt in range(max_retries):
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=45)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.HTTPError as e:
                if getattr(e.response, "status_code", 0) == 429:
                    wait_time = (2 ** attempt) + random.uniform(0, 1.5)
                    logger.warning(f"Rate limited! Waiting {wait_time:.1f}s before retry {attempt + 1}/{max_retries}")
                    time.sleep(wait_time)
                    if attempt == max_retries - 1:
                        logger.error("All retries exhausted.")
                        raise
                else:
                    raise
    return await asyncio.to_thread(_send)


def _format_provider_response(provider: str, summary: str, raw: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": True, "data": {"summary": summary, "provider": provider, "raw": raw}}


async def _call_openai(prompt: str) -> Dict[str, Any]:
    cached = _cache_get("openai", prompt)
    if cached:
        return _format_provider_response("openai", cached, {"cached": True})

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "Be concise."},
            {"role": "user", "content": prompt[:600]}
        ],
        "temperature": 0.6,
        "max_tokens": 256,
    }
    
    # Add debug logging before the request
    logging.debug(f"Using API key: {OPENAI_API_KEY[:15]}...{OPENAI_API_KEY[-4:]}")
    logging.debug(f"Authorization header: Bearer {OPENAI_API_KEY.strip()[:15]}...")
    
    try:
        await _respect_openai_rl()
        data = await _post_json("https://api.openai.com/v1/chat/completions", headers, payload)
        message = data.get("choices", [{}])[0].get("message", {}).get("content", "") or "No response."
        _cache_set("openai", prompt, message)
        return _format_provider_response("openai", message, data)
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        # graceful text instead of crashing chat
        return _format_provider_response("openai", "I'm at capacity right now. Please try again in a few seconds.", {"rate_limited": True})


async def _call_gemini(prompt: str) -> Dict[str, Any]:
    cached = _cache_get("gemini", prompt)
    if cached:
        return _format_provider_response("gemini", cached, {"cached": True})

    try:
        await _respect_openai_rl()
        response = gemini_model.generate_content(prompt)
        message = response.text or "No response."
        _cache_set("gemini", prompt, message)
        return _format_provider_response("gemini", message, {"gemini_response": True})
    except Exception as e:
        logging.error(f"❌ Gemini error: {e}")
        return _format_provider_response("gemini", "I'm at capacity right now. Please try again in a few seconds.", {"rate_limited": True})


async def _call_tavily(prompt: str) -> Dict[str, Any]:
    """Tavily fallback to OpenAI."""
    logger.warning("Tavily API unavailable, using OpenAI")
    result = await _call_openai(prompt)
    # Keep tavily in the response so frontend shows "tavily"
    result["provider"] = "tavily"
    return result


async def call_selected_provider(provider: str, prompt: str):
    """Call the selected AI provider (with fallbacks)."""
    
    if provider == "gemini":
        return await _call_gemini(prompt)
    
    elif provider == "openai":
        return await _call_openai(prompt)
    
    elif provider == "tavily":
        return await _call_tavily(prompt)
    
    else:
        return await _call_openai(prompt)


@app.post("/api/model-research")
async def model_research(req: ModelResearchReq):
    """Generate model suggestions based on prompt."""
    try:
        provider = req.provider or "openai"
        
        # Try to call the selected provider
        result = await call_selected_provider(provider, req.prompt)
        return result
        
    except Exception as e:
        logger.exception("Model research failed")
        # Return a fallback response instead of crashing
        return {
            "ok": True,
            "data": {
                "summary": f"Error calling {req.provider or 'model'}: {str(e)}",
                "provider": req.provider or "openai"
            }
        }


# ------------ Research Planner ------------ #

@app.post("/api/research-plan")
async def research_plan(req: ResearchPlanReq):
    """Generate a structured research plan."""
    try:
        if req.streaming:
            async def generate():
                async for update in await plan_research(
                    prompt=req.prompt,
                    streaming=True,
                ):
                    yield json.dumps(update) + "\n"

            return StreamingResponse(generate(), media_type="application/x-ndjson")
        else:
            result = await plan_research(prompt=req.prompt, streaming=False)
            return {"ok": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------ Experiment Designer ------------ #

@app.post("/api/experiment-design")
async def experiment_design(req: ExperimentDesignReq):
    """Generate experiment designs from a research plan."""
    if run_experiment_designer is None:
        raise HTTPException(
            status_code=500,
            detail="Experiment designer module not available.",
        )

    try:
        if req.stream:
            async def generate():
                async for update in await run_experiment_designer(
                    req.user_input, stream=True
                ):
                    yield json.dumps(update) + "\n"

            return StreamingResponse(generate(), media_type="application/x-ndjson")
        else:
            # non-streaming API in docs
            result = run_experiment_designer(req.user_input)
            return {"ok": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------ Experimentalist ------------ #

@app.post("/api/experiment-suggestions")
async def experimentalist(req: ExperimentalistReq):
    """Analyze results and suggest follow-up experiments."""
    try:
        if req.streaming:
            async def generate():
                async for update in await experiment_suggestions(
                    prompt=req.prompt,
                    experimental_results=req.experimental_results,
                    file_path=req.file_path,
                    streaming=True,
                ):
                    yield json.dumps(update) + "\n"

            return StreamingResponse(generate(), media_type="application/x-ndjson")
        else:
            result = await experiment_suggestions(
                prompt=req.prompt,
                experimental_results=req.experimental_results,
                file_path=req.file_path,
            )
            return {"ok": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------ Report Writer ------------ #

@app.post("/api/write-paper")
async def write_paper_endpoint(req: WritePaperReq):
    """Generate an academic paper from research data."""
    try:
        result = await write_paper(
            user_query=req.query,
            experimental_data=req.data,
            streaming=req.streaming,
        )
        return {"ok": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------ Build Agent from UI ------------ #

import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.post("/api/build-agent")
async def build_agent(req: AgentBuilderReq):
    """Build an AI agent from frontend form data and save to Supabase."""
    
    logger.info(f"Build agent request: {req.dict()}")
    
    prompt = f"""
    Create an ML research agent with:
    - Name: {req.agentName}
    - Description: {req.agentDesc}
    - System prompt: {req.agentPrompt}
    - Formality level: {req.formality}/100
    - Creativity level: {req.creativity}/100
    - Enabled tools: {req.toggles}
    - Model: {req.modelPick}
    """

    research_plan_raw = None
    if ENABLE_RESEARCH_PIPELINE:
        try:
            research_plan_raw = await plan_research(prompt=prompt, streaming=False)
        except Exception as e:
            logging.exception("Research plan generation failed")
            research_plan_raw = {"error": str(e)}
    else:
        research_plan_raw = {
            "ok": True,
            "mode": "mock",
            "summary": "Research pipeline disabled in this environment.",
        }

    # Extract only serializable data
    def extract_serializable(obj):
        """Recursively extract only JSON-serializable data."""
        if isinstance(obj, dict):
            return {k: extract_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [extract_serializable(item) for item in obj]
        elif isinstance(obj, (str, int, float, bool, type(None))):
            return obj
        else:
            return str(obj)

    research_plan_serialized = extract_serializable(research_plan_raw)

    # Save agent to Supabase
    agent_data = {
        "name": req.agentName,
        "description": req.agentDesc,
        "system_prompt": req.agentPrompt,
        "formality": req.formality,
        "creativity": req.creativity,
        "model": req.modelPick,
        "tools": req.toggles,
        "research_plan": json.dumps(research_plan_serialized) if research_plan_serialized else None,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    logger.info(f"Agent data to save: {agent_data}")

    agent_id = None
    if supabase:
        try:
            logger.info("Attempting to save to Supabase...")
            response = supabase.table("agentdetails").insert(agent_data).execute()  # Changed from agents
            logger.info(f"Supabase response: {response}")
            
            if response.data:
                agent_id = response.data[0]["id"]
                logger.info(f"✅ Agent saved with ID: {agent_id}")
            else:
                logger.warning("❌ Agent insert returned no data")
        except Exception as e:
            logger.exception(f"❌ Failed to save agent: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save agent: {str(e)}")
    else:
        logger.warning("⚠️ Supabase not configured")

    return {
        "ok": True,
        "agent_id": agent_id,
        "agent": req.dict(),
        "research_plan": research_plan_serialized,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=AERO_HOST, port=AERO_PORT)
