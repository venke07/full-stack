import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

from aero.model_researcher import suggest_models
from aero.research_planner import plan_research
from aero.experimentalist import experiment_suggestions
from aero.report_writer import write_paper

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
DEFAULT_OPENAI_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")  # Changed from SUPABASE_KEY

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logging.info("✅ Supabase client initialized")
else:
    logging.warning("⚠️ Supabase credentials not configured")

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


async def _post_json(url: str, headers: Optional[Dict[str, str]] = None, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    def _send():
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()

    return await asyncio.to_thread(_send)


def _format_provider_response(provider: str, summary: str, raw: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": True, "data": {"summary": summary, "provider": provider, "raw": raw}}


async def _call_openai(prompt: str) -> Dict[str, Any]:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured.")
    payload = {
        "model": DEFAULT_OPENAI_MODEL or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful AI agent builder assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    data = await _post_json("https://api.openai.com/v1/chat/completions", headers, payload)
    summary = data["choices"][0]["message"]["content"].strip()
    return _format_provider_response("openai", summary, data)


async def _call_gemini(prompt: str) -> Dict[str, Any]:
    if not GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not configured.")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
    }
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={GOOGLE_API_KEY}"
    data = await _post_json(url, payload=payload)
    candidates = data.get("candidates") or []
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    summary = parts[0].get("text", "Gemini did not return any content.") if parts else "Gemini did not return any content."
    return _format_provider_response("gemini", summary, data)


async def _call_tavily(prompt: str) -> Dict[str, Any]:
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY is not configured.")
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": prompt,
        "search_depth": "advanced",
    }
    data = await _post_json("https://api.tavily.com/search", payload=payload)
    summary = data.get("answer") or "No answer generated by Tavily."
    return _format_provider_response("tavily", summary, data)


async def call_selected_provider(provider: str, prompt: str):
    """Call the selected AI provider."""
    
    if provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        
        # Use the correct model name for generateContent
        model = genai.GenerativeModel("gemini-1.5-pro")  # Changed to gemini-1.5-pro
        response = model.generate_content(prompt)
        
        return {
            "ok": True,
            "data": {
                "summary": response.text,
                "provider": "gemini",
            }
        }
    
    elif provider == "openai":
        return await _call_openai(prompt)
    
    elif provider == "tavily":
        return await _call_tavily(prompt)
    
    raise ValueError(f"Unsupported provider '{provider}'.")


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
            response = supabase.table("agentdetails").insert(agent_data).execute()  # Changed from "agents" to "agentdetails"
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
