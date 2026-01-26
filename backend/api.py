from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import os
import sys
import json

# ensure path to your logic.py is importable
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src1", "src"))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# imports logic.py from c:\Users\legen\Downloads\src1\src\logic.py
from logic import Symbol, Not, And, Or, Implication, Biconditional, model_check  # noqa: E402

app = Flask(__name__)
CORS(app)

# simple agent registry (replace later with Agent Builder output)
AGENTS = [
    {"id": "ba", "badge": "BA", "name": "Business Analyst", "desc": "Financial reports and analysis", "capabilities": ["Forecasting", "Financial"]},
    {"id": "ra", "badge": "RA", "name": "Research Assistant", "desc": "Academic Research and Support", "capabilities": ["Search", "Summarise"]},
    {"id": "cm", "badge": "CM", "name": "Code Mentor", "desc": "Programming Help and Debugging", "capabilities": ["Code Review", "Debugging"]},
]

CANNED = {
    "ba": ["I can help with forecasting and financial analysis. Provide data or ask a question."],
    "ra": ["I can summarise literature and gather references."],
    "cm": ["Share your code and error messages and I'll help debug."],
    "default": ["I'm online and ready."]
}


@app.route("/api/agents", methods=["GET"])
def get_agents():
    return jsonify({"agents": AGENTS})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    agent_id = data.get("agentId", "default")
    message = data.get("message", "")

    # special command: /eval <json> to evaluate logical entailment via logic.py
    if message.strip().startswith("/eval"):
        try:
            payload = json.loads(message.strip()[5:].strip())
            result = evaluate_payload(payload)
            return jsonify({"reply": f"Evaluation result: {result}"}), 200
        except Exception as e:
            return jsonify({"reply": f"Eval error: {e}"}), 400

    reply = random.choice(CANNED.get(agent_id, CANNED["default"]))
    return jsonify({"reply": reply})


def build_sentence(obj):
    t = obj.get("type")
    if t == "symbol":
        return Symbol(obj["name"])
    if t == "not":
        return Not(build_sentence(obj["operand"]))
    if t == "and":
        return And(*[build_sentence(o) for o in obj.get("operands", [])])
    if t == "or":
        return Or(*[build_sentence(o) for o in obj.get("operands", [])])
    if t == "implies":
        return Implication(build_sentence(obj["antecedent"]), build_sentence(obj["consequent"]))
    if t == "biconditional":
        return Biconditional(build_sentence(obj["left"]), build_sentence(obj["right"]))
    raise ValueError(f"unknown sentence type: {t}")


def evaluate_payload(payload):
    if "knowledge" not in payload or "query" not in payload:
        raise ValueError("payload must include 'knowledge' and 'query'")
    kb = build_sentence(payload["knowledge"])
    q = build_sentence(payload["query"])
    entailed = model_check(kb, q)
    return {"entailed": bool(entailed)}


@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    try:
        payload = request.get_json() or {}
        result = evaluate_payload(payload)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(port=5001, debug=True)