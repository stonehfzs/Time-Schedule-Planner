import { GoogleGenAI, Type } from "@google/genai";

const parseEventFromString = async (prompt) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format

    const systemInstruction = `You are an intelligent assistant that parses natural language text into structured event data. The user will provide a string, and you must extract the event's title, date, start time, and end time. 
    
    - Today's date is ${today}. Use this as a reference for terms like "today", "tomorrow", etc.
    - If a date is not specified, assume it is today (${today}).
    - If an end time isn't specified, assume the event is one hour long.
    - If only a title is provided (e.g., "Team Lunch"), assume it's for today at noon (12:00) for one hour.
    - Return the date in 'YYYY-MM-DD' format.
    - Return times in 'HH:mm' (24-hour) format.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "The title of the event." },
            date: { type: Type.STRING, description: "The date of the event in YYYY-MM-DD format." },
            startTime: { type: Type.STRING, description: "The start time of the event in HH:mm (24-hour) format." },
            endTime: { type: Type.STRING, description: "The end time of the event in HH:mm (24-hour) format." },
        },
        required: ["title", "date", "startTime", "endTime"]
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error parsing event with Gemini:", error);
        throw new Error("Could not understand the event details. Please try phrasing it differently.");
    }
};

export { parseEventFromString };
