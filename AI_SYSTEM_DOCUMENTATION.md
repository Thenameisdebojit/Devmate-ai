# DevMate v2.0 - Multi-Model AI System Documentation

## Overview

DevMate now features an intelligent hybrid AI system that automatically selects between **OpenAI GPT** and **Google Gemini 2.5 Pro** models based on the task type, with automatic failover capabilities for maximum reliability.

## System Architecture

### Supported Models

1. **OpenAI GPT-5** (Primary for code generation)
   - Advanced code generation and debugging
   - Multi-file application development
   - Complex programming tasks

2. **OpenAI GPT-4o** (Alternative GPT model)
   - Configurable via `PREFERRED_GPT_MODEL` environment variable
   - Falls back when GPT-5 is unavailable

3. **Google Gemini 2.5 Pro** (Primary for reasoning)
   - Reasoning and factual queries
   - Summarization and analysis
   - Explanations and comparisons

4. **Google Gemini 2.5 Flash** (Fast alternative)
   - Available for quick responses

## Intelligent Model Selection

The system automatically chooses the best model based on:

### Code Generation Tasks → GPT Models
- Keywords: `code`, `build`, `create`, `generate`, `implement`, `function`, `class`, `backend`, `frontend`, `api`, `database`, `app`, `application`, `website`, `program`
- Actions: `generate`, `rewrite`, `fix`
- **Web Development domain ALWAYS uses GPT**

### Reasoning/Explanation Tasks → Gemini 2.5 Pro
- Keywords: `explain`, `analyze`, `summarize`, `what is`, `how does`, `why`, `describe`, `compare`
- Action: `explain`

### Example Selection Logic

```javascript
// Code generation → GPT
"Build a React component" → openai:gpt-5

// Web development → GPT
domain: "web development" → openai:gpt-5

// Reasoning → Gemini
"Explain how neural networks work" → google:gemini-2.5-pro

// Summarization → Gemini
"Summarize this article" → google:gemini-2.5-pro
```

## Automatic Failover System

The system includes multi-level failover protection:

### Failover Chain

1. **Primary GPT-5 fails:**
   - Try GPT-4o
   - Then try Gemini 2.5 Pro

2. **Primary GPT-4o fails:**
   - Try GPT-5
   - Then try Gemini 2.5 Pro

3. **Primary Gemini fails:**
   - Try preferred GPT model (GPT-5 or GPT-4o)

### Benefits
- ✓ **Zero downtime** - automatic model switching
- ✓ **Best performance** - always tries optimal model first
- ✓ **Reliability** - multiple fallback options
- ✓ **Smart selection** - task-appropriate model choices

## API Usage

### Direct API Endpoint: `/api/ai`

**Non-streaming request:**
```bash
curl -X POST http://localhost:5000/api/ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2+2?",
    "domain": "general"
  }'

# Response:
{
  "text": "2 + 2 = 4",
  "modelUsed": "google:gemini-2.5-pro"
}
```

**Code generation request:**
```bash
curl -X POST http://localhost:5000/api/ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a Python function to calculate fibonacci",
    "domain": "web development"
  }'

# Response:
{
  "text": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
  "modelUsed": "openai:gpt-5"
}
```

**Streaming request:**
```bash
curl -X POST http://localhost:5000/api/ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain recursion",
    "stream": true
  }'

# Response (Server-Sent Events):
data: {"modelUsed":"google:gemini-2.5-pro"}
data: {"text":"Recursion is a programming technique..."}
data: [DONE]
```

### Chat Endpoint: `/api/chat`

The chat endpoint uses the same intelligent routing system with additional features:
- Chat history context
- File upload support
- Multiple actions: `generate`, `explain`, `rewrite`, `fix`

## Configuration

### Environment Variables

```bash
# Required API Keys
OPENAI_API_KEY=sk-...        # OpenAI API key
GEMINI_API_KEY=...            # Google Gemini API key

# Optional Configuration
PREFERRED_GPT_MODEL=gpt-4o    # Set to 'gpt-4o' to prefer GPT-4o over GPT-5
                              # Default: gpt-5
```

### Model Preference

To use GPT-4o as the default GPT model instead of GPT-5:
```bash
PREFERRED_GPT_MODEL=gpt-4o
```

## Testing Results

### ✓ Model Selection Tests
- Reasoning task → Correctly selected Gemini 2.5 Pro
- Code generation task → Correctly selected GPT-5
- Web development domain → Correctly selected GPT-5

### ✓ Failover Tests
- Primary model quota exceeded → Failover activated
- Multiple fallback attempts → Executed in correct order

## System Status

### ✅ MULTI-MODEL DEV AGENT + AUTO FAILOVER (GPT → GEMINI 2.5 PRO) FULLY OPERATIONAL

**Confirmed capabilities:**
- ✓ Both OpenAI GPT and Google Gemini models active
- ✓ Intelligent task-based model selection working
- ✓ Automatic failover mechanism operational
- ✓ GPT-4o support added alongside GPT-5
- ✓ Streaming and non-streaming modes supported
- ✓ API endpoints fully functional

## Implementation Details

The multi-model system is implemented in `lib/aiOrchestrator.ts` with:
- `chooseModel()` - Intelligent model selection based on prompt analysis
- `callAIModel()` - Direct model invocation
- `callAIModelWithFailover()` - Non-streaming with automatic failover
- `streamAIModelWithFailover()` - Streaming with automatic failover

All API routes (`/api/ai`, `/api/chat`) automatically benefit from this hybrid system.
