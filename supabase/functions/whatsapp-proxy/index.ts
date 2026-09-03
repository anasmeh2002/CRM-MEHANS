// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = Deno.env.get("NEXT_PUBLIC_EVOLUTION_API_KEY") || Deno.env.get("EVOLUTION_API_KEY");
  if (apiKey) headers["apikey"] = apiKey;
  return headers;
}

function getBaseUrl(): string {
  return Deno.env.get("NEXT_PUBLIC_EVOLUTION_API_URL") || Deno.env.get("EVOLUTION_API_URL") || "";
}

async function parseJsonSafe(res: Response): Promise<any | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logAction(action: string, method: string, url: string, status?: number) {
  const safeUrl = url.replace(/apikey=[^&]+/, "apikey=***");
  if (status !== undefined) {
    console.log(`[whatsapp-proxy] ${action} ${method} ${safeUrl} -> ${status}`);
  } else {
    console.log(`[whatsapp-proxy] ${action} ${method} ${safeUrl}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return jsonResponse({ success: false, error: "Evolution API URL not configured" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" });
  }

  const { action, userId, instanceName } = body;
  if (!action) return jsonResponse({ success: false, error: "Missing action" });

  const name = instanceName || (userId ? `instance_${userId}` : "");

  try {
    if (action === "check-status") {
      if (!name) return jsonResponse({ success: false, error: "Missing instanceName or userId" });

      const statusUrl = `${baseUrl}/instance/connectionState/${name}`;
      logAction("check-status", "GET", statusUrl);
      const statusRes = await fetch(statusUrl, { method: "GET", headers: buildHeaders() });
      logAction("check-status", "GET", statusUrl, statusRes.status);

      if (!statusRes.ok) {
        return jsonResponse({ success: true, status: null, instanceName: name });
      }

      const statusData = await parseJsonSafe(statusRes);
      const state = statusData?.instance?.state ?? statusData?.state ?? null;
      return jsonResponse({ success: true, status: state, instanceName: name });
    }

    if (action === "create-instance") {
      if (!userId) return jsonResponse({ success: false, error: "Missing userId" });

      const createName = `instance_${userId}`;
      const createUrl = `${baseUrl}/instance/create`;
      logAction("create-instance", "POST", createUrl);

      try {
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({
            instanceName: createName,
            token: crypto.randomUUID(),
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        });
        logAction("create-instance", "POST", createUrl, createRes.status);
      } catch (err) {
        console.error(`[whatsapp-proxy] create fetch failed:`, err);
      }

      const connectUrl = `${baseUrl}/instance/connect/${createName}`;
      logAction("create-instance", "GET", connectUrl);
      const qrRes = await fetch(connectUrl, { method: "GET", headers: buildHeaders() });
      logAction("create-instance", "GET", connectUrl, qrRes.status);

      if (!qrRes.ok) {
        const rawBody = await qrRes.text().catch(() => "");
        return jsonResponse({ success: false, error: `Evolution API returned ${qrRes.status}: ${rawBody.slice(0, 500)}` });
      }

      const qrData = await parseJsonSafe(qrRes);
      if (!qrData) return jsonResponse({ success: false, error: "Response was not JSON" });

      let rawQr: string | null = null;
      if (typeof qrData.base64 === "string" && qrData.base64) rawQr = qrData.base64;
      else if (typeof qrData.code === "string" && qrData.code) rawQr = qrData.code;
      else if (typeof qrData.qrcode === "string" && qrData.qrcode) rawQr = qrData.qrcode;

      if (!rawQr) return jsonResponse({ success: false, error: "No QR code field in response" });

      const qrCode = rawQr.startsWith("data:image/") ? rawQr : `data:image/png;base64,${rawQr}`;
      return jsonResponse({ success: true, instanceName: createName, qrCode });
    }

    if (action === "get-qr") {
      if (!instanceName) return jsonResponse({ success: false, error: "Missing instanceName" });

      const connectUrl = `${baseUrl}/instance/connect/${instanceName}`;
      logAction("get-qr", "GET", connectUrl);
      const qrRes = await fetch(connectUrl, { method: "GET", headers: buildHeaders() });
      logAction("get-qr", "GET", connectUrl, qrRes.status);

      if (!qrRes.ok) {
        const rawBody = await qrRes.text().catch(() => "");
        return jsonResponse({ success: false, error: `Evolution API returned ${qrRes.status}: ${rawBody.slice(0, 500)}` });
      }

      const qrData = await parseJsonSafe(qrRes);
      if (!qrData) return jsonResponse({ success: false, error: "Response was not JSON" });

      let rawQr: string | null = null;
      if (typeof qrData.base64 === "string" && qrData.base64) rawQr = qrData.base64;
      else if (typeof qrData.code === "string" && qrData.code) rawQr = qrData.code;
      else if (typeof qrData.qrcode === "string" && qrData.qrcode) rawQr = qrData.qrcode;

      if (!rawQr) return jsonResponse({ success: false, error: "No QR code field in response" });

      const qrCode = rawQr.startsWith("data:image/") ? rawQr : `data:image/png;base64,${rawQr}`;
      return jsonResponse({ success: true, instanceName, qrCode });
    }

    if (action === "find-chats") {
      if (!name) return jsonResponse({ success: false, error: "Missing instanceName or userId" });

      const chatsUrl = `${baseUrl}/chat/findChats/${name}`;
      logAction("find-chats", "POST", chatsUrl);
      const chatsRes = await fetch(chatsUrl, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({}),
      });
      logAction("find-chats", "POST", chatsUrl, chatsRes.status);

      if (!chatsRes.ok) {
        const details = (await chatsRes.text().catch(() => "")).slice(0, 500);
        console.error(`[whatsapp-proxy] find-chats failed: ${chatsRes.status} ${details}`);
        return jsonResponse({ success: false, error: `Evolution API returned ${chatsRes.status}: ${details}` });
      }

      const chatsData = await parseJsonSafe(chatsRes);
      const chats = Array.isArray(chatsData) ? chatsData : Array.isArray(chatsData?.chats) ? chatsData.chats : [];
      return jsonResponse({ success: true, conversations: chats });
    }

    if (action === "find-contacts") {
      if (!name) return jsonResponse({ success: false, error: "Missing instanceName or userId" });

      const contactsUrl = `${baseUrl}/chat/findContacts/${name}`;
      logAction("find-contacts", "POST", contactsUrl);
      const contactsRes = await fetch(contactsUrl, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({}),
      });
      logAction("find-contacts", "POST", contactsUrl, contactsRes.status);

      if (!contactsRes.ok) return jsonResponse({ success: true, contacts: [] });

      const contactsData = await parseJsonSafe(contactsRes);
      const contacts = Array.isArray(contactsData) ? contactsData : Array.isArray(contactsData?.contacts) ? contactsData.contacts : [];
      return jsonResponse({ success: true, contacts });
    }

    if (action === "find-messages") {
      const { remoteJid } = body;
      if (!name || !remoteJid) return jsonResponse({ success: false, error: "Missing instanceName or remoteJid" });

      const msgUrl = `${baseUrl}/chat/findMessages/${name}`;
      logAction("find-messages", "POST", msgUrl);
      const msgRes = await fetch(msgUrl, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          where: { key: { remoteJid } },
          page: 1,
          offset: 100,
        }),
      });
      logAction("find-messages", "POST", msgUrl, msgRes.status);

      if (!msgRes.ok) {
        const details = (await msgRes.text().catch(() => "")).slice(0, 500);
        console.error(`[whatsapp-proxy] find-messages failed: ${msgRes.status} ${details}`);
        return jsonResponse({ success: false, error: `Evolution API returned ${msgRes.status}: ${details}` });
      }

      const msgData = await parseJsonSafe(msgRes);
      const messageContainer = msgData && typeof msgData.messages === "object" ? msgData.messages : null;
      const messages = Array.isArray(msgData?.messages)
        ? msgData.messages
        : Array.isArray(messageContainer?.records)
          ? messageContainer.records
          : Array.isArray(messageContainer?.messages)
            ? messageContainer.messages
            : Array.isArray(msgData)
              ? msgData
              : [];
      return jsonResponse({ success: true, messages });
    }

    if (action === "send-text") {
      const { remoteJid, phoneNumber, text } = body;
      if (!name || !remoteJid || !text) return jsonResponse({ success: false, error: "Missing instanceName, remoteJid, or text" });

      const number = typeof phoneNumber === "string" && phoneNumber.length > 0
        ? phoneNumber.replace(/[^0-9]/g, "")
        : remoteJid.split("@")[0];
      if (!number || remoteJid.endsWith("@lid") && !phoneNumber) {
        return jsonResponse({ success: false, error: "This WhatsApp contact has no resolved phone number yet. Refresh contacts and try again." });
      }
      const sendUrl = `${baseUrl}/message/sendText/${name}`;
      logAction("send-text", "POST", sendUrl);
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          number,
          text,
          delay: 0,
          linkPreview: true,
        }),
      });
      logAction("send-text", "POST", sendUrl, sendRes.status);

      if (!sendRes.ok) {
        const rawBody = await sendRes.text().catch(() => "");
        console.error(`[whatsapp-proxy] send-text failed: ${sendRes.status} ${rawBody.slice(0, 500)}`);
        return jsonResponse({ success: false, error: `Evolution API rejected the message: ${sendRes.status} — ${rawBody.slice(0, 500)}` });
      }

      const sendData = await parseJsonSafe(sendRes);
      return jsonResponse({ success: true, key: sendData?.key ?? null });
    }

    if (action === "send-media") {
      const { remoteJid, phoneNumber, mediatype, mimetype, media, fileName, caption } = body;
      if (!name || !remoteJid || !mediatype || !media) return jsonResponse({ success: false, error: "Missing instanceName, remoteJid, mediatype, or media" });

      const number = typeof phoneNumber === "string" && phoneNumber.length > 0
        ? phoneNumber.replace(/[^0-9]/g, "")
        : remoteJid.split("@")[0];
      if (!number || remoteJid.endsWith("@lid") && !phoneNumber) {
        return jsonResponse({ success: false, error: "This WhatsApp contact has no resolved phone number yet. Refresh contacts and try again." });
      }
      const sendUrl = `${baseUrl}/message/sendMedia/${name}`;
      logAction("send-media", "POST", sendUrl);
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          number,
          mediatype,
          mimetype,
          media,
          fileName: fileName || "file",
          caption: caption || "",
          delay: 0,
        }),
      });
      logAction("send-media", "POST", sendUrl, sendRes.status);

      if (!sendRes.ok) {
        const rawBody = await sendRes.text().catch(() => "");
        console.error(`[whatsapp-proxy] send-media failed: ${sendRes.status} ${rawBody.slice(0, 500)}`);
        return jsonResponse({ success: false, error: `Evolution API rejected the media: ${sendRes.status} — ${rawBody.slice(0, 500)}` });
      }

      const sendData = await parseJsonSafe(sendRes);
      return jsonResponse({ success: true, key: sendData?.key ?? null });
    }

    if (action === "logout") {
      if (!name) return jsonResponse({ success: false, error: "Missing instanceName or userId" });

      const logoutUrl = `${baseUrl}/instance/logout/${name}`;
      logAction("logout", "DELETE", logoutUrl);
      const logoutRes = await fetch(logoutUrl, { method: "DELETE", headers: buildHeaders() });
      logAction("logout", "DELETE", logoutUrl, logoutRes.status);

      if (!logoutRes.ok) {
        const rawBody = await logoutRes.text().catch(() => "");
        console.error(`[whatsapp-proxy] logout failed: ${logoutRes.status} ${rawBody.slice(0, 500)}`);
        return jsonResponse({ success: false, error: `Evolution API returned ${logoutRes.status}: ${rawBody.slice(0, 500)}` });
      }

      return jsonResponse({ success: true, instanceName: name });
    }

    return jsonResponse({ success: false, error: "Unknown action" });
  } catch (err) {
    console.error(`[whatsapp-proxy] Unhandled error:`, err);
    const message = err instanceof Error ? err.message : "Failed to connect to Evolution API";
    return jsonResponse({ success: false, error: message });
  }
});
