import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Mobile Recharge',
  'Transportation',
  'Petrol',
  'Shopping',
  'Entertainment',
  'Education',
  'Medical',
  'Travel',
  'Subscriptions',
  'EMI and Loans',
  'Personal Care',
  'Other Expenses',
];

const PAYMENT_METHODS = ['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Net Banking'];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'MoneyWise API' });
  });

  app.post('/api/ai/assistant', async (req, res) => {
    try {
      const { question, financialSnapshot, history } = req.body ?? {};
      if (typeof question !== 'string' || !question.trim() || question.length > 1200) {
        return res.status(400).json({ error: 'Please enter a valid financial question (max 1200 characters).' });
      }
      if (!financialSnapshot || typeof financialSnapshot !== 'object') {
        return res.status(400).json({ error: 'Financial context snapshot is required.' });
      }

      const ai = getGeminiClient();
      const safeHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => `${m.role === 'user' ? 'User' : 'MoneyWise AI'}: ${m.content.slice(0, 600)}`)
            .join('\n')
        : '';

      const systemInstruction = `You are MoneyWise AI, an intelligent personal finance advisor for an Indian household/individual using Indian Rupees (₹).
STRICT GROUNDING RULES:
1. Analyze ONLY the real database financial snapshot provided in the prompt. NEVER invent, estimate, or fabricate transactions, categories, balances, or percentages that are not derived from the snapshot.
2. Always format currency in Indian Rupees (₹) with Indian numbering commas (e.g., ₹24,500).
3. If the user has zero records in a category or period, explicitly state that no records exist yet rather than guessing.
4. Be concise, practical, and direct. Cite exact numbers from the snapshot (e.g., "You spent ₹4,000 on Shopping this month. Reducing Shopping by ₹1,000 increases your monthly savings to ₹...").
5. Address affordability questions by comparing remaining balance, upcoming unpaid bills, monthly EMI obligations, and savings goals.`;

      const prompt = `REAL USER FINANCIAL SNAPSHOT (JSON):
${JSON.stringify(financialSnapshot, null, 2)}

${safeHistory ? `RECENT CONVERSATION:\n${safeHistory}\n` : ''}USER QUESTION:
${question.trim()}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const answer = response.text?.trim();
      if (!answer) {
        return res.status(502).json({ error: 'Empty response from AI advisor.' });
      }
      res.json({ answer });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to analyze financial records.';
      console.error('AI assistant error:', error);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/receipt-ocr', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body ?? {};
      if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
        return res.status(400).json({ error: 'Receipt image data is required.' });
      }
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const safeMime = typeof mimeType === 'string' && allowedMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
      const cleanedBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanedBase64,
              },
            },
            {
              text: `Extract receipt expense details in Indian Rupees (₹). Map category strictly to one of: ${EXPENSE_CATEGORIES.join(', ')}. Map paymentMethod strictly to one of: ${PAYMENT_METHODS.join(', ')}. Return date in YYYY-MM-DD format if visible, otherwise empty string.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Short merchant or item title' },
              amount: { type: Type.NUMBER, description: 'Total bill amount as a positive number' },
              category: { type: Type.STRING, description: 'Matched expense category' },
              date: { type: Type.STRING, description: 'YYYY-MM-DD date or empty string' },
              paymentMethod: { type: Type.STRING, description: 'Matched payment method' },
              description: { type: Type.STRING, description: 'Brief itemized summary' },
              isUnnecessary: { type: Type.BOOLEAN, description: 'True if discretionary impulse/luxury spend' },
            },
            required: ['name', 'amount', 'category', 'date', 'paymentMethod', 'description', 'isUnnecessary'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json({ extracted: parsed });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to extract receipt details.';
      console.error('Receipt OCR error:', error);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/voice-parse', async (req, res) => {
    try {
      const { transcript, today } = req.body ?? {};
      if (typeof transcript !== 'string' || !transcript.trim() || transcript.length > 500) {
        return res.status(400).json({ error: 'Valid voice transcript is required.' });
      }

      const ai = getGeminiClient();
      const refDate = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
        ? today
        : new Date().toISOString().slice(0, 10);

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Today's date is ${refDate}. Parse this spoken Indian Rupee expense entry into structured JSON: "${transcript.trim()}".
Map category strictly to one of: ${EXPENSE_CATEGORIES.join(', ')}.
Map paymentMethod strictly to one of: ${PAYMENT_METHODS.join(', ')} (default "UPI" if unspecified).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              date: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              description: { type: Type.STRING },
              isUnnecessary: { type: Type.BOOLEAN },
            },
            required: ['name', 'amount', 'category', 'date', 'paymentMethod', 'description', 'isUnnecessary'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json({ parsed });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to parse voice expense.';
      console.error('Voice parse error:', error);
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MoneyWise server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
