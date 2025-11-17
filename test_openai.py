import google.generativeai as genai

genai.configure(api_key="AIzaSyDgqotz8sh2RtEdSCgCadd-SE-_HwHp6R4")

try:
    model = genai.GenerativeModel("gemini-2.0-flash")  # Changed from gemini-1.5-flash
    response = model.generate_content("Write a haiku about AI")
    print("✅ Gemini works:", response.text)
except Exception as e:
    print(f"❌ Error: {e}")