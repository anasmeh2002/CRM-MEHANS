import { NextRequest, NextResponse } from 'next/server';

const EVOLUTION_API_URL =
  process.env.NEXT_PUBLIC_EVOLUTION_API_URL ||
  process.env.EVOLUTION_API_URL ||
  '';
const EVOLUTION_API_KEY =
  process.env.NEXT_PUBLIC_EVOLUTION_API_KEY ||
  process.env.EVOLUTION_API_KEY ||
  '';

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (EVOLUTION_API_KEY) headers['apikey'] = EVOLUTION_API_KEY;
  return headers;
}

async function parseJsonSafe(res: Response): Promise<any | null> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function errorResponse(status: number, evolutionStatus: number | null, rawBody: string): Promise<NextResponse> {
  const error =
    evolutionStatus !== null
      ? `Evolution API returned status ${evolutionStatus}: ${rawBody.slice(0, 500)}`
      : rawBody || 'Failed to connect to Evolution API';
  console.error(`[whatsapp-proxy] ${error}`);
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('[whatsapp-proxy] Missing environment variables', {
      hasUrl: !!EVOLUTION_API_URL,
      hasKey: !!EVOLUTION_API_KEY,
    });
    return NextResponse.json(
      { success: false, error: 'Missing Environment Variables' },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { action, userId, instanceName } = body;

  if (!action) {
    return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 });
  }

  try {
    if (action === 'create-instance') {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
      }

      const name = `instance_${userId}`;
      const createUrl = `${EVOLUTION_API_URL}/instance/create`;
      console.log(`[whatsapp-proxy] POST ${createUrl} (instance: ${name})`);

      try {
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({
            instanceName: name,
            token: crypto.randomUUID(),
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });
        console.log(`[whatsapp-proxy] create status: ${createRes.status}`);
        if (!createRes.ok && createRes.status !== 400 && createRes.status !== 403 && createRes.status !== 409) {
          const rawBody = await createRes.text().catch(() => '');
          return errorResponse(502, createRes.status, rawBody);
        }
      } catch (err) {
        console.error('[whatsapp-proxy] create fetch failed:', err);
      }

      const connectUrl = `${EVOLUTION_API_URL}/instance/connect/${name}`;
      console.log(`[whatsapp-proxy] GET ${connectUrl}`);
      const qrRes = await fetch(connectUrl, { method: 'GET', headers: buildHeaders() });
      console.log(`[whatsapp-proxy] connect status: ${qrRes.status}`);

      if (!qrRes.ok) {
        const rawBody = await qrRes.text().catch(() => '');
        return errorResponse(502, qrRes.status, rawBody);
      }

      const qrData = await parseJsonSafe(qrRes);
      if (!qrData) {
        return errorResponse(502, qrRes.status, 'Response was not JSON');
      }

      let rawQr: string | null = null;
      if (typeof qrData.base64 === 'string' && qrData.base64) rawQr = qrData.base64;
      else if (typeof qrData.code === 'string' && qrData.code) rawQr = qrData.code;
      else if (typeof qrData.qrcode === 'string' && qrData.qrcode) rawQr = qrData.qrcode;

      if (!rawQr) {
        return errorResponse(502, qrRes.status, 'No QR code field in response');
      }

      const qrCode = rawQr.startsWith('data:image/') ? rawQr : `data:image/png;base64,${rawQr}`;
      return NextResponse.json({ success: true, instanceName: name, qrCode });
    }

    if (action === 'get-qr') {
      if (!instanceName) {
        return NextResponse.json({ success: false, error: 'Missing instanceName' }, { status: 400 });
      }

      const connectUrl = `${EVOLUTION_API_URL}/instance/connect/${instanceName}`;
      console.log(`[whatsapp-proxy] GET ${connectUrl}`);
      const qrRes = await fetch(connectUrl, { method: 'GET', headers: buildHeaders() });
      console.log(`[whatsapp-proxy] connect status: ${qrRes.status}`);

      if (!qrRes.ok) {
        const rawBody = await qrRes.text().catch(() => '');
        return errorResponse(502, qrRes.status, rawBody);
      }

      const qrData = await parseJsonSafe(qrRes);
      if (!qrData) {
        return errorResponse(502, qrRes.status, 'Response was not JSON');
      }

      let rawQr: string | null = null;
      if (typeof qrData.base64 === 'string' && qrData.base64) rawQr = qrData.base64;
      else if (typeof qrData.code === 'string' && qrData.code) rawQr = qrData.code;
      else if (typeof qrData.qrcode === 'string' && qrData.qrcode) rawQr = qrData.qrcode;

      if (!rawQr) {
        return errorResponse(502, qrRes.status, 'No QR code field in response');
      }

      const qrCode = rawQr.startsWith('data:image/') ? rawQr : `data:image/png;base64,${rawQr}`;
      return NextResponse.json({ success: true, instanceName, qrCode });
    }

    if (action === 'check-status') {
      const name = instanceName || (userId ? `instance_${userId}` : '');
      if (!name) {
        return NextResponse.json({ success: false, error: 'Missing instanceName or userId' }, { status: 400 });
      }

      const statusUrl = `${EVOLUTION_API_URL}/instance/connectionState/${name}`;
      console.log(`[whatsapp-proxy] GET ${statusUrl}`);
      const statusRes = await fetch(statusUrl, { method: 'GET', headers: buildHeaders() });
      console.log(`[whatsapp-proxy] status: ${statusRes.status}`);

      if (!statusRes.ok) {
        return NextResponse.json({ success: true, status: null, instanceName: name });
      }

      const statusData = await parseJsonSafe(statusRes);
      const state = statusData?.instance?.state ?? statusData?.state ?? null;
      return NextResponse.json({ success: true, status: state, instanceName: name });
    }

    if (action === 'find-chats') {
      const name = instanceName || (userId ? `instance_${userId}` : '');
      if (!name) {
        return NextResponse.json({ success: false, error: 'Missing instanceName or userId' }, { status: 400 });
      }

      const chatsUrl = `${EVOLUTION_API_URL}/chat/findChats/${name}`;
      console.log(`[whatsapp-proxy] GET ${chatsUrl}`);
      let chatsRes = await fetch(chatsUrl, { method: 'GET', headers: buildHeaders() });
      console.log(`[whatsapp-proxy] chats GET status: ${chatsRes.status}`);

      if (!chatsRes.ok) {
        console.log(`[whatsapp-proxy] Retrying findChats with POST`);
        chatsRes = await fetch(chatsUrl, { method: 'POST', headers: buildHeaders(), body: JSON.stringify({}) });
        console.log(`[whatsapp-proxy] chats POST status: ${chatsRes.status}`);
      }

      if (!chatsRes.ok) {
        return NextResponse.json({ success: true, conversations: [] });
      }

      const chatsData = await parseJsonSafe(chatsRes);
      const chats = Array.isArray(chatsData) ? chatsData : Array.isArray(chatsData?.chats) ? chatsData.chats : [];
      return NextResponse.json({ success: true, conversations: chats });
    }

    if (action === 'find-messages') {
      const { remoteJid } = body;
      if (!instanceName || !remoteJid) {
        return NextResponse.json({ success: false, error: 'Missing instanceName or remoteJid' }, { status: 400 });
      }

      const msgUrl = `${EVOLUTION_API_URL}/chat/findMessages/${instanceName}?remoteJid=${encodeURIComponent(remoteJid)}&limit=100`;
      console.log(`[whatsapp-proxy] GET ${msgUrl}`);
      const msgRes = await fetch(msgUrl, { method: 'GET', headers: buildHeaders() });
      console.log(`[whatsapp-proxy] messages status: ${msgRes.status}`);

      if (!msgRes.ok) {
        return NextResponse.json({ success: true, messages: [] });
      }

      const msgData = await parseJsonSafe(msgRes);
      const messages = Array.isArray(msgData?.messages) ? msgData.messages : Array.isArray(msgData) ? msgData : [];
      return NextResponse.json({ success: true, messages });
    }

    if (action === 'send-text') {
      const { remoteJid, text } = body;
      if (!instanceName || !remoteJid || !text) {
        return NextResponse.json({ success: false, error: 'Missing instanceName, remoteJid, or text' }, { status: 400 });
      }

      const sendUrl = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
      console.log(`[whatsapp-proxy] POST ${sendUrl}`);
      const sendRes = await fetch(sendUrl, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          number: remoteJid.split('@')[0],
          options: { delay: 0, presence: 'available' },
          textMessage: { text },
        }),
      });
      console.log(`[whatsapp-proxy] send status: ${sendRes.status}`);

      if (!sendRes.ok) {
        const rawBody = await sendRes.text().catch(() => '');
        return errorResponse(502, sendRes.status, rawBody);
      }

      const sendData = await parseJsonSafe(sendRes);
      return NextResponse.json({ success: true, key: sendData?.key ?? null });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[whatsapp-proxy] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Failed to connect to Evolution API';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
