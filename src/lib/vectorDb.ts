import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

pdfjsLib.GlobalWorkerOptions.workerSrc = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.js');

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface EmbeddingDocument {
  _id: ObjectId;
  content: string;
  embedding: number[];
  metadata: {
    pageNumber: number;
    documentId: string;
    fileType: string;
    createdAt: Date;
  };
}

interface SystemPrompt {
  _id: ObjectId;
  documentId: string;
  prompt: string;
  createdAt: Date;
}

interface Note {
  _id: ObjectId;
  documentId: string;
  sectionId?: string;
  content: string;
  style: 'cornell' | 'bullet' | 'outline' | 'summary';
  createdAt: Date;
  updatedAt: Date;
}

interface StreamNote extends Note {
  previousContent: string;
  streamPosition: number;
}

interface LectureNote extends Note {
  lectureId: string;
  audioFilename: string;
}

async function generateEmbedding(text: string) {
  console.log('Generating embedding for:', text.substring(0, 50) + '...');
  const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await embeddingModel.embedContent(text);
  const embedding = result.embedding;
  console.log('Embedding generated, length:', embedding.values.length);
  return embedding.values;
}

export async function setupVectorSearch(documentId: string) {
  console.log('Setting up vector search for document:', documentId);
  try {
    await client.connect();
    const db = client.db('pdf_database');
    const embeddingsCollection = db.collection<EmbeddingDocument>('embeddings');

    // Check if embeddings already exist for this document
    const existingEmbeddings = await embeddingsCollection.findOne({ "metadata.documentId": documentId });
    if (existingEmbeddings) {
      console.log('Embeddings already exist for this document');
      return;
    }

    // Construct the full URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const fullUrl = new URL(documentId, baseUrl).toString();
    console.log('Fetching PDF from URL:', fullUrl);

    // Fetch the PDF content
    const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
    const pdfData = new Uint8Array(response.data);
    console.log('PDF data fetched, length:', pdfData.length);

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;
    console.log('PDF loaded, number of pages:', numPages);

    let fullText = '';

    // Extract text from each page and create embeddings
    for (let i = 1; i <= numPages; i++) {
      console.log(`Processing page ${i} of ${numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';

      // Generate embedding for pageText
      const embedding = await generateEmbedding(pageText);

      await embeddingsCollection.insertOne({
        content: pageText,
        embedding: embedding,
        metadata: {
          pageNumber: i,
          documentId,
          fileType: 'pdf',
          createdAt: new Date()
        },
        _id: new ObjectId()
      });
    }

    // Store the full text of the document
    const documentsCollection = db.collection('documents');
    await documentsCollection.updateOne(
      { documentId },
      { $set: { fullText, createdAt: new Date() } },
      { upsert: true }
    );

    console.log('Vector search setup completed for document:', documentId);
  } catch (error) {
    console.error('Error in setupVectorSearch:', error);
    throw error;
  }
}

export async function insertEmbedding(content: string, embedding: number[], metadata: Omit<EmbeddingDocument['metadata'], 'createdAt'>) {
  const db = client.db('pdf_database');
  const embeddingsCollection = db.collection<EmbeddingDocument>('embeddings');

  await embeddingsCollection.insertOne({
    content,
    embedding,
    metadata: { ...metadata, createdAt: new Date() },
    _id: new ObjectId()
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function vectorSearch(queryEmbedding: number[], limit: number = 5, documentId?: string) {
  const db = client.db('pdf_database');
  const embeddingsCollection = db.collection<EmbeddingDocument>('embeddings');

  let pipeline = [];

  if (documentId) {
    pipeline.push({ $match: { "metadata.documentId": documentId } });
  }

  pipeline.push({
    $addFields: {
      similarity: {
        $reduce: {
          input: { $range: [0, { $size: "$embedding" }] },
          initialValue: 0,
          in: {
            $add: [
              "$$value",
              { $multiply: [{ $arrayElemAt: ["$embedding", "$$this"] }, { $arrayElemAt: [queryEmbedding, "$$this"] }] }
            ]
          }
        }
      }
    }
  });

  pipeline.push({ $sort: { similarity: -1 } });
  pipeline.push({ $limit: limit });

  pipeline.push({
    $project: {
      content: 1,
      metadata: 1,
      score: "$similarity"
    }
  });

  const results = await embeddingsCollection.aggregate(pipeline).toArray();
  return results;
}

export async function wordSearch(query: string, limit: number = 5, documentId?: string) {
  const db = client.db('pdf_database');
  const embeddingsCollection = db.collection<EmbeddingDocument>('embeddings');

  const filter = documentId ? { "metadata.documentId": documentId, $text: { $search: query } } : { $text: { $search: query } };

  const results = await embeddingsCollection.find(
    filter,
    { projection: { content: 1, metadata: 1, score: { $meta: "textScore" } } }
  ).sort({ score: { $meta: "textScore" } }).limit(limit).toArray();

  return results;
}

export async function storeSystemPrompt(documentId: string, prompt: string) {
  const db = client.db('pdf_database');
  const systemPromptsCollection = db.collection<SystemPrompt>('system_prompts');

  await systemPromptsCollection.updateOne(
    { documentId },
    { $set: { prompt, createdAt: new Date() } },
    { upsert: true }
  );
}

export async function getSystemPrompt(documentId: string): Promise<string | null> {
  const db = client.db('pdf_database');
  const systemPromptsCollection = db.collection<SystemPrompt>('system_prompts');

  const result = await systemPromptsCollection.findOne({ documentId });
  return result ? result.prompt : null;
}

export async function getDocumentContent(documentId: string): Promise<string | null> {
  const db = client.db('pdf_database');
  const documentsCollection = db.collection('documents');

  const document = await documentsCollection.findOne({ documentId });
  return document ? document.fullText : null;
}

export async function closeConnection() {
  try {
    await client.close();
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
}

export async function storeNote(note: Omit<Note, '_id' | 'createdAt' | 'updatedAt'>) {
  const db = client.db('pdf_database');
  const notesCollection = db.collection<Note>('notes');

  const now = new Date();
  await notesCollection.insertOne({
    ...note,
    _id: new ObjectId(),
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateStreamNote(documentId: string, content: string, previousContent: string, streamPosition: number) {
  const db = client.db('pdf_database');
  const streamNotesCollection = db.collection<StreamNote>('stream_notes');

  const now = new Date();
  await streamNotesCollection.updateOne(
    { documentId },
    {
      $set: {
        content,
        previousContent,
        streamPosition,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

export async function getLatestStreamNote(documentId: string): Promise<StreamNote | null> {
  const db = client.db('pdf_database');
  const streamNotesCollection = db.collection<StreamNote>('stream_notes');

  return streamNotesCollection.findOne({ documentId }, { sort: { streamPosition: -1 } });
}

export async function getNotes(documentId: string, sectionId?: string): Promise<Note[]> {
  const db = client.db('pdf_database');
  const notesCollection = db.collection<Note>('notes');

  const query = sectionId ? { documentId, sectionId } : { documentId };
  return notesCollection.find(query).sort({ createdAt: 1 }).toArray();
}

export async function storeLectureNote(note: Omit<LectureNote, '_id' | 'createdAt' | 'updatedAt'>) {
  const db = client.db('pdf_database');
  const lectureNotesCollection = db.collection<LectureNote>('lecture_notes');

  const now = new Date();
  await lectureNotesCollection.insertOne({
    ...note,
    _id: new ObjectId(),
    createdAt: now,
    updatedAt: now,
  });
}

export async function getLectureNotes(lectureId: string): Promise<LectureNote[]> {
  const db = client.db('pdf_database');
  const lectureNotesCollection = db.collection<LectureNote>('lecture_notes');

  return lectureNotesCollection.find({ lectureId }).sort({ createdAt: 1 }).toArray();
}
