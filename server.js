const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== پروکسی Gemini ====================
app.post('/api/groq', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set' } });
        }

        // استخراج پیام‌ها از درخواست فرانت
        const messages = req.body.messages || [];
        const contents = [];
        let systemText = '';

        for (const m of messages) {
            if (m.role === 'system') {
                systemText += (m.content || '') + '\n';
            } else if (m.role === 'user') {
                contents.push({ role: 'user', parts: [{ text: m.content }] });
            } else if (m.role === 'assistant') {
                contents.push({ role: 'model', parts: [{ text: m.content }] });
            }
        }

        // اگر system داشتیم، به اول پیام کاربر اضافه می‌کنیم
        if (systemText && contents.length > 0 && contents[0].role === 'user') {
            contents[0].parts[0].text = systemText.trim() + '\n\n' + contents[0].parts[0].text;
        }

        const model = 'gemini-2.0-flash'; // یا gemini-1.5-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'سلام' }] }],
                generationConfig: {
                    temperature: req.body.temperature || 0.7,
                    maxOutputTokens: req.body.max_tokens || 2048
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: {
                    message: data.error?.message || JSON.stringify(data)
                }
            });
        }

        // تبدیل پاسخ Gemini به فرمت شبیه OpenAI تا فرانت نشکند
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: text
                    }
                }
            ]
        });
    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        res.status(500).json({ error: { message: error.message || 'Proxy error' } });
    }
});

// ==================== ساخت تصویر (Hugging Face) ====================
app.post('/api/image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });

        const response = await fetch(
            'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: { width: 1024, height: 1024 }
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return res.status(500).json({ error: err || 'Image generation failed' });
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        res.json({ url: `data:image/jpeg;base64,${base64}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ایتا ====================
app.post('/api/eitaa', async (req, res) => {
    try {
        const { token, chatId, text } = req.body;
        if (!token || !chatId || !text) {
            return res.status(400).json({ error: 'token, chatId and text are required' });
        }

        const response = await fetch('https://eitaayar.ir/api/app/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, chat_id: chatId, text })
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
