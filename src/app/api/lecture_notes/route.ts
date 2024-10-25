import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Create tmp directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    await mkdir(tmpDir, { recursive: true });

    // Save the file temporarily
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const filename = `${uuidv4()}.${audioFile.name.split('.').pop()}`;
    const filepath = path.join(tmpDir, filename);
    
    try {
      await writeFile(filepath, buffer);
    } catch (writeError) {
      console.error('Error writing file:', writeError);
      return NextResponse.json({ error: 'Failed to save audio file' }, { status: 500 });
    }

    // Read the audio file content
    const audioContent = await readFile(filepath, { encoding: 'base64' });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = `You are an AI assistant capable of understanding audio content. 
    The following is a base64 encoded audio file of a lecture. 
    Please analyze it and generate concise lecture notes in the following formats:
    1. Summary (short paragraph form)
    2. Bullet points (key points only)
    3. Cornell notes (main notes, cues, and summary)

    Audio content (base64 encoded):
    ${audioContent}

    Please format the response as a JSON object with the following structure:
    {
      "summary": "...",
      "bullet_points": ["...", "...", "..."],
      "cornell": {
        "notes": ["...", "...", "..."],
        "cues": ["...", "...", "..."],
        "summary": "..."
      }
    }

    Keep the notes brief and focused on the main points.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const notes = JSON.parse(response.text());

    // Clean up the temporary file
    await unlink(filepath);

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error in lecture_notes API:', error);
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 });
  }
}
