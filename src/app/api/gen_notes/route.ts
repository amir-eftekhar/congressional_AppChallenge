import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { setupVectorSearch, getDocumentContent } from '@/lib/vectorDb';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  const { pdfUrl, currentPage } = await request.json();

  if (!pdfUrl) {
    return NextResponse.json({ error: 'PDF URL is required' }, { status: 400 });
  }

  try {
    await setupVectorSearch(pdfUrl);

    const documentContent = await getDocumentContent(pdfUrl);
    if (!documentContent) {
      return NextResponse.json({ error: 'Failed to retrieve document content' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const prompt = `Based on the following content, generate concise and well-structured Cornell notes. Focus on the main ideas, key points, and important details. Include a summary at the end.

Content:
${documentContent}

Please format the notes in markdown, using headers, bullet points, and emphasis where appropriate.`;

    const result = await model.generateContent(prompt);
    const notes = result.response.text();

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error generating notes:', error);
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const sectionId = searchParams.get('sectionId');

  if (!documentId) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
  }

  try {
    const notes = await getNotes(documentId, sectionId || undefined);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error retrieving notes:', error);
    return NextResponse.json({ error: 'Failed to retrieve notes' }, { status: 500 });
  }
}
