import { NextResponse } from 'next/server';
import textToSpeech from '@google-cloud/text-to-speech';
import { GoogleAuth } from 'google-auth-library';

const client = new textToSpeech.TextToSpeechClient({
  auth: new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  })
});

export async function POST(request: Request) {
  const { text, voice = 'en-US-Neural2-A', languageCode = 'en-US' } = await request.json();

  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  try {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode, name: voice },
      audioConfig: { audioEncoding: 'MP3' },
    });

    const audioContent = response.audioContent;

    if (!audioContent) {
      throw new Error('Failed to generate audio content');
    }

    // Convert audioContent (which is a Uint8Array) to a Buffer
    const audioBuffer = Buffer.from(audioContent);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in TTS process:', error);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}
