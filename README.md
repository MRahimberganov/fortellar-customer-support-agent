Fortellar Customer Support AI Agent

An AI-powered customer support assistant designed for Fortellar services, solutions, and offerings.

This application uses Claude (Anthropic) to provide intelligent, context-aware responses based on Fortellar-specific knowledge such as CloudOps, Security & Compliance, HIPAA, and Disaster Recovery.

🚀 Features
💬 Chat-based AI assistant (Claude-powered)
📚 Custom knowledge base using markdown files
🧠 Context-aware responses (RAG-style)
⚡ Suggested questions for quick interaction
🎯 Tailored to Fortellar services and messaging
🧪 Mock support mode (no API required for testing)

🧠 Knowledge Areas Included
CloudOps & Infrastructure
Security & Compliance
HIPAA Readiness
Disaster Recovery & Incident Management
Case Studies
FAQs

All knowledge is stored locally in:

/data/fortellar/

You can easily extend it by adding more .md files.

🛠️ Getting Started

1. Clone the repository
git clone https://github.com/MRahimberganov/fortellar-customer-support-agent.git
cd fortellar-customer-support-agent

2. Install dependencies
npm install

3. Set up environment variables
Create a .env.local file in the root:

Option A — Real AI (Claude)
ANTHROPIC_API_KEY=your_api_key_here
⚠️ Requires valid billing/credits.

Option B — Mock Mode (Recommended for testing/demo)
MOCK_SUPPORT_AGENT=true
✅ No API key required
✅ No billing required
✅ Simulates realistic support behavior

4. Run the app
npm run dev

Then open:
http://localhost:3000
🧪 Testing (Mock Mode)
If MOCK_SUPPORT_AGENT=true, you can test full support flows without AI.
Try these example messages:

🔐 Password / Login Issue
My password doesn't work
🔄 Unresolved Issue → Ticket Flow
still not working
🌐 VPN Issue
I can't access VPN
What you’ll see
Guided troubleshooting steps
Follow-up questions
Simulated escalation
Mock Jira ticket creation (e.g., SUP-123)

📦 Project Structure

fortellar-customer-support-agent/
├── data/fortellar/     # Knowledge base (.md files)
├── app/                # Next.js app (routes + API)
├── components/         # UI components
├── public/             # Static assets
├── .env.local          # Environment variables (not committed)

🔧 How It Works

AI Mode
Uses Claude API
Performs RAG (retrieval from markdown files)
Generates contextual responses
Mock Mode
Bypasses Claude API entirely
Returns structured support responses based on user input
Simulates:
troubleshooting
follow-ups
escalation
Jira ticket creation

🔒 Notes

.env.local is ignored by git (keep secrets safe)
Anthropic API key is required only for real AI mode
Mock mode is intended for:
demos
development
UI testing
backend workflow validation

📈 Future Enhancements
📊 Analytics (track user questions)
🎫 Real Jira integration
👨‍💻 Escalation to human support
📚 Multi-knowledge-base support
🧠 Smarter intent classification
🔐 Role-based access / auth
🎨 UI polish (animations, mobile optimization)

👤 Author
Mahmud Rahimberganov
Senior Cloud Engineer

💡 Pro Tip for Teammates

If the app “doesn’t respond,” it’s likely due to API/billing.

👉 Just enable:

MOCK_SUPPORT_AGENT=true

and everything will work instantly.