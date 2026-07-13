import { Segment } from "@/hooks/useUserConfig";

export async function suggestSegment(
  nombreGasto: string,
  segments: Segment[],
  apiKey: string
): Promise<string | null> {
  if (!apiKey || !nombreGasto.trim() || segments.length === 0) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `Eres un asistente financiero que ayuda a clasificar gastos personales en segmentos de presupuesto.
Clasifica el siguiente gasto basándote en su descripción de forma lógica y razonada.

Gasto a clasificar: "${nombreGasto}"

Segmentos disponibles:
${segments.map((s) => `- ${s.id}: ${s.nombre}${s.descripcion ? ` (${s.descripcion})` : ""}`).join("\n")}

Responde estrictamente en formato JSON con la siguiente estructura:
{
  "suggestedSegmentId": "ID_DEL_SEGMENTO"
}

Donde "suggestedSegmentId" debe ser exactamente uno de los IDs de los segmentos disponibles listados anteriormente (por ejemplo: ${segments.map((s) => `"${s.id}"`).join(", ")}).`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de la API de Gemini:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      console.warn("Respuesta vacía o inesperada de Gemini:", data);
      return null;
    }

    const parsed = JSON.parse(textContent);
    const suggestedId = parsed.suggestedSegmentId;

    // Verificar que el ID sugerido exista en la lista de segmentos
    const exists = segments.some((s) => s.id === suggestedId);
    if (exists) {
      return suggestedId;
    } else {
      console.warn(`Gemini sugirió un ID no registrado: "${suggestedId}"`);
      return null;
    }
  } catch (error) {
    console.error("Error al llamar a Gemini:", error);
    return null;
  }
}
