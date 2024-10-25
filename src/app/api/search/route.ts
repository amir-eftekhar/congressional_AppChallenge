import { NextResponse } from 'next/server';
import { setupVectorSearch, vectorSearch } from '@/lib/vectorDb';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

async function generateEmbedding(text: string) {
  const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

export async function POST(request: Request) {
  try {
    const { query, pdfUrl } = await request.json();

    if (!query || !pdfUrl) {
      return NextResponse.json({ error: 'Query and PDF URL are required' }, { status: 400 });
    }

    await setupVectorSearch(pdfUrl);
    const queryEmbedding = await generateEmbedding(query);
    const searchResults = await vectorSearch(queryEmbedding, 5, pdfUrl);

    const results = searchResults.map(result => ({
      content: result.content,
      page: result.metadata.pageNumber
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json({ error: 'An error occurred during the search.' }, { status: 500 });
  }
}
