"""
Test script to verify Gemini API access and list available models
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("❌ GOOGLE_API_KEY not found in .env file")
    exit(1)

print(f"✓ API Key found: {api_key[:20]}...")

# Configure the API
genai.configure(api_key=api_key)

print("\n📋 Available Gemini models:")
try:
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"  ✓ {model.name}")
except Exception as e:
    print(f"❌ Error listing models: {e}")
    print("\n⚠️  Please check:")
    print("1. Your API key is valid")
    print("2. You've enabled the Gemini API at: https://aistudio.google.com/app/apikey")
    exit(1)

print("\n🧪 Testing with correct model name...")
try:
    model = genai.GenerativeModel('models/gemini-2.5-flash')  # Updated model name
    response = model.generate_content("Say hello!")
    print(f"✓ Success! Response: {response.text}")
except Exception as e:
    print(f"❌ Error: {e}")
