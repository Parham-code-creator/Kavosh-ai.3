const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== پروکسی DeepSeek (چت) ====================
app.post('/api/groq', async (req, res) => {
    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...req.body,
                model: req.body.model || 'deepseek-chat'
            })
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('DeepSeek Proxy Error:', error);
        res.status(500).json({ error: 'Proxy error' });
    }
});

// ==================== ساخت تصویر با Hugging Face ====================
app.post('/api/image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

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
                    parameters: {
                        width: 1024,
                        height: 1024
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('HF Error:', err);
            return res.status(500).json({ error: err || 'Image generation failed' });
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        res.json({ url: dataUrl });
    } catch (err) {
        console.error('Image Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ایتا (اختیاری) ====================
app.post('/api/eitaa', async (req, res) => {
    try {
        const { token, chatId, text } = req.body;
        if (!token || !chatId || !text) {
            return res.status(400).json({ error: 'token, chatId and text are required' });
        }

        const response = await fetch('https://eitaayar.ir/api/app/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                chat_id: chatId,
                text: text
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Eitaa Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== فایل‌های استاتیک ====================
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
