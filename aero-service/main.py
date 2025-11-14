import os
import json
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from aero.model_researcher import suggest_models
from aero.research_planner import plan_research
from aero.experimentalist import experiment_suggestions
from aero.report_writer import write_paper

# Experiment designer (optional)
try:
    from design_experiment import run_experiment_designer
except Exception:
    run_experiment_designer = None

load_dotenv()

app = FastAPI()

# CORS – allow your React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
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

@app.post("/api/model-research")
async def model_research(req: ModelResearchReq):
    """Recommend ML models for a given task."""
    try:
        if req.streaming:
            async def generate():
                # docs: async for update in await suggest_models(..., streaming=True)
                async for update in await suggest_models(
                    prompt=req.prompt,
                    streaming=True,
                ):
                    yield json.dumps(update) + "\n"

            return StreamingResponse(generate(), media_type="application/x-ndjson")
        else:
            result = await suggest_models(prompt=req.prompt, streaming=False)
            return {"ok": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

@app.post("/api/build-agent")
async def build_agent(req: AgentBuilderReq):
    """Build an AI agent from frontend form data."""
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

    try:
        research_plan = await plan_research(prompt=prompt, streaming=False)
        return {"ok": True, "agent": req.dict(), "research_plan": research_plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
