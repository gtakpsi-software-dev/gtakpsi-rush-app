export async function requestTranscription(audioBlob, apiKey, web = globalThis) {
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  // Preserve the recorded WebM bytes and MIME type in the upload request.
  const audioBuffer = await audioBlob.arrayBuffer();
  const formData = new web.FormData();
  const audioFile = new web.File([audioBuffer], 'recording.webm', {
    type: 'audio/webm;codecs=opus'
  });

  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const response = await web.fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.text || '';
}
