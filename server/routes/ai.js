const express = require("express");
const router = express.Router();
const { fetchMandiPrice } = require("../utils/mandi");

router.post("/analyze-voice", async (req, res) => {
    try {
        const { transcript, formData, cropOptions, history = [], language = 'en-IN' } = req.body;
        console.log("🎙️ Received:", transcript, "| Language:", language);

        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
            console.error("GROQ_API_KEY missing");
            return res.status(500).json({ error: "Server Configuration Error: GROQ_API_KEY missing" });
        }

        // 1. Detect Crop & Fetch Prices
        let currentCtxCrop = formData.crop_name;
        if (!currentCtxCrop && transcript) {
            const allCrops = Object.values(cropOptions).flat();
            currentCtxCrop = allCrops.find(c => new RegExp(c, 'i').test(transcript));
        }

        let marketInfo = "Market Data Unavailable";
        if (currentCtxCrop) {
            const priceDataList = await fetchMandiPrice(currentCtxCrop, 1);
            const priceData = priceDataList.length > 0 ? priceDataList[0] : null;
            if (priceData) {
                marketInfo = `Mandi Price for ${currentCtxCrop}: ₹${priceData.modal_price}/quintal (~₹${priceData.modal_price / 100}/kg) in ${priceData.district}.`;
            }
        }

        // 2. Build Messages with History
        const recentHistory = history.slice(-6);

        const systemPrompt = `
      You are 'Kisan Sahayak', a smart AI for Indian farmers. 
      
      GOALS:
      1. *Compare Prices*: If user gives a price, strictly compare with: ${marketInfo}. Warn if low.
      2. *Fill Form*: Update: category, crop_name, quantity (num), price (num), sell_date (YYYY-MM-DD), village, district, state.
      3. *Category Logic*: IF 'crop_name' is set, YOU MUST strictly infer 'category' from: ${JSON.stringify(cropOptions)}. (e.g. Potato -> Vegetables, Wheat -> Grains).
      4. *Track Progress*: ALWAYS check what is specifically missing from KEY fields.

      CONTEXT:
      - Date: ${new Date().toISOString().split('T')[0]}
      - Form: ${JSON.stringify(formData)}

      RULES:
      - *History*: Use context from previous messages.
      - *Phonetics*: "Nashe ki" -> "Nashik". "Minakshi" -> "Nashik".
      - *Logic*:
          - IF Price given: Analyze it vs Market Data.
          - *CRITICAL*: If any field (Qty, Date, Location) is missing, ASK FOR IT.
          - *DONE*: IF ALL fields are filled (and valid), set "action": "upload_image", "speech": "Sab details mil gayi! Ab photo khichiye."
          - *ACCEPTANCE*: IF user confirms/accepts listing (e.g. "submit", "ho", "accept", "submit kara"), set "action": "submit_form".
      - *LANGUAGE & TONE*: The user is speaking ${language === 'mr-IN' ? 'Marathi' : (language === 'hi-IN' ? 'Hindi' : 'English / Hinglish')}. Respond in the same language. If Marathi, reply purely in natural Marathi.
      
      Return JSON ONLY:
      {
        "updates": { "category": "vegetables", "crop_name": "Potato", ... },
        "speech": "Your response in the corresponding language.",
        "action": "upload_image" (or "submit_form" if the user accepts/confirms listing)
      }
    `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...recentHistory,
            { role: "user", content: transcript }
        ];

        // 3. Fallback Model Chain
        const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
        let finalResult = null;
        let usedModel = "";

        for (const model of models) {
            try {
                console.log(`🤖 Trying Model: ${model}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.1,
                        response_format: { type: "json_object" }
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(await response.text());

                const data = await response.json();
                // Handle potential parsing errors if model doesn't return perfect JSON
                const content = data.choices[0].message.content;
                try {
                    finalResult = JSON.parse(content);
                } catch (e) {
                    console.warn(`JSON Parse failed for ${model}: ${content}`);
                    continue; // Try next model
                }

                usedModel = model;
                break; // Success
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.warn(`⏳ Model ${model} timed out after 10s. Trying next...`);
                } else {
                    console.warn(`⚠️ Model ${model} failed:`, err.message);
                }
            }
        }

        if (!finalResult) throw new Error("All AI models failed.");

        console.log(`✅ Success via ${usedModel}`);
        res.json(finalResult);

    } catch (error) {
        console.error("AI ROUTE ERROR 👉", error.message);
        res.status(500).json({ error: "Failed to process voice" });
    }
});

module.exports = router;
