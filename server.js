const fastify = require("fastify")({
  logger: { level: "error" }
});

const path = require("path");
const fs = require("fs").promises;
const fssync = require("fs");
const fastifyStatic = require("@fastify/static");
const { Server } = require("socket.io");

const videoSaveDir = path.join(__dirname, "date");
const videoSavePath = path.join(videoSaveDir, "date.json");

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

const PORT = process.env.PORT || 3000;


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

  const newVideo = {
    ...videoInfo,
    viewCount: 0,
    date: videoInfo.date || new Date().toISOString().split('T')[0] // 日付がない場合は今日の日付を設定
  };

  videos.push(newVideo);
  await fs.writeFile(videoSavePath, JSON.stringify(videos, null, 2));

  io.emit("update-videos");
  return newVideo;
}

async function incrementViewCount(videoId) {
  try {
    const data = await fs.readFile(videoSavePath, 'utf8');
    let videos = JSON.parse(data);
    
    const videoIndex = videos.findIndex(v => {
      const idFromUrl = extractVideoId(v.url);
      return idFromUrl === videoId;
    });
    
    if (videoIndex === -1) {
      return null;
    }
    
    videos[videoIndex].viewCount = (videos[videoIndex].viewCount || 0) + 1;
    
    await fs.writeFile(videoSavePath, JSON.stringify(videos, null, 2));
    
    io.emit('view-count-updated', {
      videoId: videoId,
      viewCount: videos[videoIndex].viewCount
    });
    
    return videos[videoIndex].viewCount;
  } catch (err) {
    console.error('視聴回数更新エラー:', err);
    throw err;
  }
}

async function getVideoStats(videoId) {
  try {
    const data = await fs.readFile(videoSavePath, 'utf8');
    const videos = JSON.parse(data);
    
    const video = videos.find(v => {
      const idFromUrl = extractVideoId(v.url);
      return idFromUrl === videoId;
    });
    
    if (!video) {
      return null;
    }
    
    return {
      viewCount: video.viewCount || 0,
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.error('動画統計取得エラー:', err);
    throw err;
  }
}

// ルート設定
fastify.get("/version.json", async (request, reply) => {
  reply.send({ version: "v1.2.6-glitch" }); 
});

fastify.get("/date/date.json", async (request, reply) => {
  try {
    const jsonStr = await fs.readFile(videoSavePath, "utf8");
    let data = JSON.parse(jsonStr);
    
    data = data.map(video => ({
      ...video,
      viewCount: video.viewCount || 0
    }));
    
    // 日付でソート（新しい順）
    data.sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    reply.send(data);
  } catch (e) {
    reply.status(500).send({ error: "動画データ読み込み失敗" });
  }
});

fastify.get("/api/videos/:id/stats", async (request, reply) => {
  const videoId = request.params.id;
  
  try {
    const stats = await getVideoStats(videoId);
    
    if (!stats) {
      return reply.status(404).send({ error: '動画が見つかりません' });
    }
    
    reply.send(stats);
  } catch (err) {
    reply.status(500).send({ error: '統計情報の取得に失敗しました' });
  }
});

fastify.post("/api/videos/:id/view", async (request, reply) => {
  const videoId = request.params.id;
  
  try {
    const newViewCount = await incrementViewCount(videoId);
    
    if (newViewCount === null) {
      return reply.status(404).send({ error: '動画が見つかりません' });
    }
    
    reply.send({ 
      success: true,
      viewCount: newViewCount
    });
  } catch (err) {
    reply.status(500).send({ error: '視聴回数の更新に失敗しました' });
  }
});

// サーバー起動
const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();

// Socket.IO設定
const io = new Server(fastify.server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  socket.on("save-video", async (videoInfo) => {
    if (!videoInfo.title || !videoInfo.url) {
      socket.emit("save-video-error", { error: "タイトルとURLは必須です" });
      return;
    }
    try {
      const savedVideo = await saveVideoInfo(videoInfo);
      socket.emit("save-video-success", { message: "動画情報が保存されました", video: savedVideo });
    } catch (e) {
      socket.emit("save-video-error", { error: "保存に失敗しました" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});
