const Groq = require('groq-sdk');

class LLMService {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        
        // Store conversation history per call
        this.conversationMemory = new Map();
        
        // Clear old conversations after 1 hour
        setInterval(() => {
            this.cleanupOldConversations();
        }, 60 * 60 * 1000); // 1 hour
    }

    // Clean up conversations older than 1 hour
    cleanupOldConversations() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [callSid, conversation] of this.conversationMemory.entries()) {
            if (conversation.lastUpdated < oneHourAgo) {
                console.log(`🧹 Cleaning up old conversation: ${callSid}`);
                this.conversationMemory.delete(callSid);
            }
        }
    }

    // Get or create conversation history for a call
    getConversationHistory(callSid) {
        if (!this.conversationMemory.has(callSid)) {
            this.conversationMemory.set(callSid, {
                messages: [],
                context: {
                    serviceInterest: null,
                    stage: 'greeting', // greeting, discovery, information, closing
                    keyPoints: [],
                    readyForDemo: false // NEW: Track demo readiness
                },
                lastUpdated: Date.now()
            });
            console.log(`💭 Created new conversation memory for: ${callSid}`);
        }
        return this.conversationMemory.get(callSid);
    }

    // Add message to conversation history
    addToHistory(callSid, role, content) {
        const conversation = this.getConversationHistory(callSid);
        conversation.messages.push({ 
            role, 
            content, 
            timestamp: new Date(),
            messageId: Date.now() // Add unique ID
        });
        conversation.lastUpdated = Date.now();
        
        // Keep last 16 messages (8 exchanges) to maintain context longer
        if (conversation.messages.length > 16) {
            conversation.messages = conversation.messages.slice(-16);
        }
        
        console.log(`📝 Added ${role} message to ${callSid}: "${content.substring(0, 50)}..."`);
        console.log(`💬 Total messages in conversation: ${conversation.messages.length}`);
    }

    // Update conversation context based on customer input
    updateContext(callSid, customerInput) {
        const conversation = this.getConversationHistory(callSid);
        const input = customerInput.toLowerCase().trim();
        
        // Clean up common speech-to-text errors
        const cleanInput = input
            .replace(/\b(um|uh|ah|er)\b/g, '') // Remove filler words
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
        
        // Enhanced service detection with context clues
        const servicePatterns = {
            'customer support automation': [
                'customer support', 'help desk', 'support tickets', 'customer service',
                'handling customers', 'customer questions', 'support team',
                'customer inquiries', 'answering customers', 'support calls'
            ],
            'sales automation': [
                'sales', 'lead generation', 'qualify leads', 'sales funnel',
                'booking appointments', 'sales calls', 'follow up leads',
                'convert leads', 'sales process', 'qualifying prospects'
            ],
            'chatbot for website': [
                'chatbot', 'chat agent', 'website chat', 'live chat',
                'chat on website', 'automated chat', 'web chat',
                'visitors chat', 'website visitors'
            ],
            'voice agent': [
                'voice agent', 'phone calls', 'call center', 'phone support',
                'answering calls', 'phone automation', 'voice assistant',
                'automated calls', 'phone bot'
            ],
            'appointment booking': [
                'booking', 'appointments', 'scheduling', 'calendar',
                'book meetings', 'schedule calls', 'appointment setting',
                'booking system', 'calendar booking'
            ],
            'order processing': [
                'orders', 'order processing', 'e-commerce', 'order status',
                'order management', 'fulfillment', 'order tracking',
                'process orders', 'order handling'
            ]
        };
        
        // Check for service interest
        if (!conversation.context.serviceInterest) {
            for (const [service, keywords] of Object.entries(servicePatterns)) {
                const found = keywords.some(keyword => cleanInput.includes(keyword));
                if (found) {
                    conversation.context.serviceInterest = service;
                    console.log(`🎯 Service interest identified: ${service}`);
                    break;
                }
            }
        }
        
        // Detect business context and pain points
        const businessContexts = {
            'high volume business': [
                'lots of', 'many', 'hundreds', 'thousands', 'busy', 'overwhelmed',
                'too many', 'can\'t keep up', 'swamped', 'backed up'
            ],
            'cost concerns': [
                'expensive', 'cost', 'budget', 'save money', 'cheaper',
                'affordable', 'pricing', 'costs too much', 'expensive staff'
            ],
            'availability issues': [
                '24/7', 'after hours', 'nights', 'weekends', 'always available',
                'round the clock', 'all day', 'available always'
            ],
            'scaling problems': [
                'growing', 'expanding', 'scaling', 'more customers',
                'business growing', 'getting bigger', 'need to scale'
            ],
            'manual work': [
                'manual', 'doing it myself', 'time consuming', 'repetitive',
                'manually handling', 'doing by hand', 'takes forever'
            ],
            'staff issues': [
                'hiring', 'staff', 'employees', 'team members',
                'hard to find people', 'training staff', 'staff turnover'
            ]
        };
        
        for (const [context, triggers] of Object.entries(businessContexts)) {
            const found = triggers.some(trigger => cleanInput.includes(trigger));
            if (found && !conversation.context.keyPoints.includes(context)) {
                conversation.context.keyPoints.push(context);
                console.log(`💡 Business context identified: ${context}`);
            }
        }
        
        // ✅ SIMPLIFIED INTENT DETECTION - Focus on demo readiness
        const intentSignals = {
            'wants_demo': ['demo', 'show me', 'see it work', 'example', 'how it works', 'book', 'schedule', 'yes', 'sure', 'let\'s do it'],
            'wants_pricing': ['cost', 'price', 'how much', 'pricing', 'budget'],
            'ready_to_move': ['next steps', 'get started', 'sign up', 'when can we', 'sounds good', 'interested'],
            'needs_info': ['tell me more', 'explain', 'how does', 'what exactly', 'details'],
            'has_concerns': ['but', 'however', 'worried', 'concern', 'problem with', 'what if']
        };
        
        for (const [intent, signals] of Object.entries(intentSignals)) {
            const found = signals.some(signal => cleanInput.includes(signal));
            if (found) {
                conversation.context.currentIntent = intent;
                console.log(`🎯 Intent detected: ${intent}`);
                
                // Mark as ready for demo if showing strong interest
                if (intent === 'wants_demo' || intent === 'ready_to_move') {
                    conversation.context.readyForDemo = true;
                }
                break;
            }
        }
        
        // Smart stage progression based on conversation flow
        const messageCount = conversation.messages.length;
        
        if (cleanInput.includes('thank') || cleanInput.includes('bye') || cleanInput.includes('goodbye')) {
            conversation.context.stage = 'closing';
        } else if (conversation.context.serviceInterest && conversation.context.stage === 'greeting') {
            conversation.context.stage = 'discovery';
        } else if (conversation.context.currentIntent === 'wants_demo' || conversation.context.currentIntent === 'wants_pricing') {
            conversation.context.stage = 'information';
        } else if (messageCount > 8 && conversation.context.stage === 'discovery') {
            conversation.context.stage = 'information';
        } else if (conversation.context.readyForDemo) {
            conversation.context.stage = 'closing';
        }
        
        console.log(`📍 Stage: ${conversation.context.stage}, Messages: ${messageCount}, Demo Ready: ${conversation.context.readyForDemo}`);
        console.log(`🧠 Full context: ${JSON.stringify(conversation.context, null, 2)}`);
    }

    // ✅ UPDATED SYSTEM PROMPT - SMS ONLY, NO EMAIL
    generateSystemPrompt(callSid) {
        const conversation = this.getConversationHistory(callSid);
        const { serviceInterest, stage, keyPoints, readyForDemo } = conversation.context;
        
        let systemPrompt = `You are Alex, a sharp AI sales expert for HighIQ.ai. We build custom AI voice & chat agents that automate business processes.

        🔥 CONVERSATION MEMORY - NEVER FORGET THIS:`;

        if (serviceInterest) {
            systemPrompt += `\n✅ They want: ${serviceInterest}`;
        }
        
        if (conversation.context.currentIntent) {
            systemPrompt += `\n✅ Current intent: ${conversation.context.currentIntent}`;
        }
        
        if (keyPoints.length > 0) {
            systemPrompt += `\n✅ Business context: ${keyPoints.join(', ')}`;
        }

        systemPrompt += `\n✅ Stage: ${stage}
        ✅ Demo Ready: ${readyForDemo}

        🧠 SMART INTERPRETATION RULES:
        1. If they say something unclear, DON'T ask "what do you mean?" - make an educated guess based on context
        2. If they mention "automation", "help with customers", "handling calls" - they likely want customer support automation
        3. If they say "busy", "overwhelmed", "too many" - they have volume issues, focus on scaling solutions
        4. If they mention "expensive", "cost", "budget" - address ROI and cost savings immediately
        5. Assume positive intent - if unclear, assume they're interested and guide them forward
        6. Don't get stuck on details - keep moving the conversation toward solutions

        🎯 SMS-ONLY DEMO BOOKING (CRITICAL - NO EMAIL COLLECTION):
        When customer wants demo or shows strong interest:
        Simply say: "Perfect! I'm texting you the demo video and booking link right now!"
        
        NEVER ask for email, name, or any details - just promise to text them!
        The system will automatically send SMS to their calling number.

        🎯 RESPONSE STRATEGY:
        - NEVER say "I don't understand" or "Can you clarify?"
        - Instead say "Sounds like you need [solution] - most of our clients with [their situation] see great results with [specific service]"
        - Make assumptions and let them correct you if wrong
        - Example: "Got it, you're swamped with customer inquiries. Our voice agents handle 80% of common questions automatically."

        📞 PHONE CONVERSATION RULES:
        - Max 25 words per response
        - One clear question or statement
        - Sound confident, not confused
        - If they give a vague answer, interpret it positively and move forward`;

        // ✅ SIMPLIFIED STAGE-SPECIFIC BEHAVIOR - NO EMAIL ANYWHERE
        switch (stage) {
            case 'greeting':
                systemPrompt += `\n\n🚀 GREETING MODE: Quick intro, assume they need automation help, ask about their biggest business challenge`;
                break;
            case 'discovery':
                systemPrompt += `\n\n🔍 DISCOVERY MODE: 
                - Don't fish for info - make educated guesses
                - "Sounds like [assumption] - how many [relevant metric] daily?"
                - Focus on pain points: volume, cost, availability, quality`;
                break;
            case 'information':
                systemPrompt += `\n\n💡 INFO MODE: 
                - Give concrete examples: "Our clients reduce support costs 60%"
                - Focus on their specific pain point
                - Push for demo: "Want to see how this works for your situation?"`;
                break;
            case 'closing':
                systemPrompt += `\n\n🎯 CLOSING MODE: 
                - Immediately promise SMS: "Perfect! I'm texting you the demo link right now!"
                - No questions, no data collection - just send!
                - End with: "Check your messages in a few seconds!"`;
                break;
        }

        systemPrompt += `

            💼 SOLUTION MATCHING:
            - Customer service issues → 24/7 AI support agent
            - Too many calls → Voice agent handles 80% automatically  
            - Lead follow-up → AI qualifies and books appointments
            - Website visitors → Chat agent converts 3x more leads
            - Manual processes → Custom automation workflows

            🎯 QUALIFICATION SHORTCUTS:
            - Business size? (Skip if obvious)
            - Biggest bottleneck right now?
            - Timeline to fix this?

            CRITICAL: When they want a demo, immediately promise SMS delivery. NO data collection needed!
            NEVER mention email, never ask for contact details - they're already calling you!`;

        return systemPrompt;
    }

    async generateResponse(customerInput, callSid) {
        try {
            // Validate inputs
            if (!customerInput || !callSid) {
                throw new Error('Missing required parameters: customerInput or callSid');
            }

            console.log(`🧠 Generating response for call: ${callSid}`);
            console.log(`📝 Customer input: "${customerInput}"`);
            
            // Update context based on current input
            this.updateContext(callSid, customerInput);
            
            // Get conversation history
            const conversation = this.getConversationHistory(callSid);
            
            // Add current customer message to history
            this.addToHistory(callSid, 'user', customerInput);
            
            // Generate contextual system prompt
            const systemPrompt = this.generateSystemPrompt(callSid);
            
            // Prepare conversation messages for Groq
            const messages = [
                { role: "system", content: systemPrompt }
            ];
            
            // Add ALL conversation history to maintain full context
            const allMessages = conversation.messages;
            messages.push(...allMessages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })));
            
            console.log(`💬 Using ALL ${allMessages.length} messages for full context`);
            console.log(`🧠 Current context: ${JSON.stringify(conversation.context, null, 2)}`);
            console.log(`📋 Recent messages:`, allMessages.slice(-4).map(m => `${m.role}: ${m.content.substring(0, 30)}...`));
            
            // Call Groq API with error handling
            const completion = await this.groq.chat.completions.create({
                messages: messages,
                model: "llama-3.1-8b-instant",
                temperature: 0.1, // Very low temperature for consistency
                max_tokens: 100, // Increased to prevent cutting mid-sentence
                top_p: 0.8,
                stop: ['\n\n', 'Customer:', 'Agent:', 'Hi,'] // Max 4 stop tokens
            });

            if (!completion.choices || completion.choices.length === 0) {
                throw new Error('No response from Groq API');
            }

            const aiResponse = completion.choices[0].message.content.trim();
            
            // Validate response
            if (!aiResponse) {
                throw new Error('Empty response from Groq API');
            }
            
            // Clean up response and check for repetition
            let cleanResponse = aiResponse
                .replace(/[\*\#]/g, '') // Remove markdown formatting
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            
            // ✅ ANTI-REPETITION FILTER - Block overused phrases
            const bannedPhrases = [
                /sounds like you need 24\/7 ai support/i,
                /most of our clients with high customer volume/i,
                /handle 80% of common questions automatically/i,
                /see great results with our voice agents/i,
                /how specifically can we help you/i,
                /our voice agents handle 80%/i,
                /24\/7 ai support to handle customer inquiries/i,
                /what's your email/i,
                /can i get your email/i,
                /send you an email/i
            ];
            
            const isRepetitive = bannedPhrases.some(pattern => pattern.test(cleanResponse));
            
            if (isRepetitive) {
                console.log(`🚫 BLOCKED REPETITIVE RESPONSE: "${cleanResponse}"`);
                
                // Generate contextual replacement based on conversation stage
                const messageCount = conversation.messages.length;
                
                if (conversation.context.readyForDemo) {
                    cleanResponse = "Perfect! I'm texting you the demo video and booking link right now!";
                } else if (messageCount > 6) {
                    cleanResponse = "Want to see a quick demo?";
                } else if (conversation.context.serviceInterest) {
                    cleanResponse = "How many customers contact you daily?";
                } else {
                    cleanResponse = "What's your biggest time-waster right now?";
                }
                
                console.log(`✅ REPLACED WITH: "${cleanResponse}"`);
            }
            
            // ✅ ANTI-EMAIL FILTER - Block any email collection attempts
            const emailPatterns = [
                /what.*email/i,
                /your email/i,
                /email address/i,
                /send.*email/i,
                /email you/i
            ];
            
            const hasEmailRequest = emailPatterns.some(pattern => pattern.test(cleanResponse));
            
            if (hasEmailRequest) {
                console.log(`🚫 BLOCKED EMAIL REQUEST: "${cleanResponse}"`);
                cleanResponse = "Perfect! I'm texting you the demo link right now!";
                conversation.context.readyForDemo = true;
                console.log(`✅ REPLACED WITH SMS-ONLY: "${cleanResponse}"`);
            }
            
            // ANTI-GREETING FILTER - Catch any greeting attempts
            const greetingPatterns = [
                /^hi,?\s*(i'm|i am)\s*alex/i,
                /^hello,?\s*(i'm|i am)\s*alex/i,
                /^hi\s*there/i,
                /how\s*can\s*i\s*help\s*(you\s*)?today/i,
                /welcome\s*to\s*highiq/i
            ];
            
            const isGreeting = greetingPatterns.some(pattern => pattern.test(cleanResponse));
            
            if (isGreeting && conversation.messages.length > 2) {
                console.log(`🚫 BLOCKED GREETING ATTEMPT: "${cleanResponse}"`);
                cleanResponse = "What's eating up most of your time?";
                console.log(`✅ REPLACED WITH: "${cleanResponse}"`);
            }
            
            // LENGTH CHECK - Force reasonable responses but don't cut complete sentences
            if (cleanResponse.length > 150) { // About 25-30 words
                console.log(`✂️ RESPONSE TOO LONG (${cleanResponse.length} chars): "${cleanResponse}"`);
                
                // Find the last complete sentence within reasonable length
                const sentences = cleanResponse.split(/[.!?]+/).filter(s => s.trim());
                let result = sentences[0].trim();
                
                // Add more sentences if they fit
                for (let i = 1; i < sentences.length; i++) {
                    if ((result + '. ' + sentences[i].trim()).length <= 150) {
                        result += '. ' + sentences[i].trim();
                    } else {
                        break;
                    }
                }
                
                cleanResponse = result.endsWith('.') ? result : result + '.';
                console.log(`✅ SHORTENED TO: "${cleanResponse}"`);
            }
            
            // Add AI response to history
            this.addToHistory(callSid, 'assistant', cleanResponse);
            
            console.log(`✅ Response generated: "${cleanResponse}"`);
            console.log(`📊 Conversation summary:`, this.getConversationSummary(callSid));
            
            return cleanResponse;

        } catch (error) {
            console.error('❌ Groq LLM Error:', error);
            
            // Log detailed error information
            if (error.response) {
                console.error('API Response Error:', error.response.data);
            }
            
            // Return appropriate fallback based on error type
            if (error.message.includes('rate limit')) {
                return "I'm experiencing high demand right now. Let me connect you with a human representative.";
            } else if (error.message.includes('API key')) {
                return "I'm having authentication issues. Please hold while I connect you to support.";
            } else {
                return "I apologize for the technical difficulty. Let me get a human agent to assist you right away.";
            }
        }
    }

    // Clear conversation history for a specific call (optional cleanup)
    clearConversation(callSid) {
        if (this.conversationMemory.has(callSid)) {
            this.conversationMemory.delete(callSid);
            console.log(`🗑️ Cleared conversation memory for: ${callSid}`);
            return true;
        }
        return false;
    }

    // Get conversation summary (useful for debugging)
    getConversationSummary(callSid) {
        const conversation = this.conversationMemory.get(callSid);
        if (!conversation) return null;
        
        return {
            callSid: callSid,
            messageCount: conversation.messages.length,
            context: conversation.context,
            lastUpdated: new Date(conversation.lastUpdated).toLocaleString(),
            recentMessages: conversation.messages.slice(-4) // Last 2 exchanges
        };
    }

    // Health check method
    async healthCheck() {
        try {
            const testResponse = await this.groq.chat.completions.create({
                messages: [{ role: "user", content: "Hello" }],
                model: "llama-3.1-8b-instant",
                max_tokens: 10
            });
            
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                model: 'llama-3.1-8b-instant'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Get service statistics
    getStats() {
        return {
            activeConversations: this.conversationMemory.size,
            totalMemoryUsage: JSON.stringify([...this.conversationMemory.values()]).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new LLMService();