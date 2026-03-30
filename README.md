# Fortellar Customer Support AI Agent

An AI-powered customer support assistant designed for Fortellar services, solutions, and offerings.

This application uses Claude to provide intelligent, context-aware responses based on Fortellar-specific knowledge such as CloudOps, Security & Compliance, HIPAA, and Disaster Recovery.

---

## 🚀 Features

- 💬 Chat-based AI assistant (Claude-powered)
- 📚 Custom knowledge base using markdown files
- 🧠 Context-aware responses (RAG-style)
- ⚡ Suggested questions for quick interaction
- 🎯 Tailored to Fortellar services and messaging

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
cd customer-support-agent
### 2. Install dependencies
npm install

### 3. Set up environment variables

Create a .env.local file:
ANTHROPIC_API_KEY=your_api_key_here

### 4. Run the app
npm run dev

Then open:
http://localhost:300

💡 Example Questions
What does Fortellar do?
How do you support HIPAA compliance?
What are your CloudOps services?
Do you offer disaster recovery solutions?

📦 Project Structure
customer-support-agent/
├── data/fortellar/     # Knowledge base (.md files)
├── app/                # Next.js app
├── components/         # UI components
├── public/             # Assets
├── .env.local          # API key (not committed)

🔒 Notes
This project requires an Anthropic API key
.env.local is ignored by git for security
Designed for internal demo and extensibility

📈 Future Enhancements
Analytics (track user questions)
Escalation to human support
Multi-knowledge-base support
Integration with Fortellar backend systems

👤 Author
Mahmud Rahimberganov
Senior Cloud Engineer