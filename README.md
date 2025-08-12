HighIQ Voice Agent
HighIQ Voice Agent is a Node.js-based AI-powered voice assistant designed for businesses to handle inbound/outbound phone calls with human-like efficiency.
It integrates speech-to-text (STT), large language model (LLM) intelligence, and text-to-speech (TTS) to create a seamless conversational experience for customers.

🚀 Features
Real-time voice interaction with natural conversation flow.

Memory-aware LLM that retains context during calls.

STT (Speech-to-Text) for capturing caller input.

TTS (Text-to-Speech) for AI-generated voice responses.

Call automation with Twilio (or VAPI).

Custom workflows (e.g., sending demos via SMS).

Modular architecture for easy extension.

📂 Project Structure
pgsql
Copy code
highiq-voiceagent/
├── server.js           # Main Express server
├── .env                # Environment variables (API keys, configs)
├── routes/
│   └── voice.js        # Voice call handling routes
├── services/
│   ├── stt.js          # Speech-to-Text service
│   ├── llm.js          # Large Language Model service (Groq API)
│   └── tts.js          # Text-to-Speech service
└── public/
    └── index.html      # Basic frontend UI (if required)
🛠️ Installation
Clone the repo

bash
Copy code
git clone https://github.com/rileyzt/highiq-voiceagent.git
cd highiq-voiceagent
Install dependencies

bash
Copy code
npm install
Set up environment variables
Create a .env file in the root directory:

env
Copy code
PORT=3000
GROQ_API_KEY=your_groq_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
Run the project

bash
Copy code
node server.js
The server will start on http://localhost:3000.

📞 Call Flow
User calls Twilio number connected to the app.

Twilio → /voice route triggers AI voice processing.

STT converts speech to text.

LLM processes and generates context-aware responses.

TTS converts text back to voice for the caller.

Optional: AI can send SMS, emails, or log data to CRM.

📌 Example Conversation
vbnet
Copy code
Customer: I want a demo.
AI: Great! I’ll send the demo and booking link to your phone right now.
(SMS sent automatically to caller's number)
🧠 Technologies Used
Node.js + Express

Groq API (LLM intelligence)

Twilio API (Voice & SMS)

STT & TTS Services (Speech processing)

JavaScript (ES6+)

🤝 Contributing
Contributions are welcome!
Fork the repo, create a feature branch, and submit a pull request.
