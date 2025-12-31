"""
Test script to verify OpenAI API access and list available models
"""

import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("❌ OPENAI_API_KEY not found in .env file")
    exit(1)

print(f"✓ API Key found: {api_key[:20]}...")

# Initialize OpenAI client
client = OpenAI(api_key=api_key)

print("\n📋 Available OpenAI models:")
try:
    models = client.models.list()
    
    # Filter for GPT models (most relevant)
    gpt_models = []
    all_models = []
    
    for model in models.data:
        all_models.append(model.id)
        if any(prefix in model.id.lower() for prefix in ['gpt', 'o1', 'o3']):
            gpt_models.append(model.id)
    
    print("\n🤖 GPT Models (recommended):")
    for model in sorted(gpt_models):
        print(f"  ✓ {model}")
    
    print(f"\n📊 Total models available: {len(all_models)}")
    print("\n💡 To see all models, uncomment the code below")
    
    # Uncomment to see ALL models
    # print("\n📋 All Available Models:")
    # for model in sorted(all_models):
    #     print(f"  • {model}")
    
except Exception as e:
    print(f"❌ Error listing models: {e}")
    print("\n⚠️  Please check:")
    print("1. Your API key is valid")
    print("2. You have an active OpenAI account with credits")
    print("3. Your API key has permission to list models")
    exit(1)

print("\n🧪 Testing a simple prompt with GPT-3.5-turbo...")
try:
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Say hello in one word"}
        ],
        max_tokens=10
    )
    print(f"✓ Success! Response: {response.choices[0].message.content}")
    print(f"  Model used: {response.model}")
    print(f"  Tokens used: {response.usage.total_tokens}")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n🧪 Testing with GPT-4o (if available)...")
try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Say hello in one word"}
        ],
        max_tokens=10
    )
    print(f"✓ Success! Response: {response.choices[0].message.content}")
    print(f"  Model used: {response.model}")
    print(f"  Tokens used: {response.usage.total_tokens}")
except Exception as e:
    print(f"❌ Error with gpt-4o: {e}")
    print("  💡 Try gpt-4 or gpt-3.5-turbo instead")

print("\n✨ Recommended models for your agent:")
print("  • gpt-4o - Latest and most capable (if available)")
print("  • gpt-4-turbo - Fast and capable")
print("  • gpt-4 - High quality")
print("  • gpt-3.5-turbo - Fast and cost-effective")
