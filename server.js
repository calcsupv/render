const fastify = require("fastify")({ logger: true });
const path = require("path");
const fs = require("fs").promises;
const fssync = require("fs");
const fastifyStatic = require("@fastify/static");
const { Server } = require("socket.io");

// 追記: 保存用ディレクトリパス
const videoSaveDir = path.join(__dirname, "date");

// 従来のデータ読み込み用パス（別処理で使う想定）
const videoFilePath = path.join(__dirname, "data.json");

const videoSavePath = path.join(videoSaveDir, "date.json");

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
});

const PORT = 3000;

fastify.listen(PORT, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});

const io = new Server(fastify.server, {
  cors: { origin: "*" },
});

// 追加: 動的にJSON返すGETエンドポイント
fastify.get("/date/date.json", async (request, reply) => {
  try {
    const jsonStr = await fs.readFile(videoSavePath, "utf8");
    const data = JSON.parse(jsonStr);
    reply.send(data);
  } catch (e) {
    reply.status(500).send({ error: "動画データ読み込み失敗" });
  }
});

// ディレクトリがなければ作成、ファイルもなければ初期化
async function ensureDirectoryAndFile() {
  if (!fssync.existsSync(videoSaveDir)) {
    await fs.mkdir(videoSaveDir);
  }

  try {
    await fs.access(videoSavePath);
  } catch {
    await fs.writeFile(videoSavePath, "[]", "utf8");
  }
}

async function saveVideoInfo(videoInfo) {
  await ensureDirectoryAndFile();

  let videos = [];
  try {
    const data = await fs.readFile(videoSavePath, "utf8");
    videos = JSON.parse(data);
  } catch (err) {
    console.error("読み込みエラー:", err);
    throw err;
  }

  videos.push(videoInfo);
  await fs.writeFile(videoSavePath, JSON.stringify(videos, null, 2));

  console.log("動画情報が保存されました:", videoSavePath);

  // 追加: 保存成功時にクライアント全員に通知
  io.emit("update-videos");
}

io.on("connection", (socket) => {
  console.log("クライアント接続:", socket.id);

  socket.on("save-video", async (videoInfo) => {
    if (!videoInfo.title || !videoInfo.url) {
      socket.emit("save-video-error", { error: "タイトルとURLは必須です" });
      return;
    }
    try {
      await saveVideoInfo(videoInfo);
      socket.emit("save-video-success", { message: "動画情報が保存されました" });
    } catch (e) {
      console.error("保存処理エラー:", e);
      socket.emit("save-video-error", { error: "保存に失敗しました" });
    }
  });

  socket.on("disconnect", () => {
    console.log("クライアント切断:", socket.id);
  });
});
