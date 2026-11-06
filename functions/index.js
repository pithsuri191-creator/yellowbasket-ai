const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { VertexAI } = require('@google-cloud/vertexai');

const db = new Firestore();
// กำหนด GCP Project ID ของคุณ
const vertex = new VertexAI({ 
  project: process.env.GCP_PROJECT || 'yellowbasket-ai-prod', 
  location: 'us-central1' 
});
const generativeModel = vertex.getGenerativeModel({ model: 'gemini-2.5-flash' });

functions.http('yellowBasketAPI', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const { action, userId, item, productImageUrl } = req.body || {};

  try {
    // 1. ซิงก์ข้อมูลตะกร้าสินค้าลง Cloud Firestore
    if (action === 'addToCart') {
      const cartRef = db.collection('carts').doc(userId);
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(cartRef);
        let items = doc.exists ? (doc.data().items || []) : [];
        items.push(item);
        transaction.set(cartRef, { userId, items, updatedAt: new Date().toISOString() }, { merge: true });
      });
      return res.status(200).send({ success: true, message: 'Item added to YellowBasket!' });
    }

    // 2. เรียก Vertex AI (Gemini) สร้างสคริปต์วิดีโอและแคปชันปักตะกร้าเหลือง
    if (action === 'generateAiPost') {
      const prompt = `คุณคือผู้เชี่ยวชาญด้านการตลาด E-Commerce และ Affiliate Marketing ช่วยสร้างสคริปต์วิดีโอสั้น (TikTok/Reels) พร้อมแคปชันเชิญชวนให้คนกดปักตะกร้าสีเหลือง สำหรับสินค้านี้: ${productImageUrl}`;
      const resp = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const aiText = resp.response.candidates[0].content.parts[0].text;
      return res.status(200).send({ success: true, copywriting: aiText });
    }

    return res.status(400).send({ error: 'Invalid action' });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: error.message });
  }
});