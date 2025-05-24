const fastify = require("fastify")({
  logger: true,
});
const path = require("path");
const fs = require("fs").promises;
const fssync = require("fs");
const fastifyStatic = require("@fastify/static");
const { Server } = require("socket.io");

// 保存用ディレクトリとファイルパス
const videoSaveDir = path.join(__dirname, "date");
const videoSavePath = path.join(videoSaveDir, "date.json");

// 静的ファイル用 public フォルダ設定
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/", // ルート配下に公開
});

// Render等で使うポート指定
const PORT = process.env.PORT || 3000;

// ディレクトリ・ファイルの存在確認と初期化
async function ensureDirectoryAndFile() {
  if (!fssync.existsSync(videoSaveDir)) {
    await fs.mkdir(videoSaveDir);
  }

  try {
    await fs.access(videoSavePath);
  } catch {
    // ファイルがなければ空配列で初期化
    await fs.writeFile(videoSavePath, "[]", "utf8");
  }
}

// 動画情報の保存処理
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

  // クライアント全員に通知
  io.emit("update-videos");
}

// 動的に動画データを返すAPIエンドポイント
fastify.get("/date/date.json", async (request, reply) => {
  try {
    const jsonStr = await fs.readFile(videoSavePath, "utf8");
    const data = JSON.parse(jsonStr);
    reply.send(data);
  } catch (e) {
    reply.status(500).send({ error: "動画データ読み込み失敗" });
  }
});

// サーバ起動（Fastify v4/v5対応）
// listenの引数はオブジェクト指定推奨
const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();

// Socket.IOセットアップ
const io = new Server(fastify.server, {
  cors: {
    origin: "*",
  },
});

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
