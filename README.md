# 🚀 Fortellar AI Support Orchestration Platform

An AI-powered customer support assistant designed for Fortellar services, solutions, and offerings.

This application uses **Azure OpenAI (GPT-4o-mini)** to provide intelligent, context-aware responses based on Fortellar-specific knowledge such as CloudOps, Security & Compliance, HIPAA, and Disaster Recovery.

This system acts as an intelligent orchestration layer between users and enterprise support systems, not just a chatbot.

---

## 🏗️ High-Level Architecture

User → UI (Web / Chat)
↓
AI Orchestrator (Azure OpenAI)
↓
Decision Engine (routing + priority)
↓
Knowledge Base (RAG)
↓
Provider Layer
↓
Jira / ServiceNow / Zendesk (future)

# 🚀 Features

💬 AI-powered conversational support (Azure OpenAI / GPT-4o-mini)

🧠 Intelligent decision engine
- Determines whether to troubleshoot or escalate
- Assigns priority dynamically
- Detects urgency and user intent

🔍 Guided troubleshooting workflow
- Prevents unnecessary ticket creation
- Asks contextual follow-up questions

🎫 Automated ticket creation (Jira-ready)
- Structured ticket generation
- Priority + routing logic
- Returns ticket confirmation UI

🧾 Structured AI response contract
- JSON-based responses for deterministic UI rendering
- Enables advanced workflows (routing, escalation, UI cards)

🖥️ Smart Ticket Confirmation UI
- Displays ticket ID, routing, and priority
- Styled “Open Jira Ticket” button
- Clean, structured output (not raw AI text)

🧭 Intelligent routing
- IAM / CloudOps / Network-based routing logic
- Easily extendable to ServiceNow, Zendesk, etc.

🧑‍💻 Human escalation trigger
- “Talk to a human” button
- Emits event for live support / Teams / PagerDuty

🖼️ Screenshot attachment support
- Base64 upload handling
- Included in ticket metadata

⚡ Suggested questions for faster interaction

🧪 Mock support mode (full workflow simulation without API)

---

## 🧠 Knowledge Areas Included

- CloudOps & Infrastructure  
- Security & Compliance  
- HIPAA Readiness  
- Disaster Recovery & Incident Management  
- Case Studies  
- FAQs  

All knowledge is stored locally in:
/data/fortellar/


You can easily extend it by adding more `.md` files.

---

## 🛠️ Getting Started

### 1. Clone the repository
```md
```bash
git clone https://github.com/MRahimberganov/fortellar-customer-support-agent.git
cd fortellar-customer-support-agent

### 2. Install dependencies
npm install --legacy-peer-deps

### 3. Set up environment variables
Create a .env.local file in the root:

Option A — Azure OpenAI (Recommended)
OPENAI_API_KEY=your_azure_openai_key_here
MOCK_SUPPORT_AGENT=false
⚠️ Requires valid API access

Option B — Mock Mode (Demo / No API)
MOCK_SUPPORT_AGENT=true
✅ No API key required
✅ No billing required
✅ Simulates full support + ticket workflow

### 4. Run the app
npm run dev

Then open:

http://localhost:3000
🧪 Testing
Basic Troubleshooting

Try:

“My password doesn’t work”
“I can’t access VPN”

Unresolved Issue → Ticket Flow

Try:

“I already tried everything and it still doesn’t work”
“Please create a ticket”

End-to-End Example

I can't access VPN  
I already tried reconnecting and restarting but it still doesn't work  
The error says connection timeout  
My name is Mahmud, email is mahmud@test.com  
This is happening in VPN in production  
I attached a screenshot  
Please create a ticket

Expected Behavior
Starts with troubleshooting
Switches to ticket intake when unresolved
Collects required fields
Builds structured ticket payload
Simulates ticket creation
🕒 After-Hours Support Behavior

The agent detects Eastern Time (EST) and adjusts behavior:

Business Hours: prioritizes troubleshooting
After Hours (5 PM – 9 AM EST): prioritizes escalation and ticket creation

This ensures issues are captured when live support is unavailable.

🎫 Ticket Workflow

When an issue cannot be resolved, the agent:

Collects required information:
Contact name, email, phone
Error condition and description
Affected system and environment
Validates required fields
Generates a structured ticket draft
Creates structured ticket payloads compatible with Jira API

Includes:
- Summary
- Description (ADF-ready)
- Priority mapping
- Routing (assignment group)
- Metadata (user, environment, attachments)

Returns:
- Ticket ID
- Ticket link
- Routing information
- Priority (highlighted in UI)

🖼️ Screenshot Support

Users can attach a screenshot via the UI.

Current behavior:

Captures file name and type
Marks attachment in ticket metadata

⚠️ File upload storage is not yet implemented (metadata only)

📦 Project Structure
fortellar-customer-support-agent/
├── data/fortellar/     # Knowledge base (.md files)
├── app/                # Next.js app (routes + API)
├── components/         # UI components
├── public/             # Static assets
├── .env.local          # Environment variables (not committed)

🔧 How It Works
AI Mode
Uses Azure OpenAI (GPT-4o-mini)
Retrieves context from local markdown knowledge base (RAG)
Generates structured support responses
Mock Mode
Bypasses AI entirely
Simulates realistic support behavior

Includes:

troubleshooting steps
follow-up questions
escalation
ticket creation
⚠️ Demo Status

This is an actively evolving prototype with production-oriented architecture.

Current limitations:
- Jira integration is partially mocked
- Screenshot uploads are metadata-only

The system is designed to be extended into a full production support platform.

Jira integration is mocked
Screenshot uploads are metadata-only
Designed for internal testing and iteration

📈 Future Enhancements

🔌 Multi-provider support (Jira, ServiceNow, Zendesk)
📡 Microsoft Teams / Slack integration (alerts, escalation)
📊 Analytics (ticket trends, deflection rate, resolution time)
🧠 Advanced intent classification & routing
🖼️ File storage (S3 or blob storage for attachments)
👨‍💻 Live agent handoff integration
🏢 Multi-tenant / multi-client configuration
🔐 Authentication & role-based access
🎯 SLA-based prioritization & incident workflows

🧠 AI Response Architecture (Important)

The system uses a structured JSON response format instead of plain text.

Example:

{
  "response": "...",
  "thinking": "...",
  "user_mood": "...",
  "suggested_questions": [],
  "redirect_to_agent": {
    "should_redirect": false,
    "reason": ""
  },
  "debug": {
    "context_used": true
  }
}

Why this matters:
- Enables dynamic UI rendering (ticket cards, buttons)
- Prevents frontend parsing errors
- Allows workflow automation (routing, escalation)
- Makes AI behavior predictable in production systems

👤 Author

Mahmud Rahimberganov
Senior Cloud Engineer

💡 Pro Tip for Teammates

If the app “doesn’t respond,” it’s likely due to API or billing.

👉 Just enable:

MOCK_SUPPORT_AGENT=true

and everything will work instantly.