const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use("/outputs", express.static("outputs"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");

let currentProgress = 0;

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 400 * 1024 * 1024 }
});

function generateTexts() {
  return [
    "القصة تبدأ بلحظة غير متوقعة...",
    "الأحداث تتصاعد بشكل جنوني!",
    "المواجهة الأخطر في الفيلم!",
    "المفاجأة تقلب كل شيء!",
    "النهاية كانت صادمة للجميع!"
  ];
}

app.post("/upload", upload.single("video"), (req, res) => {

  const folder = Date.now().toString();
  fs.mkdirSync(`outputs/${folder}`);

  const texts = generateTexts();
  fs.writeFileSync(`outputs/${folder}/texts.json`, JSON.stringify(texts));

  fs.renameSync(req.file.path, `uploads/${folder}.mp4`);

  res.redirect(`/edit-texts.html?folder=${folder}`);
});

app.get("/progress", (req, res) => {
  res.json({ percent: currentProgress });
});

app.post("/render-summary", (req, res) => {

  const { folder, texts } = req.body;
  currentProgress = 0;

  const inputPath = `uploads/${folder}.mp4`;
  const outputPath = `outputs/${folder}/final_summary.mp4`;

  const colors = ["#00BFFF", "#FFA500", "#FF2D2D", "#A020F0", "#FFFFFF"];

  const drawFilters = texts.map((t, i) => {

    const start = i * 180;
    const end = start + 20;
    const color = colors[i % colors.length];

    return `
    drawtext=fontfile=fonts/Cairo-Bold.ttf:
    text='${t}':
    fontcolor=${color}@0.4:
    fontsize=75:
    x=(w-text_w)/2:
    y=if(lt(t,${start+1}),h, h-120-(t-${start})*30):
    enable='between(t,${start},${end})',

    drawtext=fontfile=fonts/Cairo-Bold.ttf:
    text='${t}':
    fontcolor=${color}:
    fontsize=60:
    borderw=4:
    bordercolor=black:
    box=1:
    boxcolor=black@0.5:
    x=(w-text_w)/2:
    y=if(lt(t,${start+1}),h, h-120-(t-${start})*30):
    enable='between(t,${start},${end})',

    fade=t=in:st=${start}:d=0.4,
    fade=t=out:st=${end-1}:d=0.8
    `;

  }).join(",");

  ffmpeg(inputPath)
    .videoFilters([
      "select='gt(scene,0.35)',setpts=N/FRAME_RATE/TB",
      "scale=1280:-1",
      "setpts=0.9*PTS",
      drawFilters
    ])
    .outputOptions([
      "-t 900",
      "-an",
      "-vsync vfr",
      "-c:v libx264",
      "-preset veryfast",
      "-crf 23"
    ])
    .on("progress", (progress) => {
      if (progress.percent) {
        currentProgress = Math.round(progress.percent);
      }
    })
    .on("end", () => {
      currentProgress = 100;
      res.json({ success: true });
    })
    .on("error", () => {
      res.json({ success: false });
    })
    .save(outputPath);

});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server Running...")
);
