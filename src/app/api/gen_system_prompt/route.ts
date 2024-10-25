import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { setupVectorSearch, insertEmbedding, vectorSearch, storeSystemPrompt, getDocumentSections } from '@/lib/vectorDb';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

async function generateSystemPrompt(sections: string[]) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  const prompt = `Analyze the following document sections and create an ideal system prompt for a chatbot that will answer questions about this document. The prompt should capture the key themes, tone, and purpose of the document:

${sections.join('\n\n')}

Generate a system prompt:`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function POST(request: Request) {
  const { documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
  }

  try {
    await setupVectorSearch();

    const sections = await getDocumentSections(documentId);
    const systemPrompt = await generateSystemPrompt(sections);

    await storeSystemPrompt(documentId, systemPrompt);

    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error('Error generating system prompt:', error);
    return NextResponse.json({ error: 'Failed to generate system prompt' }, { status: 500 });
  }
}
