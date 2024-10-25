import { NextResponse } from 'next/server';
import say from 'say';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const sayPromise = promisify(say.export);

export async function POST(request: Request) {
  const { text, voice = 'Alex', speed = 1.0 } = await request.json();

  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  try {
    // Generate a unique filename for this audio
    const filename = path.join(os.tmpdir(), `tts_${Date.now()}.wav`);

    // Generate the audio file
    await sayPromise(text, voice, speed, filename);

    // Read the generated audio file
    const audioBuffer = await fs.promises.readFile(filename);

    // Delete the temporary file
    await fs.promises.unlink(filename);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in TTS process:', error);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}
