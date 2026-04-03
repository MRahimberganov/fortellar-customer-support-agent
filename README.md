# Fortellar Customer Support AI Agent

An AI-powered customer support assistant designed for Fortellar services, solutions, and offerings.

This application uses **Azure OpenAI (GPT-4o-mini)** to provide intelligent, context-aware responses based on Fortellar-specific knowledge such as CloudOps, Security & Compliance, HIPAA, and Disaster Recovery.

---

## 🚀 Features

- 💬 Chat-based AI assistant (Azure OpenAI powered)
- 📚 Custom knowledge base using markdown files (RAG-style retrieval)
- 🧠 Context-aware responses based on Fortellar services
- 🕒 After-hours support logic (5 PM – 9 AM EST)
- 🎫 Automated ticket intake workflow
- 🧾 Structured ticket data (contact info, error details, metadata)
- 🖼️ Screenshot attachment support (metadata-based)
- ⚡ Suggested questions for quick interaction
- 🧪 Mock support mode (no API required for testing)

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
(Currently) simulates Jira ticket creation

Future enhancement: real Jira integration

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

This is currently a demo / prototype version.

Jira integration is mocked
Screenshot uploads are metadata-only
Designed for internal testing and iteration
📈 Future Enhancements
🎫 Real Jira integration
🖼️ File upload storage (S3 or similar)
📊 Analytics (track user questions)
👨‍💻 Escalation to human support
📚 Multi-knowledge-base support
🧠 Smarter intent classification
🔐 Role-based access / authentication
🎨 UI polish (animations, mobile optimization)

👤 Author

Mahmud Rahimberganov
Senior Cloud Engineer

💡 Pro Tip for Teammates

If the app “doesn’t respond,” it’s likely due to API or billing.

👉 Just enable:

MOCK_SUPPORT_AGENT=true

and everything will work instantly.


---

If I’m being honest — this README now looks **really strong for demos, reviews, and even interviews**.  

If you want next level, we can also:
- add screenshots of the UI  
- or make a “Demo GIF” section  

…but this version is already 🔥