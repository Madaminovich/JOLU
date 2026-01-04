import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_API_KEY
});


export const analyzeProductImage = async (base64Image: string) => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API key not found. Simulated detection returned.");
    return { catalogType: 'FABRIC', tags: ['cotton', 'premium', 'plain'] };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: `Analyze this garment industry item (fabric or hardware) for a high-precision visual search system.
            Identify the following with extreme detail:
            1. Weave/Texture: (e.g., 'twill', 'poplin', 'jersey', 'piqué', 'satin', 'crepe').
            2. Finish/Sheen: (e.g., 'matte', 'glossy', 'brushed', 'mercerized').
            3. Hue/Tone: Be specific (e.g., 'off-white', 'eggshell', 'midnight navy', 'cobalt').
            4. Pattern scale: (e.g., 'micro-check', 'bold stripe', 'solid').
            
            Return JSON with:
            - catalogType: 'FABRIC' or 'HARDWARE'
            - color: primary color name
            - material: dominant material
            - pattern: pattern description
            - texture: detailed texture description
            - finish: detailed finish description
            - tags: array of descriptive keywords including texture and finish terms.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            catalogType: {
              type: Type.STRING,
              description: "Must be 'FABRIC' or 'HARDWARE'",
            },
            color: { type: Type.STRING },
            material: { type: Type.STRING },
            pattern: { type: Type.STRING },
            texture: { type: Type.STRING },
            finish: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Detailed keywords for matching",
            },
          },
          required: ["catalogType", "tags", "color", "texture"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};