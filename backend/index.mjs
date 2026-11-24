// Node.js 20+ Lambda behind a Function URL. CORS is configured on the Function URL (not here).
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME || "PokemonExplorer";
const reply = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function load(userId) {
  const { Items = [] } = await db.send(new QueryCommand({
    TableName: TABLE, KeyConditionExpression: "userId = :u", ExpressionAttributeValues: { ":u": userId }
  }));
  const out = { prefs: {}, mons: {} };
  for (const i of Items) {
    if (i.sk === "PREF") out.prefs = { gen: i.gen, game: i.game };
    else if (i.sk.startsWith("MON#")) out.mons[i.id] = { id: i.id, name: i.name, status: i.status };
  }
  return out;
}

export const handler = async (event) => {
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Invalid JSON" }); }
  const userId = String(b.userId || "");
  if (!/^[\w-]{8,64}$/.test(userId)) return reply(400, { error: "Invalid userId" });
  const id = Number(b.id);
  const monKey = { userId, sk: "MON#" + String(id).padStart(5, "0") };
  const validId = Number.isInteger(id) && id >= 1 && id <= 2000;

  try {
    switch (b.action) {
      case "load":
        return reply(200, await load(userId));
      case "prefs": {
        const gen = Number(b.prefs?.gen), game = String(b.prefs?.game || "").slice(0, 20);
        if (!(gen >= 1 && gen <= 9) || !/^[a-z0-9-]+$/.test(game)) return reply(400, { error: "Invalid prefs" });
        await db.send(new PutCommand({ TableName: TABLE, Item: { userId, sk: "PREF", gen, game } }));
        return reply(200, { ok: true });
      }
      case "save": {
        if (!validId || !["owned", "want"].includes(b.status) || !/^[a-z0-9-]{1,40}$/.test(String(b.name))) return reply(400, { error: "Invalid Pokémon" });
        await db.send(new PutCommand({ TableName: TABLE, Item: { ...monKey, id, name: b.name, status: b.status, updatedAt: Date.now() } }));
        return reply(200, { ok: true });
      }
      case "remove":
        if (!validId) return reply(400, { error: "Invalid id" });
        await db.send(new DeleteCommand({ TableName: TABLE, Key: monKey }));
        return reply(200, { ok: true });
      default:
        return reply(400, { error: "Unknown action" });
    }
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Server error" });
  }
};
