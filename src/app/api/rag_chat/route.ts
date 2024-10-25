import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { setupVectorSearch, getDocumentContent } from '@/lib/vectorDb';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  const { query, pdfUrl, currentPage } = await req.json();

  try {
    await setupVectorSearch(pdfUrl);
    const documentContent = await getDocumentContent(pdfUrl);

    if (!documentContent) {
      return NextResponse.json({ error: 'Failed to retrieve document content' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Based on the following context, answer the user's question: "${query}"\n\nContext:\n${documentContent}`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Error in RAG chat:', error);
    return NextResponse.json({ error: 'An error occurred during the chat.' }, { status: 500 });
  }
}
